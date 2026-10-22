import unittest
from tests.api_audit.base import ApiTestCase


class Test23CrossAdminUser(ApiTestCase):
    """
    Kịch bản S10: Quản trị Người dùng & Ràng buộc Đơn dở (EX-22), Lỗ hổng JWT Token cũ (F2).
    Quy tắc nghiệp vụ: UC23, EX-22, BR-02, BR-08.
    """

    def test_ex22_cannot_deactivate_user_with_active_orders(self):
        """Admin cố tình khóa tài khoản đang có đơn dở -> Bị chặn lỗi EX-22 (EX-22, UC23)."""
        admin_token = self.get_admin_token()

        # User 4 (sinhvien@neu.edu.vn) đang có đơn mẫu NF2610153456 ở trạng thái CHO_XAC_NHAN
        resp_lock = self.request(
            "PATCH",
            "/api/v1/users/admin/4/status",
            token=admin_token,
            json={"is_active": False}
        )
        self.assertEqual(resp_lock.status_code, 400)
        self.assertIn("EX-22", str(resp_lock.get_json()))

        # Sau khi hoàn thành toàn bộ đơn dở -> Khóa thành công
        self.execute_sql("UPDATE orders SET status = 'HOAN_THANH' WHERE user_id = 4")
        resp_lock_ok = self.request(
            "PATCH",
            "/api/v1/users/admin/4/status",
            token=admin_token,
            json={"is_active": False}
        )
        self.assert_envelope(resp_lock_ok, 200, True)

    def test_f2_deactivated_user_token_rejected_on_all_endpoints(self):
        """
        [F2] Lỗ hổng JWT Stateless: jwt_required không truy vấn lại trạng thái is_active từ DB.
        Khi Admin khóa tài khoản (is_active = False), token cũ (hạn 24h) vẫn gọi được các endpoint
        chỉ dùng @jwt_required thuần túy như GET /orders hoặc GET /dishes.
        Theo chuẩn an toàn, tài khoản bị khóa phải bị từ chối 401/403 ở mọi endpoint.
        """
        # 1. Khách hàng đăng nhập lấy token
        cust_token = self.login("sinhvien@neu.edu.vn")
        self.execute_sql("UPDATE orders SET status = 'HOAN_THANH' WHERE user_id = 4")

        # 2. Admin khóa tài khoản khách hàng
        admin_token = self.get_admin_token()
        self.request(
            "PATCH",
            "/api/v1/users/admin/4/status",
            token=admin_token,
            json={"is_active": False}
        )

        # 3. Khách hàng dùng token cũ gọi GET /api/v1/orders
        resp = self.request("GET", "/api/v1/orders", token=cust_token)
        # Kỳ vọng: 401 hoặc 403 vì tài khoản đã bị khóa trong DB
        self.assertIn(
            resp.status_code,
            (401, 403),
            f"Tài khoản bị khóa nhưng token cũ vẫn gọi thành công GET /orders (status={resp.status_code})"
        )


if __name__ == "__main__":
    unittest.main()
