"""PostgreSQL integration: requires disposable TEST_DATABASE_URL ending _orders_test."""
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from contextlib import contextmanager
from flask import Flask
import unittest

import test_order_creation as order_tests
from app.crud.chat_order import (prepare_draft, confirm_draft, discard_draft, lock_customer,
                                draft_context, now)
from app.crud.order import OrderError
from app.db.models import Order, Dish, User
from app.db.chat_models import ChatOrderDraft, ChatDeliveryPreference


class ChatOrderConfirmationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        order_tests.OrderCreationTests.setUpClass.__func__(cls)
        ChatOrderDraft.__table__.create(cls.engine, checkfirst=True)
        ChatDeliveryPreference.__table__.create(cls.engine, checkfirst=True)

    setUp = order_tests.OrderCreationTests.setUp

    def payload(self, **changes):
        data = dict(items=[{"dish_id": "rice", "quantity": 2, "note": "Không hành"}],
                    order_type="delivery", recipient_name="Nguyễn An", recipient_phone="0977112233",
                    building_code="A2", room_detail="Phòng 502", payment_method="cod_cash",
                    is_preorder=False, order_for_self=True, notes_confirmed=True,
                    delivery_note="Gọi trước")
        data.update(changes)
        return data

    def prepare(self, **changes):
        with self.sessions.begin() as db:
            return prepare_draft(db, lock_customer(db, 1), "session", self.payload(**changes))

    def confirm(self, action, user_id=1):
        with self.sessions.begin() as db:
            return confirm_draft(db, lock_customer(db, user_id), "session", action["draft_id"], action["revision"])

    def test_summary_does_not_create_order_or_save_preferences(self):
        reply, action = self.prepare()
        self.assertEqual(action["type"], "ORDER_CONFIRMATION")
        self.assertIn("75.000đ", reply)
        self.assertIn("0977112233", reply)
        with self.sessions() as db:
            self.assertEqual(db.query(Order).count(), 0)
            self.assertEqual(db.query(ChatDeliveryPreference).count(), 0)

    def test_confirm_and_replay_after_order_finished(self):
        _, action = self.prepare()
        _, first = self.confirm(action)
        with self.sessions.begin() as db:
            db.get(Order, first["order"]["id"]).status = "HOAN_THANH"
        _, second = self.confirm(action)
        self.assertEqual(first["order"]["id"], second["order"]["id"])
        with self.sessions() as db:
            self.assertEqual(db.query(Order).count(), 1)
            self.assertEqual(db.get(ChatDeliveryPreference, 1).details["room_detail"], "Phòng 502")

    def test_concurrent_confirmation_creates_one_order(self):
        _, action = self.prepare()
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: self.confirm(action)[1]["order"]["id"], range(2)))
        self.assertEqual(results[0], results[1])

    def test_revision_change_rejects_old_confirmation(self):
        _, old = self.prepare()
        with self.sessions.begin() as db:
            _, new = prepare_draft(db, lock_customer(db, 1), "session", {"room_detail": "Phòng 503"})
        self.assertGreater(new["revision"], old["revision"])
        with self.assertRaisesRegex(OrderError, "thay đổi"):
            self.confirm(old)
        self.assertEqual(self.confirm(new)[1]["type"], "ORDER_CREATED")

    def test_price_change_requires_new_confirmation(self):
        _, old = self.prepare()
        with self.sessions.begin() as db:
            db.get(Dish, "rice").price = Decimal("36000")
        _, new = self.confirm(old)
        self.assertEqual(new["type"], "ORDER_CONFIRMATION")
        with self.sessions() as db:
            self.assertEqual(db.query(Order).count(), 0)
        self.assertEqual(self.confirm(new)[1]["type"], "ORDER_CREATED")

    def test_expired_and_cancelled_drafts_do_not_create(self):
        _, action = self.prepare()
        with self.sessions.begin() as db:
            db.get(ChatOrderDraft, action["draft_id"]).expires_at = now() - timedelta(seconds=1)
        with self.assertRaises(OrderError):
            self.confirm(action)
        _, action = self.prepare()
        with self.sessions.begin() as db:
            discard_draft(db, 1, "session")
        with self.assertRaises(OrderError):
            self.confirm(action)

    def test_account_isolation(self):
        _, action = self.prepare()
        with self.assertRaises(OrderError):
            self.confirm(action, user_id=2)

    def test_missing_phone_and_recipient_kind_are_collected(self):
        reply, action = self.prepare(recipient_phone=None, order_for_self=None)
        self.assertEqual(action["type"], "ORDER_COLLECTING")
        self.assertIn("SĐT", reply)
        self.assertIn("đặt hộ", reply)

    def test_proxy_order_does_not_overwrite_saved_details(self):
        _, action = self.prepare()
        self.confirm(action)
        with self.sessions.begin() as db:
            db.query(Order).update({Order.status: "HOAN_THANH"})
        _, action = self.prepare(order_for_self=False, recipient_name="Người Bạn", room_detail="Phòng 999")
        self.confirm(action)
        with self.sessions() as db:
            self.assertEqual(db.get(ChatDeliveryPreference, 1).details["room_detail"], "Phòng 502")

    def test_saved_details_suggested_only_to_owner(self):
        _, action = self.prepare()
        self.confirm(action)
        with self.sessions() as db:
            self.assertIsNotNone(draft_context(db, db.get(User, 1), "other")["saved_delivery"])
            self.assertIsNone(draft_context(db, db.get(User, 2), "other")["saved_delivery"])

    def test_four_receiving_and_timing_combinations(self):
        for order_type in ("delivery", "pickup"):
            for preorder in (False, True):
                with self.subTest(order_type=order_type, preorder=preorder):
                    self.setUp()
                    scheduled = (now() + timedelta(days=1)).replace(hour=4, minute=0, second=0).isoformat() if preorder else None
                    _, action = self.prepare(order_type=order_type, is_preorder=preorder, scheduled_at=scheduled)
                    _, created = self.confirm(action)
                    self.assertEqual(created["type"], "ORDER_CREATED")
                    self.assertEqual(Decimal(created["order"]["ship_fee"]), Decimal(5000 if order_type == "delivery" else 0))

    def test_unavailable_blacklist_active_order_and_quantity(self):
        with self.sessions.begin() as db:
            db.get(Dish, "rice").is_available = False
        with self.assertRaises(OrderError):
            self.prepare()
        with self.sessions.begin() as db:
            db.get(Dish, "rice").is_available = True
            db.get(User, 1).is_blacklisted = True
        with self.assertRaises(OrderError):
            self.prepare()
        with self.sessions.begin() as db:
            db.get(User, 1).is_blacklisted = False
        with self.assertRaises(OrderError):
            self.prepare(items=[{"dish_id": "rice", "quantity": 6}, {"dish_id": "rice", "quantity": 5}])
        _, action = self.prepare()
        self.confirm(action)
        with self.assertRaises(OrderError):
            self.prepare()

    def test_confirmation_failure_rolls_back_order_and_preferences(self):
        _, action = self.prepare()
        with patch("app.crud.chat_order.created_action", side_effect=RuntimeError("injected")):
            with self.assertRaises(RuntimeError):
                self.confirm(action)
        with self.sessions() as db:
            self.assertEqual(db.query(Order).count(), 0)
            self.assertEqual(db.query(ChatDeliveryPreference).count(), 0)
        self.assertEqual(self.confirm(action)[1]["type"], "ORDER_CREATED")

    def chat(self, body, model_action=None, user_id=1, path="/message"):
        from app.routes.chat import chat_bp
        app = Flask(__name__)
        app.register_blueprint(chat_bp, url_prefix="/api/v1/chat")
        app.config["TESTING"] = True
        from app.core.limiter import limiter
        limiter.enabled = False

        @contextmanager
        def test_db():
            with self.sessions.begin() as db:
                yield db

        actor = {"id": user_id, "role": "customer", "full_name": "Nguyễn An"} if user_id else None
        result = {"reply": "AI response", "provider": "gemini", "suggested_dishes": [], "action": model_action}
        with patch("app.routes.chat.get_db", test_db), \
             patch("app.routes.chat._extract_optional_user", return_value=actor), \
             patch("app.routes.chat.get_chatbot_knowledge_context", return_value={}), \
             patch("app.routes.chat.get_user_active_and_recent_orders", return_value=[]), \
             patch("app.routes.chat.get_conversation_history", return_value=[]), \
             patch("app.routes.chat.save_conversation_turn"), \
             patch("app.routes.chat.clear_conversation_history", return_value=True), \
             patch("app.routes.chat.generate_chat_reply", return_value=result):
            return app.test_client().post("/api/v1/chat" + path, json={"session_id": "session", **body})

    def test_ai_create_action_only_prepares_and_text_confirms(self):
        action = self.chat({"message": "Đặt món"}, {"type": "CREATE_ORDER", **self.payload()}).get_json()["data"]["action"]
        self.assertEqual(action["type"], "ORDER_CONFIRMATION")
        with self.sessions() as db:
            self.assertEqual(db.query(Order).count(), 0)
        response = self.chat({"message": "đồng ý đặt đơn", "draft_id": action["draft_id"], "revision": action["revision"]})
        self.assertEqual(response.get_json()["data"]["action"]["type"], "ORDER_CREATED")

    def test_negative_or_modified_agreement_does_not_confirm(self):
        for text in ("không đồng ý", "đồng ý nhưng đổi sang nhận quầy"):
            with self.subTest(text=text):
                self.setUp()
                _, action = self.prepare()
                self.chat({"message": text, "draft_id": action["draft_id"], "revision": action["revision"]})
                with self.sessions() as db:
                    self.assertEqual(db.query(Order).count(), 0)
                with self.assertRaises(OrderError):
                    self.confirm(action)

    def test_guest_order_is_login_required(self):
        response = self.chat({"message": "Đặt món"}, {"type": "PREPARE_ORDER", **self.payload()}, user_id=None)
        self.assertEqual(response.get_json()["data"]["action"]["type"], "NEED_LOGIN")

    def test_missing_confirmation_version_cannot_place_order(self):
        self.prepare()
        response = self.chat({"message": "đồng ý"})
        self.assertEqual(response.get_json()["data"]["action"]["type"], "ORDER_FAILED")

    def test_reset_invalidates_draft_but_keeps_saved_details_and_real_order(self):
        _, first = self.prepare()
        self.confirm(first)
        with self.sessions.begin() as db:
            db.query(Order).update({Order.status: "HOAN_THANH"})
        _, pending = self.prepare()
        response = self.chat({}, path="/reset")
        self.assertEqual(response.status_code, 200)
        with self.assertRaises(OrderError):
            self.confirm(pending)
        with self.sessions() as db:
            self.assertEqual(db.query(Order).count(), 1)
            self.assertIsNotNone(db.get(ChatDeliveryPreference, 1))
