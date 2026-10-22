import unittest
from tests.api_audit.base import ApiTestCase


class Test01ContractAndRBAC(ApiTestCase):
    """
    Rà soát Hợp đồng & Phân quyền RBAC cho toàn bộ endpoint theo:
    - docs/Quy_Trinh_Nghiep_Vu.md Chương 2 (Ma trận phân quyền)
    - Chuẩn JSON response envelope (api_response)
    """

    # --- Nhóm 1: Xác thực công khai & Yêu cầu đăng nhập (401) ---

    def test_public_endpoints_accessible_without_token(self):
        """Khách vãng lai (Guest) được xem thực đơn, danh mục, địa điểm, đánh giá (UC06, UC07, UC24)."""
        public_urls = [
            ("GET", "/api/v1/dishes/categories"),
            ("GET", "/api/v1/dishes"),
            ("GET", "/api/v1/dishes/pho-bo-tai-lan"),
            ("GET", "/api/v1/reviews/dish/pho-bo-tai-lan"),
            ("GET", "/api/v1/locations"),
            ("GET", "/api/v1/settings"),
            ("GET", "/api/v1/settings/delivery_fee"),
            ("POST", "/api/v1/dishes/validate-cart", {"dish_ids": ["pho-bo-tai-lan"]}),
        ]
        for item in public_urls:
            method, path = item[0], item[1]
            json_body = item[2] if len(item) > 2 else None
            with self.subTest(path=path):
                resp = self.request(method, path, json=json_body)
                self.assertIn(resp.status_code, (200, 201), f"Public endpoint {path} failed: {resp.status_code}")
                data = resp.get_json()
                self.assertTrue(data.get("success"), f"Endpoint {path} failed: {data}")

    def test_protected_endpoints_require_jwt(self):
        """Mọi endpoint bảo vệ phải từ chối khi không có Bearer token (401)."""
        protected_urls = [
            ("GET", "/api/v1/auth/me"),
            ("POST", "/api/v1/auth/logout"),
            ("POST", "/api/v1/auth/change-password"),
            ("GET", "/api/v1/users/profile"),
            ("PUT", "/api/v1/users/profile"),
            ("GET", "/api/v1/users/admin/all"),
            ("PATCH", "/api/v1/users/admin/1/status"),
            ("PATCH", "/api/v1/users/admin/1/blacklist"),
            ("PUT", "/api/v1/settings/delivery_fee"),
            ("PUT", "/api/v1/settings/bulk"),
            ("POST", "/api/v1/dishes"),
            ("PUT", "/api/v1/dishes/pho-bo-tai-lan"),
            ("DELETE", "/api/v1/dishes/pho-bo-tai-lan"),
            ("PATCH", "/api/v1/dishes/pho-bo-tai-lan/availability"),
            ("POST", "/api/v1/locations"),
            ("PUT", "/api/v1/locations/1"),
            ("DELETE", "/api/v1/locations/1"),
            ("POST", "/api/v1/orders"),
            ("GET", "/api/v1/orders"),
            ("GET", "/api/v1/orders/NF2610153456"),
            ("GET", "/api/v1/orders/admin/all"),
            ("POST", "/api/v1/orders/NF2610153456/cancel"),
            ("PATCH", "/api/v1/orders/NF2610153456/process"),
            ("PATCH", "/api/v1/orders/NF2610153456/status"),
            ("POST", "/api/v1/orders/NF2610153456/handover"),
            ("POST", "/api/v1/orders/NF2610153456/delivery-issue"),
            ("POST", "/api/v1/orders/NF2610153456/confirm-receipt"),
            ("POST", "/api/v1/reviews"),
            ("GET", "/api/v1/complaints"),
            ("POST", "/api/v1/complaints"),
            ("PATCH", "/api/v1/complaints/1/resolve"),
            ("GET", "/api/v1/shifts"),
            ("GET", "/api/v1/shifts/my-current-shift"),
            ("POST", "/api/v1/shifts/submit"),
            ("PATCH", "/api/v1/shifts/1/close"),
            ("GET", "/api/v1/shifts/reports/summary"),
        ]
        for method, path in protected_urls:
            with self.subTest(path=path):
                resp = self.request(method, path)
                self.assertEqual(resp.status_code, 401, f"{path} không yêu cầu JWT (status={resp.status_code})")

    # --- Nhóm 2: Phân quyền vai trò chi tiết (RBAC) ---

    def test_customer_cannot_access_staff_or_admin_endpoints(self):
        """Khách hàng không được phép gọi endpoint của Staff, Manager, Admin (403)."""
        customer_token = self.get_customer_token()
        forbidden_calls = [
            ("GET", "/api/v1/users/admin/all"),
            ("PATCH", "/api/v1/users/admin/1/status", {"is_active": False}),
            ("PATCH", "/api/v1/users/admin/1/blacklist", {"is_blacklisted": True}),
            ("PUT", "/api/v1/settings/delivery_fee", {"setting_value": "6000"}),
            ("POST", "/api/v1/dishes", {"name": "Món lậu"}),
            ("PATCH", "/api/v1/dishes/pho-bo-tai-lan/availability", {"is_available": False}),
            ("POST", "/api/v1/locations", {"building_code": "X", "building_name": "Tòa X"}),
            ("GET", "/api/v1/orders/admin/all"),
            ("PATCH", "/api/v1/orders/NF2610153456/process", {"action": "accept"}),
            ("POST", "/api/v1/orders/NF2610153456/handover", {"order_code_suffix": "3456"}),
            ("PATCH", "/api/v1/complaints/1/resolve", {"status": "CHAP_NHAN", "admin_response": "OK"}),
            ("GET", "/api/v1/shifts"),
            ("POST", "/api/v1/shifts/submit", {"actual_cash": 10000, "actual_qr": 0}),
            ("PATCH", "/api/v1/shifts/1/close", {"status": "DA_CHOT"}),
            ("GET", "/api/v1/shifts/reports/summary"),
        ]
        for item in forbidden_calls:
            method, path = item[0], item[1]
            json_body = item[2] if len(item) > 2 else None
            with self.subTest(path=path):
                resp = self.request(method, path, token=customer_token, json=json_body)
                self.assertEqual(resp.status_code, 403, f"Customer truy cập được {path} (status={resp.status_code})")

    def test_staff_cannot_modify_menu_or_access_admin_settings(self):
        """Nhân viên (Staff) không có quyền CRUD thực đơn, quản lý tài khoản hay cấu hình hệ thống."""
        staff_token = self.get_staff_token()
        forbidden_calls = [
            ("POST", "/api/v1/dishes", {"name": "Món mới"}),
            ("PUT", "/api/v1/dishes/pho-bo-tai-lan", {"name": "Tên mới"}),
            ("DELETE", "/api/v1/dishes/pho-bo-tai-lan"),
            ("GET", "/api/v1/users/admin/all"),
            ("PATCH", "/api/v1/users/admin/1/status", {"is_active": False}),
            ("PUT", "/api/v1/settings/delivery_fee", {"setting_value": "10000"}),
            ("POST", "/api/v1/locations", {"building_code": "X", "building_name": "Tòa X"}),
            ("PATCH", "/api/v1/complaints/1/resolve", {"status": "CHAP_NHAN", "admin_response": "OK"}),
            ("PATCH", "/api/v1/shifts/1/close", {"status": "DA_CHOT"}),
            ("GET", "/api/v1/shifts/reports/summary"),
        ]
        for item in forbidden_calls:
            method, path = item[0], item[1]
            json_body = item[2] if len(item) > 2 else None
            with self.subTest(path=path):
                resp = self.request(method, path, token=staff_token, json=json_body)
                self.assertEqual(resp.status_code, 403, f"Staff truy cập trái phép {path} (status={resp.status_code})")

    def test_manager_cannot_manage_users_locations_or_resolve_complaints(self):
        """Quản lý Canteen (Manager) không có quyền can thiệp tài khoản, vị trí hay khiếu nại (độc quyền Admin)."""
        manager_token = self.get_manager_token()
        forbidden_calls = [
            ("GET", "/api/v1/users/admin/all"),
            ("PATCH", "/api/v1/users/admin/1/status", {"is_active": False}),
            ("PATCH", "/api/v1/users/admin/1/blacklist", {"is_blacklisted": True}),
            ("POST", "/api/v1/locations", {"building_code": "X", "building_name": "Tòa X"}),
            ("DELETE", "/api/v1/locations/1"),
            ("PUT", "/api/v1/settings/delivery_fee", {"setting_value": "10000"}),
            ("PATCH", "/api/v1/complaints/1/resolve", {"status": "CHAP_NHAN", "admin_response": "OK"}),
        ]
        for item in forbidden_calls:
            method, path = item[0], item[1]
            json_body = item[2] if len(item) > 2 else None
            with self.subTest(path=path):
                resp = self.request(method, path, token=manager_token, json=json_body)
                self.assertEqual(resp.status_code, 403, f"Manager truy cập trái phép {path} (status={resp.status_code})")

    # --- Nhóm 3: Kiểm tra xung đột tài liệu F11 (Admin có được CRUD/bật tắt món không?) ---

    def test_f11_admin_forbidden_from_dish_crud_and_toggle(self):
        """
        [F11] docs/Quy_Trinh_Nghiep_Vu.md §2.2 quy định Admin = 'Không' cho CRUD món và Bật/tắt món.
        Hiện tại routes/dish.py cho phép @role_required('manager', 'admin') và @role_required('staff', 'manager', 'admin').
        """
        admin_token = self.get_admin_token()
        # Admin bật/tắt món phải bị 403 theo Quy_Trinh_Nghiep_Vu.md
        resp = self.request(
            "PATCH",
            "/api/v1/dishes/pho-bo-tai-lan/availability",
            token=admin_token,
            json={"is_available": False}
        )
        self.assertEqual(resp.status_code, 403, "Theo Quy_Trinh_Nghiep_Vu §2.2, Admin không được bật/tắt món")

    # --- Nhóm 4: Kiểm tra chuẩn Response Envelope (F9) ---

    def test_authenticated_response_envelope_compliance(self):
        """Mọi phản hồi 200/400/403/404 phải có đầy đủ success, message, data."""
        admin_token = self.get_admin_token()
        resp = self.request("GET", "/api/v1/settings", token=admin_token)
        self.assert_envelope(resp, 200, True)

    def test_f9_unauthorized_response_has_standard_envelope(self):
        """
        [F9] Khi chưa đăng nhập (401), decorator jwt_required trả jsonify thiếu trường 'data'.
        Theo chuẩn §5.1, mọi phản hồi bắt buộc qua api_response (chứa success, message, data).
        """
        resp = self.request("GET", "/api/v1/auth/me")
        self.assertEqual(resp.status_code, 401)
        data = resp.get_json()
        self.assertIn("data", data, "jwt_required trả về thiếu trường 'data' theo chuẩn api_response")


if __name__ == "__main__":
    unittest.main()
