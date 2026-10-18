import time
import requests

BASE_URL = "http://127.0.0.1:5000/api/v1/auth"
email = "otp_expiry_test@neu.edu.vn"

print("[START] Yêu cầu gửi OTP khôi phục mật khẩu...")
r_forgot = requests.post(f"{BASE_URL}/forgot-password", json={"email": email})
data = r_forgot.json()
otp_code = data.get("data", {}).get("otp_debug")
print(f"[OK] OTP nhận được: {otp_code}, expires_in: {data.get('data', {}).get('expires_in_seconds')}s")

print("[WAIT] Đang chờ đúng 301 giây (5 phút 1 giây) để mã OTP hết hạn tự nhiên trên server...")
time.sleep(301)

print("[CHECK] Gửi yêu cầu reset-password với mã OTP đã hết hạn...")
r_reset = requests.post(f"{BASE_URL}/reset-password", json={
    "email": email,
    "otp": otp_code,
    "new_password": "NewPassAfterExpiry123!"
})
print(f"[RESULT] Status Code: {r_reset.status_code}")
print(f"[RESULT] Response Body: {r_reset.text}")

if r_reset.status_code == 400 and "quá 5 phút" in r_reset.text:
    print("[PASS_REAL_NETWORK] OTP quá hạn 5 phút đã bị chặn chính xác với HTTP 400 (EX-04)!")
else:
    print("[FAIL_REAL_NETWORK] Kết quả không như kỳ vọng!")
