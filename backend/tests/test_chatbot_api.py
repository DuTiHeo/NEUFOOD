"""
Unit & Integration Test Suite for NEUFood AI Chatbot Module
Endpoints tested:
- POST /api/v1/chat/message
- POST /api/v1/chat/reset
"""

import os
import sys
import unittest
from unittest.mock import patch

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import create_app
from app.core.limiter import limiter
from app.core.security import create_access_token


MOCK_KNOWLEDGE_CONTEXT = {
    "categories": [
        {"id": "com-hop", "name": "Cơm Hộp", "description": "Cơm văn phòng nóng hổi"},
        {"id": "mi-pho", "name": "Mì Phở", "description": "Bún, phở, mì"},
        {"id": "do-uong", "name": "Đồ Uống", "description": "Trà đào, trà sữa"},
    ],
    "available_dishes": [
        {
            "id": "com-ga-xoi-mo",
            "name": "Cơm Gà Xối Mỡ Da Giòn",
            "short_description": "Đùi gà chiên da giòn rụm, cơm rang thơm béo.",
            "price": 45000,
            "base_price": 40000,
            "rating": 4.9,
            "review_count": 530,
            "image_url": "https://example.com/com-ga.jpg",
            "is_available": True,
            "categories": ["Cơm Hộp"],
            "category_ids": ["com-hop"],
            "badges": ["bestSeller", "hot"],
        },
        {
            "id": "pho-bo-tai-lan",
            "name": "Phở Bò Tái Lăn",
            "short_description": "Phở truyền thống, nước dùng thanh ngọt.",
            "price": 50000,
            "base_price": 45000,
            "rating": 4.8,
            "review_count": 312,
            "image_url": "https://example.com/pho-bo.jpg",
            "is_available": True,
            "categories": ["Mì Phở"],
            "category_ids": ["mi-pho"],
            "badges": ["bestSeller"],
        },
        {
            "id": "tra-dao-cam-sa",
            "name": "Trà Đào Cam Sả Tươi Mát",
            "short_description": "Thanh lọc cơ thể, hương sả thơm lừng.",
            "price": 30000,
            "base_price": 25000,
            "rating": 4.8,
            "review_count": 195,
            "image_url": "https://example.com/tra-dao.jpg",
            "is_available": True,
            "categories": ["Đồ Uống"],
            "category_ids": ["do-uong"],
            "badges": [],
        },
    ],
    "unavailable_dishes": [
        {
            "id": "com-suon-nuong",
            "name": "Cơm Sườn Nướng Mật Ong",
            "short_description": "Sườn cốt lết ướp sốt mật ong.",
            "price": 45000,
            "base_price": 40000,
            "rating": 4.7,
            "review_count": 210,
            "image_url": "https://example.com/com-suon.jpg",
            "is_available": False,
            "categories": ["Cơm Hộp"],
            "category_ids": ["com-hop"],
            "badges": [],
        }
    ],
    "locations": [
        {
            "id": 1,
            "building_code": "A1",
            "building_name": "Tòa nhà Thế Kỷ A1",
            "default_room_note": "Phòng học & Văn phòng từ tầng 2 đến tầng 10",
        },
        {
            "id": 2,
            "building_code": "A2",
            "building_name": "Khu Canteen & Giảng đường A2",
            "default_room_note": "Quầy trả món Canteen A2 Tầng 1",
        },
    ],
    "settings": {
        "canteen_open_time": "06:30",
        "canteen_close_time": "19:30",
        "delivery_fee": "5000",
        "system_maintenance_fee": "5000",
        "max_cod_amount": "500000",
        "max_dish_quantity_per_order": "10",
        "order_timeout_minutes": "10",
        "pickup_hold_minutes": "30",
        "min_preorder_lead_minutes": "30",
    },
}

MOCK_USER_ORDERS = [
    {
        "id": "NF2610153456",
        "order_code_suffix": "3456",
        "status": "DANG_GIAO",
        "status_label": "Shipper đang trên đường giao tới phòng/tòa nhà",
        "is_active_order": True,
        "order_type": "delivery",
        "order_type_label": "Giao tận nơi nội khu NEU",
        "delivery_address": "P.502 Tầng 5, Tòa nhà Thế Kỷ A1, Đại học Kinh tế Quốc dân",
        "subtotal_amount": 85000,
        "ship_fee": 5000,
        "total_amount": 90000,
        "payment_method": "Tiền mặt COD",
        "payment_status": "Chưa thanh toán (Thu khi nhận món)",
        "eta": "15 - 25 phút",
        "cancelled_reason": None,
        "created_at": "2026-10-15T10:00:00+00:00",
        "items": [
            {"dish_name": "Phở Bò Tái Lăn", "quantity": 1, "unit_price": 50000, "subtotal": 50000},
            {"dish_name": "Trà Sữa Trân Châu Đường Đen", "quantity": 1, "unit_price": 35000, "subtotal": 35000},
        ],
    }
]


class TestChatbotAPI(unittest.TestCase):
    """Kiểm thử toàn diện 4 lớp cho Module Chatbot AI (/api/v1/chat)."""

    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        limiter.enabled = False
        self.client = self.app.test_client()

    # 1. Happy Path: Khách vãng lai hỏi gợi ý thực đơn (Smart Local Fallback)
    @patch("app.routes.chat.get_chatbot_knowledge_context", return_value=MOCK_KNOWLEDGE_CONTEXT)
    @patch("app.core.chatbot_engine._call_gemini_api", return_value=(None, None))
    def test_guest_menu_recommendation_fallback(self, _mock_gemini, _mock_ctx):
        res = self.client.post(
            "/api/v1/chat/message",
            json={"message": "Gợi ý món ngon cho bữa trưa dưới 50k", "session_id": "test-guest-001"},
        )
        self.assertEqual(res.status_code, 200)
        body = res.get_json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["session_id"], "test-guest-001")
        self.assertEqual(body["data"]["provider"], "fallback")
        self.assertIn("Cơm Gà Xối Mỡ Da Giòn", body["data"]["reply"])
        self.assertIn("45.000đ", body["data"]["reply"])
        self.assertTrue(len(body["data"]["suggested_dishes"]) >= 1)

    # 2. Happy Path: Khách vãng lai hỏi món đang tạm hết hàng hôm nay
    @patch("app.routes.chat.get_chatbot_knowledge_context", return_value=MOCK_KNOWLEDGE_CONTEXT)
    @patch("app.core.chatbot_engine._call_gemini_api", return_value=(None, None))
    def test_guest_asks_unavailable_dish(self, _mock_gemini, _mock_ctx):
        res = self.client.post(
            "/api/v1/chat/message",
            json={"message": "Hôm nay còn Cơm Sườn Nướng Mật Ong không?"},
        )
        self.assertEqual(res.status_code, 200)
        body = res.get_json()
        self.assertTrue(body["success"])
        self.assertIn("Cơm Sườn Nướng Mật Ong", body["data"]["reply"])
        self.assertIn("tạm hết hàng", body["data"]["reply"])

    # 3. Happy Path: Sinh viên đã đăng nhập hỏi trạng thái đơn hàng & mã 4 số cuối (BR-18)
    @patch("app.routes.chat._extract_optional_user")
    @patch("app.routes.chat.get_chatbot_knowledge_context", return_value=MOCK_KNOWLEDGE_CONTEXT)
    @patch("app.routes.chat.get_user_active_and_recent_orders", return_value=MOCK_USER_ORDERS)
    @patch("app.core.chatbot_engine._call_gemini_api", return_value=(None, None))
    def test_authenticated_user_order_tracking(
        self, _mock_gemini, _mock_orders, _mock_ctx, mock_auth_user
    ):
        mock_auth_user.return_value = {
            "id": 4,
            "full_name": "Nguyễn Sinh Viên",
            "role": "customer",
        }
        token = create_access_token({"sub": "4", "email": "sinhvien@neu.edu.vn", "role": "customer"})

        res = self.client.post(
            "/api/v1/chat/message",
            headers={"Authorization": f"Bearer {token}"},
            json={"message": "Đơn hàng của mình đến đâu rồi?"},
        )
        self.assertEqual(res.status_code, 200)
        body = res.get_json()
        self.assertTrue(body["success"])
        reply = body["data"]["reply"]
        self.assertIn("NF2610153456", reply)
        self.assertIn("3456", reply)
        self.assertIn("90.000đ", reply)

    # 4. Happy Path: Google Gemini API trả lời thành công
    @patch("app.routes.chat.get_chatbot_knowledge_context", return_value=MOCK_KNOWLEDGE_CONTEXT)
    @patch(
        "app.core.chatbot_engine._call_gemini_api",
        return_value=(
            "Chào bạn! Bạn có thể thử **Phở Bò Tái Lăn** giá **50.000đ** rất ngon nhé!",
            None,
        ),
    )
    def test_gemini_provider_response(self, _mock_gemini, _mock_ctx):
        res = self.client.post(
            "/api/v1/chat/message",
            json={"message": "Trưa nay ăn phở gì ngon?"},
        )
        self.assertEqual(res.status_code, 200)
        body = res.get_json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["provider"], "gemini")
        self.assertIn("Phở Bò Tái Lăn", body["data"]["reply"])
        self.assertEqual(body["data"]["suggested_dishes"][0]["id"], "pho-bo-tai-lan")

    # 5. Reset lịch sử hội thoại (/api/v1/chat/reset)
    def test_reset_chat_session(self):
        res = self.client.post(
            "/api/v1/chat/reset",
            json={"session_id": "test-reset-session-123"},
        )
        self.assertEqual(res.status_code, 200)
        body = res.get_json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["previous_session_id"], "test-reset-session-123")
        self.assertTrue(bool(body["data"]["session_id"]))

    # 6. Boundary & Validation Cases (400 & 422)
    def test_validation_and_boundary_errors(self):
        # Tin nhắn rỗng / toàn khoảng trắng -> 422
        res_empty = self.client.post("/api/v1/chat/message", json={"message": "   "})
        self.assertEqual(res_empty.status_code, 422)
        self.assertFalse(res_empty.get_json()["success"])

        # Tin nhắn vượt quá 500 ký tự -> 422
        res_long = self.client.post("/api/v1/chat/message", json={"message": "a" * 501})
        self.assertEqual(res_long.status_code, 422)
        self.assertFalse(res_long.get_json()["success"])

        # Payload không phải JSON object -> 400
        res_bad = self.client.post(
            "/api/v1/chat/message",
            data="not-a-json",
            content_type="text/plain",
        )
        self.assertEqual(res_bad.status_code, 400)
        self.assertFalse(res_bad.get_json()["success"])

    # 7. Action Testing: Gemini đặt món hộ người dùng (CREATE_ORDER)
    @patch("app.routes.chat._extract_optional_user")
    @patch("app.routes.chat.get_chatbot_knowledge_context", return_value=MOCK_KNOWLEDGE_CONTEXT)
    @patch(
        "app.core.chatbot_engine._call_gemini_api",
        return_value=(
            "Mình sẽ đặt đơn giao tới phòng cho bạn ngay!\n```action\n{\"type\": \"CREATE_ORDER\", \"order_type\": \"delivery\", \"items\": [{\"dish_id\": \"pho-bo-tai-lan\", \"quantity\": 1}], \"building_code\": \"A1\", \"room_detail\": \"P.502\", \"payment_method\": \"cod_cash\"}\n```",
            None,
        ),
    )
    @patch("app.routes.chat.create_order")
    def test_gemini_action_create_order_for_customer(
        self, mock_create_order, _mock_gemini, _mock_ctx, mock_auth_user
    ):
        mock_auth_user.return_value = {
            "id": 4,
            "full_name": "Nguyễn Sinh Viên",
            "role": "customer",
            "phone_number": "0977112233",
        }
        # Giả lập đơn hàng được tạo thành công
        from unittest.mock import MagicMock
        fake_order = MagicMock()
        fake_order.id = "NF2611029999"
        fake_order.order_code_suffix = "9999"
        fake_order.status = "CHO_XAC_NHAN"
        fake_order.order_type = "delivery"
        fake_order.delivery_address = "P.502, Tòa nhà Thế Kỷ A1, Đại học Kinh tế Quốc dân"
        fake_order.total_amount = 55000
        fake_order.eta = "15 - 25 phút"
        fake_order.payment_method = "cod_cash"
        mock_create_order.return_value = fake_order

        token = create_access_token({"sub": "4", "email": "sinhvien@neu.edu.vn", "role": "customer"})

        res = self.client.post(
            "/api/v1/chat/message",
            headers={"Authorization": f"Bearer {token}"},
            json={"message": "Đặt cho mình 1 phở bò giao đến P.502 A1"},
        )
        self.assertEqual(res.status_code, 200)
        body = res.get_json()
        self.assertTrue(body["success"])
        action = body["data"].get("action")
        self.assertIsNotNone(action)
        self.assertEqual(action["type"], "ORDER_CREATED")
        self.assertEqual(action["order"]["id"], "NF2611029999")
        self.assertEqual(action["order"]["order_code_suffix"], "9999")
        self.assertIn("9999", body["data"]["reply"])

    # 8. Action Testing: Thêm món vào giỏ hàng (ADD_TO_CART)
    @patch("app.routes.chat.get_chatbot_knowledge_context", return_value=MOCK_KNOWLEDGE_CONTEXT)
    @patch(
        "app.core.chatbot_engine._call_gemini_api",
        return_value=(
            "Đã thêm 2 phần vào giỏ!\n```action\n{\"type\": \"ADD_TO_CART\", \"items\": [{\"dish_id\": \"pho-bo-tai-lan\", \"quantity\": 2}]}\n```",
            None,
        ),
    )
    def test_gemini_action_add_to_cart(self, _mock_gemini, _mock_ctx):
        res = self.client.post(
            "/api/v1/chat/message",
            json={"message": "Thêm 2 phở bò vào giỏ hàng nhé"},
        )
        self.assertEqual(res.status_code, 200)
        body = res.get_json()
        self.assertTrue(body["success"])
        action = body["data"].get("action")
        self.assertIsNotNone(action)
        self.assertEqual(action["type"], "ADD_TO_CART")
        self.assertEqual(len(action["items"]), 1)
        self.assertEqual(action["items"][0]["qty"], 2)
        self.assertEqual(action["items"][0]["id"], "pho-bo-tai-lan")

    # 9. Action Testing: Khách vãng lai yêu cầu đặt đơn -> Phản hồi NEED_LOGIN
    @patch("app.routes.chat.get_chatbot_knowledge_context", return_value=MOCK_KNOWLEDGE_CONTEXT)
    @patch(
        "app.core.chatbot_engine._call_gemini_api",
        return_value=(
            "Đang tạo đơn...\n```action\n{\"type\": \"CREATE_ORDER\", \"order_type\": \"pickup\", \"items\": [{\"dish_id\": \"pho-bo-tai-lan\", \"quantity\": 1}]}\n```",
            None,
        ),
    )
    def test_guest_order_requires_login(self, _mock_gemini, _mock_ctx):
        res = self.client.post(
            "/api/v1/chat/message",
            json={"message": "Đặt luôn giúp mình 1 phở bò lấy tại quầy"},
        )
        self.assertEqual(res.status_code, 200)
        body = res.get_json()
        self.assertTrue(body["success"])
        action = body["data"].get("action")
        self.assertIsNotNone(action)
        self.assertEqual(action["type"], "NEED_LOGIN")
        self.assertIn("Đăng nhập", body["data"]["reply"])


if __name__ == "__main__":
    unittest.main()
