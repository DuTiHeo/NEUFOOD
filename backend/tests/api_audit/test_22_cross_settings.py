import unittest
from tests.api_audit.base import ApiTestCase


class Test22CrossSettings(ApiTestCase):
    """
    Kịch bản S7: Liên kết Cấu hình hệ thống (Settings) xuyên suốt Đơn hàng, Thực đơn & Khiếu nại.
    Quy tắc nghiệp vụ: §2.3.5, BR-07, BR-12, BR-13, BR-14, BR-16.
    """

    def test_delivery_fee_setting_controls_order_shipping(self):
        """Admin đổi delivery_fee từ 5k lên 8k -> Đơn mới tự động tính phí ship 8k (BR-13)."""
        admin_token = self.get_admin_token()
        resp_set = self.request(
            "PUT",
            "/api/v1/settings/delivery_fee",
            token=admin_token,
            json={"setting_value": "8000"}
        )
        self.assert_envelope(resp_set, 200, True)

        # Khách tạo đơn delivery mới
        cust_token = self.login("sinhvien@neu.edu.vn")
        self.execute_sql("UPDATE orders SET status = 'HOAN_THANH' WHERE user_id = 4")
        payload = {
            "order_type": "delivery",
            "recipient_name": "Nguyễn Sinh Viên",
            "recipient_phone": "0977112233",
            "campus_location_id": 1,
            "room_detail": "Phòng 101",
            "delivery_address": "Phòng 101, Tòa nhà Thế Kỷ A1, Đại học Kinh tế Quốc dân",
            "payment_method": "cod_cash",
            "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
        }
        resp_order = self.request("POST", "/api/v1/orders", token=cust_token, json=payload)
        order_data = self.assert_envelope(resp_order, 201, True)["data"]
        self.assertEqual(order_data["ship_fee"], 8000.0)
        self.assertEqual(order_data["total_amount"], 50000.0 + 8000.0)

    def test_max_cod_amount_setting_enforced(self):
        """Admin hạ trần max_cod_amount xuống 100k -> Đơn 105k bị chặn lỗi EX-11 (BR-14)."""
        admin_token = self.get_admin_token()
        self.request("PUT", "/api/v1/settings/max_cod_amount", token=admin_token, json={"setting_value": "100000"})

        cust_token = self.login("sinhvien@neu.edu.vn")
        self.execute_sql("UPDATE orders SET status = 'HOAN_THANH' WHERE user_id = 4")
        payload = {
            "order_type": "delivery",
            "recipient_name": "Nguyễn Sinh Viên",
            "recipient_phone": "0977112233",
            "campus_location_id": 1,
            "room_detail": "Phòng 101",
            "delivery_address": "Phòng 101, Tòa nhà Thế Kỷ A1, Đại học Kinh tế Quốc dân",
            "payment_method": "cod_cash",
            # 2 bát phở (100k) + 5k ship = 105k > 100k
            "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 2}]
        }
        resp = self.request("POST", "/api/v1/orders", token=cust_token, json=payload)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("EX-11", str(resp.get_json()))

    def test_max_quantity_setting_enforced(self):
        """Admin hạ max_dish_quantity_per_order xuống 3 -> Mua 4 phần bị chặn lỗi EX-06 (BR-07)."""
        admin_token = self.get_admin_token()
        self.request("PUT", "/api/v1/settings/max_dish_quantity_per_order", token=admin_token, json={"setting_value": "3"})

        cust_token = self.login("sinhvien@neu.edu.vn")
        self.execute_sql("UPDATE orders SET status = 'HOAN_THANH' WHERE user_id = 4")
        payload = {
            "order_type": "pickup",
            "recipient_name": "Nguyễn Sinh Viên",
            "recipient_phone": "0977112233",
            "delivery_address": "Quầy Canteen",
            "payment_method": "cod_cash",
            "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 4}]
        }
        resp = self.request("POST", "/api/v1/orders", token=cust_token, json=payload)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("EX-06", str(resp.get_json()))

    def test_f3_system_maintenance_fee_dynamically_applied_to_dishes(self):
        """
        [F3] docs/Quy_Trinh_Nghiep_Vu.md §1.3 & §2.3.5:
        Phụ phí hệ thống (system_maintenance_fee) nằm trong bảng system_settings và do Admin thiết lập.
        Khi Admin cập nhật setting này từ 5000 lên 7000, món mới tạo phải có price = base_price + 7000.
        Hiện tại crud/dish.py hardcode: SYSTEM_FEE = Decimal('5000') nên setting không có tác dụng.
        """
        admin_token = self.get_admin_token()
        # Admin đổi phụ phí bảo trì hệ thống lên 7.000 VNĐ
        self.request(
            "PUT",
            "/api/v1/settings/system_maintenance_fee",
            token=admin_token,
            json={"setting_value": "7000"}
        )

        # Quản lý Canteen tạo món mới với base_price = 40.000 VNĐ
        manager_token = self.get_manager_token()
        new_dish_payload = {
            "id": "mon-test-fee",
            "name": "Món Test Phụ Phí",
            "base_price": 40000.0,
            "category_ids": ["mi-pho"]
        }
        resp_dish = self.request("POST", "/api/v1/dishes", token=manager_token, json=new_dish_payload)
        dish_data = self.assert_envelope(resp_dish, 201, True)["data"]

        # Kỳ vọng: price = 40.000 + 7.000 = 47.000 VNĐ
        self.assertEqual(
            dish_data["price"],
            47000.0,
            f"Giá món niêm yết {dish_data['price']} != 47000 (do SYSTEM_FEE bị hardcode 5000)"
        )


if __name__ == "__main__":
    unittest.main()
