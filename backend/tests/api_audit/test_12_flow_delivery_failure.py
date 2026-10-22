from tests.api_audit.base import ApiTestCase


class Test12FlowDeliveryFailure(ApiTestCase):
    """
    Kịch bản S3: Luồng Giao hàng thất bại tạm thời (GIAO_THAT_BAI), mang về quầy giữ 30p, thu đủ cả ship 5k.
    Quy tắc nghiệp vụ: BR-20, EX-18, BR-22.
    """

    def _create_and_dispatch_delivery_order(self):
        """Helper tạo đơn delivery và chuyển tới trạng thái DANG_GIAO."""
        cust_token = self.login("sinhvien@neu.edu.vn")
        # Hoàn thành các đơn dở cũ của sinhvien
        self.execute_sql("UPDATE orders SET status = 'HOAN_THANH' WHERE user_id = 4")

        payload = {
            "order_type": "delivery",
            "recipient_name": "Nguyễn Sinh Viên",
            "recipient_phone": "0977112233",
            "campus_location_id": 1,
            "room_detail": "Phòng 301",
            "delivery_address": "Phòng 301, Tòa nhà Thế Kỷ A1, Đại học Kinh tế Quốc dân",
            "payment_method": "cod_cash",
            "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
        }
        resp = self.request("POST", "/api/v1/orders", token=cust_token, json=payload)
        order_data = self.assert_envelope(resp, 201, True)["data"]
        order_id = order_data["id"]
        order_suffix = order_data["order_code_suffix"]

        staff_token = self.get_staff_token()
        self.request("PATCH", f"/api/v1/orders/{order_id}/process", token=staff_token, json={"action": "accept"})
        self.request("PATCH", f"/api/v1/orders/{order_id}/status", token=staff_token, json={"status": "DANG_GIAO"})

        return order_id, order_suffix, staff_token, cust_token

    def test_delivery_failure_recovery_at_counter_charges_full_ship_fee(self):
        """Khách không nghe máy -> GIAO_THAT_BAI -> Khách ra quầy nhận vẫn trả đủ cả tiền ship 5k (BR-20)."""
        order_id, order_suffix, staff_token, cust_token = self._create_and_dispatch_delivery_order()

        # 1. Shipper gọi điện 5-10p không được -> Báo sự cố no_answer (EX-18)
        issue_payload = {
            "issue_type": "no_answer",
            "reason": "Gọi 3 cuộc liên tiếp chuông reo không ai nhấc máy"
        }
        resp_issue = self.request("POST", f"/api/v1/orders/{order_id}/delivery-issue", token=staff_token, json=issue_payload)
        data_failed = self.assert_envelope(resp_issue, 200, True)["data"]
        self.assertEqual(data_failed["status"], "GIAO_THAT_BAI")
        self.assertIsNotNone(data_failed["pickup_deadline"])

        # 2. Khách ra quầy Canteen A2 trong vòng 30 phút -> Bàn giao tại quầy (DA_BAN_GIAO)
        resp_handover = self.request(
            "POST",
            f"/api/v1/orders/{order_id}/handover",
            token=staff_token,
            json={"order_code_suffix": order_suffix}
        )
        data_handover = self.assert_envelope(resp_handover, 200, True)["data"]
        self.assertEqual(data_handover["status"], "DA_BAN_GIAO")
        self.assertEqual(data_handover["payment_status"], "da_thanh_toan")
        # Xác nhận tiền ship 5k VẪN ĐƯỢC TÍNH theo BR-20
        self.assertEqual(data_handover["ship_fee"], 5000.0)
        self.assertEqual(data_handover["total_amount"], 55000.0)

    def test_delivery_failure_not_collected_within_30m_blacklists(self):
        """Khách không nghe máy, đồ mang về quầy quá 30p khách không ra lấy -> BO_DON_BLACKLIST (BR-20, BR-22)."""
        order_id, order_suffix, staff_token, cust_token = self._create_and_dispatch_delivery_order()

        # Shipper báo no_answer -> GIAO_THAT_BAI
        self.request(
            "POST",
            f"/api/v1/orders/{order_id}/delivery-issue",
            token=staff_token,
            json={"issue_type": "no_answer", "reason": "Khách không nghe máy"}
        )

        # Time-travel: Quá 30 phút lưu giữ tại quầy
        self.execute_sql(
            "UPDATE orders SET pickup_deadline = NOW() - INTERVAL '10 minutes' WHERE id = %s",
            (order_id,)
        )

        # Quá hạn tại quầy -> Thử bàn giao sẽ bị từ chối và tự động đóng BO_DON_BLACKLIST (EX-18)
        resp_handover = self.request(
            "POST",
            f"/api/v1/orders/{order_id}/handover",
            token=staff_token,
            json={"order_code_suffix": order_suffix}
        )
        self.assertEqual(resp_handover.status_code, 400)
        self.assertIn("EX-18", str(resp_handover.get_json()))

        # Kiểm tra trạng thái đơn và user trong DB
        order_row = self.query_sql("SELECT status FROM orders WHERE id = %s", (order_id,))
        self.assertEqual(order_row[0][0], "BO_DON_BLACKLIST")

        user_row = self.query_sql("SELECT is_blacklisted FROM users WHERE id = 4")
        self.assertTrue(user_row[0][0])


if __name__ == "__main__":
    unittest.main()
