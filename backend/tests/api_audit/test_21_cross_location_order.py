from tests.api_audit.base import ApiTestCase


class Test21CrossLocationOrder(ApiTestCase):
    """
    Kịch bản S9: Liên kết Địa điểm nội khu NEU & Đơn hàng Delivery.
    Quy tắc nghiệp vụ: BR-09, BR-10, EX-07, EX-23, UC09, UC24.
    """

    def test_invalid_or_inactive_location_rejected(self):
        """Đơn giao tận nơi chọn địa điểm không tồn tại hoặc đã tạm dừng phục vụ -> EX-07 (BR-09)."""
        cust_token = self.login("sinhvien@neu.edu.vn")
        self.execute_sql("UPDATE orders SET status = 'HOAN_THANH' WHERE user_id = 4")

        # 1. Location ID = 99999 không tồn tại
        payload_invalid = {
            "order_type": "delivery",
            "recipient_name": "Nguyễn Sinh Viên",
            "recipient_phone": "0977112233",
            "campus_location_id": 99999,
            "room_detail": "Phòng 101",
            "payment_method": "cod_cash",
            "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
        }
        resp = self.request("POST", "/api/v1/orders", token=cust_token, json=payload_invalid)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("EX-07", str(resp.get_json()))

        # 2. Location ID = 1 bị Admin tạm ngừng (is_active = False)
        admin_token = self.get_admin_token()
        self.request(
            "PUT",
            "/api/v1/locations/1",
            token=admin_token,
            json={"building_code": "A1", "building_name": "Tòa A1", "is_active": False}
        )

        payload_inactive = {**payload_invalid, "campus_location_id": 1}
        resp_inactive = self.request("POST", "/api/v1/orders", token=cust_token, json=payload_inactive)
        self.assertEqual(resp_inactive.status_code, 400)
        self.assertIn("EX-07", str(resp_inactive.get_json()))

    def test_delete_location_with_active_orders_is_soft_deactivated(self):
        """Xóa địa điểm đang có đơn chưa hoàn thành chỉ chuyển is_active = False (BR-10, EX-23)."""
        admin_token = self.get_admin_token()

        # Location ID = 1 (Tòa A1) đang có đơn mẫu NF2610153456 ở trạng thái CHO_XAC_NHAN
        resp_del = self.request("DELETE", "/api/v1/locations/1", token=admin_token)
        self.assert_envelope(resp_del, 200, True)

        # Kiểm tra database: Không bị xóa cứng mà được cập nhật is_active = False
        rows = self.query_sql("SELECT is_active FROM campus_locations WHERE id = 1")
        self.assertEqual(len(rows), 1)
        self.assertFalse(rows[0][0])  # is_active = False

        # Khách xem danh sách không thấy tòa A1
        resp_pub = self.request("GET", "/api/v1/locations")
        pub_locs = self.assert_envelope(resp_pub, 200, True)["data"]
        self.assertFalse(any(l["id"] == 1 for l in pub_locs))

        # Admin xem với ?all=true vẫn thấy tòa A1
        resp_all = self.request("GET", "/api/v1/locations", token=admin_token, query_string={"all": "true"})
        all_locs = self.assert_envelope(resp_all, 200, True)["data"]
        self.assertTrue(any(l["id"] == 1 for l in all_locs))


if __name__ == "__main__":
    unittest.main()
