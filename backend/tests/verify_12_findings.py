import os
import unittest
import psycopg
from decimal import Decimal
from datetime import datetime, date, timedelta, timezone

os.environ["DATABASE_URL"] = "postgresql://neufood_user:neufood_password@database:5432/neufood_api_test"
os.environ["TESTING"] = "True"

from app import create_app
from app.core.limiter import limiter
from app.db.session import get_db
from app.db.models import Dish, Order, User, Complaint, StaffShift, OrderItem
from app.crud.dish import create_dish, get_system_maintenance_fee
from app.crud.order import create_order, generate_order_id, sync_overdue_orders
from app.crud.review import create_review, REVIEWABLE_ORDER_STATUSES, ReviewError
from app.crud.shift import calculate_staff_shift_orders, get_revenue_report, ShiftError
from app.crud.complaint import resolve_complaint, ComplaintError

class VerifyFindingsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config["TESTING"] = True
        limiter.enabled = False
        cls.client = cls.app.test_client()

    def setUp(self):
        # Reset DB bằng file sql mẫu của api_audit
        sql_dir = os.path.join(os.path.dirname(__file__), "api_audit", "sql")
        conn = psycopg.connect(os.environ["DATABASE_URL"], autocommit=True)
        with conn.cursor() as cur:
            cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
            with open(os.path.join(sql_dir, "01_init.sql"), "r", encoding="utf-8") as f:
                cur.execute(f.read())
            with open(os.path.join(sql_dir, "02_sample.sql"), "r", encoding="utf-8") as f:
                cur.execute(f.read())
        conn.close()

    def login(self, email: str, password: str = "password123"):
        resp = self.client.post("/api/v1/auth/login", json={"email": email, "password": password})
        self.assertEqual(resp.status_code, 200, f"Login failed for {email}: {resp.get_data(as_text=True)}")
        return resp.get_json()["data"]["access_token"]

    def test_f1_idor_check(self):
        """[F1] Kiểm tra IDOR: Khách B xem đơn của Khách A"""
        token_b = self.login("thanhhuong@neu.edu.vn") # User 5
        # Đơn NF2610153456 thuộc User 4 (sinhvien@neu.edu.vn)
        resp = self.client.get("/api/v1/orders/NF2610153456", headers={"Authorization": f"Bearer {token_b}"})
        self.assertEqual(resp.status_code, 404, "F1: Khách B không được phép xem đơn của Khách A (chống IDOR)")
        self.assertFalse(resp.get_json()["success"])
        self.assertIsNone(resp.get_json()["data"])
        print("\n [TEST PASS] -> [F1 IDOR]: ĐÃ KHẮC PHỤC (Khách B xem đơn Khách A trả về 404 Not Found để chống dò quét ID và bảo vệ mã nhận đồ)")

    def test_f2_jwt_stateless_check(self):
        """[F2] Kiểm tra JWT Stateless: User bị khóa token cũ có bị từ chối không"""
        token_b = self.login("thanhhuong@neu.edu.vn") # User 5
        # Giải tỏa đơn hoạt động của User 5 trước khi khóa (tuân thủ EX-22)
        conn = psycopg.connect(os.environ["DATABASE_URL"], autocommit=True)
        with conn.cursor() as cur:
            cur.execute("UPDATE orders SET status = 'HOAN_THANH' WHERE user_id = 5")
        conn.close()

        # Admin khóa User 5
        admin_token = self.login("admin@neufood.vn")
        lock_resp = self.client.patch("/api/v1/users/admin/5/status", 
                                      headers={"Authorization": f"Bearer {admin_token}"},
                                      json={"is_active": False})
        self.assertEqual(lock_resp.status_code, 200)
        # User 5 dùng token cũ gọi API
        resp = self.client.get("/api/v1/orders", headers={"Authorization": f"Bearer {token_b}"})
        self.assertEqual(resp.status_code, 403, "F2: Token của tài khoản bị khóa phải bị từ chối 403")
        self.assertIn("đã bị khóa", resp.get_json()["message"])
        print("\n [TEST PASS] -> [F2 JWT Stateless]: ĐÃ KHẮC PHỤC (jwt_required truy vấn trực tiếp DB, user bị khóa bị chặn 403 ngay lập tức)")

    def test_f3_dynamic_system_fee(self):
        """[F3] Kiểm tra phụ phí động system_maintenance_fee"""
        admin_token = self.login("admin@neufood.vn")
        # Đổi system_maintenance_fee thành 7000
        put_resp = self.client.put("/api/v1/settings/system_maintenance_fee",
                                   headers={"Authorization": f"Bearer {admin_token}"},
                                   json={"setting_value": "7000"})
        self.assertEqual(put_resp.status_code, 200)
        manager_token = self.login("manager.a2@neufood.vn")
        create_resp = self.client.post("/api/v1/dishes",
                                       headers={"Authorization": f"Bearer {manager_token}"},
                                       json={
                                           "id": "mon-test-f3",
                                           "name": "Món Thử Nghiệm F3",
                                           "short_description": "Mô tả ngắn",
                                           "base_price": 30000,
                                           "category_ids": ["mi-pho"]
                                       })
        self.assertEqual(create_resp.status_code, 201)
        data = create_resp.get_json()["data"]
        self.assertEqual(data["system_fee"], 7000)
        self.assertEqual(data["price"], 37000)
        print("\n [TEST PASS] -> [F3 Dynamic Fee]: ĐÃ KHẮC PHỤC (Phụ phí đọc động từ system_settings: base 30k + fee 7k = price 37k)")

    def test_f4_pagination_invalid_params(self):
        """[F4] Robustness phân trang không crash 500"""
        staff_token = self.login("shipper01@neufood.vn")
        for bad_param in [("abc", "10"), ("0", "10"), ("1", "xyz"), ("1", "-5")]:
            resp = self.client.get(f"/api/v1/orders/admin/all?page={bad_param[0]}&limit={bad_param[1]}",
                                   headers={"Authorization": f"Bearer {staff_token}"})
            self.assertEqual(resp.status_code, 400, f"Tham số {bad_param} phải trả 400, không được crash 500")
            self.assertFalse(resp.get_json()["success"])
        print("\n [TEST PASS] -> [F4 Safe Pagination]: ĐÃ KHẮC PHỤC (page=abc, page=0, limit=-5 trả 400 an toàn, triệt tiêu crash 500)")

    def test_f5_duplicate_status_definitions(self):
        """[F5] Kiểm tra tập trung hóa ACTIVE/TERMINAL_ORDER_STATUSES tại models.py và re-export an toàn"""
        from app.db import models as db_models
        from app.crud import user as user_crud
        from app.crud import order as order_crud
        from app.crud import location as loc_crud
        from app.crud import shift as shift_crud
        from app.crud import review as review_crud
        from app.crud import complaint as complaint_crud

        # 1. Hằng số được khai báo tập trung tại models
        self.assertTrue(hasattr(db_models, "ACTIVE_ORDER_STATUSES"))
        self.assertTrue(hasattr(db_models, "TERMINAL_ORDER_STATUSES"))
        self.assertTrue(hasattr(db_models, "COMPLETED_ORDER_STATUSES"))
        self.assertTrue(hasattr(db_models, "REVIEWABLE_ORDER_STATUSES"))
        self.assertTrue(hasattr(db_models, "COMPLAINT_STATUSES"))

        # 2. Re-export an toàn tại các file CRUD để bảo toàn test contract
        self.assertIs(user_crud.ACTIVE_ORDER_STATUSES, db_models.ACTIVE_ORDER_STATUSES)
        self.assertIs(order_crud.ACTIVE_ORDER_STATUSES, db_models.ACTIVE_ORDER_STATUSES)
        self.assertIs(loc_crud.TERMINAL_ORDER_STATUSES, db_models.TERMINAL_ORDER_STATUSES)
        self.assertIs(shift_crud.COMPLETED_ORDER_STATUSES, db_models.COMPLETED_ORDER_STATUSES)
        self.assertIs(review_crud.REVIEWABLE_ORDER_STATUSES, db_models.REVIEWABLE_ORDER_STATUSES)
        self.assertIs(complaint_crud.COMPLAINT_STATUSES, db_models.COMPLAINT_STATUSES)
        print("\n [TEST PASS] -> [F5 Status Centralization]: ĐÃ KHẮC PHỤC (Các tập trạng thái đã tập trung tại models.py và re-export an toàn)")

    def test_f6_review_after_da_giai_quyet(self):
        """[F6] Kiểm tra đánh giá khi đơn ở trạng thái DA_GIAI_QUYET"""
        with get_db() as db:
            from app.db.models import Review
            db.query(Review).filter(Review.order_id == "NF2610148833").delete()
            order = db.query(Order).filter(Order.id == "NF2610148833").first()
            order.status = "DA_GIAI_QUYET"
            db.commit()
        cust_token = self.login("sinhvien@neu.edu.vn")
        resp = self.client.post("/api/v1/reviews",
                                headers={"Authorization": f"Bearer {cust_token}"},
                                json={
                                    "order_id": "NF2610148833",
                                    "dish_id": "combo-com-ga-tra-dao",
                                    "rating": 5,
                                    "comment": "Đã được đền bù thỏa đáng"
                                })
        # Đơn DA_GIAI_QUYET đã nằm trong REVIEWABLE_ORDER_STATUSES -> Tạo review thành công HTTP 201
        self.assertEqual(resp.status_code, 201, f"Review thất bại: {resp.get_data(as_text=True)}")
        self.assertTrue(resp.get_json()["success"])
        self.assertIn("DA_GIAI_QUYET", REVIEWABLE_ORDER_STATUSES)
        print("\n [TEST PASS] -> [F6 Review DA_GIAI_QUYET]: ĐÃ KHẮC PHỤC (Khách hàng đánh giá món ăn thành công sau khi đơn chuyển DA_GIAI_QUYET)")

    def test_f7_lazy_auto_sync_mechanism(self):
        """[F7] Kiểm tra cơ chế tự động sync đơn quá hạn khi gọi báo cáo doanh thu"""
        # Giả lập 1 đơn CHO_XAC_NHAN quá hạn 15 phút
        conn = psycopg.connect(os.environ["DATABASE_URL"], autocommit=True)
        with conn.cursor() as cur:
            cur.execute("UPDATE orders SET created_at = NOW() - INTERVAL '15 minutes' WHERE id = 'NF2610153456'")
        conn.close()

        with get_db() as db:
            # Báo cáo doanh thu tự động gọi sync_overdue_orders(db) ngay đầu hàm
            report = get_revenue_report(db, date.today(), date.today())
            order_updated = db.query(Order).filter(Order.id == 'NF2610153456').first()
            self.assertEqual(order_updated.status, "TU_DONG_HUY")
        print("\n [TEST PASS] -> [F7 Auto Sync in Report]: ĐÃ KHẮC PHỤC (Đơn quá hạn 15p tự động chuyển TU_DONG_HUY khi lập báo cáo doanh thu)")

    def test_f8_reporting_time_drift(self):
        """[F8] Kiểm tra mốc thời gian đồng bộ giữa Staff Shift (delivered_at) và Canteen Report (delivered_at)"""
        yesterday = date.today() - timedelta(days=2)
        today = date.today() - timedelta(days=1)
        vn_tz = timezone(timedelta(hours=7))
        created_time = datetime(yesterday.year, yesterday.month, yesterday.day, 23, 55, tzinfo=vn_tz).astimezone(timezone.utc)
        delivered_time = datetime(today.year, today.month, today.day, 0, 15, tzinfo=vn_tz).astimezone(timezone.utc)
        
        conn = psycopg.connect(os.environ["DATABASE_URL"], autocommit=True)
        with conn.cursor() as cur:
            # Xóa sạch đơn cũ để đo lường chính xác tuyệt đối
            cur.execute("DELETE FROM reviews; DELETE FROM complaints; DELETE FROM order_items; DELETE FROM orders;")
            cur.execute("""
                INSERT INTO orders (
                    id, order_code_suffix, user_id, campus_location_id, order_type,
                    recipient_name, recipient_phone, room_detail, delivery_address, status, subtotal_amount,
                    ship_fee, total_amount, payment_method, payment_status, created_at, delivered_at, staff_id
                ) VALUES (
                    'NF2610159999', '9999', 4, 1, 'delivery',
                    'Nguyễn Sinh Viên', '0977112233', 'P101', 'Tòa A1 - Nhà A', 'DA_GIAO', 50000,
                    5000, 55000, 'cod_cash', 'da_thanh_toan', %s, %s, 3
                )
            """, (created_time, delivered_time))
        conn.close()

        with get_db() as db:
            # Cả hai báo cáo cho ngày yesterday đều = 0 (vì đơn được bàn giao vào ngày today)
            rep_yesterday = get_revenue_report(db, yesterday, yesterday)
            shift_orders_yesterday = calculate_staff_shift_orders(db, staff_id=3, target_date=yesterday)
            self.assertEqual(rep_yesterday["total_orders"], 0)
            self.assertEqual(shift_orders_yesterday[0], 0)

            # Cả hai báo cáo cho ngày today đều = 1 (khớp 100% doanh thu)
            rep_today = get_revenue_report(db, today, today)
            shift_orders_today = calculate_staff_shift_orders(db, staff_id=3, target_date=today)
            self.assertEqual(rep_today["completed_orders"], 1)
            self.assertEqual(shift_orders_today[0], 1)
            self.assertEqual(rep_today["gross_revenue"], Decimal("55000.00"))
            self.assertEqual(shift_orders_today[1], Decimal("55000.00"))
        print("\n [TEST PASS] -> [F8 Reporting Time Sync]: ĐÃ KHẮC PHỤC (Đơn thanh toán lọc thống nhất theo delivered_at, khớp 100% số đơn và tiền giữa Ca trực và Báo cáo Canteen)")

    def test_f9_standard_response_envelope(self):
        """[F9] Chuẩn hóa Response Envelope có đủ success, message, data"""
        resp_401 = self.client.get("/api/v1/orders") # Không có Bearer token
        self.assertEqual(resp_401.status_code, 401)
        body = resp_401.get_json()
        self.assertIn("success", body)
        self.assertIn("message", body)
        self.assertIn("data", body)
        self.assertIsNone(body["data"])
        self.assertFalse(body["success"])
        print("\n [TEST PASS] -> [F9 Response Envelope]: ĐÃ KHẮC PHỤC (Lỗi 401/403 trả envelope chuẩn có 'data': null)")

    def test_f10_order_code_format(self):
        """[F10] Định dạng mã đơn hàng: NF + YYMMDD + 4 chữ số (12 ký tự)"""
        with get_db() as db:
            order_id = generate_order_id(db)
            self.assertEqual(len(order_id), 12, "Mã đơn hàng phải đúng 12 ký tự")
            self.assertTrue(order_id.startswith("NF"), "Mã đơn hàng phải bắt đầu bằng NF")
            yymmdd = datetime.now().strftime("%y%m%d")
            self.assertEqual(order_id[2:8], yymmdd)
            self.assertTrue(order_id[8:].isdigit() and len(order_id[8:]) == 4)
        print(f"\n [TEST PASS] -> [F10 Order Code Format]: ĐÃ KHẮC PHỤC (Sinh mã chuẩn BR-18: {order_id}, độ dài 12 ký tự)")

    def test_f11_admin_forbidden_dish_crud(self):
        """[F11] Admin không có quyền CRUD thực đơn hay bật/tắt món"""
        admin_token = self.login("admin@neufood.vn")
        # 1. Thêm món
        resp_add = self.client.post("/api/v1/dishes", headers={"Authorization": f"Bearer {admin_token}"}, json={})
        self.assertEqual(resp_add.status_code, 403)
        # 2. Bật tắt món
        resp_toggle = self.client.patch("/api/v1/dishes/pho-bo-tai-lan/availability", 
                                        headers={"Authorization": f"Bearer {admin_token}"}, 
                                        json={"is_available": False})
        self.assertEqual(resp_toggle.status_code, 403)
        print("\n [TEST PASS] -> [F11 Admin Dish RBAC]: ĐÃ KHẮC PHỤC (Admin bị chặn 403 khi can thiệp thực đơn theo đúng Ma trận §2.2)")

    def test_f12_complaint_additional_evidence_state(self):
        """[F12] Khiếu nại hỗ trợ trạng thái YEU_CAU_BO_SUNG theo EX-15 và quy trình nhiều bước"""
        admin_token = self.login("admin@neufood.vn")
        
        # 1. Admin yêu cầu bổ sung bằng chứng
        resp = self.client.patch("/api/v1/complaints/1/resolve",
                                 headers={"Authorization": f"Bearer {admin_token}"},
                                 json={"status": "YEU_CAU_BO_SUNG", "admin_response": "Vui lòng chụp lại ảnh rõ nét nhãn hộp trong 12h"})
        self.assertEqual(resp.status_code, 200, f"Yêu cầu bổ sung thất bại: {resp.get_data(as_text=True)}")
        data = resp.get_json()["data"]
        self.assertEqual(data["status"], "YEU_CAU_BO_SUNG")

        # Kiểm tra đơn hàng vẫn giữ nguyên trạng thái KHIEU_NAI
        with get_db() as db:
            order = db.query(Order).filter(Order.id == "NF2610155566").first()
            self.assertEqual(order.status, "KHIEU_NAI")

        # 2. Admin phân xử tiếp tục từ YEU_CAU_BO_SUNG sang CHAP_NHAN
        resp2 = self.client.patch("/api/v1/complaints/1/resolve",
                                  headers={"Authorization": f"Bearer {admin_token}"},
                                  json={"status": "CHAP_NHAN", "admin_response": "Đã nhận đủ ảnh, Canteen đồng ý hoàn tiền"})
        self.assertEqual(resp2.status_code, 200)
        data2 = resp2.get_json()["data"]
        self.assertEqual(data2["status"], "CHAP_NHAN")

        # Kiểm tra đơn hàng đã đổi sang DA_GIAI_QUYET
        with get_db() as db:
            order = db.query(Order).filter(Order.id == "NF2610155566").first()
            self.assertEqual(order.status, "DA_GIAI_QUYET")

        # 3. Phân xử lần nữa khi đã xong -> Bị chặn COMPLAINT_ALREADY_RESOLVED (HTTP 400)
        resp3 = self.client.patch("/api/v1/complaints/1/resolve",
                                  headers={"Authorization": f"Bearer {admin_token}"},
                                  json={"status": "TU_CHOI", "admin_response": "Từ chối sau khi chấp nhận"})
        self.assertEqual(resp3.status_code, 400)
        self.assertIn("đã được xử lý trước đó", resp3.get_json()["message"])
        print("\n [TEST PASS] -> [F12 Complaint EX-15 State]: ĐÃ KHẮC PHỤC (Hỗ trợ hoàn chỉnh trạng thái YEU_CAU_BO_SUNG và quy trình phân xử nhiều bước)")

if __name__ == "__main__":
    unittest.main()
