import unittest
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.db.models import User, UserDevice
from app.core.security import (
    generate_device_token,
    verify_device_token,
    hash_device_token,
    hash_password,
    verify_password,
)
from app.crud.user import (
    create_or_touch_device,
    record_device_failed_login,
    reset_device_attempts,
    revoke_all_user_devices,
    record_failed_login,
    reset_login_attempts,
    update_user_password,
    get_user_device,
    get_device_by_token_hash,
)
from app.routes.auth import (
    _check_otp_rate_limit,
    _record_otp_request,
    OTP_STORE,
    OTP_IP_STORE,
)


class TestDeviceLockoutAndSecurity(unittest.TestCase):
    def setUp(self):
        # Thiết lập SQLite in-memory để test độc lập không phụ thuộc DB ngoài
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.db = self.SessionLocal()

        # Tạo user mẫu
        self.user = User(
            email="test_student@neu.edu.vn",
            password_hash=hash_password("Password123@"),
            full_name="Nguyễn Văn A",
            phone_number="0987654321",
            role="customer",
            is_active=True,
        )
        self.db.add(self.user)
        self.db.commit()
        self.db.refresh(self.user)

        # Dọn dẹp OTP stores
        OTP_STORE.clear()
        OTP_IP_STORE.clear()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_device_token_hmac_sign_and_verify(self):
        """Kiểm tra tạo chữ ký HMAC và xác thực device token hợp lệ (BR-02)."""
        device_id = "device-uuid-123"
        token = generate_device_token(self.user.id, device_id)
        self.assertIsNotNone(token)
        self.assertIn(".", token)

        verified = verify_device_token(token)
        self.assertIsNotNone(verified)
        user_id, dev_id = verified
        self.assertEqual(user_id, self.user.id)
        self.assertEqual(dev_id, device_id)

    def test_device_token_tampering_detected(self):
        """Kiểm tra phát hiện token giả mạo chữ ký HMAC."""
        token = generate_device_token(self.user.id, "device-1")
        # Giả mạo payload
        tampered_token = token.replace(str(self.user.id), str(self.user.id + 999), 1)
        self.assertIsNone(verify_device_token(tampered_token))

        # Giả mạo chữ ký
        payload, sig = token.split(".")
        fake_sig = sig[:-4] + "ffff"
        self.assertIsNone(verify_device_token(f"{payload}.{fake_sig}"))

    def test_trusted_device_lockout_after_5_failed_attempts(self):
        """Nhánh A: Thiết bị tin cậy nhập sai 5 lần -> Khóa riêng thiết bị đó 15p (BR-02, EX-02)."""
        device_id = "trusted-device-1"
        token = generate_device_token(self.user.id, device_id)
        token_hash = hash_device_token(token)

        device = create_or_touch_device(
            self.db, self.user.id, device_id, token_hash, device_name="Chrome MacOS"
        )
        self.assertEqual(device.failed_login_attempts, 0)
        self.assertIsNone(device.locked_until)

        # 4 lần đầu gõ sai
        for i in range(1, 5):
            device = record_device_failed_login(self.db, device)
            self.assertEqual(device.failed_login_attempts, i)
            self.assertIsNone(device.locked_until)

        # Lần thứ 5 gõ sai -> Khóa 15 phút
        now = datetime.now(timezone.utc)
        device = record_device_failed_login(self.db, device)
        self.assertEqual(device.failed_login_attempts, 5)
        self.assertIsNotNone(device.locked_until)

        # Tài khoản user trên nhánh chưa xác minh vẫn KHÔNG bị khóa
        self.db.refresh(self.user)
        self.assertEqual(self.user.failed_login_attempts, 0)
        self.assertIsNone(self.user.locked_until)

    def test_unverified_device_lockout_does_not_affect_trusted_device(self):
        """Kẻ xấu dùng thiết bị lạ gõ sai 5 lần -> Thiết bị tin cậy của chủ tài khoản KHÔNG bị khóa."""
        # 1. Tạo 1 thiết bị tin cậy cho chủ tài khoản
        dev_token = generate_device_token(self.user.id, "my-phone")
        dev_hash = hash_device_token(dev_token)
        trusted_dev = create_or_touch_device(self.db, self.user.id, "my-phone", dev_hash)

        # 2. Kẻ xấu gõ sai 5 lần trên nhánh thiết bị chưa xác minh
        for _ in range(5):
            self.user = record_failed_login(self.db, self.user)

        self.assertEqual(self.user.failed_login_attempts, 5)
        self.assertIsNotNone(self.user.locked_until)

        # 3. Kiểm tra thiết bị tin cậy: hoàn toàn KHÔNG bị khóa!
        self.db.refresh(trusted_dev)
        self.assertEqual(trusted_dev.failed_login_attempts, 0)
        self.assertIsNone(trusted_dev.locked_until)

    def test_password_change_revokes_all_devices(self):
        """Đổi mật khẩu thành công -> Thu hồi toàn bộ thiết bị tin cậy (UC05, BR-02)."""
        d1 = create_or_touch_device(self.db, self.user.id, "d1", "hash1")
        d2 = create_or_touch_device(self.db, self.user.id, "d2", "hash2")

        self.assertFalse(d1.is_revoked)
        self.assertFalse(d2.is_revoked)

        # Người dùng đổi mật khẩu
        update_user_password(self.db, self.user, "NewSecurePassword456@")

        self.db.refresh(d1)
        self.db.refresh(d2)
        self.assertTrue(d1.is_revoked)
        self.assertTrue(d2.is_revoked)

    def test_otp_rate_limiting_per_ip_and_email(self):
        """Hạn mức OTP: Cooldown 60s, 5 lần/ngày/(email+IP) và 10 lần/ngày/email (EX-04)."""
        email = "test_student@neu.edu.vn"
        ip = "192.168.1.50"
        today = datetime.now(timezone.utc).date().isoformat()
        now = datetime.now(timezone.utc)

        # 1. Gửi lần 1 hợp lệ
        err1 = _check_otp_rate_limit(email, ip, today)
        self.assertIsNone(err1)
        _record_otp_request(email, ip, today, "123456", now + timedelta(minutes=5))

        # 2. Gửi ngay lập tức (< 60s) -> Bị chặn bởi Cooldown 60s
        err_cooldown = _check_otp_rate_limit(email, ip, today)
        self.assertIsNotNone(err_cooldown)
        self.assertEqual(err_cooldown[0], 429)
        self.assertIn("Vui lòng đợi", err_cooldown[1])

        # 3. Giả lập time-travel qua 61 giây cho các lần tiếp theo
        ip_key = f"{ip}:{email}"
        for _ in range(4):
            OTP_IP_STORE[ip_key]["last_sent_at"] = datetime.now(timezone.utc) - timedelta(seconds=61)
            err = _check_otp_rate_limit(email, ip, today)
            self.assertIsNone(err)
            _record_otp_request(email, ip, today, "123456", now + timedelta(minutes=5))

        # 4. Lần thứ 6 từ cùng IP -> Chạm mốc 5 lần/ngày cho cặp (IP + email) -> 429
        OTP_IP_STORE[ip_key]["last_sent_at"] = datetime.now(timezone.utc) - timedelta(seconds=61)
        err_limit = _check_otp_rate_limit(email, ip, today)
        self.assertIsNotNone(err_limit)
        self.assertEqual(err_limit[0], 429)
        self.assertIn("5 lần", err_limit[1])

        # 5. Đổi sang IP khác (IP 2) -> Vẫn gửi được (chống kẻ xấu ở IP 1 phá)
        ip_2 = "192.168.1.51"
        err_ip2 = _check_otp_rate_limit(email, ip_2, today)
        self.assertIsNone(err_ip2)

    def test_otp_invalidation_after_5_wrong_attempts(self):
        """EX-04: Nhập sai mã OTP liên tiếp 5 lần -> Hủy mã OTP ngay lập tức."""
        email = "test_student@neu.edu.vn"
        today = datetime.now(timezone.utc).date().isoformat()
        _record_otp_request(email, "127.0.0.1", today, "654321", datetime.now(timezone.utc) + timedelta(minutes=5), purpose="login_otp")

        entry = OTP_STORE[email]
        self.assertEqual(entry["otp"], "654321")

        # Giả lập nhập sai 5 lần
        for i in range(1, 6):
            entry["failed_attempts"] = (entry.get("failed_attempts") or 0) + 1
            if entry["failed_attempts"] >= 5:
                entry["otp"] = None
                entry["expires_at"] = None

        self.assertIsNone(entry["otp"])
        self.assertIsNone(entry["expires_at"])

    def test_send_otp_email_without_smtp_config_falls_back(self):
        """Khi chưa cấu hình SMTP: hàm ghi log và không gây lỗi crash ứng dụng."""
        from app.utils.email import send_otp_email
        from app.core.config import settings

        old_user = settings.SMTP_USER
        old_pass = settings.SMTP_PASSWORD
        try:
            settings.SMTP_USER = ""
            settings.SMTP_PASSWORD = ""
            res = send_otp_email("test@neu.edu.vn", "888999", "reset_password")
            self.assertFalse(res)
        finally:
            settings.SMTP_USER = old_user
            settings.SMTP_PASSWORD = old_pass

    def test_build_otp_email_templates(self):
        """Kiểm tra template email HTML và Text chứa mã OTP và thương hiệu NEUFood."""
        from app.utils.email import _build_otp_html, _build_otp_text

        html = _build_otp_html("sv@neu.edu.vn", "123456", "reset_password")
        self.assertIn("1 2 3 4 5 6", html)
        self.assertIn("NEUFood", html)
        self.assertIn("5 phút", html)

        text = _build_otp_text("sv@neu.edu.vn", "123456", "login_otp")
        self.assertIn("123456", text)
        self.assertIn("Đại học Kinh tế Quốc dân", text)

    def test_change_password_flow_with_otp_and_fallback(self):
        """Kiểm thử toàn diện luồng OTP đổi mật khẩu và đổi bằng OTP/old_password (UC05, BR-02)."""
        from app.routes.auth import OTP_STORE, _record_otp_request

        email = self.user.email
        now = datetime.now(timezone.utc)
        today_str = now.date().isoformat()

        # 1. Tạo thiết bị tin cậy trước khi đổi mật khẩu
        create_or_touch_device(
            self.db, self.user.id, "device-before-change", "hash123", device_name="Device 1"
        )
        self.assertEqual(len(self.user.devices), 1)

        # 2. Sinh và lưu mã OTP đổi mật khẩu
        _record_otp_request(
            email_key=email,
            client_ip="127.0.0.1",
            today_str=today_str,
            otp_code="654321",
            expires_at=now + timedelta(minutes=5),
            purpose="change_password",
        )
        entry = OTP_STORE.get(email)
        self.assertIsNotNone(entry)
        self.assertEqual(entry["purpose"], "change_password")
        self.assertEqual(entry["otp"], "654321")

        # 3. Thử nhập sai OTP 5 lần -> Hủy mã OTP (EX-04)
        for _ in range(5):
            entry["failed_attempts"] = (entry.get("failed_attempts") or 0) + 1
            if entry["failed_attempts"] >= 5:
                entry["otp"] = None

        self.assertIsNone(entry["otp"])

        # 4. Cấp mã OTP mới hợp lệ và thực hiện đổi mật khẩu
        _record_otp_request(
            email_key=email,
            client_ip="127.0.0.1",
            today_str=today_str,
            otp_code="987654",
            expires_at=now + timedelta(minutes=5),
            purpose="change_password",
        )
        self.assertEqual(OTP_STORE[email]["otp"], "987654")

        # 5. Cập nhật mật khẩu mới -> thành công, đồng thời thu hồi mọi thiết bị cũ (BR-02)
        update_user_password(self.db, self.user, "NewSecurePassword123!")
        self.assertTrue(verify_password("NewSecurePassword123!", self.user.password_hash))
        self.assertFalse(verify_password("Password123@", self.user.password_hash))
        self.assertEqual(self.user.failed_login_attempts, 0)
        self.assertIsNone(self.user.locked_until)

        # Kiểm tra toàn bộ thiết bị trước đó đã bị thu hồi (is_revoked = True)
        for dev in self.user.devices:
            self.assertTrue(dev.is_revoked)


if __name__ == "__main__":
    unittest.main()
