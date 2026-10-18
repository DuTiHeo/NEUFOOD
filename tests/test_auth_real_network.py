import time
import json
import subprocess
import requests

BASE_URL = "http://127.0.0.1:5000/api/v1/auth"

def run_psql(sql: str) -> str:
    """Truy vấn PostgreSQL trực tiếp qua docker compose psql."""
    cmd = [
        "docker", "compose", "exec", "-T", "database",
        "psql", "-U", "neufood_user", "-d", "neufood_db", "-t", "-A", "-c", sql
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"PSQL Error: {res.stderr}")
    return res.stdout.strip()

def run_in_backend_container(code: str) -> str:
    """Chạy lệnh python trong backend container (chỉ dùng khi cần can thiệp mock thời gian OTP hoặc kiểm tra nội bộ)."""
    cmd = ["docker", "compose", "exec", "-T", "backend", "python", "-c", code]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Backend Python Error: {res.stderr}")
    return res.stdout.strip()

results = []

def record(code, desc, expected, actual, passed):
    status = "PASS" if passed else "FAIL"
    results.append({
        "code": code,
        "desc": desc,
        "expected": expected,
        "actual": actual,
        "status": status
    })
    print(f"[{status}] {code}: {desc} | Expected: {expected} | Actual: {actual}")

def main():
    ts = int(time.time())
    print(f"Starting real network testing suite with timestamp={ts}...")

    # =========================================================================
    # LỚP 1: HAPPY PATH (Luồng Chuẩn)
    # =========================================================================
    happy_email = f"happy_{ts}@neu.edu.vn"
    happy_pass = "HappyPass123!"
    happy_phone = "0912345678"
    happy_student_id = f"SV{ts}"
    happy_name = "Nguyen Van Happy"

    # L1-01: Đăng ký tài khoản hợp lệ
    reg_payload = {
        "email": happy_email,
        "password": happy_pass,
        "full_name": happy_name,
        "phone_number": happy_phone,
        "student_id": happy_student_id
    }
    r = requests.post(f"{BASE_URL}/register", json=reg_payload)
    reg_data = r.json()
    reg_ok = (
        r.status_code == 201 and
        reg_data.get("success") is True and
        reg_data.get("data", {}).get("user", {}).get("role") == "customer" and
        bool(reg_data.get("data", {}).get("access_token"))
    )
    # DB verify
    db_user = run_psql(f"SELECT role, phone_number, student_id FROM users WHERE email='{happy_email}';")
    db_ok = db_user == f"customer|{happy_phone}|{happy_student_id}"
    record("L1-01 (UC01)", "Đăng ký tài khoản hợp lệ với email, SĐT, MSSV chuẩn",
           "HTTP 201, role='customer', có token & DB khớp",
           f"HTTP {r.status_code}, role={reg_data.get('data', {}).get('user', {}).get('role')}, DB='{db_user}'",
           reg_ok and db_ok)

    # L1-02: Đăng nhập bằng tài khoản vừa tạo
    login_payload = {"email": happy_email, "password": happy_pass}
    r = requests.post(f"{BASE_URL}/login", json=login_payload)
    login_data = r.json()
    token = login_data.get("data", {}).get("access_token")
    login_ok = (
        r.status_code == 200 and
        login_data.get("success") is True and
        bool(token) and
        login_data.get("data", {}).get("user", {}).get("email") == happy_email
    )
    db_login = run_psql(f"SELECT failed_login_attempts, locked_until IS NULL FROM users WHERE email='{happy_email}';")
    record("L1-02 (UC02)", "Đăng nhập với email và mật khẩu đúng",
           "HTTP 200, có access_token & DB reset failed=0, locked=NULL",
           f"HTTP {r.status_code}, DB='{db_login}'",
           login_ok and db_login == "0|t")

    # L1-03: Lấy thông tin tài khoản hiện tại qua /me
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{BASE_URL}/me", headers=headers)
    me_data = r.json()
    me_ok = (
        r.status_code == 200 and
        me_data.get("success") is True and
        me_data.get("data", {}).get("email") == happy_email and
        me_data.get("data", {}).get("student_id") == happy_student_id
    )
    record("L1-03 (UC03)", "Lấy thông tin tài khoản qua GET /me có Bearer token",
           "HTTP 200, đúng email và student_id của phiên đăng nhập",
           f"HTTP {r.status_code}, email={me_data.get('data', {}).get('email')}",
           me_ok)

    # L1-04: Đổi mật khẩu thành công và xác thực login mới/cũ
    new_happy_pass = "NewHappyPass456!"
    chg_payload = {"old_password": happy_pass, "new_password": new_happy_pass}
    r = requests.post(f"{BASE_URL}/change-password", headers=headers, json=chg_payload)
    chg_data = r.json()
    chg_ok = (
        r.status_code == 200 and
        chg_data.get("success") is True and
        chg_data.get("message") == "Đổi mật khẩu thành công"
    )
    # Login lại bằng pass mới
    r_new = requests.post(f"{BASE_URL}/login", json={"email": happy_email, "password": new_happy_pass})
    # Login bằng pass cũ
    r_old = requests.post(f"{BASE_URL}/login", json={"email": happy_email, "password": happy_pass})
    pass_verify_ok = (r_new.status_code == 200 and r_old.status_code == 401)
    record("L1-04 (UC05)", "Đổi mật khẩu với mật khẩu cũ hợp lệ & đăng nhập lại",
           "HTTP 200, pass mới login được (200), pass cũ bị từ chối (401)",
           f"Change: {r.status_code}, New pass login: {r_new.status_code}, Old pass login: {r_old.status_code}",
           chg_ok and pass_verify_ok)

    # L1-05: Khôi phục mật khẩu (Forgot Password -> OTP -> Reset Password)
    r_forgot = requests.post(f"{BASE_URL}/forgot-password", json={"email": happy_email})
    forgot_data = r_forgot.json()
    otp_code = forgot_data.get("data", {}).get("otp_debug")
    forgot_ok = (
        r_forgot.status_code == 200 and
        forgot_data.get("success") is True and
        bool(otp_code) and len(str(otp_code)) == 6
    )
    # Gửi reset password
    reset_pass = "ResetPassFinal789!"
    reset_payload = {
        "email": happy_email,
        "otp": otp_code,
        "new_password": reset_pass
    }
    r_reset = requests.post(f"{BASE_URL}/reset-password", json=reset_payload)
    reset_data = r_reset.json()
    reset_ok = (
        r_reset.status_code == 200 and
        reset_data.get("success") is True and
        reset_data.get("message") == "Đặt lại mật khẩu thành công"
    )
    r_login_reset = requests.post(f"{BASE_URL}/login", json={"email": happy_email, "password": reset_pass})
    db_reset = run_psql(f"SELECT failed_login_attempts, locked_until IS NULL FROM users WHERE email='{happy_email}';")
    record("L1-05 (UC05, EX-04)", "Quy trình khôi phục mật khẩu qua OTP (forgot -> reset -> login)",
           "HTTP 200 cho forgot/reset, pass mới login thành công (200), DB reset attempts=0",
           f"Forgot: {r_forgot.status_code}, Reset: {r_reset.status_code}, Login: {r_login_reset.status_code}, DB: '{db_reset}'",
           forgot_ok and reset_ok and r_login_reset.status_code == 200 and db_reset == "0|t")

    # L1-06: Đăng xuất hệ thống
    r_logout = requests.post(f"{BASE_URL}/logout", headers=headers)
    logout_data = r_logout.json()
    logout_ok = (
        r_logout.status_code == 200 and
        logout_data.get("success") is True and
        logout_data.get("message") == "Đăng xuất thành công"
    )
    record("L1-06 (UC03)", "Đăng xuất với Bearer token hợp lệ",
           "HTTP 200, message='Đăng xuất thành công'",
           f"HTTP {r_logout.status_code}, message='{logout_data.get('message')}'",
           logout_ok)

    # =========================================================================
    # LỚP 2: BOUNDARY & EDGE CASES (Điều kiện biên & Dữ liệu dị biệt)
    # =========================================================================

    # L2-01: SĐT 9 chữ số (BR-01)
    p_9 = {"email": f"phone9_{ts}@neu.edu.vn", "password": "Pass123456!", "full_name": "Test Phone", "phone_number": "091234567"}
    r = requests.post(f"{BASE_URL}/register", json=p_9)
    record("L2-01 (BR-01)", "Đăng ký với SĐT 9 chữ số ('091234567')",
           "HTTP 422 Unprocessable Entity kèm thông điệp BR-01",
           f"HTTP {r.status_code}, msg='{r.json().get('message')}'",
           r.status_code == 422 and "BR-01" in r.json().get("message", ""))

    # L2-02: SĐT 11 chữ số (BR-01)
    p_11 = {"email": f"phone11_{ts}@neu.edu.vn", "password": "Pass123456!", "full_name": "Test Phone", "phone_number": "09123456789"}
    r = requests.post(f"{BASE_URL}/register", json=p_11)
    record("L2-02 (BR-01)", "Đăng ký với SĐT 11 chữ số ('09123456789')",
           "HTTP 422 Unprocessable Entity kèm thông điệp BR-01",
           f"HTTP {r.status_code}, msg='{r.json().get('message')}'",
           r.status_code == 422 and "BR-01" in r.json().get("message", ""))

    # L2-03: SĐT 10 chữ số không bắt đầu bằng 0 (BR-01)
    p_not0 = {"email": f"phonenot0_{ts}@neu.edu.vn", "password": "Pass123456!", "full_name": "Test Phone", "phone_number": "1912345678"}
    r = requests.post(f"{BASE_URL}/register", json=p_not0)
    record("L2-03 (BR-01)", "Đăng ký với SĐT 10 số nhưng không bắt đầu bằng 0 ('1912345678')",
           "HTTP 422 Unprocessable Entity kèm thông điệp BR-01",
           f"HTTP {r.status_code}, msg='{r.json().get('message')}'",
           r.status_code == 422 and "BR-01" in r.json().get("message", ""))

    # L2-04: SĐT chứa ký tự chữ (BR-01)
    p_char = {"email": f"phonechar_{ts}@neu.edu.vn", "password": "Pass123456!", "full_name": "Test Phone", "phone_number": "091234567a"}
    r = requests.post(f"{BASE_URL}/register", json=p_char)
    record("L2-04 (BR-01)", "Đăng ký với SĐT chứa chữ ('091234567a')",
           "HTTP 422 Unprocessable Entity kèm thông điệp BR-01",
           f"HTTP {r.status_code}, msg='{r.json().get('message')}'",
           r.status_code == 422 and "BR-01" in r.json().get("message", ""))

    # L2-05: student_id="" chuẩn hóa về None, không bị báo trùng khi nhiều user cùng để rỗng
    p_null_1 = {"email": f"nostudent1_{ts}@neu.edu.vn", "password": "Pass123456!", "full_name": "No Student 1", "phone_number": "0911112222", "student_id": ""}
    p_null_2 = {"email": f"nostudent2_{ts}@neu.edu.vn", "password": "Pass123456!", "full_name": "No Student 2", "phone_number": "0933334444", "student_id": ""}
    r1 = requests.post(f"{BASE_URL}/register", json=p_null_1)
    r2 = requests.post(f"{BASE_URL}/register", json=p_null_2)
    db_s1 = run_psql(f"SELECT student_id IS NULL FROM users WHERE email='{p_null_1['email']}';")
    db_s2 = run_psql(f"SELECT student_id IS NULL FROM users WHERE email='{p_null_2['email']}';")
    both_created = (r1.status_code == 201 and r2.status_code == 201 and db_s1 == "t" and db_s2 == "t")
    record("L2-05 (BR-01)", "Đăng ký 2 tài khoản với student_id='' (chuẩn hóa về NULL trong DB, không xung đột)",
           "Cả 2 đều HTTP 201 Created và DB student_id IS NULL",
           f"User1: HTTP {r1.status_code} (DB={db_s1}), User2: HTTP {r2.status_code} (DB={db_s2})",
           both_created)

    # L2-06: Đăng nhập sai 5 lần liên tiếp -> Khóa 15 phút (BR-02, EX-02)
    lock_email = f"lockuser_{ts}@neu.edu.vn"
    lock_pass = "LockCorrectPass123!"
    requests.post(f"{BASE_URL}/register", json={
        "email": lock_email, "password": lock_pass, "full_name": "Lock Target", "phone_number": "0955556666"
    })
    statuses = []
    for i in range(1, 5):
        r_fail = requests.post(f"{BASE_URL}/login", json={"email": lock_email, "password": "WrongPassword!"})
        statuses.append(r_fail.status_code)
    # Lần thứ 5 sai:
    r_5th = requests.post(f"{BASE_URL}/login", json={"email": lock_email, "password": "WrongPassword!"})
    db_lock = run_psql(f"SELECT failed_login_attempts, (locked_until > NOW()) FROM users WHERE email='{lock_email}';")
    lock_ok = (
        statuses == [401, 401, 401, 401] and
        r_5th.status_code == 403 and
        "EX-02" in r_5th.json().get("message", "") and
        db_lock == "5|t"
    )
    record("L2-06 (BR-02, EX-02)", "Đăng nhập sai mật khẩu 5 lần liên tiếp",
           "Lần 1..4: 401, Lần 5: 403 (EX-02) & DB: failed=5, locked_until > now",
           f"Lần 1..4: {statuses}, Lần 5: HTTP {r_5th.status_code}, DB='{db_lock}'",
           lock_ok)

    # L2-07: Đăng nhập bằng MẬT KHẨU ĐÚNG khi đang trong 15 phút khóa (EX-02)
    r_correct_while_locked = requests.post(f"{BASE_URL}/login", json={"email": lock_email, "password": lock_pass})
    correct_blocked = (
        r_correct_while_locked.status_code == 403 and
        "EX-02" in r_correct_while_locked.json().get("message", "")
    )
    record("L2-07 (BR-02, EX-02)", "Đăng nhập bằng MẬT KHẨU ĐÚNG khi tài khoản đang bị khóa 15 phút",
           "HTTP 403 Forbidden kèm thông điệp EX-02 (vẫn bị chặn dù mật khẩu đúng)",
           f"HTTP {r_correct_while_locked.status_code}, msg='{r_correct_while_locked.json().get('message')}'",
           correct_blocked)

    # L2-08: Mở khóa ngay lập tức qua reset password OTP (BR-02, UC05)
    r_forgot_locked = requests.post(f"{BASE_URL}/forgot-password", json={"email": lock_email})
    otp_locked = r_forgot_locked.json().get("data", {}).get("otp_debug")
    new_unlocked_pass = "UnlockedNewPass999!"
    r_reset_locked = requests.post(f"{BASE_URL}/reset-password", json={
        "email": lock_email, "otp": otp_locked, "new_password": new_unlocked_pass
    })
    r_login_unlocked = requests.post(f"{BASE_URL}/login", json={
        "email": lock_email, "password": new_unlocked_pass
    })
    db_unlocked = run_psql(f"SELECT failed_login_attempts, locked_until IS NULL FROM users WHERE email='{lock_email}';")
    unlock_ok = (
        r_reset_locked.status_code == 200 and
        r_login_unlocked.status_code == 200 and
        db_unlocked == "0|t"
    )
    record("L2-08 (BR-02, UC05)", "Mở khóa tài khoản bị khóa 15 phút ngay lập tức qua Reset Password OTP",
           "Reset OTP thành công (200), pass mới đăng nhập được ngay (200), DB reset về 0|t",
           f"Reset: HTTP {r_reset_locked.status_code}, Login mới: HTTP {r_login_unlocked.status_code}, DB='{db_unlocked}'",
           unlock_ok)

    # L2-09: Giới hạn gửi mã OTP tối đa 3 lần/ngày/email (EX-04)
    otp_user = f"otplimit_{ts}@neu.edu.vn"
    requests.post(f"{BASE_URL}/register", json={
        "email": otp_user, "password": "Pass123456!", "full_name": "OTP Limit", "phone_number": "0977889900"
    })
    r_otp1 = requests.post(f"{BASE_URL}/forgot-password", json={"email": otp_user})
    r_otp2 = requests.post(f"{BASE_URL}/forgot-password", json={"email": otp_user})
    r_otp3 = requests.post(f"{BASE_URL}/forgot-password", json={"email": otp_user})
    r_otp4 = requests.post(f"{BASE_URL}/forgot-password", json={"email": otp_user})
    otp_limit_ok = (
        r_otp1.status_code == 200 and r_otp1.json().get("data", {}).get("daily_count") == 1 and
        r_otp2.status_code == 200 and r_otp2.json().get("data", {}).get("daily_count") == 2 and
        r_otp3.status_code == 200 and r_otp3.json().get("data", {}).get("daily_count") == 3 and
        r_otp4.status_code == 400 and "EX-04" in r_otp4.json().get("message", "")
    )
    record("L2-09 (EX-04)", "Giới hạn gửi mã OTP tối đa 3 lần/ngày (lần 1..3 thành công, lần 4 bị chặn 400)",
           "Lần 1..3: HTTP 200, Lần 4: HTTP 400 kèm thông điệp EX-04",
           f"Lần 1..3: {[r_otp1.status_code, r_otp2.status_code, r_otp3.status_code]}, Lần 4: HTTP {r_otp4.status_code}, msg='{r_otp4.json().get('message')}'",
           otp_limit_ok)

    # L2-10: Nhập sai mã OTP (EX-04)
    r_bad_otp = requests.post(f"{BASE_URL}/reset-password", json={
        "email": otp_user, "otp": "999999", "new_password": "NewBadOtpPass123!"
    })
    bad_otp_ok = (
        r_bad_otp.status_code == 400 and
        "EX-04" in r_bad_otp.json().get("message", "") and
        "không chính xác" in r_bad_otp.json().get("message", "")
    )
    record("L2-10 (EX-04)", "Nhập sai mã OTP khi đặt lại mật khẩu ('999999')",
           "HTTP 400 Bad Request kèm 'Mã xác nhận OTP không chính xác (EX-04)'",
           f"HTTP {r_bad_otp.status_code}, msg='{r_bad_otp.json().get('message')}'",
           bad_otp_ok)

    # L2-11: Dùng lại mã OTP đã tiêu thụ (EX-04)
    # Lấy OTP hợp lệ từ lần 3 của otp_user
    valid_otp_3 = r_otp3.json().get("data", {}).get("otp_debug")
    r_first_use = requests.post(f"{BASE_URL}/reset-password", json={
        "email": otp_user, "otp": valid_otp_3, "new_password": "NewPassConsum1!"
    })
    r_reuse = requests.post(f"{BASE_URL}/reset-password", json={
        "email": otp_user, "otp": valid_otp_3, "new_password": "NewPassConsum2!"
    })
    reuse_ok = (
        r_first_use.status_code == 200 and
        r_reuse.status_code == 400 and
        "EX-04" in r_reuse.json().get("message", "")
    )
    record("L2-11 (EX-04)", "Dùng lại mã OTP đã tiêu thụ thành công trước đó",
           "Lần 1: 200, Lần 2 (dùng lại): 400 Bad Request (EX-04)",
           f"Lần 1: HTTP {r_first_use.status_code}, Lần 2: HTTP {r_reuse.status_code}, msg='{r_reuse.json().get('message')}'",
           reuse_ok)

    # L2-12: Mã OTP quá hạn 5 phút (EX-04) - Xác thực bằng mã OTP đã hết hạn tự nhiên trên server live
    r_test_exp = requests.post(f"{BASE_URL}/reset-password", json={
        "email": "otp_expiry_test@neu.edu.vn",
        "otp": "880726",
        "new_password": "NewExpPass123!"
    })
    exp_msg = r_test_exp.json().get("message", "")
    exp_ok = (
        r_test_exp.status_code == 400 and
        "quá 5 phút" in exp_msg and
        "EX-04" in exp_msg
    )
    record("L2-12 (EX-04)", "Mã OTP đã quá hạn 5 phút khi gửi reset-password (xác thực thời gian thực)",
           "HTTP 400 Bad Request kèm 'Mã xác nhận OTP đã hết hiệu lực (quá 5 phút). Vui lòng yêu cầu gửi lại mã OTP (EX-04)'",
           f"HTTP {r_test_exp.status_code}, msg='{exp_msg}'",
           exp_ok)

    # L2-13: Gửi payload rỗng {} hoặc non-JSON tới các endpoints (chống văng 500)
    endpoints = [
        ("POST", f"{BASE_URL}/login"),
        ("POST", f"{BASE_URL}/register"),
        ("POST", f"{BASE_URL}/change-password"),
        ("POST", f"{BASE_URL}/forgot-password"),
        ("POST", f"{BASE_URL}/reset-password"),
    ]
    empty_codes = []
    non_json_codes = []
    for method, ep in endpoints:
        r_empty = requests.post(ep, json={}, headers=headers)
        empty_codes.append(r_empty.status_code)
        r_non_json = requests.post(ep, data="not-a-json", headers={"Content-Type": "application/json", **headers})
        non_json_codes.append(r_non_json.status_code)

    payload_ok = all(c == 422 for c in empty_codes) and all(c == 400 for c in non_json_codes)
    record("L2-13 (Boundary)", "Payload rỗng {} trả 422, non-JSON trả 400 cho cả 5 endpoints (chống văng 500)",
           "Empty payload: all 422; Non-JSON: all 400; Không có lỗi 500",
           f"Empty: {empty_codes}, Non-JSON: {non_json_codes}",
           payload_ok)

    # =========================================================================
    # LỚP 3: EXCEPTIONS & RBAC (Ngoại lệ nghiệp vụ & Phân quyền)
    # =========================================================================

    # L3-01: Đăng ký trùng email đã tồn tại (EX-01)
    dup_email_payload = {
        "email": happy_email,  # đã đăng ký ở L1-01
        "password": "Pass123456!",
        "full_name": "Nguyen Van Trung",
        "phone_number": "0988776655",
        "student_id": f"SV_NEW_{ts}"
    }
    r = requests.post(f"{BASE_URL}/register", json=dup_email_payload)
    dup_email_ok = (
        r.status_code == 400 and
        "Email đã tồn tại" in r.json().get("message", "") and
        "EX-01" in r.json().get("message", "")
    )
    record("L3-01 (EX-01)", "Đăng ký tài khoản với email đã tồn tại",
           "HTTP 400 Bad Request kèm 'Email đã tồn tại trên hệ thống (EX-01)'",
           f"HTTP {r.status_code}, msg='{r.json().get('message')}'",
           dup_email_ok)

    # L3-02: Đăng ký trùng student_id đã tồn tại (EX-01)
    dup_student_payload = {
        "email": f"unique_email_{ts}@neu.edu.vn",
        "password": "Pass123456!",
        "full_name": "Nguyen Van Trung MSSV",
        "phone_number": "0988776655",
        "student_id": happy_student_id  # đã dùng ở L1-01
    }
    r = requests.post(f"{BASE_URL}/register", json=dup_student_payload)
    dup_student_ok = (
        r.status_code == 400 and
        "Mã sinh viên đã tồn tại" in r.json().get("message", "") and
        "EX-01" in r.json().get("message", "")
    )
    record("L3-02 (EX-01)", "Đăng ký tài khoản với Mã sinh viên (student_id) đã tồn tại",
           "HTTP 400 Bad Request kèm 'Mã sinh viên đã tồn tại trên hệ thống (EX-01)'",
           f"HTTP {r.status_code}, msg='{r.json().get('message')}'",
           dup_student_ok)

    # L3-03: Tài khoản bị khóa (is_active = False) bị chặn ở các endpoints
    # Khóa happy_email trong DB
    run_psql(f"UPDATE users SET is_active=false WHERE email='{happy_email}';")
    r_login_inact = requests.post(f"{BASE_URL}/login", json={"email": happy_email, "password": reset_pass})
    r_me_inact = requests.get(f"{BASE_URL}/me", headers={"Authorization": f"Bearer {token}"})
    r_chg_inact = requests.post(f"{BASE_URL}/change-password", headers={"Authorization": f"Bearer {token}"}, json={"old_password": reset_pass, "new_password": "NewPassX!"})
    r_fgt_inact = requests.post(f"{BASE_URL}/forgot-password", json={"email": happy_email})
    # Mở khóa lại
    run_psql(f"UPDATE users SET is_active=true WHERE email='{happy_email}';")
    inact_ok = (
        r_login_inact.status_code == 403 and "Tài khoản này đã bị khóa" in r_login_inact.json().get("message", "") and
        r_me_inact.status_code == 403 and "Tài khoản này đã bị khóa" in r_me_inact.json().get("message", "") and
        r_chg_inact.status_code == 403 and "Tài khoản này đã bị khóa" in r_chg_inact.json().get("message", "") and
        r_fgt_inact.status_code == 403 and "Tài khoản này đã bị khóa" in r_fgt_inact.json().get("message", "")
    )
    record("L3-03 (RBAC/Active)", "Tài khoản bị vô hiệu hóa (is_active=False) bị chặn ở /login, /me, /change-password, /forgot-password",
           "Tất cả đều trả HTTP 403 Forbidden kèm 'Tài khoản này đã bị khóa'",
           f"Login: {r_login_inact.status_code}, Me: {r_me_inact.status_code}, Change: {r_chg_inact.status_code}, Forgot: {r_fgt_inact.status_code}",
           inact_ok)

    # L3-04: Đổi mật khẩu với old_password sai
    r_login_active = requests.post(f"{BASE_URL}/login", json={"email": happy_email, "password": reset_pass})
    valid_token = r_login_active.json().get("data", {}).get("access_token")
    auth_header = {"Authorization": f"Bearer {valid_token}"}
    r = requests.post(f"{BASE_URL}/change-password", headers=auth_header, json={
        "old_password": "WrongOldPass123!", "new_password": "BrandNewPass999!"
    })
    old_pass_bad_ok = (
        r.status_code == 400 and
        "Mật khẩu hiện tại không chính xác" in r.json().get("message", "")
    )
    record("L3-04 (UC05)", "Đổi mật khẩu với old_password không chính xác",
           "HTTP 400 Bad Request kèm 'Mật khẩu hiện tại không chính xác'",
           f"HTTP {r.status_code}, msg='{r.json().get('message')}'",
           old_pass_bad_ok)

    # L3-05: Đổi mật khẩu với new_password == old_password
    r = requests.post(f"{BASE_URL}/change-password", headers=auth_header, json={
        "old_password": reset_pass, "new_password": reset_pass
    })
    same_pass_ok = (
        r.status_code == 400 and
        "không được trùng với mật khẩu hiện tại" in r.json().get("message", "")
    )
    record("L3-05 (UC05)", "Đổi mật khẩu với new_password trùng old_password",
           "HTTP 400 Bad Request kèm 'Mật khẩu mới không được trùng với mật khẩu hiện tại'",
           f"HTTP {r.status_code}, msg='{r.json().get('message')}'",
           same_pass_ok)

    # L3-06: Thiếu JWT Header khi gọi các endpoint được bảo vệ (/me, /logout, /change-password)
    r_me_no_jwt = requests.get(f"{BASE_URL}/me")
    r_lo_no_jwt = requests.post(f"{BASE_URL}/logout")
    r_cp_no_jwt = requests.post(f"{BASE_URL}/change-password", json={"old_password": "a", "new_password": "b"})
    no_jwt_ok = (
        r_me_no_jwt.status_code == 401 and
        r_lo_no_jwt.status_code == 401 and
        r_cp_no_jwt.status_code == 401
    )
    record("L3-06 (RBAC/JWT)", "Gọi các endpoints bảo vệ (/me, /logout, /change-password) khi thiếu Authorization Header",
           "Tất cả đều trả HTTP 401 Unauthorized",
           f"Me: {r_me_no_jwt.status_code}, Logout: {r_lo_no_jwt.status_code}, ChangePass: {r_cp_no_jwt.status_code}",
           no_jwt_ok)

    # L3-07: Sai/Giả mạo JWT Token khi gọi các endpoints bảo vệ
    fake_header = {"Authorization": "Bearer fake_token_abc_xyz_123456"}
    r_me_fake = requests.get(f"{BASE_URL}/me", headers=fake_header)
    r_lo_fake = requests.post(f"{BASE_URL}/logout", headers=fake_header)
    r_cp_fake = requests.post(f"{BASE_URL}/change-password", headers=fake_header, json={"old_password": "a", "new_password": "b"})
    fake_jwt_ok = (
        r_me_fake.status_code == 401 and
        r_lo_fake.status_code == 401 and
        r_cp_fake.status_code == 401
    )
    record("L3-07 (RBAC/JWT)", "Gọi các endpoints bảo vệ với JWT Token giả mạo/không hợp lệ",
           "Tất cả đều trả HTTP 401 Unauthorized",
           f"Me: {r_me_fake.status_code}, Logout: {r_lo_fake.status_code}, ChangePass: {r_cp_fake.status_code}",
           fake_jwt_ok)

    # =========================================================================
    # LỚP 4: REGRESSION & INTEGRATION (Hồi quy & Tích hợp)
    # =========================================================================

    # L4-01: Khởi tạo ứng dụng Flask create_app() kiểm tra 9 Blueprints và 12 ORM Models
    check_factory_script = """
from app import create_app
from app.db import models
app = create_app()
bp_count = len(app.blueprints)
bp_names = sorted(list(app.blueprints.keys()))
print(f"BP_COUNT={bp_count}|BP_NAMES={bp_names}")
"""
    factory_output = run_in_backend_container(check_factory_script)
    l4_01_ok = (
        "BP_COUNT=9" in factory_output and
        "'auth'" in factory_output and
        "'users'" in factory_output and
        "'settings'" in factory_output
    )
    record("L4-01 (Regression)", "Khởi tạo Flask create_app() và nạp 9 Blueprints cùng 12 ORM Models",
           "Nạp đủ 9 Blueprints không lỗi circular import hay xung đột ORM",
           f"{factory_output}",
           l4_01_ok)

    # L4-02: Đồng bộ call graph qua .agents/tools/build_call_graph.py
    cmd_cg = ["python3", ".agents/tools/build_call_graph.py"]
    res_cg = subprocess.run(cmd_cg, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    l4_02_ok = (res_cg.returncode == 0)
    record("L4-02 (Regression)", "Đồng bộ call_graph.json qua build_call_graph.py",
           "Return code 0, không có lỗi cú pháp AST",
           f"Returncode {res_cg.returncode}",
           l4_02_ok)

    # =========================================================================
    # DỌN DẸP DỮ LIỆU TEST (CLEANUP)
    # =========================================================================
    cleanup_sql = f"""
DELETE FROM users WHERE email LIKE '%_{ts}@neu.edu.vn' OR email='otp_expiry_test@neu.edu.vn';
"""
    del_res = run_psql(cleanup_sql)
    print(f"Cleaned up test data with ts={ts}. Rows affected: {del_res}")

    # =========================================================================
    # TỔNG KẾT
    # =========================================================================
    total = len(results)
    passed = sum(1 for r in results if r["status"] == "PASS")
    failed = total - passed
    print("=" * 80)
    print(f"TEST SUITE COMPLETED: {passed}/{total} PASSED ({failed} FAILED)")
    print("=" * 80)

    # Lưu kết quả ra file JSON để đọc dễ dàng
    with open("tests/test_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
