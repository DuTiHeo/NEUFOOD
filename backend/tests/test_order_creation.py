"""UC08–UC10 and UC12 integration tests. TEST_DATABASE_URL must name a disposable *_orders_test DB.

Initialize that database with database/init_db.sql, then run from backend:
python -m unittest discover -s tests -p test_order_creation.py -v
"""
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from threading import Barrier
from unittest.mock import patch

from flask import Flask
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.core.security import create_access_token
from app.crud.order import ACTIVE_ORDER_STATUSES, OrderError, cancel_order, create_order, update_order_status
from app.db.models import CampusLocation, Dish, Order, OrderItem, SystemSetting, User
from app.routes.order import order_bp


class OrderCreationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url = os.environ.get("TEST_DATABASE_URL")
        if not url:
            raise unittest.SkipTest("Set TEST_DATABASE_URL to a disposable PostgreSQL *_orders_test database")
        parsed = make_url(url)
        if parsed.get_backend_name() != "postgresql" or not parsed.database.endswith("_orders_test"):
            raise RuntimeError("Refusing to modify a database without the PostgreSQL *_orders_test guard")
        cls.engine = create_engine(url, connect_args={"options": "-c statement_timeout=10000"})
        cls.sessions = sessionmaker(bind=cls.engine, autoflush=False)
        cls.app = Flask(__name__)
        cls.app.register_blueprint(order_bp, url_prefix="/api/v1/orders")
        cls.app.config["TESTING"] = True

        @contextmanager
        def test_db():
            with cls.sessions.begin() as db:
                yield db

        cls.db_patch = patch("app.routes.order.get_db", test_db)
        cls.db_patch.start()
        cls.addClassCleanup(cls.db_patch.stop)
        cls.addClassCleanup(cls.engine.dispose)

    def setUp(self):
        with self.engine.begin() as conn:
            conn.execute(text("TRUNCATE users, dishes, campus_locations, system_settings RESTART IDENTITY CASCADE"))
        with self.sessions.begin() as db:
            db.add_all([
                User(id=i, email=f"orders-test-{i}@example.com", password_hash="unused",
                     full_name="Test User", phone_number=f"097700000{i}", role=role)
                for i, role in enumerate(["customer", "customer", "staff", "manager", "admin"], 1)
            ])
            db.add_all([
                Dish(id="rice", name="Cơm", price=Decimal("35000"), base_price=Decimal("30000")),
                Dish(id="premium", name="Cơm đặc biệt", price=Decimal("50000"), base_price=Decimal("45000")),
                CampusLocation(id=1, building_code="A2", building_name="Tòa A2"),
                CampusLocation(id=2, building_code="A1", building_name="Tòa A1", is_active=False),
            ])
        self.now = datetime(2026, 10, 19, 4, 0, tzinfo=timezone.utc)

    def payload(self, **changes):
        return dict(order_type="delivery", recipient_name="Nguyễn An", recipient_phone="0977112233",
                    campus_location_id=1, room_detail="Phòng 502", delivery_address="Địa chỉ giả mạo",
                    items=[{"dish_id": "rice", "quantity": 2}], **changes)

    def post(self, payload=None, user=1, role="customer"):
        token = create_access_token({"sub": str(user), "role": role})
        with self.app.test_client() as client:
            return client.post("/api/v1/orders", json=payload if payload is not None else self.payload(),
                               headers={"Authorization": f"Bearer {token}"})

    def assert_rejected(self, payload, code, status=400, **auth):
        response = self.post(payload, **auth)
        self.assertEqual(response.status_code, status, response.get_json())
        self.assertEqual(response.get_json()["errors"][0]["code"], code)
        with self.sessions() as db:
            self.assertEqual(db.query(Order).count(), 0)
            self.assertEqual(db.query(OrderItem).count(), 0)

    def test_delivery_snapshot_and_server_prices(self):
        payload = self.payload()
        payload.update(total_amount=1, ship_fee=0)
        payload["items"][0].update(unit_price=1, base_price=1)
        with patch("app.crud.order.secrets.randbelow", return_value=7):
            response = self.post(payload)
        self.assertEqual(response.status_code, 201, response.get_json())
        data = response.get_json()["data"]
        self.assertEqual((data["subtotal_amount"], data["ship_fee"], data["total_amount"]), (70000, 5000, 75000))
        self.assertEqual((data["status"], data["payment_status"]), ("CHO_XAC_NHAN", "chua_thanh_toan"))
        self.assertEqual(data["order_code_suffix"], "0007")
        self.assertTrue(data["id"].endswith("0007"))
        self.assertIn("Tòa A2", data["delivery_address"])
        self.assertNotIn("giả mạo", data["delivery_address"])
        with self.sessions.begin() as db:
            dish = db.get(Dish, "rice")
            dish.price = 40000
            dish.base_price = 35000
        with self.sessions() as db:
            item = db.query(OrderItem).one()
            self.assertEqual((item.unit_price, item.base_price, item.dish_name), (35000, 30000, "Cơm"))
            self.assertEqual(db.query(Order).one().total_amount, 75000)

    def test_pickup_ignores_address_and_accepts_vietqr(self):
        payload = self.payload()
        payload.update(order_type="pickup", campus_location_id=999, payment_method="cod_vietqr")
        response = self.post(payload)
        self.assertEqual(response.status_code, 201, response.get_json())
        data = response.get_json()["data"]
        self.assertEqual((data["ship_fee"], data["delivery_address"], data["campus_location_id"], data["room_detail"]),
                         (0, "Quầy trả món Canteen A2", None, None))
        self.assertEqual(data["payment_method"], "cod_vietqr")

    def test_blacklist(self):
        with self.sessions.begin() as db:
            db.get(User, 1).is_blacklisted = True
        self.assert_rejected(self.payload(), "EX-10", 403)

    def test_database_role_and_account_status_override_old_token(self):
        for field, value in [("role", "staff"), ("is_active", False)]:
            with self.subTest(field=field):
                with self.sessions.begin() as db:
                    user = db.get(User, 1)
                    user.role, user.is_active = "customer", True
                    setattr(user, field, value)
                self.assert_rejected(self.payload(), "FORBIDDEN", 403)
        self.assert_rejected(self.payload(), "FORBIDDEN", 403, user=999)

    def test_each_active_state_blocks_another_order(self):
        self.assertEqual(self.post().status_code, 201)
        for state in ACTIVE_ORDER_STATUSES:
            with self.subTest(state=state):
                with self.sessions.begin() as db:
                    db.query(Order).one().status = state
                response = self.post()
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.get_json()["errors"][0]["code"], "EX-09")
        self.assertEqual(self.post(user=2).status_code, 201)

    def test_completed_order_allows_new_order(self):
        self.assertEqual(self.post().status_code, 201)
        with self.sessions.begin() as db:
            db.query(Order).one().status = "HOAN_THANH"
        self.assertEqual(self.post().status_code, 201)

    def test_missing_unavailable_inactive_deleted_dish(self):
        payload = self.payload()
        payload["items"] = [{"dish_id": "missing", "quantity": 1}]
        self.assert_rejected(payload, "EX-05")
        for field in ("is_available", "is_active", "is_deleted"):
            with self.subTest(field=field):
                with self.sessions.begin() as db:
                    dish = db.get(Dish, "rice")
                    dish.is_available, dish.is_active, dish.is_deleted = True, True, False
                    setattr(dish, field, field == "is_deleted")
                self.assert_rejected(self.payload(), "EX-05")

    def test_duplicate_dish_cannot_bypass_quantity_limit(self):
        payload = self.payload()
        payload["items"] = [{"dish_id": "rice", "quantity": 6}, {"dish_id": "rice", "quantity": 5}]
        self.assert_rejected(payload, "EX-06")
        payload["items"][1]["quantity"] = 4
        self.assertEqual(self.post(payload).status_code, 201)

    def test_delivery_requires_active_location(self):
        for location in (None, 999, 2):
            with self.subTest(location=location):
                payload = self.payload()
                payload["campus_location_id"] = location
                self.assert_rejected(payload, "EX-07")

    def test_cod_cap_includes_shipping(self):
        payload = self.payload()
        payload["items"] = [{"dish_id": "premium", "quantity": 10}]
        self.assert_rejected(payload, "EX-11")
        payload["order_type"] = "pickup"
        response = self.post(payload)
        self.assertEqual(response.status_code, 201, response.get_json())
        self.assertEqual(response.get_json()["data"]["total_amount"], 500000)

    def test_cod_one_dong_above_cap_rejected(self):
        with self.sessions.begin() as db:
            db.get(Dish, "rice").price = Decimal("495001")
        payload = self.payload()
        payload["items"][0]["quantity"] = 1
        self.assert_rejected(payload, "EX-11")

    def test_preorder_lead_boundary_and_timezone(self):
        payload = self.payload()
        payload["is_preorder"] = True
        with patch("app.crud.order.datetime") as clock:
            clock.now.return_value = self.now
            for delay in (None, -1, 29):
                with self.subTest(delay=delay):
                    payload["scheduled_at"] = (self.now + timedelta(minutes=delay)).isoformat() if delay is not None else None
                    self.assert_rejected(payload, "EX-08")
            payload["scheduled_at"] = (self.now + timedelta(minutes=30)).astimezone(timezone(timedelta(hours=7))).isoformat()
            response = self.post(payload)
        self.assertEqual(response.status_code, 201, response.get_json())
        with self.sessions() as db:
            self.assertEqual(db.query(Order).one().scheduled_at, self.now + timedelta(minutes=30))

    def test_preorder_opening_hours(self):
        payload = self.payload()
        payload["is_preorder"] = True
        with patch("app.crud.order.datetime") as clock:
            clock.now.return_value = self.now
            for hour, minute in [(22, 0), (12, 30)]:
                payload["scheduled_at"] = (self.now + timedelta(days=1)).replace(hour=hour, minute=minute).isoformat()
                self.assert_rejected(payload, "EX-08")
            payload["scheduled_at"] = (self.now + timedelta(days=1)).replace(hour=23, minute=30).isoformat()
            self.assertEqual(self.post(payload).status_code, 201)  # 06:30 Asia/Saigon

    def test_scheduled_time_requires_preorder(self):
        payload = self.payload()
        payload["scheduled_at"] = (self.now + timedelta(hours=1)).isoformat()
        self.assert_rejected(payload, "EX-08")

    def test_settings_apply_with_database_hard_caps(self):
        with self.sessions.begin() as db:
            db.add_all([SystemSetting(setting_key=key, setting_value=value) for key, value in
                        [("delivery_fee", "7000"), ("max_cod_amount", "80000"),
                         ("max_dish_quantity_per_order", "2"), ("min_preorder_lead_minutes", "45")]])
        payload = self.payload()
        payload["items"][0]["quantity"] = 3
        self.assert_rejected(payload, "EX-06")
        payload = self.payload()
        payload.update(is_preorder=True, scheduled_at=(self.now + timedelta(minutes=30)).isoformat())
        with patch("app.crud.order.datetime") as clock:
            clock.now.return_value = self.now
            self.assert_rejected(payload, "EX-08")
        response = self.post()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["data"]["total_amount"], 77000)

    def test_settings_cannot_raise_existing_schema_caps(self):
        with self.sessions.begin() as db:
            db.add_all([SystemSetting(setting_key=key, setting_value=value) for key, value in
                        [("max_cod_amount", "1000000"), ("max_dish_quantity_per_order", "20")]])
        payload = self.payload()
        payload["items"] = [{"dish_id": "rice", "quantity": 6}, {"dish_id": "rice", "quantity": 5}]
        self.assert_rejected(payload, "EX-06")
        payload["items"] = [{"dish_id": "premium", "quantity": 10}]
        self.assert_rejected(payload, "EX-11")

    def test_schema_rejects_bad_input(self):
        for quantity in (0, 11, True, 1.5, "2"):
            with self.subTest(quantity=quantity):
                payload = self.payload()
                payload["items"][0]["quantity"] = quantity
                self.assertEqual(self.post(payload).status_code, 422)
        for changes in ({"items": []}, {"recipient_phone": "abcdefghij"}, {"recipient_name": "  "},
                        {"recipient_name": "a" * 151}, {"payment_method": "vnpay"},
                        {"order_type": "unknown"}, {"room_detail": "x" * 101},
                        {"campus_location_id": True}, {"is_preorder": "false"},
                        {"is_preorder": True, "scheduled_at": "2026-10-20T12:00:00"}):
            with self.subTest(changes=changes):
                payload = self.payload()
                payload.update(changes)
                response = self.post(payload)
                self.assertEqual(response.status_code, 422, response.get_json())
        with self.sessions() as db:
            self.assertEqual(db.query(Order).count(), 0)

    def test_malformed_json_and_roles(self):
        with self.app.test_client() as client:
            self.assertEqual(client.post("/api/v1/orders", json=self.payload()).status_code, 401)
            token = create_access_token({"sub": "1", "role": "customer"})
            headers = {"Authorization": f"Bearer {token}"}
            for raw in ("{", "null", "[]", '"string"'):
                response = client.post("/api/v1/orders", data=raw, content_type="application/json", headers=headers)
                self.assertEqual(response.status_code, 422)
                self.assertFalse(response.get_json()["success"])
        for user, role in [(3, "staff"), (4, "manager"), (5, "admin")]:
            self.assertEqual(self.post(user=user, role=role).status_code, 403)

    def test_simultaneous_requests_create_only_one_active_order(self):
        barrier = Barrier(2)

        def concurrent_create(*args, **kwargs):
            barrier.wait(timeout=5)
            return create_order(*args, **kwargs)

        with patch("app.routes.order.create_order", side_effect=concurrent_create):
            with ThreadPoolExecutor(max_workers=2) as pool:
                futures = [pool.submit(self.post) for _ in range(2)]
                responses = [future.result(timeout=15) for future in futures]
        self.assertEqual(sorted(r.status_code for r in responses), [201, 400])
        rejected = next(r for r in responses if r.status_code == 400)
        self.assertEqual(rejected.get_json()["errors"][0]["code"], "EX-09")
        with self.sessions() as db:
            self.assertEqual(db.query(Order).count(), 1)
            self.assertEqual(db.query(OrderItem).count(), 1)

    def test_item_database_failure_rolls_back_entire_order(self):
        with self.engine.begin() as conn:
            conn.execute(text("ALTER TABLE order_items ADD CONSTRAINT test_item_failure CHECK (quantity < 2)"))
        try:
            with self.assertRaises(IntegrityError) as error:
                self.post()
            self.assertIn("test_item_failure", str(error.exception.orig))
            with self.sessions() as db:
                self.assertEqual(db.query(Order).count(), 0)
                self.assertEqual(db.query(OrderItem).count(), 0)
        finally:
            with self.engine.begin() as conn:
                conn.execute(text("ALTER TABLE order_items DROP CONSTRAINT test_item_failure"))

    def cancel(self, order_id, user=1, role="customer"):
        token = create_access_token({"sub": str(user), "role": role})
        with self.app.test_client() as client:
            return client.post(f"/api/v1/orders/{order_id}/cancel",
                               headers={"Authorization": f"Bearer {token}"})

    def test_customer_cancels_pending_order_and_can_place_again(self):
        before = self.post().get_json()["data"]
        response = self.cancel(before["id"])
        self.assertEqual(response.status_code, 200, response.get_json())
        after = response.get_json()["data"]
        self.assertEqual(after["status"], "DA_HUY_KHACH")
        for field in ("payment_status", "total_amount", "items", "order_code_suffix", "user_id"):
            self.assertEqual(after[field], before[field])
        self.assertEqual(self.post().status_code, 201)

    def test_cancel_rejects_every_non_pending_state(self):
        order_id = self.post().get_json()["data"]["id"]
        states = ("DANG_CHUAN_BI", "DANG_GIAO", "SAN_SANG_LAY", "DA_GIAO", "DA_BAN_GIAO",
                  "GIAO_THAT_BAI", "HOAN_THANH", "DA_HUY_KHACH", "TU_CHOI", "TU_DONG_HUY",
                  "BO_DON_BLACKLIST", "KHIEU_NAI", "DA_GIAI_QUYET")
        for state in states:
            with self.subTest(state=state):
                with self.sessions.begin() as db:
                    db.get(Order, order_id).status = state
                response = self.cancel(order_id)
                self.assertEqual(response.status_code, 400, response.get_json())
                self.assertEqual(response.get_json()["errors"][0]["code"], "EX-12")
                if state == "DANG_CHUAN_BI":
                    self.assertEqual(response.get_json()["message"],
                                     "Bếp đã bắt đầu nấu đơn hàng của bạn, không thể hủy đơn vào lúc này")
                with self.sessions() as db:
                    self.assertEqual(db.get(Order, order_id).status, state)

    def test_cancel_not_found_and_other_customers_order_are_hidden(self):
        order_id = self.post().get_json()["data"]["id"]
        for target, user in [("missing", 1), (order_id, 2)]:
            response = self.cancel(target, user=user)
            self.assertEqual(response.status_code, 404)
            self.assertIsNone(response.get_json()["data"])
        with self.sessions() as db:
            self.assertEqual(db.get(Order, order_id).status, "CHO_XAC_NHAN")

    def test_cancel_requires_customer_and_active_database_account(self):
        order_id = self.post().get_json()["data"]["id"]
        with self.app.test_client() as client:
            self.assertEqual(client.post(f"/api/v1/orders/{order_id}/cancel").status_code, 401)
        for user, role in [(3, "staff"), (4, "manager"), (5, "admin")]:
            self.assertEqual(self.cancel(order_id, user=user, role=role).status_code, 403)
        with self.sessions.begin() as db:
            db.get(User, 1).is_active = False
        self.assertEqual(self.cancel(order_id).status_code, 403)
        with self.sessions.begin() as db:
            user = db.get(User, 1)
            user.is_active, user.role = True, "staff"
        self.assertEqual(self.cancel(order_id).status_code, 403)
        with self.sessions() as db:
            self.assertEqual(db.get(Order, order_id).status, "CHO_XAC_NHAN")

    def test_blacklist_does_not_block_cancellation(self):
        order_id = self.post().get_json()["data"]["id"]
        with self.sessions.begin() as db:
            db.get(User, 1).is_blacklisted = True
        self.assertEqual(self.cancel(order_id).status_code, 200)

    def test_two_simultaneous_cancellations_only_one_succeeds(self):
        order_id = self.post().get_json()["data"]["id"]
        barrier = Barrier(2)

        def concurrent_cancel(*args, **kwargs):
            barrier.wait(timeout=5)
            return cancel_order(*args, **kwargs)

        with patch("app.routes.order.cancel_order", side_effect=concurrent_cancel):
            with ThreadPoolExecutor(max_workers=2) as pool:
                futures = [pool.submit(self.cancel, order_id) for _ in range(2)]
                self.assertEqual(sorted(f.result(timeout=15).status_code for f in futures), [200, 400])
        with self.sessions() as db:
            self.assertEqual(db.get(Order, order_id).status, "DA_HUY_KHACH")

    def test_stale_staff_update_cannot_overwrite_cancellation(self):
        order_id = self.post().get_json()["data"]["id"]
        with self.sessions() as db:
            stale = db.get(Order, order_id)
            self.assertEqual(self.cancel(order_id).status_code, 200)
            with self.assertRaises(OrderError) as error:
                update_order_status(db, stale, "DANG_CHUAN_BI")
            self.assertEqual(error.exception.code, "EX-12")
        with self.sessions() as db:
            self.assertEqual(db.get(Order, order_id).status, "DA_HUY_KHACH")

    def test_cancel_and_staff_accept_cannot_both_succeed(self):
        order_id = self.post().get_json()["data"]["id"]
        barrier = Barrier(2)

        def concurrent_cancel(*args, **kwargs):
            barrier.wait(timeout=5)
            return cancel_order(*args, **kwargs)

        def concurrent_update(*args, **kwargs):
            barrier.wait(timeout=5)
            return update_order_status(*args, **kwargs)

        def accept():
            token = create_access_token({"sub": "3", "role": "staff"})
            with self.app.test_client() as client:
                return client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "DANG_CHUAN_BI"},
                                    headers={"Authorization": f"Bearer {token}"})

        with patch("app.routes.order.cancel_order", side_effect=concurrent_cancel), \
                patch("app.routes.order.update_order_status", side_effect=concurrent_update):
            with ThreadPoolExecutor(max_workers=2) as pool:
                cancel_future = pool.submit(self.cancel, order_id)
                accept_future = pool.submit(accept)
                cancelled, accepted = cancel_future.result(timeout=15), accept_future.result(timeout=15)
        self.assertEqual(sorted([cancelled.status_code, accepted.status_code]), [200, 400])
        with self.sessions() as db:
            expected = "DA_HUY_KHACH" if cancelled.status_code == 200 else "DANG_CHUAN_BI"
            self.assertEqual(db.get(Order, order_id).status, expected)

    def test_generic_status_endpoint_cannot_cancel_for_customer(self):
        order_id = self.post().get_json()["data"]["id"]
        token = create_access_token({"sub": "3", "role": "staff"})
        with self.app.test_client() as client:
            response = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "DA_HUY_KHACH"},
                                    headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["errors"][0]["code"], "EX-12")
        with self.sessions() as db:
            self.assertEqual(db.get(Order, order_id).status, "CHO_XAC_NHAN")


if __name__ == "__main__":
    unittest.main()
