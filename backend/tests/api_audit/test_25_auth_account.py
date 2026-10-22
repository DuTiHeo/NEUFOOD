from tests.api_audit.base import ApiTestCase


class Test25AuthAccount(ApiTestCase):
    """
    Kịch bản S13: Phân hệ 1 - Xác thực, Đăng ký, Khóa tài khoản sai mật khẩu (BR-02), Cập nhật hồ sơ.
    Quy tắc nghiệp vụ: UC01, UC02, UC03, UC04, UC05, BR-01, BR-02, EX-01, EX-02, EX-03, EX-04.
    """

    def test_ex01_duplicate_email_or_student_id_rejected(self):
        """Đăng ký trùng Email hoặc Mã sinh viên -> EX-01 (BR-01)."""
        # Trùng email đã có (admin@neufood.vn)
        resp_email = self.request(
            "POST",
            "/api/v1/auth/register",
            json={
                "email": "admin@neufood.vn",
                "password": "Password123!",
                "full_name": "Trùng Email",
                "phone_number": "0911223344"
            }
        )
        self.assertEqual(resp_email.status_code, 400)
        self.assertIn("Email đã tồn tại", str(resp_email.get_json()))

        # Trùng mã sinh viên của User 4 (11215432)
        resp_student = self.request(
            "POST",
            "/api/v1/auth/register",
            json={
                "email": "unique_student@neu.edu.vn",
                "password": "Password123!",
                "full_name": "Trùng MSSV",
                "phone_number": "0911223344",
                "student_id": "11215432"
            }
        )
        self.assertEqual(resp_student.status_code, 400)
        self.assertIn("Mã sinh viên đã tồn tại", str(resp_student.get_json()))

    def test_br01_invalid_phone_number_format(self):
        """Số điện thoại không đúng 10 chữ số di động VN -> Bị từ chối (BR-01)."""
        invalid_phones = ["098765432", "09876543210", "1234567890", "09876abcde"]
        for phone in invalid_phones:
            with self.subTest(phone=phone):
                resp = self.request(
                    "POST",
                    "/api/v1/auth/register",
                    json={
                        "email": f"phone_test_{phone}@neu.edu.vn",
                        "password": "Password123!",
                        "full_name": "Test Phone",
                        "phone_number": phone
                    }
                )
                self.assertIn(resp.status_code, (400, 422))

    def test_br02_ex02_failed_login_locks_account_for_15_minutes(self):
        """Sai mật khẩu 5 lần liên tiếp -> Khóa tài khoản 15 phút (BR-02, EX-02)."""
        target_email = "sinhvien@neu.edu.vn"

        # 4 lần đầu nhập sai mật khẩu -> Báo sai thông tin đăng nhập (401), chưa bị khóa
        for i in range(4):
            resp = self.request("POST", "/api/v1/auth/login", json={"email": target_email, "password": "WrongPassword"})
            self.assertEqual(resp.status_code, 401)

        # Lần thứ 5 nhập sai -> Chạm mốc khóa tài khoản 15 phút -> Trả về 403 (EX-02)
        resp_5th = self.request("POST", "/api/v1/auth/login", json={"email": target_email, "password": "WrongPassword"})
        self.assertEqual(resp_5th.status_code, 403)
        self.assertIn("Tài khoản bị khóa tạm thời 15 phút", str(resp_5th.get_json()))

        # Khi đang bị khóa: nhập ĐÚNG mật khẩu vẫn bị chặn 403
        resp_correct_during_lock = self.request(
            "POST",
            "/api/v1/auth/login",
            json={"email": target_email, "password": "password123"}
        )
        self.assertEqual(resp_correct_during_lock.status_code, 403)

        # Giả lập time-travel: Quá 15 phút khóa (BR-02)
        self.execute_sql("UPDATE users SET locked_until = NOW() - INTERVAL '1 minute' WHERE email = %s", (target_email,))

        # Đăng nhập lại với đúng mật khẩu -> Thành công và reset failed_login_attempts về 0
        resp_recovered = self.request(
            "POST",
            "/api/v1/auth/login",
            json={"email": target_email, "password": "password123"}
        )
        self.assert_envelope(resp_recovered, 200, True)

        # Kiểm tra DB đã reset
        rows = self.query_sql("SELECT failed_login_attempts, locked_until FROM users WHERE email = %s", (target_email,))
        self.assertEqual(rows[0][0], 0)
        self.assertIsNone(rows[0][1])

    def test_change_password_invalidates_old_password(self):
        """Đổi mật khẩu (UC05) -> Mật khẩu cũ không còn đăng nhập được."""
        cust_token = self.login("sinhvien@neu.edu.vn")

        # Đổi mật khẩu
        resp_chg = self.request(
            "POST",
            "/api/v1/auth/change-password",
            token=cust_token,
            json={"old_password": "password123", "new_password": "NewSecretPassword123!"}
        )
        self.assert_envelope(resp_chg, 200, True)

        # Đăng nhập bằng mật khẩu cũ -> Thất bại 401
        resp_old = self.request("POST", "/api/v1/auth/login", json={"email": "sinhvien@neu.edu.vn", "password": "password123"})
        self.assertEqual(resp_old.status_code, 401)

        # Đăng nhập bằng mật khẩu mới -> Thành công 200
        resp_new = self.request("POST", "/api/v1/auth/login", json={"email": "sinhvien@neu.edu.vn", "password": "NewSecretPassword123!"})
        self.assert_envelope(resp_new, 200, True)


if __name__ == "__main__":
    unittest.main()
