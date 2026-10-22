from tests.api_audit.base import ApiTestCase


class Test11FlowPickupBlacklist(ApiTestCase):
    """
    Kịch bản S2, S4: Luồng Đơn nhận tại quầy (Pick-up), Phí ship 0đ, Quá hạn 30p quầy & Blacklist COD.
    Quy tắc nghiệp vụ: BR-13, BR-21, BR-22, EX-10, EX-18, EX-19, UC23.
    """

    def test_pickup_order_zero_ship_fee(self):
        """Đơn nhận tại quầy (Pickup) có ship_fee = 0đ (BR-13)."""
        cust_token = self.login("thanhhuong@neu.edu.vn")
        # Huỷ đơn dở cũ của thanhhuong để tạo đơn mới
        self.execute_sql("UPDATE orders SET status = 'HOAN_THANH' WHERE user_id = 5")

        payload = {
            "order_type": "pickup",
            "recipient_name": "Lê Thị Thanh Hương",
            "recipient_phone": "0988112233",
            "delivery_address": "Quầy trả món Canteen A2",
            "payment_method": "cod_cash",
            "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
        }
        resp = self.request("POST", "/api/v1/orders", token=cust_token, json=payload)
        data = self.assert_envelope(resp, 201, True)["data"]
        self.assertEqual(data["order_type"], "pickup")
        self.assertEqual(data["ship_fee"], 0.0)
        self.assertEqual(data["total_amount"], data["subtotal_amount"])

    def test_pickup_timeout_leads_to_blacklist_and_blocks_new_orders(self):
        """Khách không đến lấy món quá 30p -> BO_DON_BLACKLIST -> Bị khoá đặt hàng EX-10 -> Admin gỡ Blacklist."""
        cust_token = self.login("thanhhuong@neu.edu.vn")
        self.execute_sql("UPDATE orders SET status = 'HOAN_THANH' WHERE user_id = 5")

        # 1. Tạo đơn pickup
        payload = {
            "order_type": "pickup",
            "recipient_name": "Lê Thị Thanh Hương",
            "recipient_phone": "0988112233",
            "delivery_address": "Quầy trả món Canteen A2",
            "payment_method": "cod_cash",
            "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
        }
        resp = self.request("POST", "/api/v1/orders", token=cust_token, json=payload)
        order_id = self.assert_envelope(resp, 201, True)["data"]["id"]

        # 2. Staff duyệt đơn -> DANG_CHUAN_BI -> SAN_SANG_LAY
        staff_token = self.get_staff_token()
        self.request("PATCH", f"/api/v1/orders/{order_id}/process", token=staff_token, json={"action": "accept"})
        resp_ready = self.request("PATCH", f"/api/v1/orders/{order_id}/status", token=staff_token, json={"status": "SAN_SANG_LAY"})
        data_ready = self.assert_envelope(resp_ready, 200, True)["data"]
        self.assertEqual(data_ready["status"], "SAN_SANG_LAY")
        self.assertIsNotNone(data_ready["pickup_deadline"])

        # 3. Giả lập time-travel: quá 30 phút lưu giữ tại quầy (BR-21)
        self.execute_sql(
            "UPDATE orders SET pickup_deadline = NOW() - INTERVAL '5 minutes' WHERE id = %s",
            (order_id,)
        )

        # 4. Nhân viên báo sự cố quá hạn nhận (EX-18) -> Đơn sang BO_DON_BLACKLIST & Khách vào Blacklist COD (BR-22)
        issue_payload = {
            "issue_type": "pickup_timeout",
            "reason": "Khách không đến nhận sau 35 phút chuẩn bị"
        }
        resp_issue = self.request("POST", f"/api/v1/orders/{order_id}/delivery-issue", token=staff_token, json=issue_payload)
        issue_data = self.assert_envelope(resp_issue, 200, True)["data"]
        self.assertEqual(issue_data["status"], "BO_DON_BLACKLIST")

        # Kiểm tra cờ is_blacklisted trong database
        rows = self.query_sql("SELECT is_blacklisted, blacklist_reason FROM users WHERE id = 5")
        self.assertTrue(rows[0][0])
        self.assertIn("35 phút", rows[0][1])

        # 5. Khách cố tình tạo đơn mới -> Phải bị chặn lỗi EX-10 (403)
        resp_new = self.request("POST", "/api/v1/orders", token=cust_token, json=payload)
        self.assertEqual(resp_new.status_code, 403)
        err_data = resp_new.get_json()
        self.assertIn("EX-10", str(err_data))

        # 6. Admin kiểm tra danh sách Blacklist và gỡ phạt (UC23)
        admin_token = self.get_admin_token()
        resp_bl_list = self.request("GET", "/api/v1/users/admin/all", token=admin_token, query_string={"is_blacklisted": "true"})
        bl_users = self.assert_envelope(resp_bl_list, 200, True)["data"]
        self.assertTrue(any(u["id"] == 5 for u in bl_users))

        # Admin gỡ Blacklist
        resp_unbl = self.request(
            "PATCH",
            "/api/v1/users/admin/5/blacklist",
            token=admin_token,
            json={"is_blacklisted": False}
        )
        self.assert_envelope(resp_unbl, 200, True)

        # 7. Khách đặt lại đơn thành công sau khi gỡ Blacklist
        resp_after_unbl = self.request("POST", "/api/v1/orders", token=cust_token, json=payload)
        self.assert_envelope(resp_after_unbl, 201, True)

    def test_refuse_payment_immediately_blacklists(self):
        """Khách từ chối trả tiền COD (EX-19) -> Đóng đơn BO_DON_BLACKLIST ngay lập tức."""
        cust_token = self.login("thanhhuong@neu.edu.vn")
        self.execute_sql("UPDATE orders SET status = 'HOAN_THANH' WHERE user_id = 5")

        payload = {
            "order_type": "pickup",
            "recipient_name": "Lê Thị Thanh Hương",
            "recipient_phone": "0988112233",
            "delivery_address": "Quầy trả món Canteen A2",
            "payment_method": "cod_cash",
            "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
        }
        resp = self.request("POST", "/api/v1/orders", token=cust_token, json=payload)
        order_id = self.assert_envelope(resp, 201, True)["data"]["id"]

        staff_token = self.get_staff_token()
        self.request("PATCH", f"/api/v1/orders/{order_id}/process", token=staff_token, json={"action": "accept"})
        self.request("PATCH", f"/api/v1/orders/{order_id}/status", token=staff_token, json={"status": "SAN_SANG_LAY"})

        # Staff báo sự cố khách từ chối trả tiền
        issue_payload = {
            "issue_type": "refuse_payment",
            "reason": "Khách không mang tiền và không đồng ý chuyển khoản"
        }
        resp_issue = self.request("POST", f"/api/v1/orders/{order_id}/delivery-issue", token=staff_token, json=issue_payload)
        issue_data = self.assert_envelope(resp_issue, 200, True)["data"]
        self.assertEqual(issue_data["status"], "BO_DON_BLACKLIST")

        # Kiểm tra user bị blacklist
        rows = self.query_sql("SELECT is_blacklisted FROM users WHERE id = 5")
        self.assertTrue(rows[0][0])


if __name__ == "__main__":
    unittest.main()
