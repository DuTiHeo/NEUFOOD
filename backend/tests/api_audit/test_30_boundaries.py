import unittest
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor
from tests.api_audit.base import ApiTestCase


class Test30Boundaries(ApiTestCase):
    """
    Kịch bản Điều kiện biên (Boundaries) & Ngoại lệ hệ thống (Edge Cases).
    Quy tắc nghiệp vụ: BR-07, BR-08, BR-11, BR-14, F4.
    """

    def test_br07_dish_quantity_boundaries(self):
        """Số lượng món từ 1 đến 10 phần; 11 phần hoặc chia 2 dòng (6+5=11) bị chặn EX-06 (BR-07)."""
        cust_token = self.login("sinhvien@neu.edu.vn")
        self.execute_sql("UPDATE orders SET status = 'HOAN_THANH' WHERE user_id = 4")

        base_payload = {
            "order_type": "pickup",
            "recipient_name": "Nguyễn Sinh Viên",
            "recipient_phone": "0977112233",
            "delivery_address": "Quầy Canteen",
            "payment_method": "cod_cash",
        }

        # 1. Số lượng = 0 -> Bị chặn
        resp_0 = self.request("POST", "/api/v1/orders", token=cust_token, json={
            **base_payload, "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 0}]
        })
        self.assertIn(resp_0.status_code, (400, 422))

        # 2. Số lượng = 11 phần trên 1 dòng -> Bị chặn (400 hoặc 422 Pydantic Validation)
        resp_11 = self.request("POST", "/api/v1/orders", token=cust_token, json={
            **base_payload, "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 11}]
        })
        self.assertIn(resp_11.status_code, (400, 422))

        # 3. Cố tình chia cùng 1 món thành 2 dòng (6 + 5 = 11 phần) -> Counter phát hiện và chặn EX-06
        resp_split = self.request("POST", "/api/v1/orders", token=cust_token, json={
            **base_payload, "items": [
                {"dish_id": "pho-bo-tai-lan", "quantity": 6, "note": "Ít ớt"},
                {"dish_id": "pho-bo-tai-lan", "quantity": 5, "note": "Nhiều chanh"}
            ]
        })
        self.assertEqual(resp_split.status_code, 400)
        self.assertIn("EX-06", str(resp_split.get_json()))

        # 4. Số lượng biên hợp lệ: đúng 10 phần -> Thành công
        resp_10 = self.request("POST", "/api/v1/orders", token=cust_token, json={
            **base_payload, "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 10}]
        })
        self.assert_envelope(resp_10, 201, True)

    def test_br14_cod_limit_boundary_500k(self):
        """Hạn mức đơn COD tối đa 500.000 VNĐ; 505k bị chặn lỗi EX-11 (BR-14)."""
        cust_token = self.login("sinhvien@neu.edu.vn")
        self.execute_sql("UPDATE orders SET status = 'HOAN_THANH' WHERE user_id = 4")

        # Phở 50k * 10 = 500k; Đơn delivery có ship 5k -> Tổng 505k > 500k -> Bị chặn EX-11
        payload_505k = {
            "order_type": "delivery",
            "recipient_name": "Nguyễn Sinh Viên",
            "recipient_phone": "0977112233",
            "campus_location_id": 1,
            "room_detail": "Phòng 101",
            "delivery_address": "Phòng 101, Tòa nhà Thế Kỷ A1, Đại học Kinh tế Quốc dân",
            "payment_method": "cod_cash",
            "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 10}]
        }
        resp = self.request("POST", "/api/v1/orders", token=cust_token, json=payload_505k)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("EX-11", str(resp.get_json()))

        # Đơn pickup: 50k * 10 = đúng 500.000 VNĐ -> Vừa khít hạn mức -> Thành công!
        payload_500k = {
            "order_type": "pickup",
            "recipient_name": "Nguyễn Sinh Viên",
            "recipient_phone": "0977112233",
            "delivery_address": "Quầy Canteen",
            "payment_method": "cod_cash",
            "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 10}]
        }
        resp_ok = self.request("POST", "/api/v1/orders", token=cust_token, json=payload_500k)
        data = self.assert_envelope(resp_ok, 201, True)["data"]
        self.assertEqual(data["total_amount"], 500000.0)

    def test_br11_preorder_lead_time_and_opening_hours(self):
        """Đơn hẹn giờ phải cách hiện tại tối thiểu 30p và trong giờ mở cửa 06:30-19:30 (BR-11, EX-08)."""
        cust_token = self.login("sinhvien@neu.edu.vn")
        self.execute_sql("UPDATE orders SET status = 'HOAN_THANH' WHERE user_id = 4")

        now_utc = datetime.now(timezone.utc)

        # 1. Hẹn trước chỉ 15 phút (< 30 phút) -> Bị chặn EX-08
        invalid_lead = now_utc + timedelta(minutes=15)
        payload_15m = {
            "order_type": "pickup",
            "recipient_name": "Nguyễn Sinh Viên",
            "recipient_phone": "0977112233",
            "delivery_address": "Quầy Canteen",
            "payment_method": "cod_cash",
            "is_preorder": True,
            "scheduled_at": invalid_lead.isoformat(),
            "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
        }
        resp_early = self.request("POST", "/api/v1/orders", token=cust_token, json=payload_15m)
        self.assertEqual(resp_early.status_code, 400)
        self.assertIn("EX-08", str(resp_early.get_json()))

    def test_br08_single_active_order_limit(self):
        """Mỗi tài khoản chỉ được có tối đa 01 đơn hàng đang hoạt động (BR-08, EX-09)."""
        cust_token = self.login("sinhvien@neu.edu.vn")
        self.execute_sql("UPDATE orders SET status = 'HOAN_THANH' WHERE user_id = 4")

        payload = {
            "order_type": "pickup",
            "recipient_name": "Nguyễn Sinh Viên",
            "recipient_phone": "0977112233",
            "delivery_address": "Quầy Canteen",
            "payment_method": "cod_cash",
            "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
        }

        # Đơn 1 tạo thành công
        resp1 = self.request("POST", "/api/v1/orders", token=cust_token, json=payload)
        self.assert_envelope(resp1, 201, True)

        # Đơn 2 cố tình tạo khi đơn 1 đang CHO_XAC_NHAN -> Bị chặn lỗi EX-09
        resp2 = self.request("POST", "/api/v1/orders", token=cust_token, json=payload)
        self.assertEqual(resp2.status_code, 400)
        self.assertIn("EX-09", str(resp2.get_json()))

    def test_f4_pagination_invalid_params_does_not_crash_500(self):
        """
        [F4] Robustness kiểm tra phân trang GET /api/v1/orders/admin/all:
        Khi client gửi page='abc' hoặc page=0, route ép kiểu int() không try/except dẫn tới 500 Internal Error.
        Kỳ vọng: Bắt lỗi tham số và trả về 400/422, tuyệt đối không crash 500.
        """
        admin_token = self.get_admin_token()
        # Truyền query string không hợp lệ: page=invalid_string
        resp = self.request(
            "GET",
            "/api/v1/orders/admin/all",
            token=admin_token,
            query_string={"page": "invalid_page"}
        )
        self.assertIn(
            resp.status_code,
            (400, 422),
            f"Phân trang page='invalid_page' gây lỗi 500 (status={resp.status_code})"
        )


if __name__ == "__main__":
    unittest.main()
