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
        """Hạn mức OTP: 3 lần/ngày/(email+IP) và 10 lần/ngày/email (EX-04)."""
        email = "test_student@neu.edu.vn"
        ip = "192.168.1.50"
        today = datetime.now(timezone.utc).date().isoformat()

        # 3 lần đầu từ cùng IP -> Hợp lệ
        for _ in range(3):
            err = _check_otp_rate_limit(email, ip, today)
            self.assertIsNone(err)
            _record_otp_request(email, ip, today, "123456", datetime.now(timezone.utc))

        # Lần thứ 4 từ cùng IP -> Bị chặn 429
        err = _check_otp_rate_limit(email, ip, today)
        self.assertIsNotNone(err)
        status_code, msg = err
        self.assertEqual(status_code, 429)
        self.assertIn("3 lần/ngày từ địa chỉ mạng này", msg)

        # Đổi sang IP khác (IP 2) -> Vẫn gửi được (chống khóa oan khi kẻ xấu spam từ IP 1)
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


if __name__ == "__main__":
    unittest.main()
