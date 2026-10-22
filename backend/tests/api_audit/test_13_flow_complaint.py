from tests.api_audit.base import ApiTestCase


class Test13FlowComplaint(ApiTestCase):
    """
    Kịch bản S5: Luồng Khiếu nại đơn hàng (COMPLAINTS) - Độc quyền Admin xử lý.
    Quy tắc nghiệp vụ: UC15, UC25, BR-23, BR-24, EX-14, EX-15.
    """

    def _setup_delivered_order(self):
        """Tạo và bàn giao đơn thành công cho sinhvien@neu.edu.vn."""
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
        resp = self.request("POST", "/api/v1/orders", token=cust_token, json=payload)
        order_data = self.assert_envelope(resp, 201, True)["data"]
        order_id = order_data["id"]
        order_suffix = order_data["order_code_suffix"]

        staff_token = self.get_staff_token()
        self.request("PATCH", f"/api/v1/orders/{order_id}/process", token=staff_token, json={"action": "accept"})
        self.request("PATCH", f"/api/v1/orders/{order_id}/status", token=staff_token, json={"status": "DANG_GIAO"})
        self.request("POST", f"/api/v1/orders/{order_id}/handover", token=staff_token, json={"order_code_suffix": order_suffix})

        return order_id, cust_token

    def test_full_complaint_lifecycle(self):
        """Khách khiếu nại trong 24h -> Đơn sang KHIEU_NAI -> Admin độc quyền phân xử -> Đơn sang DA_GIAI_QUYET."""
        order_id, cust_token = self._setup_delivered_order()

        # 1. Khách gửi khiếu nại hợp lệ kèm link ảnh minh chứng (UC15, BR-23)
        complaint_payload = {
            "order_id": order_id,
            "reason": "Món ăn bị nguội và đổ nước dùng",
            "description": "Shipper giao muộn làm nước dùng đổ ướt túi, bánh phở bị nát.",
            "proof_image_url": "https://neufood.vn/uploads/proof_image_01.jpg"
        }
        resp_comp = self.request("POST", "/api/v1/complaints", token=cust_token, json=complaint_payload)
        comp_data = self.assert_envelope(resp_comp, 201, True)["data"]
        complaint_id = comp_data["id"]
        self.assertEqual(comp_data["status"], "DANG_XU_LY")

        # Kiểm tra trạng thái đơn đổi thành KHIEU_NAI
        order_row = self.query_sql("SELECT status FROM orders WHERE id = %s", (order_id,))
        self.assertEqual(order_row[0][0], "KHIEU_NAI")

        # 2. Khi đang khiếu nại, khách không thể bấm 'confirm-receipt'
        resp_confirm = self.request("POST", f"/api/v1/orders/{order_id}/confirm-receipt", token=cust_token)
        self.assertEqual(resp_confirm.status_code, 400)

        # 3. Quản lý hoặc Nhân viên thử giải quyết khiếu nại -> Bị chặn 403 (BR-24: Độc quyền Admin)
        manager_token = self.get_manager_token()
        resp_mgr_resolve = self.request(
            "PATCH",
            f"/api/v1/complaints/{complaint_id}/resolve",
            token=manager_token,
            json={"status": "CHAP_NHAN", "admin_response": "Manager duyệt"}
        )
        self.assertEqual(resp_mgr_resolve.status_code, 403)

        # 4. Admin phân xử khiếu nại thành công (UC25)
        admin_token = self.get_admin_token()
        resolve_payload = {
            "status": "CHAP_NHAN",
            "admin_response": "Canteen ghi nhận và hoàn bù coupon suất ăn mới cho khách hàng"
        }
        resp_resolve = self.request(
            "PATCH",
            f"/api/v1/complaints/{complaint_id}/resolve",
            token=admin_token,
            json=resolve_payload
        )
        resolved_data = self.assert_envelope(resp_resolve, 200, True)["data"]
        self.assertEqual(resolved_data["status"], "CHAP_NHAN")
        self.assertIsNotNone(resolved_data["resolved_at"])

        # Trạng thái đơn đổi thành DA_GIAI_QUYET
        order_after = self.query_sql("SELECT status FROM orders WHERE id = %s", (order_id,))
        self.assertEqual(order_after[0][0], "DA_GIAI_QUYET")

        # 5. Phân xử lần 2 -> Bị từ chối
        resp_resolve_again = self.request(
            "PATCH",
            f"/api/v1/complaints/{complaint_id}/resolve",
            token=admin_token,
            json=resolve_payload
        )
        self.assertEqual(resp_resolve_again.status_code, 400)

    def test_complaint_restrictions_and_exceptions(self):
        """Kiểm tra các ngoại lệ: Trùng lặp (EX-15), Quá hạn 24h (EX-14), Chưa giao (EX-14)."""
        order_id, cust_token = self._setup_delivered_order()

        # 1. Gửi khiếu nại lần 1
        complaint_payload = {
            "order_id": order_id,
            "reason": "Lý do khiếu nại",
            "description": "Mô tả chi tiết",
            "proof_image_url": "https://example.com/proof.jpg"
        }
        self.request("POST", "/api/v1/complaints", token=cust_token, json=complaint_payload)

        # Gửi khiếu nại lần 2 trên cùng 1 đơn -> EX-15 (Mỗi đơn tối đa 01 khiếu nại)
        resp_dup = self.request("POST", "/api/v1/complaints", token=cust_token, json=complaint_payload)
        self.assertEqual(resp_dup.status_code, 400)
        self.assertIn("EX-15", str(resp_dup.get_json()))

        # 2. Đơn chưa giao (CHO_XAC_NHAN) -> Không được khiếu nại (EX-14)
        new_order_payload = {
            "order_type": "pickup",
            "recipient_name": "Nguyễn Sinh Viên",
            "recipient_phone": "0977112233",
            "delivery_address": "Quầy trả món Canteen A2",
            "payment_method": "cod_cash",
            "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
        }
        resp_new = self.request("POST", "/api/v1/orders", token=cust_token, json=new_order_payload)
        new_order_id = self.assert_envelope(resp_new, 201, True)["data"]["id"]

        resp_premature = self.request(
            "POST",
            "/api/v1/complaints",
            token=cust_token,
            json={**complaint_payload, "order_id": new_order_id}
        )
        self.assertEqual(resp_premature.status_code, 400)
        self.assertIn("EX-14", str(resp_premature.get_json()))

        # 3. Quá thời hạn 24 giờ kể từ khi giao -> Bị chặn (EX-14)
        # Bàn giao đơn mới rồi time-travel delivered_at về 25 tiếng trước
        staff_token = self.get_staff_token()
        suffix = self.query_sql("SELECT order_code_suffix FROM orders WHERE id = %s", (new_order_id,))[0][0]
        self.request("PATCH", f"/api/v1/orders/{new_order_id}/process", token=staff_token, json={"action": "accept"})
        self.request("PATCH", f"/api/v1/orders/{new_order_id}/status", token=staff_token, json={"status": "SAN_SANG_LAY"})
        self.request("POST", f"/api/v1/orders/{new_order_id}/handover", token=staff_token, json={"order_code_suffix": suffix})

        self.execute_sql(
            "UPDATE orders SET delivered_at = NOW() - INTERVAL '25 hours' WHERE id = %s",
            (new_order_id,)
        )
        resp_expired = self.request(
            "POST",
            "/api/v1/complaints",
            token=cust_token,
            json={**complaint_payload, "order_id": new_order_id}
        )
        self.assertEqual(resp_expired.status_code, 400)
        self.assertIn("EX-14", str(resp_expired.get_json()))

    def test_customer_can_place_new_order_while_having_khieu_nai_order(self):
        """
        Quyết định #2 của Người dùng:
        Đơn đang KHIEU_NAI không được tính là 'đơn đang hoạt động' theo BR-08.
        Do đó khách có đơn đang khiếu nại VẪN ĐƯỢC đặt đơn mới.
        """
        order_id, cust_token = self._setup_delivered_order()
        # Đưa đơn sang KHIEU_NAI
        self.request(
            "POST",
            "/api/v1/complaints",
            token=cust_token,
            json={
                "order_id": order_id,
                "reason": "Khiếu nại",
                "description": "Mô tả",
                "proof_image_url": "https://example.com/p.jpg"
            }
        )
        # Đặt đơn mới
        payload = {
            "order_type": "pickup",
            "recipient_name": "Nguyễn Sinh Viên",
            "recipient_phone": "0977112233",
            "delivery_address": "Quầy trả món Canteen A2",
            "payment_method": "cod_cash",
            "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
        }
        resp = self.request("POST", "/api/v1/orders", token=cust_token, json=payload)
        self.assert_envelope(resp, 201, True)


if __name__ == "__main__":
    unittest.main()
