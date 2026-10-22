import re
import unittest
from decimal import Decimal
from tests.api_audit.base import ApiTestCase


class Test10FlowDeliveryHappy(ApiTestCase):
    """
    Kịch bản S1: Luồng hoàn chỉnh Đơn giao tận nơi (Delivery) từ Khách -> Bếp -> Shipper -> Đánh giá -> Chốt ca -> Báo cáo doanh thu.
    Liên kết 4 phân hệ:
    - Phân hệ 1 (Auth, User): Đăng ký, đăng nhập
    - Phân hệ 2 (Menu, Location): Xem món, validate giỏ hàng, chọn phòng/tòa nhà
    - Phân hệ 3 (Orders): Tạo đơn COD, duyệt bếp, giao hàng, bàn giao 4 số cuối, xác nhận hoàn thành
    - Phân hệ 4 (Review, Shift): Đánh giá sao cập nhật điểm món ăn, chốt ca tiền mặt, đối soát doanh thu Canteen
    """

    def test_full_delivery_flow_cross_module(self):
        # 1. Khách hàng mới đăng ký & đăng nhập (UC01, UC02)
        reg_payload = {
            "email": "new_student@neu.edu.vn",
            "password": "Password123!",
            "full_name": "Nguyễn Văn Sinh Viên Mới",
            "phone_number": "0988776655",
            "student_id": "11223344",
        }
        resp = self.request("POST", "/api/v1/auth/register", json=reg_payload)
        self.assert_envelope(resp, 201, True)

        cust_token = self.login("new_student@neu.edu.vn", "Password123!")

        # 2. Khách xem thực đơn, địa điểm và kiểm tra giỏ hàng (UC06, UC07, UC09, UC24)
        resp_dishes = self.request("GET", "/api/v1/dishes")
        dishes = self.assert_envelope(resp_dishes, 200, True)["data"]["items"]
        self.assertTrue(len(dishes) > 0)
        target_dish = next(d for d in dishes if d["id"] == "pho-bo-tai-lan")
        dish_price = Decimal(str(target_dish["price"]))  # 50,000 đ

        resp_loc = self.request("GET", "/api/v1/locations")
        locations = self.assert_envelope(resp_loc, 200, True)["data"]
        loc_a1 = next(l for l in locations if l["building_code"] == "A1")

        val_cart = self.request("POST", "/api/v1/dishes/validate-cart", json={"dish_ids": ["pho-bo-tai-lan"]})
        self.assert_envelope(val_cart, 200, True)

        # 3. Khách tạo đơn hàng Delivery COD (UC10, BR-12, BR-13, BR-14)
        order_payload = {
            "order_type": "delivery",
            "recipient_name": "Nguyễn Văn Sinh Viên Mới",
            "recipient_phone": "0988776655",
            "campus_location_id": loc_a1["id"],
            "room_detail": "Phòng 502 Nhà A1",
            "delivery_address": "Phòng 502 Nhà A1, Tòa nhà Thế Kỷ A1, Đại học Kinh tế Quốc dân",
            "delivery_note": "Giao tận tay giờ ra chơi",
            "is_preorder": False,
            "payment_method": "cod_cash",
            "items": [
                {"dish_id": "pho-bo-tai-lan", "quantity": 2, "note": "Không hành lá"}
            ]
        }
        resp_order = self.request("POST", "/api/v1/orders", token=cust_token, json=order_payload)
        order_data = self.assert_envelope(resp_order, 201, True)["data"]
        order_id = order_data["id"]
        order_suffix = order_data["order_code_suffix"]

        # Kiểm tra tính giá chính xác: (50k * 2) + 5k ship = 105.000 đ
        expected_subtotal = float(dish_price * 2)
        expected_total = expected_subtotal + 5000.0
        self.assertEqual(order_data["subtotal_amount"], expected_subtotal)
        self.assertEqual(order_data["ship_fee"], 5000.0)
        self.assertEqual(order_data["total_amount"], expected_total)
        self.assertEqual(order_data["status"], "CHO_XAC_NHAN")
        self.assertEqual(order_data["payment_status"], "chua_thanh_toan")
        self.assertEqual(len(order_suffix), 4)

        # 4. Nhân viên Canteen (Staff 3) tiếp nhận đơn (UC17) -> DANG_CHUAN_BI
        staff_token = self.get_staff_token()
        resp_process = self.request(
            "PATCH",
            f"/api/v1/orders/{order_id}/process",
            token=staff_token,
            json={"action": "accept"}
        )
        proc_data = self.assert_envelope(resp_process, 200, True)["data"]
        self.assertEqual(proc_data["status"], "DANG_CHUAN_BI")
        self.assertEqual(proc_data["staff_id"], 3)

        # 5. Nhân viên nấu xong chuyển sang Đang giao hàng (UC18) -> DANG_GIAO
        resp_delivery = self.request(
            "PATCH",
            f"/api/v1/orders/{order_id}/status",
            token=staff_token,
            json={"status": "DANG_GIAO"}
        )
        deliv_data = self.assert_envelope(resp_delivery, 200, True)["data"]
        self.assertEqual(deliv_data["status"], "DANG_GIAO")

        # 6. Nhân viên đến nơi, kiểm tra 4 số cuối và bàn giao thu tiền COD (UC19, BR-18) -> DA_GIAO
        resp_handover = self.request(
            "POST",
            f"/api/v1/orders/{order_id}/handover",
            token=staff_token,
            json={"order_code_suffix": order_suffix}
        )
        handover_data = self.assert_envelope(resp_handover, 200, True)["data"]
        self.assertEqual(handover_data["status"], "DA_GIAO")
        self.assertEqual(handover_data["payment_status"], "da_thanh_toan")
        self.assertIsNotNone(handover_data["delivered_at"])

        # 7. Khách hàng bấm xác nhận đã nhận hàng (UC13) -> HOAN_THANH
        resp_confirm = self.request(
            "POST",
            f"/api/v1/orders/{order_id}/confirm-receipt",
            token=cust_token
        )
        confirm_data = self.assert_envelope(resp_confirm, 200, True)["data"]
        self.assertEqual(confirm_data["status"], "HOAN_THANH")
        self.assertIsNotNone(confirm_data["completed_at"])

        # 8. Khách hàng đánh giá món ăn (UC14, BR-23) -> Cập nhật rating và review_count của Dish
        old_rating = float(target_dish["rating"])
        old_count = target_dish["review_count"]
        review_payload = {
            "order_id": order_id,
            "dish_id": "pho-bo-tai-lan",
            "rating": 5,
            "comment": "Phở rất ngon, nước dùng đậm đà!"
        }
        resp_rev = self.request("POST", "/api/v1/reviews", token=cust_token, json=review_payload)
        self.assert_envelope(resp_rev, 201, True)

        # Kiểm tra chi tiết món ăn đã được cập nhật điểm rating
        resp_updated_dish = self.request("GET", "/api/v1/dishes/pho-bo-tai-lan")
        updated_dish = self.assert_envelope(resp_updated_dish, 200, True)["data"]
        self.assertEqual(updated_dish["review_count"], old_count + 1)
        self.assertTrue(updated_dish["rating"] > 0)

        # 9. Nhân viên kiểm tra ca làm việc hiện tại (UC20, BR-25)
        resp_shift = self.request("GET", "/api/v1/shifts/my-current-shift", token=staff_token)
        shift_data = self.assert_envelope(resp_shift, 200, True)["data"]
        self.assertTrue(shift_data["total_orders_handled"] >= 1)
        self.assertTrue(float(shift_data["expected_cash"]) >= expected_total)

        # Nhân viên chốt nộp tiền COD cuối ca (khớp 100% cả tiền mặt và QR)
        submit_payload = {
            "actual_cash": float(shift_data["expected_cash"]),
            "actual_qr": float(shift_data["expected_qr"]),
            "discrepancy_note": "Khớp 100% tiền mặt COD và VietQR trong ca"
        }
        resp_submit_shift = self.request("POST", "/api/v1/shifts/submit", token=staff_token, json=submit_payload)
        submitted_shift = self.assert_envelope(resp_submit_shift, (200, 201), True)["data"]
        self.assertEqual(submitted_shift["status"], "CHO_DUYET")
        self.assertEqual(float(submitted_shift["discrepancy_amount"]), 0.0)

        # 10. Quản lý Canteen (Manager 2) phê duyệt chốt ca & xem Báo cáo doanh thu (UC20, UC22)
        manager_token = self.get_manager_token()
        shift_id = submitted_shift["id"]
        resp_close = self.request(
            "PATCH",
            f"/api/v1/shifts/{shift_id}/close",
            token=manager_token,
            json={"status": "DA_CHOT"}
        )
        closed_shift = self.assert_envelope(resp_close, 200, True)["data"]
        self.assertEqual(closed_shift["status"], "DA_CHOT")

        # Quản lý xem báo cáo doanh thu Canteen
        from datetime import date
        today_str = date.today().isoformat()
        resp_rep = self.request(
            "GET",
            "/api/v1/shifts/reports/summary",
            token=manager_token,
            query_string={"from_date": today_str, "to_date": today_str}
        )
        rep_data = self.assert_envelope(resp_rep, 200, True)["data"]
        self.assertTrue(rep_data["total_orders"] >= 1)
        self.assertTrue(rep_data["gross_revenue"] >= expected_total)

    def test_f10_order_code_format_matches_quy_trinh_nghiep_vu(self):
        """
        [F10] docs/Quy_Trinh_Nghiep_Vu.md §3.1 & BR-18:
        Mã đơn hàng có cấu trúc: NF + YYMMDD + 4 chữ số ngẫu nhiên (Ví dụ: NF2610153456, 12 ký tự).
        Hiện tại crud/order.py dùng: NF + time_ns (19 số) + 4 số ngẫu nhiên (tổng 25 ký tự).
        """
        cust_token = self.login("thanhhuong@neu.edu.vn")
        # Huỷ đơn dở cũ nếu có để tạo đơn mới
        self.execute_sql("UPDATE orders SET status = 'HOAN_THANH' WHERE user_id = 5")

        order_payload = {
            "order_type": "pickup",
            "recipient_name": "Lê Thị Thanh Hương",
            "recipient_phone": "0988112233",
            "delivery_address": "Quầy trả món Canteen A2",
            "payment_method": "cod_cash",
            "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
        }
        resp = self.request("POST", "/api/v1/orders", token=cust_token, json=order_payload)
        order_data = self.assert_envelope(resp, 201, True)["data"]
        order_id = order_data["id"]

        # Kiểm tra Regex: ^NF\d{6}\d{4}$ (Đúng 12 ký tự: NF + YYMMDD + 4 số)
        pattern = r"^NF\d{6}\d{4}$"
        self.assertTrue(
            bool(re.match(pattern, order_id)),
            f"Mã đơn '{order_id}' không tuân theo format NF+YYMMDD+4số (độ dài hiện tại: {len(order_id)})"
        )


if __name__ == "__main__":
    unittest.main()
