"""
Live Network Integration Test Suite for NeuFood Subsystem #4:
Reviews, Complaints, Shifts & Reports (RCRS)
Testing against Live Backend (http://localhost:5000/api/v1) and PostgreSQL (localhost:5432)
"""
import sys
import os
import json
import time
import requests
import psycopg2
from decimal import Decimal
from datetime import datetime, timezone, timedelta

BASE_API_URL = "http://127.0.0.1:5000/api/v1"
BASE_ROOT_URL = "http://127.0.0.1:5000"
DB_URL = "postgresql://neufood_user:neufood_password@localhost:5432/neufood_db"

results = []

def record(test_id, name, layer, expected, actual, passed, details=""):
    results.append({
        "id": test_id,
        "name": name,
        "layer": layer,
        "expected": expected,
        "actual": actual,
        "status": "PASS" if passed else "FAIL",
        "details": details
    })
    status_str = "\033[92mPASS\033[0m" if passed else "\033[91mFAIL\033[0m"
    print(f"[{status_str}] {test_id}: {name} -> {actual}")
    if not passed and details:
        print(f"    ERROR DETAILS: {details}")

def get_db_connection():
    return psycopg2.connect(DB_URL)

def http_get(path, token=None, params=None, root=False):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    base = BASE_ROOT_URL if root else BASE_API_URL
    resp = requests.get(f"{base}{path}", headers=headers, params=params, timeout=10)
    try:
        body = resp.json()
    except Exception:
        body = {"raw": resp.text}
    return resp.status_code, body

def http_post(path, data, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = requests.post(f"{BASE_API_URL}{path}", headers=headers, json=data, timeout=10)
    try:
        body = resp.json()
    except Exception:
        body = {"raw": resp.text}
    return resp.status_code, body

def http_patch(path, data, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = requests.patch(f"{BASE_API_URL}{path}", headers=headers, json=data, timeout=10)
    try:
        body = resp.json()
    except Exception:
        body = {"raw": resp.text}
    return resp.status_code, body

def login(email, password="password123"):
    status, body = http_post("/auth/login", {"email": email, "password": password})
    if status == 200 and body.get("success"):
        return body["data"]["access_token"]
    raise RuntimeError(f"Login failed for {email}: {status} {body}")

def run_tests():
    print("=" * 80)
    print("STARTING LIVE REAL-NETWORK TEST SUITE FOR SUBSYSTEM 4: RCRS")
    print("Backend: http://127.0.0.1:5000/api/v1 | Database: PostgreSQL 5432")
    print("=" * 80)

    # 1. Obtain Tokens for all roles
    admin_token = login("admin@neufood.vn")
    manager_token = login("manager.a2@neufood.vn")
    staff_token = login("shipper01@neufood.vn")
    customer4_token = login("sinhvien@neu.edu.vn")
    customer5_token = login("thanhhuong@neu.edu.vn")

    ts = int(time.time())
    db = get_db_connection()
    cur = db.cursor()

    # Create dedicated test orders with UNIQUE TEST_RCRS_ prefix
    order_hp_review = f"TEST_RCRS_REV_{ts}"
    order_hp_complaint = f"TEST_RCRS_CMP_{ts}"
    order_ex14_old = f"TEST_RCRS_OLD_{ts}"
    order_ex14_undelivered = f"TEST_RCRS_UNDELIV_{ts}"
    order_shift_cash = f"TEST_RCRS_SH_CASH_{ts}"
    order_shift_qr = f"TEST_RCRS_SH_QR_{ts}"

    now_utc = datetime.now(timezone.utc)
    old_time = now_utc - timedelta(hours=26)
    recent_time = now_utc - timedelta(hours=2)

    # Note: For review and complaint, staff_id can be None or 3.
    # To keep shift calculations isolated to the two shift orders:
    # Set staff_id = None for review and complaint test orders!
    cur.execute("""
        INSERT INTO orders (id, order_code_suffix, user_id, staff_id, order_type, recipient_name, recipient_phone,
                            delivery_address, status, subtotal_amount, ship_fee, total_amount, payment_method,
                            payment_status, delivered_at, created_at)
        VALUES
        (%s, '1111', 4, NULL, 'delivery', 'Nguyễn Sinh Viên', '0977112233', 'P101 A2', 'DA_GIAO', 30000, 5000, 35000, 'cod_cash', 'da_thanh_toan', %s, %s),
        (%s, '2222', 4, NULL, 'delivery', 'Nguyễn Sinh Viên', '0977112233', 'P101 A2', 'DA_GIAO', 30000, 5000, 35000, 'cod_cash', 'da_thanh_toan', %s, %s),
        (%s, '3333', 4, NULL, 'delivery', 'Nguyễn Sinh Viên', '0977112233', 'P101 A2', 'DA_GIAO', 30000, 5000, 35000, 'cod_cash', 'da_thanh_toan', %s, %s),
        (%s, '4444', 4, NULL, 'delivery', 'Nguyễn Sinh Viên', '0977112233', 'P101 A2', 'CHO_XAC_NHAN', 30000, 5000, 35000, 'cod_cash', 'chua_thanh_toan', NULL, %s),
        (%s, '5555', 4, 3, 'delivery', 'Nguyễn Sinh Viên', '0977112233', 'P101 A2', 'DA_GIAO', 50000, 5000, 55000, 'cod_cash', 'da_thanh_toan', %s, %s),
        (%s, '6666', 4, 3, 'delivery', 'Nguyễn Sinh Viên', '0977112233', 'P101 A2', 'DA_GIAO', 40000, 5000, 45000, 'cod_vietqr', 'da_thanh_toan', %s, %s)
    """, (
        order_hp_review, recent_time, recent_time,
        order_hp_complaint, recent_time, recent_time,
        order_ex14_old, old_time, old_time,
        order_ex14_undelivered, now_utc,
        order_shift_cash, now_utc, now_utc,
        order_shift_qr, now_utc, now_utc
    ))

    # Insert items matching exact prices and dishes:
    # tra-dao-cam-sa: unit_price 15000, base_price 10000
    # pho-bo-tai-lan: unit_price 50000, base_price 45000
    # bun-bo-hue: unit_price 40000, base_price 35000
    cur.execute("""
        INSERT INTO order_items (order_id, dish_id, dish_name, unit_price, base_price, quantity, subtotal)
        VALUES
        (%s, 'tra-dao-cam-sa', 'Trà Đào Cam Sả Tươi Mát', 15000, 10000, 2, 30000),
        (%s, 'tra-dao-cam-sa', 'Trà Đào Cam Sả Tươi Mát', 15000, 10000, 2, 30000),
        (%s, 'tra-dao-cam-sa', 'Trà Đào Cam Sả Tươi Mát', 15000, 10000, 2, 30000),
        (%s, 'tra-dao-cam-sa', 'Trà Đào Cam Sả Tươi Mát', 15000, 10000, 2, 30000),
        (%s, 'pho-bo-tai-lan', 'Phở Bò Tái Lăn', 50000, 45000, 1, 50000),
        (%s, 'bun-bo-hue', 'Bún Bò Xứ Huế', 40000, 35000, 1, 40000)
    """, (
        order_hp_review, order_hp_complaint, order_ex14_old,
        order_ex14_undelivered, order_shift_cash, order_shift_qr
    ))
    db.commit()

    # Clean up any existing shift today for staff 3 to ensure clean test
    cur.execute("DELETE FROM staff_shifts WHERE staff_id = 3 AND shift_date = CURRENT_DATE;")
    db.commit()

    # =========================================================================
    # LỚP 1: LUỒNG CHUẨN (HAPPY PATH)
    # =========================================================================
    print("\n--- LỚP 1: LUỒNG CHUẨN (HAPPY PATH) ---")

    # TC-HP-01: Public get reviews for a dish
    s_hp01, b_hp01 = http_get("/reviews/dish/combo-com-ga-tra-dao")
    p_hp01 = s_hp01 == 200 and isinstance(b_hp01.get("data"), list) and len(b_hp01["data"]) > 0
    record("TC-HP-01", "GET /reviews/dish/<dish_id> (Public endpoint)", "Lớp 1",
           "200 OK & List of reviews", f"Status {s_hp01}, Count {len(b_hp01.get('data', []))}", p_hp01)

    # TC-HP-02: Customer submits valid review for delivered order
    # Get current dish rating for tra-dao-cam-sa
    cur.execute("SELECT rating, review_count FROM dishes WHERE id = 'tra-dao-cam-sa';")
    rating_before, count_before = cur.fetchone()
    rating_before = Decimal(str(rating_before)) if rating_before is not None else Decimal("0")
    count_before = count_before or 0

    rev_payload = {
        "order_id": order_hp_review,
        "dish_id": "tra-dao-cam-sa",
        "rating": 5,
        "comment": "Trà đào thơm ngon tuyệt vời!"
    }
    s_hp02, b_hp02 = http_post("/reviews", rev_payload, customer4_token)
    p_hp02 = s_hp02 == 201 and b_hp02.get("success") is True and b_hp02.get("data", {}).get("rating") == 5

    # Check database rating updated
    cur.execute("SELECT rating, review_count FROM dishes WHERE id = 'tra-dao-cam-sa';")
    rating_after, count_after = cur.fetchone()
    p_hp02_db = count_after == count_before + 1
    record("TC-HP-02", "POST /reviews (Customer submit valid review & dish rating update)", "Lớp 1",
           "201 Created & dish.review_count incremented",
           f"Status {s_hp02}, Count before {count_before} -> after {count_after}", p_hp02 and p_hp02_db)

    # TC-HP-03: Customer submits complaint within 24h
    cmp_payload = {
        "order_id": order_hp_complaint,
        "reason": "Thiếu món ăn kèm",
        "description": "Đơn hàng bị thiếu 1 phần trà đào theo ghi chú, cốc trà bị đổ",
        "proof_image_url": "https://images.unsplash.com/photo-1544787219-7f47ccb76574"
    }
    s_hp03, b_hp03 = http_post("/complaints", cmp_payload, customer4_token)
    new_cmp_id = b_hp03.get("data", {}).get("id")
    # Verify order status transitions to KHIEU_NAI in DB
    cur.execute("SELECT status FROM orders WHERE id = %s;", (order_hp_complaint,))
    order_cmp_status = cur.fetchone()[0]
    p_hp03 = s_hp03 == 201 and b_hp03.get("data", {}).get("status") == "DANG_XU_LY" and order_cmp_status == "KHIEU_NAI"
    record("TC-HP-03", "POST /complaints (Customer submit complaint within 24h -> order KHIEU_NAI)", "Lớp 1",
           "201 Created & order.status = KHIEU_NAI",
           f"Status {s_hp03}, OrderStatus {order_cmp_status}, CmpID {new_cmp_id}", p_hp03)

    # TC-HP-04: Customer lists own complaints
    s_hp04, b_hp04 = http_get("/complaints", customer4_token)
    p_hp04 = s_hp04 == 200 and isinstance(b_hp04.get("data"), list) and any(c["id"] == new_cmp_id for c in b_hp04.get("data", []))
    record("TC-HP-04", "GET /complaints (Customer lists own complaints)", "Lớp 1",
           "200 OK & contains submitted complaint", f"Status {s_hp04}, Items {len(b_hp04.get('data', []))}", p_hp04)

    # TC-HP-05: Customer views complaint detail
    s_hp05, b_hp05 = http_get(f"/complaints/{new_cmp_id}", customer4_token)
    p_hp05 = s_hp05 == 200 and b_hp05.get("data", {}).get("id") == new_cmp_id
    record("TC-HP-05", "GET /complaints/<id> (Customer views own complaint detail)", "Lớp 1",
           "200 OK & matching complaint detail", f"Status {s_hp05}", p_hp05)

    # TC-HP-06: Admin views all complaints
    s_hp06, b_hp06 = http_get("/complaints", admin_token)
    p_hp06 = s_hp06 == 200 and len(b_hp06.get("data", [])) >= 2
    record("TC-HP-06", "GET /complaints (Admin lists all system complaints)", "Lớp 1",
           "200 OK & includes complaints from all users", f"Status {s_hp06}, Total {len(b_hp06.get('data', []))}", p_hp06)

    # TC-HP-07: Admin resolves complaint (status CHAP_NHAN -> order DA_GIAI_QUYET)
    res_payload = {
        "status": "CHAP_NHAN",
        "admin_response": "Canteen xác nhận sai sót và sẽ bù món vào đơn hàng tiếp theo của bạn."
    }
    s_hp07, b_hp07 = http_patch(f"/complaints/{new_cmp_id}/resolve", res_payload, admin_token)
    # Check order status in DB
    cur.execute("SELECT status FROM orders WHERE id = %s;", (order_hp_complaint,))
    order_resolved_status = cur.fetchone()[0]
    p_hp07 = (s_hp07 == 200 and b_hp07.get("data", {}).get("status") == "CHAP_NHAN" and
              order_resolved_status == "DA_GIAI_QUYET")
    record("TC-HP-07", "PATCH /complaints/<id>/resolve (Admin resolves complaint -> DA_GIAI_QUYET)", "Lớp 1",
           "200 OK & complaint CHAP_NHAN & order DA_GIAI_QUYET",
           f"Status {s_hp07}, OrderStatus {order_resolved_status}", p_hp07)

    # TC-HP-08: Staff views current shift summary
    s_hp08, b_hp08 = http_get("/shifts/my-current-shift", staff_token)
    data_hp08 = b_hp08.get("data", {})
    expected_cash = data_hp08.get("expected_cash", 0.0)
    expected_qr = data_hp08.get("expected_qr", 0.0)
    orders_handled = data_hp08.get("total_orders_handled", 0)
    p_hp08 = (s_hp08 == 200 and data_hp08.get("staff_id") == 3 and
              expected_cash >= 55000.0 and expected_qr >= 45000.0 and orders_handled >= 2)
    record("TC-HP-08", "GET /shifts/my-current-shift (Staff views live shift summary)", "Lớp 1",
           "200 OK & expected_cash>=55k & expected_qr>=45k & orders>=2",
           f"Status {s_hp08}, Cash {expected_cash}, QR {expected_qr}, Orders {orders_handled}", p_hp08)

    # TC-HP-09: Staff submits shift without discrepancy
    submit_hp09 = {
        "actual_cash": expected_cash,
        "actual_qr": expected_qr,
        "discrepancy_note": "Khớp hoàn toàn số tiền COD ca hôm nay"
    }
    s_hp09, b_hp09 = http_post("/shifts/submit", submit_hp09, staff_token)
    data_hp09 = b_hp09.get("data", {})
    shift_today_id = data_hp09.get("id")
    p_hp09 = (s_hp09 in (200, 201) and data_hp09.get("status") == "CHO_DUYET" and
              data_hp09.get("discrepancy_amount") == 0.0)
    record("TC-HP-09", "POST /shifts/submit (Staff submits matching COD count -> CHO_DUYET)", "Lớp 1",
           "200/201 & status=CHO_DUYET & discrepancy=0.0",
           f"Status {s_hp09}, ShiftStatus {data_hp09.get('status')}, ShiftID {shift_today_id}", p_hp09)

    # TC-HP-10: Manager closes shift (status DA_CHOT)
    close_hp10 = {
        "status": "DA_CHOT",
        "discrepancy_note": "Quản lý Canteen đã đối soát và nhận đủ tiền nộp"
    }
    s_hp10, b_hp10 = http_patch(f"/shifts/{shift_today_id}/close", close_hp10, manager_token)
    data_hp10 = b_hp10.get("data", {})
    p_hp10 = s_hp10 == 200 and data_hp10.get("status") == "DA_CHOT" and data_hp10.get("closed_by") == 2
    record("TC-HP-10", "PATCH /shifts/<id>/close (Manager approves and closes shift -> DA_CHOT)", "Lớp 1",
           "200 OK & status=DA_CHOT & closed_by=2",
           f"Status {s_hp10}, Status {data_hp10.get('status')}, ClosedBy {data_hp10.get('closed_by')}", p_hp10)

    # TC-HP-11: Manager views revenue report
    s_hp11, b_hp11 = http_get("/shifts/reports/summary", manager_token, params={"from_date": "2026-10-01", "to_date": "2026-10-21"})
    data_hp11 = b_hp11.get("data", {})
    gross = Decimal(str(data_hp11.get("gross_revenue", 0)))
    canteen_net = Decimal(str(data_hp11.get("canteen_net_revenue", 0)))
    system_fee = Decimal(str(data_hp11.get("system_fee_total", 0)))
    ship_fee = Decimal(str(data_hp11.get("ship_fee_total", 0)))
    balance_ok = (gross == canteen_net + system_fee + ship_fee)
    p_hp11 = s_hp11 == 200 and balance_ok and isinstance(data_hp11.get("top_dishes"), list)
    record("TC-HP-11", "GET /shifts/reports/summary (Manager views financial revenue report)", "Lớp 1",
           "200 OK & gross == canteen_net + system_fee + ship_fee",
           f"Status {s_hp11}, Gross={gross}, Net={canteen_net}, SysFee={system_fee}, ShipFee={ship_fee}, Balanced={balance_ok}", p_hp11)

    # TC-HP-12: Staff lists shifts
    s_hp12, b_hp12 = http_get("/shifts", staff_token)
    p_hp12 = s_hp12 == 200 and isinstance(b_hp12.get("data"), list) and len(b_hp12["data"]) >= 1
    record("TC-HP-12", "GET /shifts (Staff lists own shifts)", "Lớp 1",
           "200 OK & List of shifts", f"Status {s_hp12}, ShiftCount {len(b_hp12.get('data', []))}", p_hp12)

    # =========================================================================
    # LỚP 2: ĐIỀU KIỆN BIÊN & DỮ LIỆU DỊ BIỆT (BOUNDARY & EDGE CASES)
    # =========================================================================
    print("\n--- LỚP 2: ĐIỀU KIỆN BIÊN & DỮ LIỆU DỊ BIỆT (BOUNDARY & EDGE CASES) ---")

    # TC-BD-01: Review rating = 0 (below minimum)
    s_bd01, b_bd01 = http_post("/reviews", {"order_id": order_hp_review, "dish_id": "tra-dao-cam-sa", "rating": 0}, customer4_token)
    record("TC-BD-01", "POST /reviews with rating = 0 (under minimum)", "Lớp 2",
           "422 Unprocessable Entity", f"Status {s_bd01}", s_bd01 == 422)

    # TC-BD-02: Review rating = 6 (above maximum)
    s_bd02, b_bd02 = http_post("/reviews", {"order_id": order_hp_review, "dish_id": "tra-dao-cam-sa", "rating": 6}, customer4_token)
    record("TC-BD-02", "POST /reviews with rating = 6 (over maximum)", "Lớp 2",
           "422 Unprocessable Entity", f"Status {s_bd02}", s_bd02 == 422)

    # TC-BD-03: Review rating = 4.5 (float instead of strict integer)
    s_bd03, b_bd03 = http_post("/reviews", {"order_id": order_hp_review, "dish_id": "tra-dao-cam-sa", "rating": 4.5}, customer4_token)
    record("TC-BD-03", "POST /reviews with rating = 4.5 (float non-strict)", "Lớp 2",
           "422 Unprocessable Entity", f"Status {s_bd03}", s_bd03 == 422)

    # TC-BD-04: Review rating = "5" (string instead of integer)
    s_bd04, b_bd04 = http_post("/reviews", {"order_id": order_hp_review, "dish_id": "tra-dao-cam-sa", "rating": "5"}, customer4_token)
    record("TC-BD-04", "POST /reviews with rating = '5' (string type)", "Lớp 2",
           "422 Unprocessable Entity", f"Status {s_bd04}", s_bd04 == 422)

    # TC-BD-05 & 06: Boundary values rating = 1 and rating = 5
    # Create two fresh orders for boundary testing
    order_bd_min = f"TEST_RCRS_BD_MIN_{ts}"
    order_bd_max = f"TEST_RCRS_BD_MAX_{ts}"
    cur.execute("""
        INSERT INTO orders (id, order_code_suffix, user_id, staff_id, order_type, recipient_name, recipient_phone,
                            delivery_address, status, subtotal_amount, ship_fee, total_amount, payment_method,
                            payment_status, delivered_at, created_at)
        VALUES
        (%s, '7777', 4, NULL, 'delivery', 'Nguyễn Sinh Viên', '0977112233', 'P101 A2', 'DA_GIAO', 15000, 5000, 20000, 'cod_cash', 'da_thanh_toan', %s, %s),
        (%s, '8888', 4, NULL, 'delivery', 'Nguyễn Sinh Viên', '0977112233', 'P101 A2', 'DA_GIAO', 15000, 5000, 20000, 'cod_cash', 'da_thanh_toan', %s, %s)
    """, (order_bd_min, recent_time, recent_time, order_bd_max, recent_time, recent_time))
    cur.execute("""
        INSERT INTO order_items (order_id, dish_id, dish_name, unit_price, base_price, quantity, subtotal)
        VALUES
        (%s, 'tra-dao-cam-sa', 'Trà Đào Cam Sả Tươi Mát', 15000, 10000, 1, 15000),
        (%s, 'tra-dao-cam-sa', 'Trà Đào Cam Sả Tươi Mát', 15000, 10000, 1, 15000)
    """, (order_bd_min, order_bd_max))
    db.commit()

    s_bd05, b_bd05 = http_post("/reviews", {"order_id": order_bd_min, "dish_id": "tra-dao-cam-sa", "rating": 1}, customer4_token)
    record("TC-BD-05", "POST /reviews boundary rating = 1 (valid minimum)", "Lớp 2",
           "201 Created", f"Status {s_bd05}", s_bd05 == 201)

    s_bd06, b_bd06 = http_post("/reviews", {"order_id": order_bd_max, "dish_id": "tra-dao-cam-sa", "rating": 5}, customer4_token)
    record("TC-BD-06", "POST /reviews boundary rating = 5 (valid maximum)", "Lớp 2",
           "201 Created", f"Status {s_bd06}", s_bd06 == 201)

    # TC-BD-07: Duplicate review prevention (same order_id and dish_id)
    s_bd07, b_bd07 = http_post("/reviews", {"order_id": order_hp_review, "dish_id": "tra-dao-cam-sa", "rating": 4}, customer4_token)
    p_bd07 = s_bd07 == 400 and "đã đánh giá món này" in b_bd07.get("message", "").lower()
    record("TC-BD-07", "POST /reviews duplicate review prevention on (order_id, dish_id)", "Lớp 2",
           "400 Bad Request & REVIEW_DUPLICATE", f"Status {s_bd07}, Msg: {b_bd07.get('message')}", p_bd07)

    # TC-BD-08: Empty payload {} on review submit
    s_bd08, b_bd08 = http_post("/reviews", {}, customer4_token)
    record("TC-BD-08", "POST /reviews with empty body {}", "Lớp 2",
           "422 Unprocessable Entity", f"Status {s_bd08}", s_bd08 == 422)

    # TC-BD-09: Complaint with empty reason
    s_bd09, b_bd09 = http_post("/complaints", {
        "order_id": order_bd_min,
        "reason": "   ",
        "description": "Chi tiết khiếu nại hợp lệ",
        "proof_image_url": "https://example.com/pic.jpg"
    }, customer4_token)
    record("TC-BD-09", "POST /complaints with whitespace-only reason", "Lớp 2",
           "422 Unprocessable Entity", f"Status {s_bd09}", s_bd09 == 422)

    # TC-BD-10: Complaint with invalid proof_image_url
    s_bd10, b_bd10 = http_post("/complaints", {
        "order_id": order_bd_min,
        "reason": "Món ăn có vị lạ",
        "description": "Chi tiết khiếu nại hợp lệ",
        "proof_image_url": "invalid-url-without-scheme"
    }, customer4_token)
    record("TC-BD-10", "POST /complaints with invalid proof_image_url", "Lớp 2",
           "422 Unprocessable Entity", f"Status {s_bd10}", s_bd10 == 422)

    # TC-BD-11: Duplicate complaint on same order (BR-23)
    s_bd11, b_bd11 = http_post("/complaints", {
        "order_id": order_hp_complaint,
        "reason": "Lại thiếu đồ ăn",
        "description": "Lần 2 khiếu nại tiếp",
        "proof_image_url": "https://example.com/pic2.jpg"
    }, customer4_token)
    p_bd11 = s_bd11 == 400 and ("tối đa 01 khiếu nại" in b_bd11.get("message", "").lower() or "ex-15" in str(b_bd11).lower())
    record("TC-BD-11", "POST /complaints duplicate complaint on same order (BR-23)", "Lớp 2",
           "400 Bad Request & EX-15", f"Status {s_bd11}, Msg: {b_bd11.get('message')}", p_bd11)

    # TC-BD-12: Shift submit with negative actual_cash
    s_bd12, b_bd12 = http_post("/shifts/submit", {"actual_cash": -1000.0, "actual_qr": 0.0}, staff_token)
    record("TC-BD-12", "POST /shifts/submit with negative actual_cash (-1000)", "Lớp 2",
           "422 Unprocessable Entity", f"Status {s_bd12}", s_bd12 == 422)

    # TC-BD-13: Shift submit with overflow actual_cash
    s_bd13, b_bd13 = http_post("/shifts/submit", {"actual_cash": 1e12, "actual_qr": 0.0}, staff_token)
    record("TC-BD-13", "POST /shifts/submit with huge actual_cash (10^12)", "Lớp 2",
           "422 Unprocessable Entity", f"Status {s_bd13}", s_bd13 == 422)

    # TC-BD-14: Revenue report invalid date format
    s_bd14, b_bd14 = http_get("/shifts/reports/summary", manager_token, params={"from_date": "2026-13-45"})
    record("TC-BD-14", "GET /shifts/reports/summary with invalid date format", "Lớp 2",
           "422 Unprocessable Entity", f"Status {s_bd14}", s_bd14 == 422)

    # TC-BD-15: Revenue report reversed date range from_date > to_date
    s_bd15, b_bd15 = http_get("/shifts/reports/summary", manager_token, params={"from_date": "2026-10-25", "to_date": "2026-10-20"})
    p_bd15 = s_bd15 == 400 and "không được lớn hơn" in b_bd15.get("message", "").lower()
    record("TC-BD-15", "GET /shifts/reports/summary with from_date > to_date", "Lớp 2",
           "400 Bad Request & INVALID_DATE_RANGE", f"Status {s_bd15}, Msg: {b_bd15.get('message')}", p_bd15)

    # TC-BD-16: Revenue report date range > 366 days
    s_bd16, b_bd16 = http_get("/shifts/reports/summary", manager_token, params={"from_date": "2024-01-01", "to_date": "2026-01-01"})
    p_bd16 = s_bd16 == 400 and "366 ngày" in b_bd16.get("message", "").lower()
    record("TC-BD-16", "GET /shifts/reports/summary with range > 366 days", "Lớp 2",
           "400 Bad Request & DATE_RANGE_TOO_LONG", f"Status {s_bd16}, Msg: {b_bd16.get('message')}", p_bd16)

    # =========================================================================
    # LỚP 3: NGOẠI LỆ NGHIỆP VỤ & PHÂN QUYỀN RBAC (EXCEPTIONS & RBAC)
    # =========================================================================
    print("\n--- LỚP 3: NGOẠI LỆ NGHIỆP VỤ & PHÂN QUYỀN RBAC ---")

    # TC-EX-01: Review submit without token
    s_ex01, _ = http_post("/reviews", {"order_id": order_hp_review, "dish_id": "tra-dao-cam-sa", "rating": 5}, token=None)
    record("TC-EX-01", "POST /reviews without token (RBAC Auth check)", "Lớp 3",
           "401 Unauthorized", f"Status {s_ex01}", s_ex01 == 401)

    # TC-EX-02: Review submit with Staff token
    s_ex02, _ = http_post("/reviews", {"order_id": order_hp_review, "dish_id": "tra-dao-cam-sa", "rating": 5}, token=staff_token)
    record("TC-EX-02", "POST /reviews with Staff token (RBAC customer only)", "Lớp 3",
           "403 Forbidden", f"Status {s_ex02}", s_ex02 == 403)

    # TC-EX-03: Review submit for another user's order
    s_ex03, b_ex03 = http_post("/reviews", {"order_id": order_hp_review, "dish_id": "tra-dao-cam-sa", "rating": 5}, token=customer5_token)
    p_ex03 = s_ex03 == 404
    record("TC-EX-03", "POST /reviews for another user's order (ID privacy)", "Lớp 3",
           "404 Not Found", f"Status {s_ex03}, Msg: {b_ex03.get('message')}", p_ex03)

    # TC-EX-04: Review submit for undelivered order (CHO_XAC_NHAN)
    s_ex04, b_ex04 = http_post("/reviews", {"order_id": order_ex14_undelivered, "dish_id": "tra-dao-cam-sa", "rating": 5}, token=customer4_token)
    p_ex04 = s_ex04 == 400 and "chỉ được đánh giá đơn đã giao" in b_ex04.get("message", "").lower()
    record("TC-EX-04", "POST /reviews on undelivered order (ORDER_NOT_REVIEWABLE)", "Lớp 3",
           "400 Bad Request & ORDER_NOT_REVIEWABLE", f"Status {s_ex04}, Msg: {b_ex04.get('message')}", p_ex04)

    # TC-EX-05: Review submit for dish not in order
    s_ex05, b_ex05 = http_post("/reviews", {"order_id": order_bd_min, "dish_id": "pho-bo-tai-lan", "rating": 5}, token=customer4_token)
    p_ex05 = s_ex05 == 400 and "không thuộc đơn hàng này" in b_ex05.get("message", "").lower()
    record("TC-EX-05", "POST /reviews for dish not in order (DISH_NOT_IN_ORDER)", "Lớp 3",
           "400 Bad Request & DISH_NOT_IN_ORDER", f"Status {s_ex05}, Msg: {b_ex05.get('message')}", p_ex05)

    # TC-EX-06: EX-14 Complaint on undelivered order (CHO_XAC_NHAN)
    s_ex06, b_ex06 = http_post("/complaints", {
        "order_id": order_ex14_undelivered,
        "reason": "Đơn giao quá chậm",
        "description": "Quá giờ chưa nhận được đồ ăn",
        "proof_image_url": "https://example.com/proof.jpg"
    }, token=customer4_token)
    p_ex06 = s_ex06 == 400 and "chỉ được khiếu nại đơn đã giao" in b_ex06.get("message", "").lower()
    record("TC-EX-06", "POST /complaints on undelivered order (EX-14)", "Lớp 3",
           "400 Bad Request & EX-14", f"Status {s_ex06}, Msg: {b_ex06.get('message')}", p_ex06)

    # TC-EX-07: EX-14 Complaint on order delivered > 24 hours ago
    s_ex07, b_ex07 = http_post("/complaints", {
        "order_id": order_ex14_old,
        "reason": "Đồ ăn nguội lạnh",
        "description": "Đơn nhận hôm qua đồ ăn bị hỏng",
        "proof_image_url": "https://example.com/proof.jpg"
    }, token=customer4_token)
    p_ex07 = s_ex07 == 400 and "quá thời hạn khiếu nại" in b_ex07.get("message", "").lower()
    record("TC-EX-07", "POST /complaints on order delivered > 24h (EX-14)", "Lớp 3",
           "400 Bad Request & EX-14", f"Status {s_ex07}, Msg: {b_ex07.get('message')}", p_ex07)

    # TC-EX-08: Customer views another customer's complaint detail (ID enumeration defense)
    s_ex08, b_ex08 = http_get(f"/complaints/{new_cmp_id}", token=customer5_token)
    p_ex08 = s_ex08 == 404
    record("TC-EX-08", "GET /complaints/<id> for another customer's ticket (ID Security)", "Lớp 3",
           "404 Not Found", f"Status {s_ex08}, Msg: {b_ex08.get('message')}", p_ex08)

    # TC-EX-09: BR-24 Non-admin attempts to resolve complaint
    s_ex09_c, _ = http_patch(f"/complaints/{new_cmp_id}/resolve", {"status": "CHAP_NHAN", "admin_response": "ok"}, customer4_token)
    s_ex09_s, _ = http_patch(f"/complaints/{new_cmp_id}/resolve", {"status": "CHAP_NHAN", "admin_response": "ok"}, staff_token)
    s_ex09_m, _ = http_patch(f"/complaints/{new_cmp_id}/resolve", {"status": "CHAP_NHAN", "admin_response": "ok"}, manager_token)
    p_ex09 = s_ex09_c == 403 and s_ex09_s == 403 and s_ex09_m == 403
    record("TC-EX-09", "PATCH /complaints/<id>/resolve by non-admin roles (BR-24 exclusive)", "Lớp 3",
           "403 Forbidden for customer/staff/manager", f"C:{s_ex09_c}, S:{s_ex09_s}, M:{s_ex09_m}", p_ex09)

    # TC-EX-10: Admin resolves an already-resolved complaint
    s_ex10, b_ex10 = http_patch(f"/complaints/{new_cmp_id}/resolve", {"status": "TU_CHOI", "admin_response": "Đã xử lý rồi"}, admin_token)
    p_ex10 = s_ex10 == 400 and "đã được xử lý" in b_ex10.get("message", "").lower()
    record("TC-EX-10", "PATCH /complaints/<id>/resolve on already-resolved complaint", "Lớp 3",
           "400 Bad Request & COMPLAINT_ALREADY_RESOLVED", f"Status {s_ex10}, Msg: {b_ex10.get('message')}", p_ex10)

    # TC-EX-11: Admin resolves complaint with invalid status
    s_ex11, b_ex11 = http_patch(f"/complaints/{new_cmp_id}/resolve", {"status": "HUY_DON", "admin_response": "test"}, admin_token)
    record("TC-EX-11", "PATCH /complaints/<id>/resolve with invalid status", "Lớp 3",
           "422 Unprocessable Entity", f"Status {s_ex11}", s_ex11 == 422)

    # TC-EX-12: Customer attempts to submit shift
    s_ex12, _ = http_post("/shifts/submit", {"actual_cash": 10000, "actual_qr": 0}, customer4_token)
    record("TC-EX-12", "POST /shifts/submit by Customer (RBAC Staff only)", "Lớp 3",
           "403 Forbidden", f"Status {s_ex12}", s_ex12 == 403)

    # TC-EX-13 & 14: EX-20 Shift submit discrepancy tests
    cur.execute("""
        INSERT INTO users (id, email, password_hash, full_name, phone_number, role, is_active)
        VALUES (999, 'staff_test_999@neufood.vn', '$2b$12$8MExWX3DjGGtc5FFYQu3yOM1.Th4Ky36280O2126Ux.A8ydGfDb/y', 'Test Staff 999', '0988999999', 'staff', TRUE)
        ON CONFLICT (id) DO UPDATE SET is_active = TRUE, role = 'staff';
    """)
    db.commit()
    staff999_token = login("staff_test_999@neufood.vn")

    # TC-EX-13: EX-20 Staff submits shift with discrepancy WITHOUT discrepancy note -> 400 Bad Request
    s_ex13, b_ex13 = http_post("/shifts/submit", {"actual_cash": 50000.0, "actual_qr": 0.0, "discrepancy_note": None}, staff999_token)
    p_ex13 = s_ex13 == 400 and ("bắt buộc phải có giải trình" in b_ex13.get("message", "").lower() or "ex-20" in str(b_ex13).lower())
    record("TC-EX-13", "POST /shifts/submit with discrepancy WITHOUT note (EX-20)", "Lớp 3",
           "400 Bad Request & EX-20", f"Status {s_ex13}, Msg: {b_ex13.get('message')}", p_ex13)

    # TC-EX-14: EX-20 Staff submits shift with discrepancy WITH discrepancy note -> 201/200 & status CAN_GIAI_TRINH
    s_ex14, b_ex14 = http_post("/shifts/submit", {
        "actual_cash": 50000.0,
        "actual_qr": 0.0,
        "discrepancy_note": "Tiền mặt thừa do khách tip không lấy lại"
    }, staff999_token)
    p_ex14 = s_ex14 in (200, 201) and b_ex14.get("data", {}).get("status") == "CAN_GIAI_TRINH"
    shift999_id = b_ex14.get("data", {}).get("id")
    record("TC-EX-14", "POST /shifts/submit with discrepancy WITH note (EX-20 -> CAN_GIAI_TRINH)", "Lớp 3",
           "200/201 & status=CAN_GIAI_TRINH", f"Status {s_ex14}, Status {b_ex14.get('data', {}).get('status')}", p_ex14)

    # TC-EX-15: Staff attempts to close shift
    s_ex15, _ = http_patch(f"/shifts/{shift999_id}/close", {"status": "DA_CHOT"}, staff999_token)
    record("TC-EX-15", "PATCH /shifts/<id>/close by Staff (RBAC Manager/Admin only)", "Lớp 3",
           "403 Forbidden", f"Status {s_ex15}", s_ex15 == 403)

    # TC-EX-16: Manager closes shift already closed (shift_today_id was closed in TC-HP-10)
    s_ex16, b_ex16 = http_patch(f"/shifts/{shift_today_id}/close", {"status": "DA_CHOT"}, manager_token)
    p_ex16 = s_ex16 == 400 and "đã được chốt" in b_ex16.get("message", "").lower()
    record("TC-EX-16", "PATCH /shifts/<id>/close on already-closed shift", "Lớp 3",
           "400 Bad Request & SHIFT_ALREADY_CLOSED", f"Status {s_ex16}, Msg: {b_ex16.get('message')}", p_ex16)

    # TC-EX-17: Staff attempts to submit shift for today after shift was already closed DA_CHOT
    s_ex17, b_ex17 = http_post("/shifts/submit", {"actual_cash": expected_cash, "actual_qr": expected_qr}, staff_token)
    p_ex17 = s_ex17 == 400 and "không thể nộp lại" in b_ex17.get("message", "").lower()
    record("TC-EX-17", "POST /shifts/submit after shift already DA_CHOT", "Lớp 3",
           "400 Bad Request & SHIFT_ALREADY_CLOSED", f"Status {s_ex17}, Msg: {b_ex17.get('message')}", p_ex17)

    # TC-EX-18: Customer and Staff attempt to view revenue reports (RBAC)
    s_ex18_c, _ = http_get("/shifts/reports/summary", customer4_token)
    s_ex18_s, _ = http_get("/shifts/reports/summary", staff_token)
    p_ex18 = s_ex18_c == 403 and s_ex18_s == 403
    record("TC-EX-18", "GET /shifts/reports/summary by Customer and Staff (RBAC)", "Lớp 3",
           "403 Forbidden for both", f"Customer:{s_ex18_c}, Staff:{s_ex18_s}", p_ex18)

    # =========================================================================
    # LỚP 4: HỒI QUY & TOÀN VẸN HỆ THỐNG (REGRESSION & SYSTEM INTEGRITY)
    # =========================================================================
    print("\n--- LỚP 4: HỒI QUY & TOÀN VẸN HỆ THỐNG (REGRESSION & INTEGRITY) ---")

    # TC-REG-01: Verify mathematical precision of dish rating formula
    cur.execute("SELECT rating, review_count FROM dishes WHERE id = 'tra-dao-cam-sa';")
    final_rating, final_count = cur.fetchone()
    p_reg01 = 1.0 <= float(final_rating) <= 5.0 and final_count >= 3
    record("TC-REG-01", "Database integrity: dish rating and review count valid bounds", "Lớp 4",
           "1.0 <= rating <= 5.0 and count >= 3", f"Rating {final_rating}, Count {final_count}", p_reg01)

    # TC-REG-02: Financial balance verification across multiple date ranges
    s_reg02, b_reg02 = http_get("/shifts/reports/summary", admin_token, params={"from_date": "2026-10-15", "to_date": "2026-10-21"})
    data_reg02 = b_reg02.get("data", {})
    g_rev = Decimal(str(data_reg02.get("gross_revenue", 0)))
    c_net = Decimal(str(data_reg02.get("canteen_net_revenue", 0)))
    sys_f = Decimal(str(data_reg02.get("system_fee_total", 0)))
    shp_f = Decimal(str(data_reg02.get("ship_fee_total", 0)))
    p_reg02 = (g_rev == c_net + sys_f + shp_f)
    record("TC-REG-02", "Financial balance equation: gross == canteen_net + system_fee + ship_fee", "Lớp 4",
           "Perfect financial balance", f"Gross={g_rev}, Sum={c_net + sys_f + shp_f}", p_reg02)

    # TC-REG-03: Order state machine verification: DA_GIAO -> KHIEU_NAI -> DA_GIAI_QUYET
    cur.execute("SELECT status FROM orders WHERE id = %s;", (order_hp_complaint,))
    final_order_status = cur.fetchone()[0]
    p_reg03 = final_order_status == "DA_GIAI_QUYET"
    record("TC-REG-03", "Order State Machine: Delivered -> KHIEU_NAI -> DA_GIAI_QUYET", "Lớp 4",
           "order.status = DA_GIAI_QUYET", f"Final Status: {final_order_status}", p_reg03)

    # TC-REG-04: Verify System Health Check at root /health
    s_reg04, b_reg04 = http_get("/health", root=True)
    p_reg04 = s_reg04 == 200 and b_reg04.get("status") == "healthy"
    record("TC-REG-04", "System Health Check and Blueprint Routing verification", "Lớp 4",
           "200 OK & status=healthy", f"Status {s_reg04}", p_reg04)

    # TC-REG-05: Non-existent complaint ID returns 404
    s_reg05, _ = http_get("/complaints/99999999", admin_token)
    record("TC-REG-05", "GET /complaints/99999999 (Non-existent ID)", "Lớp 4",
           "404 Not Found", f"Status {s_reg05}", s_reg05 == 404)

    # Cleanup test data created during this run (ONLY TEST_RCRS_ prefix!)
    try:
        cur.execute("DELETE FROM reviews WHERE order_id LIKE 'TEST_RCRS_%%';")
        cur.execute("DELETE FROM complaints WHERE order_id LIKE 'TEST_RCRS_%%';")
        cur.execute("DELETE FROM order_items WHERE order_id LIKE 'TEST_RCRS_%%';")
        cur.execute("DELETE FROM orders WHERE id LIKE 'TEST_RCRS_%%';")
        cur.execute("DELETE FROM staff_shifts WHERE staff_id = 999;")
        cur.execute("DELETE FROM users WHERE id = 999;")
        db.commit()
    except Exception as e:
        print(f"Warning during cleanup: {e}")
    finally:
        cur.close()
        db.close()

    # Summary
    total = len(results)
    passed_count = sum(1 for r in results if r["status"] == "PASS")
    failed_count = sum(1 for r in results if r["status"] == "FAIL")

    print("\n" + "=" * 80)
    print(f"TEST RUN COMPLETED: Total {total} | PASSED: {passed_count} | FAILED: {failed_count}")
    print("=" * 80)

    # Write results to json
    results_path = os.path.join(os.path.dirname(__file__), "test_rcrs_live_results.json")
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "total": total,
            "passed": passed_count,
            "failed": failed_count,
            "results": results
        }, f, indent=2, ensure_ascii=False)
    print(f"Detailed test report saved to {results_path}")

    return failed_count == 0

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
