from tests.api_audit.base import ApiTestCase


class Test14FlowCancelTimeout(ApiTestCase):
    """
    Kịch bản S6: Khách hủy đơn, Canteen từ chối & Tự động hủy sau 10p (TU_DONG_HUY).
    Quy tắc nghiệp vụ: UC12, UC17, BR-16, BR-17, EX-12, EX-16.
    """

    def _create_sample_order(self):
        cust_token = self.login("sinhvien@neu.edu.vn")
        self.execute_sql("UPDATE orders SET status = 'HOAN_THANH' WHERE user_id = 4")
        payload = {
            "order_type": "delivery",
            "recipient_name": "Nguyễn Sinh Viên",
            "recipient_phone": "0977112233",
            "campus_location_id": 1,
            "room_detail": "Phòng 202",
            "delivery_address": "Phòng 202 Nhà A1, Đại học Kinh tế Quốc dân",
            "payment_method": "cod_cash",
            "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
        }
        resp = self.request("POST", "/api/v1/orders", token=cust_token, json=payload)
        order_data = self.assert_envelope(resp, 201, True)["data"]
        return order_data["id"], cust_token

    def test_customer_can_cancel_when_cho_xac_nhan(self):
        """Khách tự hủy khi đơn còn ở CHO_XAC_NHAN (UC12, BR-17) -> DA_HUY_KHACH."""
        order_id, cust_token = self._create_sample_order()
        resp_cancel = self.request("POST", f"/api/v1/orders/{order_id}/cancel", token=cust_token)
        cancel_data = self.assert_envelope(resp_cancel, 200, True)["data"]
        self.assertEqual(cancel_data["status"], "DA_HUY_KHACH")

    def test_customer_cannot_cancel_after_bep_accepts(self):
        """Khách không được hủy khi Canteen đã bấm tiếp nhận DANG_CHUAN_BI (EX-12)."""
        order_id, cust_token = self._create_sample_order()
        staff_token = self.get_staff_token()
        self.request("PATCH", f"/api/v1/orders/{order_id}/process", token=staff_token, json={"action": "accept"})

        # Khách bấm hủy -> Bị chặn lỗi EX-12
        resp_cancel = self.request("POST", f"/api/v1/orders/{order_id}/cancel", token=cust_token)
        self.assertEqual(resp_cancel.status_code, 400)
        self.assertIn("EX-12", str(resp_cancel.get_json()))

    def test_canteen_reject_order_requires_reason(self):
        """Canteen từ chối đơn phải có lý do (UC17) -> TU_CHOI."""
        order_id, _ = self._create_sample_order()
        staff_token = self.get_staff_token()

        # Từ chối không có lý do -> Bị từ chối (400 hoặc 422 Pydantic Validation)
        resp_no_reason = self.request(
            "PATCH",
            f"/api/v1/orders/{order_id}/process",
            token=staff_token,
            json={"action": "reject", "reason": "   "}
        )
        self.assertIn(resp_no_reason.status_code, (400, 422))

        # Từ chối có lý do hợp lệ -> Thành công sang TU_CHOI
        resp_reject = self.request(
            "PATCH",
            f"/api/v1/orders/{order_id}/process",
            token=staff_token,
            json={"action": "reject", "reason": "Hết bánh phở tươi"}
        )
        reject_data = self.assert_envelope(resp_reject, 200, True)["data"]
        self.assertEqual(reject_data["status"], "TU_CHOI")
        self.assertEqual(reject_data["cancelled_reason"], "Hết bánh phở tươi")

    def test_order_auto_cancels_after_10_minutes(self):
        """Quá 10 phút Canteen không duyệt -> Tự động hủy TU_DONG_HUY (BR-16, EX-16)."""
        order_id, _ = self._create_sample_order()

        # Giả lập time-travel: đơn đã tạo cách đây 11 phút (quá order_timeout_minutes = 10)
        self.execute_sql(
            "UPDATE orders SET created_at = NOW() - INTERVAL '11 minutes' WHERE id = %s",
            (order_id,)
        )

        # Khi xem chi tiết đơn hàng, hệ thống tự động đồng bộ sang TU_DONG_HUY
        admin_token = self.get_admin_token()
        resp_get = self.request("GET", f"/api/v1/orders/{order_id}", token=admin_token)
        order_data = self.assert_envelope(resp_get, 200, True)["data"]
        self.assertEqual(order_data["status"], "TU_DONG_HUY")

        # Canteen cố tiếp nhận đơn đã quá hạn -> Báo lỗi EX-16
        staff_token = self.get_staff_token()
        resp_late_accept = self.request(
            "PATCH",
            f"/api/v1/orders/{order_id}/process",
            token=staff_token,
            json={"action": "accept"}
        )
        self.assertEqual(resp_late_accept.status_code, 400)
        self.assertIn("EX-16", str(resp_late_accept.get_json()))

    def test_invalid_status_transitions_rejected(self):
        """Các bước chuyển trạng thái sai quy trình State Machine phải bị từ chối (INVALID_TRANSITION)."""
        order_id, _ = self._create_sample_order()
        staff_token = self.get_staff_token()

        # Nhảy cóc: CHO_XAC_NHAN -> DANG_GIAO (chưa qua DANG_CHUAN_BI)
        resp_invalid = self.request(
            "PATCH",
            f"/api/v1/orders/{order_id}/status",
            token=staff_token,
            json={"status": "DANG_GIAO"}
        )
        self.assertEqual(resp_invalid.status_code, 400)
        self.assertIn("INVALID_TRANSITION", str(resp_invalid.get_json()))


if __name__ == "__main__":
    unittest.main()
