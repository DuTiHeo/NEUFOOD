import unittest
from tests.api_audit.base import ApiTestCase


class Test24SecurityIsolation(ApiTestCase):
    """
    Kịch bản S12: Kiểm tra Phân lập Dữ liệu (Isolation), Chống can thiệp chéo & Lỗ hổng IDOR (F1).
    Quy tắc nghiệp vụ: BR-03, BR-18, UC11, UC12, UC13, UC14, UC15.
    """

    def test_f1_customer_cannot_view_another_customer_order_details(self):
        """
        [F1] Lỗ hổng IDOR nghiêm trọng tại GET /api/v1/orders/<order_id>:
        Endpoint chỉ yêu cầu @jwt_required nhưng không kiểm tra quyền sở hữu đơn (order.user_id == current_user.id)
        hoặc vai trò nhân viên/quản lý.
        Khách hàng B có thể đọc toàn bộ thông tin đơn của Khách hàng A, bao gồm:
        - Tên người nhận, số điện thoại, phòng học cụ thể
        - Đặc biệt là 'order_code_suffix' (4 chữ số bí mật để nhận hàng), làm vô hiệu hoá BR-18!
        Kỳ vọng: Trả về 404 Not Found hoặc 403 Forbidden nếu không phải chủ đơn.
        """
        # Đơn mẫu NF2610153456 thuộc sở hữu của User 4 (sinhvien@neu.edu.vn)
        # User 5 (thanhhuong@neu.edu.vn) là một khách hàng khác
        cust_b_token = self.login("thanhhuong@neu.edu.vn")

        resp = self.request("GET", "/api/v1/orders/NF2610153456", token=cust_b_token)
        # Kỳ vọng: Bị từ chối 404 hoặc 403
        self.assertIn(
            resp.status_code,
            (403, 404),
            f"IDOR phát hiện: Khách B xem được đơn của Khách A với status={resp.status_code}. "
            f"Dữ liệu lộ: {resp.get_data(as_text=True)}"
        )

    def test_customer_cannot_cancel_or_confirm_another_customer_order(self):
        """Khách B không thể hủy hoặc xác nhận đơn của Khách A (UC12, UC13)."""
        # Đơn NF2610153456 thuộc User 4
        cust_b_token = self.login("thanhhuong@neu.edu.vn")

        # Khách B cố bấm hủy đơn của Khách A
        resp_cancel = self.request("POST", "/api/v1/orders/NF2610153456/cancel", token=cust_b_token)
        self.assertEqual(resp_cancel.status_code, 404)

        # Khách B cố bấm xác nhận nhận hàng
        resp_confirm = self.request("POST", "/api/v1/orders/NF2610153456/confirm-receipt", token=cust_b_token)
        self.assertEqual(resp_confirm.status_code, 404)

    def test_customer_cannot_complain_or_review_another_customer_order(self):
        """Khách B không thể gửi khiếu nại hoặc đánh giá món trên đơn của Khách A (UC14, UC15)."""
        cust_b_token = self.login("thanhhuong@neu.edu.vn")

        # Đơn NF2610148833 đã HOAN_THANH của User 4
        resp_comp = self.request(
            "POST",
            "/api/v1/complaints",
            token=cust_b_token,
            json={
                "order_id": "NF2610148833",
                "reason": "Khiếu nại trái phép",
                "description": "Mô tả",
                "proof_image_url": "https://example.com/p.jpg"
            }
        )
        self.assertEqual(resp_comp.status_code, 404)

        resp_rev = self.request(
            "POST",
            "/api/v1/reviews",
            token=cust_b_token,
            json={
                "order_id": "NF2610148833",
                "dish_id": "pho-bo-tai-lan",
                "rating": 5,
                "comment": "Đánh giá giả mạo"
            }
        )
        self.assertEqual(resp_rev.status_code, 404)

    def test_staff_cannot_view_another_staff_shift_detail(self):
        """Nhân viên không thể xem chi tiết biên bản chốt ca của nhân viên khác (UC20, BR-03)."""
        # Giả sử có ca ID 1 thuộc staff khác
        staff_token = self.get_staff_token()
        resp = self.request("GET", "/api/v1/shifts/9999", token=staff_token)
        self.assertEqual(resp.status_code, 404)


if __name__ == "__main__":
    unittest.main()
