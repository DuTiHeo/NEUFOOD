"""RCRS integration tests (Reviews, Complaints, Shifts, Reports).
TEST_DATABASE_URL must name a disposable *_rcrs_test DB.

Initialize that database with database/init_db.sql, then run from backend:
python -m unittest discover -s tests -p test_rcrs_integration.py -v
"""
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

from flask import Flask
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.core.security import create_access_token
from app.db.models import (
    CampusLocation, Dish, Order, OrderItem, SystemSetting, User, Review, Complaint, StaffShift
)
from app.routes.review import review_bp
from app.routes.complaint import complaint_bp
from app.routes.shift import shift_bp


class RcrsIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url = os.environ.get("TEST_DATABASE_URL")
        if not url:
            raise unittest.SkipTest("Set TEST_DATABASE_URL to a disposable PostgreSQL *_rcrs_test database")
        parsed = make_url(url)
        if parsed.get_backend_name() != "postgresql" or not parsed.database.endswith("_rcrs_test"):
            raise RuntimeError("Refusing to modify a database without the PostgreSQL *_rcrs_test guard")
        cls.engine = create_engine(url, connect_args={"options": "-c statement_timeout=10000"})
        cls.sessions = sessionmaker(bind=cls.engine, autoflush=False)
        cls.app = Flask(__name__)
        cls.app.register_blueprint(review_bp, url_prefix="/api/v1/reviews")
        cls.app.register_blueprint(complaint_bp, url_prefix="/api/v1/complaints")
        cls.app.register_blueprint(shift_bp, url_prefix="/api/v1/shifts")
        cls.app.config["TESTING"] = True

        @contextmanager
        def _get_test_db():
            with cls.sessions.begin() as db:
                yield db

        cls.review_db_patch = patch("app.routes.review.get_db", _get_test_db)
        cls.complaint_db_patch = patch("app.routes.complaint.get_db", _get_test_db)
        cls.shift_db_patch = patch("app.routes.shift.get_db", _get_test_db)

        cls.review_db_patch.start()
        cls.complaint_db_patch.start()
        cls.shift_db_patch.start()

        cls.addClassCleanup(cls.review_db_patch.stop)
        cls.addClassCleanup(cls.complaint_db_patch.stop)
        cls.addClassCleanup(cls.shift_db_patch.stop)
        cls.addClassCleanup(cls.engine.dispose)

    def setUp(self):
        with self.engine.begin() as conn:
            conn.execute(
                text("TRUNCATE users, dishes, campus_locations, system_settings, orders, order_items, reviews, complaints, staff_shifts RESTART IDENTITY CASCADE")
            )
        with self.sessions.begin() as db:
            db.add_all([
                User(id=1, email="customer1@example.com", password_hash="unused",
                     full_name="Nguyễn Khách 1", phone_number="0977000001", role="customer"),
                User(id=2, email="customer2@example.com", password_hash="unused",
                     full_name="Nguyễn Khách 2", phone_number="0977000002", role="customer"),
                User(id=3, email="staff1@example.com", password_hash="unused",
                     full_name="Trần Nhân Viên", phone_number="0977000003", role="staff"),
                User(id=4, email="manager1@example.com", password_hash="unused",
                     full_name="Lê Quản Lý", phone_number="0977000004", role="manager"),
                User(id=5, email="admin1@example.com", password_hash="unused",
                     full_name="Phạm Quản Trị", phone_number="0977000005", role="admin"),
                User(id=6, email="staff2@example.com", password_hash="unused",
                     full_name="Hoàng Nhân Viên 2", phone_number="0977000006", role="staff"),
            ])
            db.add_all([
                SystemSetting(setting_key="complaint_window_hours", setting_value="24", description="Thời hạn khiếu nại (giờ)"),
            ])
            db.add_all([
                Dish(id="bun-bo-hue", name="Bún bò Huế", price=Decimal("40000"), base_price=Decimal("35000"),
                     rating=Decimal("4.90"), review_count=420),
                Dish(id="com-tam", name="Cơm tấm sườn", price=Decimal("35000"), base_price=Decimal("30000"),
                     rating=None, review_count=0),
                Dish(id="tra-dao", name="Trà đào", price=Decimal("15000"), base_price=Decimal("12000"),
                     rating=Decimal("5.00"), review_count=1),
                CampusLocation(id=1, building_code="A2", building_name="Tòa A2"),
            ])
            now = datetime.now(timezone.utc)
            # Đơn 1: Đã giao, của user 1, do staff 3 bàn giao COD tiền mặt
            o1 = Order(
                id="NF2610190001", order_code_suffix="0001", user_id=1, staff_id=3, order_type="delivery",
                status="DA_GIAO", recipient_name="Nguyễn Khách 1", recipient_phone="0977000001",
                delivery_address="Phòng 502, Tòa A2", payment_method="cod_cash", payment_status="da_thanh_toan",
                subtotal_amount=Decimal("75000"), ship_fee=Decimal("5000"), total_amount=Decimal("80000"),
                delivered_at=now, created_at=now,
            )
            # Đơn 2: Chờ xác nhận, của user 1
            o2 = Order(
                id="NF2610190002", order_code_suffix="0002", user_id=1, order_type="delivery",
                status="CHO_XAC_NHAN", recipient_name="Nguyễn Khách 1", recipient_phone="0977000001",
                delivery_address="Phòng 502, Tòa A2", payment_method="cod_cash", payment_status="chua_thanh_toan",
                subtotal_amount=Decimal("40000"), ship_fee=Decimal("5000"), total_amount=Decimal("45000"),
                created_at=now,
            )
            # Đơn 3: Đã bàn giao, của user 2, do staff 3 bàn giao COD VietQR
            o3 = Order(
                id="NF2610190003", order_code_suffix="0003", user_id=2, staff_id=3, order_type="pickup",
                status="DA_BAN_GIAO", recipient_name="Nguyễn Khách 2", recipient_phone="0977000002",
                delivery_address="Quầy trả món Canteen A2", payment_method="cod_vietqr", payment_status="da_thanh_toan",
                subtotal_amount=Decimal("40000"), ship_fee=Decimal("0"), total_amount=Decimal("40000"),
                delivered_at=now, created_at=now,
            )
            # Đơn 4: Hoàn thành, của user 1
            o4 = Order(
                id="NF2610190004", order_code_suffix="0004", user_id=1, order_type="delivery",
                status="HOAN_THANH", recipient_name="Nguyễn Khách 1", recipient_phone="0977000001",
                delivery_address="Phòng 502, Tòa A2", payment_method="cod_cash", payment_status="da_thanh_toan",
                subtotal_amount=Decimal("40000"), ship_fee=Decimal("5000"), total_amount=Decimal("45000"),
                delivered_at=now, completed_at=now, created_at=now,
            )
            # Đơn 5: Đã giao 25 giờ trước (quá hạn 24h)
            o5 = Order(
                id="NF2610190005", order_code_suffix="0005", user_id=1, order_type="delivery",
                status="DA_GIAO", recipient_name="Nguyễn Khách 1", recipient_phone="0977000001",
                delivery_address="Phòng 502, Tòa A2", payment_method="cod_cash", payment_status="da_thanh_toan",
                subtotal_amount=Decimal("40000"), ship_fee=Decimal("5000"), total_amount=Decimal("45000"),
                delivered_at=now - timedelta(hours=25), created_at=now - timedelta(hours=26),
            )
            # Đơn 6: Đã giao, của user 2, đang có 1 khiếu nại DANG_XU_LY
            o6 = Order(
                id="NF2610190006", order_code_suffix="0006", user_id=2, order_type="delivery",
                status="KHIEU_NAI", recipient_name="Nguyễn Khách 2", recipient_phone="0977000002",
                delivery_address="Phòng 601, Tòa A2", payment_method="cod_cash", payment_status="da_thanh_toan",
                subtotal_amount=Decimal("40000"), ship_fee=Decimal("5000"), total_amount=Decimal("45000"),
                delivered_at=now, created_at=now,
            )
            # Đơn 7: Bị từ chối (chưa thanh toán)
            o7 = Order(
                id="NF2610190007", order_code_suffix="0007", user_id=1, order_type="delivery",
                status="TU_CHOI", recipient_name="Nguyễn Khách 1", recipient_phone="0977000001",
                delivery_address="Phòng 502, Tòa A2", payment_method="cod_cash", payment_status="chua_thanh_toan",
                subtotal_amount=Decimal("30000"), ship_fee=Decimal("0"), total_amount=Decimal("30000"),
                created_at=now,
            )
            # Đơn 8: Bỏ đơn blacklist (chưa thanh toán)
            o8 = Order(
                id="NF2610190008", order_code_suffix="0008", user_id=2, order_type="delivery",
                status="BO_DON_BLACKLIST", recipient_name="Nguyễn Khách 2", recipient_phone="0977000002",
                delivery_address="Phòng 601, Tòa A2", payment_method="cod_cash", payment_status="chua_thanh_toan",
                subtotal_amount=Decimal("45000"), ship_fee=Decimal("5000"), total_amount=Decimal("50000"),
                created_at=now,
            )
            db.add_all([o1, o2, o3, o4, o5, o6, o7, o8])
            db.add_all([
                OrderItem(order_id="NF2610190001", dish_id="bun-bo-hue", dish_name="Bún bò Huế",
                          unit_price=Decimal("40000"), base_price=Decimal("35000"), quantity=1, subtotal=Decimal("40000")),
                OrderItem(order_id="NF2610190001", dish_id="com-tam", dish_name="Cơm tấm sườn",
                          unit_price=Decimal("35000"), base_price=Decimal("30000"), quantity=1, subtotal=Decimal("35000")),
                OrderItem(order_id="NF2610190002", dish_id="bun-bo-hue", dish_name="Bún bò Huế",
                          unit_price=Decimal("40000"), base_price=Decimal("35000"), quantity=1, subtotal=Decimal("40000")),
                OrderItem(order_id="NF2610190003", dish_id="bun-bo-hue", dish_name="Bún bò Huế",
                          unit_price=Decimal("40000"), base_price=Decimal("35000"), quantity=1, subtotal=Decimal("40000")),
                OrderItem(order_id="NF2610190004", dish_id="bun-bo-hue", dish_name="Bún bò Huế",
                          unit_price=Decimal("40000"), base_price=Decimal("35000"), quantity=1, subtotal=Decimal("40000")),
                OrderItem(order_id="NF2610190005", dish_id="bun-bo-hue", dish_name="Bún bò Huế",
                          unit_price=Decimal("40000"), base_price=Decimal("35000"), quantity=1, subtotal=Decimal("40000")),
                OrderItem(order_id="NF2610190006", dish_id="bun-bo-hue", dish_name="Bún bò Huế",
                          unit_price=Decimal("40000"), base_price=Decimal("35000"), quantity=1, subtotal=Decimal("40000")),
            ])
            # Tạo sẵn 1 ticket khiếu nại cho đơn NF2610190006 (để sequence tự cấp id)
            c6 = Complaint(
                order_id="NF2610190006",
                user_id=2,
                reason="Giao nhầm món ăn",
                description="Đặt bún bò Huế nhưng giao nhầm bún riêu",
                proof_image_url="https://example.com/proof1.jpg",
                status="DANG_XU_LY",
                created_at=now,
            )
            db.add(c6)

    def post_review(self, payload, user_id=1, role="customer"):
        token = create_access_token({"sub": str(user_id), "role": role})
        with self.app.test_client() as client:
            return client.post("/api/v1/reviews", json=payload, headers={"Authorization": f"Bearer {token}"})

    def post_complaint(self, payload, user_id=1, role="customer"):
        token = create_access_token({"sub": str(user_id), "role": role})
        with self.app.test_client() as client:
            return client.post("/api/v1/complaints", json=payload, headers={"Authorization": f"Bearer {token}"})

    def patch_resolve_complaint(self, complaint_id, payload, user_id=5, role="admin"):
        token = create_access_token({"sub": str(user_id), "role": role})
        with self.app.test_client() as client:
            return client.patch(f"/api/v1/complaints/{complaint_id}/resolve", json=payload, headers={"Authorization": f"Bearer {token}"})

    def get_my_current_shift(self, user_id=3, role="staff"):
        token = create_access_token({"sub": str(user_id), "role": role})
        with self.app.test_client() as client:
            return client.get("/api/v1/shifts/my-current-shift", headers={"Authorization": f"Bearer {token}"})

    def post_submit_shift(self, payload, user_id=3, role="staff"):
        token = create_access_token({"sub": str(user_id), "role": role})
        with self.app.test_client() as client:
            return client.post("/api/v1/shifts/submit", json=payload, headers={"Authorization": f"Bearer {token}"})

    def patch_close_shift(self, shift_id, payload, user_id=4, role="manager"):
        token = create_access_token({"sub": str(user_id), "role": role})
        with self.app.test_client() as client:
            return client.patch(f"/api/v1/shifts/{shift_id}/close", json=payload, headers={"Authorization": f"Bearer {token}"})

    def get_complaint(self, complaint_id, user_id=1, role="customer"):
        token = create_access_token({"sub": str(user_id), "role": role})
        with self.app.test_client() as client:
            return client.get(f"/api/v1/complaints/{complaint_id}", headers={"Authorization": f"Bearer {token}"})

    def get_shift(self, shift_id, user_id=3, role="staff"):
        token = create_access_token({"sub": str(user_id), "role": role})
        with self.app.test_client() as client:
            return client.get(f"/api/v1/shifts/{shift_id}", headers={"Authorization": f"Bearer {token}"})

    def get_reports_summary(self, query_params="", user_id=4, role="manager"):
        token = create_access_token({"sub": str(user_id), "role": role})
        with self.app.test_client() as client:
            url = "/api/v1/shifts/reports/summary"
            if query_params:
                url += f"?{query_params}"
            return client.get(url, headers={"Authorization": f"Bearer {token}"})


    # ==========================
    # TESTS PHASE 1: REVIEWS
    # ==========================

    def test_review_first_review_on_dish(self):
        """Món chưa có review nào: rating mới chính là rating vừa đánh giá."""
        payload = {
            "order_id": "NF2610190001",
            "dish_id": "com-tam",
            "rating": 5,
            "comment": "Cơm tấm rất ngon!",
        }
        res = self.post_review(payload, user_id=1)
        self.assertEqual(res.status_code, 201, res.get_json())
        data = res.get_json()["data"]
        self.assertEqual(data["order_id"], "NF2610190001")
        self.assertEqual(data["dish_id"], "com-tam")
        self.assertEqual(data["rating"], 5)
        self.assertEqual(data["comment"], "Cơm tấm rất ngon!")
        self.assertEqual(data["user_name"], "Nguyễn Khách 1")
        self.assertIsNotNone(data["created_at"])

        with self.sessions() as db:
            dish = db.get(Dish, "com-tam")
            self.assertEqual(dish.rating, Decimal("5.00"))
            self.assertEqual(dish.review_count, 1)

    def test_review_incremental_average_formula(self):
        """Món đã có 420 lượt và rating 4.90 (seed data), đánh giá 1 sao."""
        payload = {
            "order_id": "NF2610190001",
            "dish_id": "bun-bo-hue",
            "rating": 1,
            "comment": "Hôm nay nước dùng hơi mặn",
        }
        res = self.post_review(payload, user_id=1)
        self.assertEqual(res.status_code, 201, res.get_json())

        # Công thức D1: (4.90 * 420 + 1) / 421 = 2059 / 421 = 4.890736... -> 4.89
        with self.sessions() as db:
            dish = db.get(Dish, "bun-bo-hue")
            self.assertEqual(dish.rating, Decimal("4.89"))
            self.assertEqual(dish.review_count, 421)

    def test_review_order_not_reviewable(self):
        """Đơn hàng đang ở trạng thái CHO_XAC_NHAN thì không được đánh giá."""
        payload = {
            "order_id": "NF2610190002",
            "dish_id": "bun-bo-hue",
            "rating": 5,
        }
        res = self.post_review(payload, user_id=1)
        self.assertEqual(res.status_code, 400, res.get_json())
        self.assertEqual(res.get_json()["errors"][0]["code"], "ORDER_NOT_REVIEWABLE")

    def test_review_other_user_order(self):
        """Không được đánh giá đơn hàng của khách hàng khác (404 bảo mật)."""
        payload = {
            "order_id": "NF2610190003",
            "dish_id": "bun-bo-hue",
            "rating": 5,
        }
        res = self.post_review(payload, user_id=1)
        self.assertEqual(res.status_code, 404, res.get_json())
        self.assertEqual(res.get_json()["errors"][0]["code"], "NOT_FOUND")

    def test_review_dish_not_in_order(self):
        """Món ăn không có trong đơn hàng thì không được đánh giá."""
        payload = {
            "order_id": "NF2610190001",
            "dish_id": "tra-dao",
            "rating": 5,
        }
        res = self.post_review(payload, user_id=1)
        self.assertEqual(res.status_code, 400, res.get_json())
        self.assertEqual(res.get_json()["errors"][0]["code"], "DISH_NOT_IN_ORDER")

    def test_review_duplicate(self):
        """Không được đánh giá 2 lần cùng một món trong cùng một đơn."""
        payload = {
            "order_id": "NF2610190001",
            "dish_id": "bun-bo-hue",
            "rating": 5,
        }
        res1 = self.post_review(payload, user_id=1)
        self.assertEqual(res1.status_code, 201)

        res2 = self.post_review(payload, user_id=1)
        self.assertEqual(res2.status_code, 400, res2.get_json())
        self.assertEqual(res2.get_json()["errors"][0]["code"], "REVIEW_DUPLICATE")

    def test_review_validation_schema(self):
        """Kiểm tra xác thực schema đầu vào (Pydantic v2 strict mode)."""
        base_payload = {"order_id": "NF2610190001", "dish_id": "bun-bo-hue", "rating": 5}

        for invalid_rating in [0, 6, -1, 10]:
            p = dict(base_payload, rating=invalid_rating)
            res = self.post_review(p, user_id=1)
            self.assertEqual(res.status_code, 422)

        for strict_invalid in ["5", 4.5, True]:
            p = dict(base_payload, rating=strict_invalid)
            res = self.post_review(p, user_id=1)
            self.assertEqual(res.status_code, 422)

        p = dict(base_payload, comment="A" * 1001)
        res = self.post_review(p, user_id=1)
        self.assertEqual(res.status_code, 422)

        for empty_field in ["order_id", "dish_id"]:
            p = dict(base_payload)
            p[empty_field] = ""
            res = self.post_review(p, user_id=1)
            self.assertEqual(res.status_code, 422)

    def test_review_auth_and_permissions(self):
        """Chưa đăng nhập, sai vai trò hoặc tài khoản bị khóa."""
        payload = {"order_id": "NF2610190001", "dish_id": "bun-bo-hue", "rating": 5}

        with self.app.test_client() as client:
            res = client.post("/api/v1/reviews", json=payload)
            self.assertEqual(res.status_code, 401)

        res_staff = self.post_review(payload, user_id=3, role="staff")
        self.assertEqual(res_staff.status_code, 403)

        with self.sessions.begin() as db:
            db.get(User, 1).is_active = False
        res_inactive = self.post_review(payload, user_id=1, role="customer")
        self.assertEqual(res_inactive.status_code, 403)

    def test_list_dish_reviews(self):
        """Lấy danh sách đánh giá theo dish_id (xác định thứ tự DESC theo created_at và id)."""
        with self.sessions.begin() as db:
            now = datetime.now(timezone.utc)
            t_earlier = now - timedelta(minutes=10)
            db.add_all([
                Review(order_id="NF2610190001", dish_id="bun-bo-hue", user_id=1, rating=5, comment="Tuyệt vời", created_at=now),
                Review(order_id="NF2610190003", dish_id="bun-bo-hue", user_id=2, rating=4, comment="Ổn áp", created_at=t_earlier),
            ])

        with self.app.test_client() as client:
            res = client.get("/api/v1/reviews/dish/bun-bo-hue")
            self.assertEqual(res.status_code, 200)
            data = res.get_json()["data"]
            self.assertEqual(len(data), 2)
            self.assertEqual(data[0]["dish_id"], "bun-bo-hue")
            self.assertEqual(data[0]["user_name"], "Nguyễn Khách 1")
            self.assertEqual(data[1]["user_name"], "Nguyễn Khách 2")

    def test_concurrent_reviews_same_dish(self):
        """Hai review gửi đồng thời trên cùng một món ăn không làm sai lệch review_count."""
        p1 = {"order_id": "NF2610190001", "dish_id": "bun-bo-hue", "rating": 5}
        p2 = {"order_id": "NF2610190003", "dish_id": "bun-bo-hue", "rating": 4}

        with ThreadPoolExecutor(max_workers=2) as pool:
            f1 = pool.submit(self.post_review, p1, 1, "customer")
            f2 = pool.submit(self.post_review, p2, 2, "customer")
            r1 = f1.result(timeout=10)
            r2 = f2.result(timeout=10)

        self.assertEqual(r1.status_code, 201)
        self.assertEqual(r2.status_code, 201)

        with self.sessions() as db:
            dish = db.get(Dish, "bun-bo-hue")
            self.assertEqual(dish.review_count, 422)

    # ==========================
    # TESTS PHASE 2: COMPLAINTS
    # ==========================

    def test_create_complaint_success(self):
        """Tạo khiếu nại thành công cho đơn đã giao (UC15), order đổi sang KHIEU_NAI."""
        payload = {
            "order_id": "NF2610190001",
            "reason": "Thiếu món ăn kèm",
            "description": "Đơn hàng thiếu trà đào và đũa muỗng.",
            "proof_image_url": "https://example.com/proof-complain.jpg",
        }
        res = self.post_complaint(payload, user_id=1)
        self.assertEqual(res.status_code, 201, res.get_json())
        data = res.get_json()["data"]
        self.assertEqual(data["order_id"], "NF2610190001")
        self.assertEqual(data["user_id"], 1)
        self.assertEqual(data["reason"], "Thiếu món ăn kèm")
        self.assertEqual(data["status"], "DANG_XU_LY")
        self.assertEqual(data["user_name"], "Nguyễn Khách 1")
        self.assertIsNotNone(data["created_at"])

        with self.sessions() as db:
            order = db.get(Order, "NF2610190001")
            self.assertEqual(order.status, "KHIEU_NAI")

    def test_create_complaint_order_not_complainable(self):
        """Đơn hàng đang CHO_XAC_NHAN thì không được khiếu nại (EX-14)."""
        payload = {
            "order_id": "NF2610190002",
            "reason": "Giao nhầm",
            "description": "Giao sai đồ ăn",
            "proof_image_url": "https://example.com/proof.jpg",
        }
        res = self.post_complaint(payload, user_id=1)
        self.assertEqual(res.status_code, 400, res.get_json())
        self.assertEqual(res.get_json()["errors"][0]["code"], "EX-14")

    def test_create_complaint_window_expired(self):
        """Đơn hàng đã giao quá 24 giờ thì bị từ chối khiếu nại (BR-23, EX-14)."""
        payload = {
            "order_id": "NF2610190005",
            "reason": "Đồ ăn nguội",
            "description": "Đồ ăn bị giao muộn và nguội ngắt",
            "proof_image_url": "https://example.com/proof.jpg",
        }
        res = self.post_complaint(payload, user_id=1)
        self.assertEqual(res.status_code, 400, res.get_json())
        self.assertEqual(res.get_json()["errors"][0]["code"], "EX-14")

    def test_create_complaint_duplicate_rejected(self):
        """Mỗi đơn chỉ được tạo tối đa 01 khiếu nại (EX-15)."""
        payload = {
            "order_id": "NF2610190006",
            "reason": "Khiếu nại lần 2",
            "description": "Cố tình khiếu nại thêm lần nữa",
            "proof_image_url": "https://example.com/proof2.jpg",
        }
        res = self.post_complaint(payload, user_id=2)
        self.assertEqual(res.status_code, 400, res.get_json())
        self.assertEqual(res.get_json()["errors"][0]["code"], "EX-15")

    def test_create_complaint_other_user_order(self):
        """Không được khiếu nại đơn hàng của người khác (404 bảo mật)."""
        payload = {
            "order_id": "NF2610190003",
            "reason": "Giao chậm",
            "description": "Đơn giao quá lâu",
            "proof_image_url": "https://example.com/proof.jpg",
        }
        res = self.post_complaint(payload, user_id=1)
        self.assertEqual(res.status_code, 404, res.get_json())
        self.assertEqual(res.get_json()["errors"][0]["code"], "NOT_FOUND")

    def test_create_complaint_validation_schema(self):
        """Kiểm tra schema validation cho tạo khiếu nại (chặn XSS url, whitespace, chấp nhận full URL hoặc relative path)."""
        # proof_image_url không phải URL http/https/đường dẫn và có thể là javascript:
        res_xss = self.post_complaint({
            "order_id": "NF2610190001",
            "reason": "Thiếu món",
            "description": "Chi tiết sự cố",
            "proof_image_url": "javascript:alert(1)",
        }, user_id=1)
        self.assertEqual(res_xss.status_code, 422)

        # reason chỉ có khoảng trắng
        res_space = self.post_complaint({
            "order_id": "NF2610190001",
            "reason": "   ",
            "description": "Chi tiết sự cố hợp lệ",
            "proof_image_url": "https://example.com/proof.jpg",
        }, user_id=1)
        self.assertEqual(res_space.status_code, 422)

        # proof_image_url là đường dẫn upload nội bộ tương đối hợp lệ (pass schema validation)
        res_rel = self.post_complaint({
            "order_id": "NF2610190001",
            "reason": "Thiếu món",
            "description": "Chi tiết sự cố hợp lệ với ảnh upload nội bộ",
            "proof_image_url": "/uploads/complaints/proof123.png",
        }, user_id=1)
        self.assertEqual(res_rel.status_code, 201)

    def test_complaint_detail_security_anti_enumeration(self):
        """Khách xem khiếu nại của người khác hoặc ID không tồn tại đều trả 404 để chống dò đoán ID."""
        # Khiếu nại 1 thuộc user 2, user 1 xem -> 404 NOT_FOUND
        res_other = self.get_complaint(1, user_id=1, role="customer")
        self.assertEqual(res_other.status_code, 404, res_other.get_json())
        self.assertEqual(res_other.get_json()["errors"][0]["code"], "NOT_FOUND")

        # ID cực lớn vượt int(max=2147483647) -> Flask tự trả 404 không bị lỗi 500 DB
        with self.app.test_client() as client:
            token = create_access_token({"sub": "1", "role": "customer"})
            res_overflow = client.get("/api/v1/complaints/99999999999", headers={"Authorization": f"Bearer {token}"})
            self.assertEqual(res_overflow.status_code, 404)

    def test_resolve_complaint_accept(self):
        """Admin chấp nhận khiếu nại (UC25, BR-24), đơn đổi sang DA_GIAI_QUYET."""
        payload = {
            "status": "CHAP_NHAN",
            "admin_response": "Đã xác minh và hoàn tiền qua ví cho khách.",
        }
        res = self.patch_resolve_complaint(1, payload, user_id=5, role="admin")
        self.assertEqual(res.status_code, 200, res.get_json())
        data = res.get_json()["data"]
        self.assertEqual(data["status"], "CHAP_NHAN")
        self.assertEqual(data["admin_response"], "Đã xác minh và hoàn tiền qua ví cho khách.")
        self.assertEqual(data["resolved_by"], 5)
        self.assertIsNotNone(data["resolved_at"])

        with self.sessions() as db:
            order = db.get(Order, "NF2610190006")
            self.assertEqual(order.status, "DA_GIAI_QUYET")

    def test_resolve_complaint_reject(self):
        """Admin từ chối khiếu nại (UC25), đơn đổi sang DA_GIAI_QUYET."""
        payload = {
            "status": "TU_CHOI",
            "admin_response": "Hình ảnh minh chứng không rõ ràng, từ chối giải quyết.",
        }
        res = self.patch_resolve_complaint(1, payload, user_id=5, role="admin")
        self.assertEqual(res.status_code, 200, res.get_json())
        data = res.get_json()["data"]
        self.assertEqual(data["status"], "TU_CHOI")

        with self.sessions() as db:
            order = db.get(Order, "NF2610190006")
            self.assertEqual(order.status, "DA_GIAI_QUYET")

    def test_resolve_complaint_already_resolved(self):
        """Không được giải quyết lại khiếu nại đã phân xử xong (D5)."""
        payload = {
            "status": "CHAP_NHAN",
            "admin_response": "Giải quyết lần đầu",
        }
        res1 = self.patch_resolve_complaint(1, payload, user_id=5, role="admin")
        self.assertEqual(res1.status_code, 200)

        res2 = self.patch_resolve_complaint(1, {"status": "TU_CHOI", "admin_response": "Đổi ý"}, user_id=5, role="admin")
        self.assertEqual(res2.status_code, 400, res2.get_json())
        self.assertEqual(res2.get_json()["errors"][0]["code"], "COMPLAINT_ALREADY_RESOLVED")

    def test_resolve_complaint_forbidden_for_non_admin(self):
        """Chỉ Admin mới có quyền resolve khiếu nại."""
        payload = {"status": "CHAP_NHAN", "admin_response": "Nhân viên tự giải quyết"}
        res_staff = self.patch_resolve_complaint(1, payload, user_id=3, role="staff")
        self.assertEqual(res_staff.status_code, 403)

        res_customer = self.patch_resolve_complaint(1, payload, user_id=1, role="customer")
        self.assertEqual(res_customer.status_code, 403)

    def test_list_complaints_permissions(self):
        """Khách chỉ thấy khiếu nại của mình; Admin thấy toàn bộ khiếu nại hệ thống."""
        self.post_complaint({
            "order_id": "NF2610190001",
            "reason": "Thiếu món",
            "description": "Chi tiết",
            "proof_image_url": "https://example.com/p1.jpg",
        }, user_id=1)

        token1 = create_access_token({"sub": "1", "role": "customer"})
        with self.app.test_client() as client:
            res1 = client.get("/api/v1/complaints", headers={"Authorization": f"Bearer {token1}"})
            self.assertEqual(res1.status_code, 200)
            items1 = res1.get_json()["data"]
            self.assertEqual(len(items1), 1)
            self.assertEqual(items1[0]["order_id"], "NF2610190001")

        token_admin = create_access_token({"sub": "5", "role": "admin"})
        with self.app.test_client() as client:
            res_admin = client.get("/api/v1/complaints", headers={"Authorization": f"Bearer {token_admin}"})
            self.assertEqual(res_admin.status_code, 200)
            items_admin = res_admin.get_json()["data"]
            self.assertEqual(len(items_admin), 2)

    # ==========================
    # TESTS PHASE 3: SHIFTS
    # ==========================

    def test_my_current_shift_summary(self):
        """Nhân viên xem tổng hợp số đơn và tiền dự kiến trong ngày hôm nay."""
        res = self.get_my_current_shift(user_id=3, role="staff")
        self.assertEqual(res.status_code, 200, res.get_json())
        data = res.get_json()["data"]
        self.assertEqual(data["staff_id"], 3)
        self.assertEqual(data["staff_name"], "Trần Nhân Viên")
        # Trong setUp: staff 3 đã giao đơn 1 (80k cash) và đơn 3 (40k QR)
        self.assertEqual(data["total_orders_handled"], 2)
        self.assertEqual(data["expected_cash"], 80000.0)
        self.assertEqual(data["expected_qr"], 40000.0)

    def test_submit_shift_exact_match(self):
        """Nhân viên nộp tiền khớp 100% -> trạng thái CHO_DUYET, discrepancy = 0."""
        payload = {
            "actual_cash": 80000.0,
            "actual_qr": 40000.0,
            "discrepancy_note": "Khớp tiền",
        }
        res = self.post_submit_shift(payload, user_id=3, role="staff")
        self.assertEqual(res.status_code, 201, res.get_json())
        data = res.get_json()["data"]
        self.assertEqual(data["status"], "CHO_DUYET")
        self.assertEqual(data["discrepancy_amount"], 0.0)
        self.assertEqual(data["actual_cash"], 80000.0)
        self.assertEqual(data["actual_qr"], 40000.0)

    def test_submit_shift_with_discrepancy_requires_note(self):
        """Lệch tiền COD mà không có giải trình thì bị chặn (BR-25, EX-20)."""
        # Thiếu 10k tiền mặt, không gửi note
        payload_no_note = {
            "actual_cash": 70000.0,
            "actual_qr": 40000.0,
            "discrepancy_note": None,
        }
        res_err = self.post_submit_shift(payload_no_note, user_id=3, role="staff")
        self.assertEqual(res_err.status_code, 400, res_err.get_json())
        self.assertEqual(res_err.get_json()["errors"][0]["code"], "EX-20")

        # Có gửi note giải trình -> thành công, trạng thái CAN_GIAI_TRINH
        payload_with_note = {
            "actual_cash": 70000.0,
            "actual_qr": 40000.0,
            "discrepancy_note": "Khách thiếu 10k tiền mặt, hẹn ngày mai trả bù",
        }
        res_ok = self.post_submit_shift(payload_with_note, user_id=3, role="staff")
        self.assertEqual(res_ok.status_code, 201, res_ok.get_json())
        data = res_ok.get_json()["data"]
        self.assertEqual(data["status"], "CAN_GIAI_TRINH")
        self.assertEqual(data["discrepancy_amount"], -10000.0)
        self.assertEqual(data["discrepancy_note"], "Khách thiếu 10k tiền mặt, hẹn ngày mai trả bù")

    def test_close_shift_flow(self):
        """Quy trình duyệt chốt ca bởi Quản lý (UC20, Quyết định D7)."""
        # Bước 1: Staff nộp ca khớp tiền
        res_sub = self.post_submit_shift({"actual_cash": 80000.0, "actual_qr": 40000.0}, user_id=3)
        self.assertEqual(res_sub.status_code, 201)
        shift_id = res_sub.get_json()["data"]["id"]

        # Bước 2: Manager duyệt DA_CHOT
        payload_close = {"status": "DA_CHOT", "discrepancy_note": "Đã nhận đủ tiền"}
        res_close = self.patch_close_shift(shift_id, payload_close, user_id=4, role="manager")
        self.assertEqual(res_close.status_code, 200, res_close.get_json())
        data = res_close.get_json()["data"]
        self.assertEqual(data["status"], "DA_CHOT")
        self.assertEqual(data["closed_by"], 4)
        self.assertIsNotNone(data["closed_at"])

        # Bước 3: Đã DA_CHOT thì không được chốt lại lần 2
        res_reclose = self.patch_close_shift(shift_id, payload_close, user_id=4, role="manager")
        self.assertEqual(res_reclose.status_code, 400)
        self.assertEqual(res_reclose.get_json()["errors"][0]["code"], "SHIFT_ALREADY_CLOSED")

        # Bước 4: Đã DA_CHOT thì Staff không được nộp đè
        res_resubmit = self.post_submit_shift({"actual_cash": 80000.0, "actual_qr": 40000.0}, user_id=3)
        self.assertEqual(res_resubmit.status_code, 400)
        self.assertEqual(res_resubmit.get_json()["errors"][0]["code"], "SHIFT_ALREADY_CLOSED")

    def test_close_shift_discrepancy_without_note_rejected(self):
        """Ca có lệch tiền nếu chưa có giải trình từ staff lẫn manager thì không được chốt DA_CHOT (EX-20)."""
        today_vn = datetime.now(timezone(timedelta(hours=7))).date()
        with self.sessions.begin() as db:
            s_disc = StaffShift(
                staff_id=3,
                shift_date=today_vn,
                total_orders_handled=2,
                expected_cash=Decimal("80000"),
                expected_qr=Decimal("40000"),
                actual_cash=Decimal("70000"),
                actual_qr=Decimal("40000"),
                discrepancy_amount=Decimal("-10000"),
                discrepancy_note=None,
                status="CAN_GIAI_TRINH",
            )
            db.add(s_disc)
            db.flush()
            shift_id = s_disc.id

        # 1. Manager cố tình chốt DA_CHOT mà không gửi kèm discrepancy_note -> Bị từ chối với 400 EX-20
        res_fail = self.patch_close_shift(shift_id, {"status": "DA_CHOT"}, user_id=4, role="manager")
        self.assertEqual(res_fail.status_code, 400, res_fail.get_json())
        self.assertEqual(res_fail.get_json()["errors"][0]["code"], "EX-20")

        # 2. Manager bổ sung discrepancy_note khi chốt -> Thành công
        res_ok = self.patch_close_shift(
            shift_id,
            {"status": "DA_CHOT", "discrepancy_note": "Quản lý đã xác nhận sự cố trừ nhầm tiền"},
            user_id=4,
            role="manager",
        )
        self.assertEqual(res_ok.status_code, 200, res_ok.get_json())
        self.assertEqual(res_ok.get_json()["data"]["status"], "DA_CHOT")
        self.assertEqual(res_ok.get_json()["data"]["discrepancy_note"], "Quản lý đã xác nhận sự cố trừ nhầm tiền")

    def test_shift_permissions(self):
        """Khách hàng không được nộp hay xem ca làm việc."""
        res_curr = self.get_my_current_shift(user_id=1, role="customer")
        self.assertEqual(res_curr.status_code, 403)

        res_sub = self.post_submit_shift({"actual_cash": 0, "actual_qr": 0}, user_id=1, role="customer")
        self.assertEqual(res_sub.status_code, 403)

    def test_shift_submit_status_code_create_vs_update(self):
        """Lần đầu nộp ca trả về 201 Created; nộp lại cập nhật ca trả về 200 OK."""
        # Nộp lần 1 -> 201
        res1 = self.post_submit_shift({"actual_cash": 80000.0, "actual_qr": 40000.0}, user_id=3)
        self.assertEqual(res1.status_code, 201, res1.get_json())

        # Nộp lần 2 (cập nhật khi ca còn CHO_DUYET) -> 200
        res2 = self.post_submit_shift({"actual_cash": 80000.0, "actual_qr": 40000.0}, user_id=3)
        self.assertEqual(res2.status_code, 200, res2.get_json())

    def test_shift_detail_security_anti_enumeration(self):
        """Nhân viên xem ca của người khác hoặc ID không tồn tại đều trả 404 để chống dò đoán ID."""
        # Nộp 1 ca cho staff 3
        res_sub = self.post_submit_shift({"actual_cash": 80000.0, "actual_qr": 40000.0}, user_id=3)
        shift_id = res_sub.get_json()["data"]["id"]

        # Staff 2 (user_id=6) cố xem ca của Staff 3 -> 404 NOT_FOUND (anti-enumeration)
        res_other = self.get_shift(shift_id, user_id=6, role="staff")
        self.assertEqual(res_other.status_code, 404, res_other.get_json())
        self.assertEqual(res_other.get_json()["errors"][0]["code"], "NOT_FOUND")

        # Ca không tồn tại -> 404
        res_none = self.get_shift(99999, user_id=3, role="staff")
        self.assertEqual(res_none.status_code, 404, res_none.get_json())
        self.assertEqual(res_none.get_json()["errors"][0]["code"], "NOT_FOUND")

        # ID cực lớn vượt int(max=2147483647) -> Flask tự trả 404 không bị lỗi 500 DB
        with self.app.test_client() as client:
            token = create_access_token({"sub": "3", "role": "staff"})
            res_overflow = client.get("/api/v1/shifts/99999999999", headers={"Authorization": f"Bearer {token}"})
            self.assertEqual(res_overflow.status_code, 404)

    def test_shift_delivered_at_vn_boundary(self):
        """Kiểm tra đơn giao lúc 23:30 VN và 00:30 VN (ngày hôm sau) được tính đúng ca theo giờ Việt Nam."""
        today_vn = datetime.now(timezone(timedelta(hours=7))).date()
        # 23:30 VN hôm nay:
        t_2330_vn = datetime(today_vn.year, today_vn.month, today_vn.day, 23, 30, 0, tzinfo=timezone(timedelta(hours=7)))
        t_2330_utc = t_2330_vn.astimezone(timezone.utc)

        # 00:30 VN ngày mai:
        tomorrow_vn = today_vn + timedelta(days=1)
        t_0030_vn = datetime(tomorrow_vn.year, tomorrow_vn.month, tomorrow_vn.day, 0, 30, 0, tzinfo=timezone(timedelta(hours=7)))
        t_0030_utc = t_0030_vn.astimezone(timezone.utc)

        with self.sessions.begin() as db:
            o_boundary_in = Order(
                id="NF_VN_IN", order_code_suffix="9991", user_id=1, staff_id=3, order_type="delivery",
                status="DA_GIAO", recipient_name="Khách", recipient_phone="0977000001",
                delivery_address="A2", payment_method="cod_cash", payment_status="da_thanh_toan",
                subtotal_amount=Decimal("10000"), ship_fee=Decimal("0"), total_amount=Decimal("10000"),
                delivered_at=t_2330_utc, created_at=t_2330_utc,
            )
            o_boundary_out = Order(
                id="NF_VN_OUT", order_code_suffix="9992", user_id=1, staff_id=3, order_type="delivery",
                status="DA_GIAO", recipient_name="Khách", recipient_phone="0977000001",
                delivery_address="A2", payment_method="cod_cash", payment_status="da_thanh_toan",
                subtotal_amount=Decimal("20000"), ship_fee=Decimal("0"), total_amount=Decimal("20000"),
                delivered_at=t_0030_utc, created_at=t_0030_utc,
            )
            db.add_all([o_boundary_in, o_boundary_out])

        res = self.get_my_current_shift(user_id=3, role="staff")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()["data"]
        # Đơn ban đầu của staff 3: Đơn 1 (80k cash), Đơn 3 (40k qr). Thêm đơn NF_VN_IN (+10k cash) -> 90k cash.
        # Đơn NF_VN_OUT (00:30 hôm sau) không được tính vào ca hôm nay.
        self.assertEqual(data["expected_cash"], 90000.0)
        self.assertEqual(data["expected_qr"], 40000.0)
        self.assertEqual(data["total_orders_handled"], 3)

    def test_concurrent_shift_submit(self):
        """Hai request submit_shift đồng thời của cùng một nhân viên không tạo thành 2 ca cùng ngày (D6)."""
        p1 = {"actual_cash": 80000.0, "actual_qr": 40000.0}
        p2 = {"actual_cash": 80000.0, "actual_qr": 40000.0}

        with ThreadPoolExecutor(max_workers=2) as pool:
            f1 = pool.submit(self.post_submit_shift, p1, 3, "staff")
            f2 = pool.submit(self.post_submit_shift, p2, 3, "staff")
            r1 = f1.result(timeout=10)
            r2 = f2.result(timeout=10)

        # Một request tạo ca mới (201), request còn lại cập nhật ca hiện có (200)
        status_codes = sorted([r1.status_code, r2.status_code])
        self.assertEqual(status_codes, [200, 201], f"Unexpected status codes: {r1.status_code}, {r2.status_code}")

        # Kiểm tra trong DB chỉ có duy nhất 1 bản ghi ca cho staff 3 trong ngày
        today_vn = datetime.now(timezone(timedelta(hours=7))).date()
        with self.sessions() as db:
            shifts = db.query(StaffShift).filter(
                StaffShift.staff_id == 3,
                StaffShift.shift_date == today_vn,
            ).all()
            self.assertEqual(len(shifts), 1)

    # ==========================
    # TESTS PHASE 4: REPORTS
    # ==========================

    def test_reports_summary_financials_and_counts(self):
        """Báo cáo doanh thu chuẩn (UC22, Quyết định D8)."""
        res = self.get_reports_summary()
        self.assertEqual(res.status_code, 200, res.get_json())
        data = res.get_json()["data"]

        # Tổng đơn tạo hôm nay: đơn 1, 2, 3, 4, 6, 7, 8 = 7 đơn
        self.assertEqual(data["total_orders"], 7)
        # Đơn hoàn thành/đã giao/khiếu nại đã thanh toán: 1, 3, 4, 6 = 4 đơn
        self.assertEqual(data["completed_orders"], 4)
        self.assertEqual(data["cancelled_or_rejected_orders"], 1)
        self.assertEqual(data["blacklisted_orders"], 1)

        # Doanh thu:
        # Gross revenue = 80k + 40k + 45k + 45k = 210000.0
        self.assertEqual(data["gross_revenue"], 210000.0)
        # Ship fee = 5k + 0 + 5k + 5k = 15000.0
        self.assertEqual(data["ship_fee_total"], 15000.0)
        # Canteen net revenue:
        # Đơn 1: 35k + 30k = 65k
        # Đơn 3: 35k
        # Đơn 4: 35k
        # Đơn 6: 35k
        # Tổng = 170000.0
        self.assertEqual(data["canteen_net_revenue"], 170000.0)
        # System fee = 10k + 5k + 5k + 5k = 25000.0
        self.assertEqual(data["system_fee_total"], 25000.0)

        # Kiểm tra khớp công thức: gross = canteen_net + system_fee + ship_fee
        self.assertEqual(
            data["gross_revenue"],
            data["canteen_net_revenue"] + data["system_fee_total"] + data["ship_fee_total"]
        )

        # Kiểm tra top món bán chạy (bún bò huế 4 phần, cơm tấm 1 phần)
        top_dishes = data["top_dishes"]
        self.assertTrue(len(top_dishes) >= 2)
        self.assertEqual(top_dishes[0]["dish_id"], "bun-bo-hue")
        self.assertEqual(top_dishes[0]["total_quantity"], 4)
        self.assertEqual(top_dishes[0]["total_revenue"], 160000.0)
        self.assertEqual(top_dishes[1]["dish_id"], "com-tam")
        self.assertEqual(top_dishes[1]["total_quantity"], 1)
        self.assertEqual(top_dishes[1]["total_revenue"], 35000.0)

    def test_reports_summary_date_validation(self):
        """Kiểm tra validation tham số ngày trong báo cáo."""
        # Sai định dạng ngày (gạch chéo)
        res_fmt = self.get_reports_summary("from_date=2026/10/19")
        self.assertEqual(res_fmt.status_code, 422)

        # Sai định dạng do không chèn số 0 (unpadded: 2026-1-5)
        res_unpadded = self.get_reports_summary("from_date=2026-1-5")
        self.assertEqual(res_unpadded.status_code, 422)

        # Năm ngoài khoảng hợp lý (2000-2100)
        res_year = self.get_reports_summary("from_date=1999-12-31")
        self.assertEqual(res_year.status_code, 422)

        # from_date lớn hơn to_date
        res_range = self.get_reports_summary("from_date=2026-10-25&to_date=2026-10-20")
        self.assertEqual(res_range.status_code, 400)
        self.assertEqual(res_range.get_json()["errors"][0]["code"], "INVALID_DATE_RANGE")

        # Khoảng cách thời gian vượt quá 366 ngày
        res_cap = self.get_reports_summary("from_date=2024-01-01&to_date=2025-02-01")
        self.assertEqual(res_cap.status_code, 400)
        self.assertEqual(res_cap.get_json()["errors"][0]["code"], "DATE_RANGE_TOO_LONG")

    def test_reports_summary_permissions(self):
        """Chỉ Manager và Admin mới có quyền xem báo cáo doanh thu."""
        res_staff = self.get_reports_summary(user_id=3, role="staff")
        self.assertEqual(res_staff.status_code, 403)

        res_cust = self.get_reports_summary(user_id=1, role="customer")
        self.assertEqual(res_cust.status_code, 403)

        res_admin = self.get_reports_summary(user_id=5, role="admin")
        self.assertEqual(res_admin.status_code, 200)

    def test_reports_summary_empty_date_range(self):
        """Khoảng ngày không có đơn hàng trả về báo cáo rỗng an toàn, doanh thu 0.0."""
        res = self.get_reports_summary("from_date=2026-01-01&to_date=2026-01-02")
        self.assertEqual(res.status_code, 200, res.get_json())
        data = res.get_json()["data"]
        self.assertEqual(data["total_orders"], 0)
        self.assertEqual(data["completed_orders"], 0)
        self.assertEqual(data["cancelled_or_rejected_orders"], 0)
        self.assertEqual(data["blacklisted_orders"], 0)
        self.assertEqual(data["gross_revenue"], 0.0)
        self.assertEqual(data["canteen_net_revenue"], 0.0)
        self.assertEqual(data["system_fee_total"], 0.0)
        self.assertEqual(data["ship_fee_total"], 0.0)
        self.assertEqual(data["top_dishes"], [])

