from tests.api_audit.base import ApiTestCase


class Test20CrossMenuOrder(ApiTestCase):
    """
    Kịch bản S8: Liên kết Phân hệ 2 (Menu) & Phân hệ 3 (Orders).
    Quy tắc nghiệp vụ: BR-04, BR-05, BR-06, BR-12, EX-05, EX-21, UC16, UC21.
    """

    def test_out_of_stock_dish_blocks_ordering(self):
        """Món ăn hết hàng (is_available = False) -> validate-cart cảnh báo & Chặn đặt đơn (BR-06, EX-05)."""
        staff_token = self.get_staff_token()
        # 1. Staff tắt trạng thái còn món của pho-bo-tai-lan
        resp_toggle = self.request(
            "PATCH",
            "/api/v1/dishes/pho-bo-tai-lan/availability",
            token=staff_token,
            json={"is_available": False}
        )
        self.assert_envelope(resp_toggle, 200, True)

        # 2. validate-cart phát hiện món đã hết hàng
        resp_val = self.request("POST", "/api/v1/dishes/validate-cart", json={"dish_ids": ["pho-bo-tai-lan"]})
        val_data = self.assert_envelope(resp_val, 200, True)["data"]
        self.assertFalse(val_data["is_valid"])
        self.assertTrue(len(val_data["unavailable_dishes"]) > 0)

        # 3. Khách cố tình tạo đơn có món hết hàng -> Bị chặn lỗi EX-05
        cust_token = self.login("sinhvien@neu.edu.vn")
        self.execute_sql("UPDATE orders SET status = 'HOAN_THANH' WHERE user_id = 4")
        payload = {
            "order_type": "pickup",
            "recipient_name": "Nguyễn Sinh Viên",
            "recipient_phone": "0977112233",
            "delivery_address": "Quầy trả món Canteen A2",
            "payment_method": "cod_cash",
            "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
        }
        resp_order = self.request("POST", "/api/v1/orders", token=cust_token, json=payload)
        self.assertEqual(resp_order.status_code, 400)
        self.assertIn("EX-05", str(resp_order.get_json()))

    def test_price_freeze_on_order_creation(self):
        """Giá đơn hàng được chốt tại thời điểm đặt; đổi giá sau đó không đổi giá đơn cũ (BR-05, BR-12)."""
        cust_token = self.login("sinhvien@neu.edu.vn")
        self.execute_sql("UPDATE orders SET status = 'HOAN_THANH' WHERE user_id = 4")

        # 1. Khách đặt đơn khi phở có giá 50.000đ (base_price = 45k)
        payload = {
            "order_type": "pickup",
            "recipient_name": "Nguyễn Sinh Viên",
            "recipient_phone": "0977112233",
            "delivery_address": "Quầy trả món Canteen A2",
            "payment_method": "cod_cash",
            "items": [{"dish_id": "pho-bo-tai-lan", "quantity": 1}]
        }
        resp_order = self.request("POST", "/api/v1/orders", token=cust_token, json=payload)
        order_id = self.assert_envelope(resp_order, 201, True)["data"]["id"]

        # 2. Quản lý Canteen (Manager 2) tăng base_price từ 45k lên 55k (giá niêm yết mới = 60k) (UC21, BR-12)
        manager_token = self.get_manager_token()
        update_payload = {
            "name": "Phở Bò Tái Lăn Đặc Biệt",
            "base_price": 55000.0,
            "category_ids": ["mi-pho"]
        }
        resp_update = self.request(
            "PUT",
            "/api/v1/dishes/pho-bo-tai-lan",
            token=manager_token,
            json=update_payload
        )
        updated_dish = self.assert_envelope(resp_update, 200, True)["data"]
        self.assertEqual(updated_dish["price"], 60000.0)

        # 3. Kiểm tra đơn hàng cũ: giá món unit_price và subtotal vẫn nguyên 50.000đ (BR-05)
        resp_get_order = self.request("GET", f"/api/v1/orders/{order_id}", token=manager_token)
        old_order = self.assert_envelope(resp_get_order, 200, True)["data"]
        self.assertEqual(old_order["items"][0]["unit_price"], 50000.0)
        self.assertEqual(old_order["total_amount"], 50000.0)

    def test_soft_delete_preserves_order_history(self):
        """Món ăn đã từng có trong lịch sử đơn hàng không bị xóa cứng (BR-04, EX-21)."""
        manager_token = self.get_manager_token()

        # pho-bo-tai-lan đã có đơn trong database mẫu
        resp_del = self.request("DELETE", "/api/v1/dishes/pho-bo-tai-lan", token=manager_token)
        self.assert_envelope(resp_del, 200, True)

        # Kiểm tra database: Bản ghi vẫn còn, chỉ cập nhật is_deleted = True, is_active = False
        rows = self.query_sql(
            "SELECT is_deleted, is_active, is_available FROM dishes WHERE id = 'pho-bo-tai-lan'"
        )
        self.assertEqual(len(rows), 1)
        self.assertTrue(rows[0][0])   # is_deleted = True
        self.assertFalse(rows[0][1])  # is_active = False

        # Thực đơn công khai không còn trả về món đã xóa
        resp_dishes = self.request("GET", "/api/v1/dishes")
        dishes = self.assert_envelope(resp_dishes, 200, True)["data"]["items"]
        self.assertFalse(any(d["id"] == "pho-bo-tai-lan" for d in dishes))


if __name__ == "__main__":
    unittest.main()
