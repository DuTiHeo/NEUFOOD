import os
import unittest
import psycopg
import logging
from datetime import datetime, timezone
from sqlalchemy.engine import make_url

# Tắt log ồn ào của SQLAlchemy engine trong quá trình test
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

# Đảm bảo DATABASE_URL trỏ tới database test trước khi load app
TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql://neufood_user:neufood_password@database:5432/neufood_api_test"
)

# Kiểm tra an toàn bắt buộc: tên database phải kết thúc bằng _api_test
parsed = make_url(TEST_DB_URL)
if not parsed.database.endswith("_api_test"):
    raise RuntimeError(
        f"LỖI BẢO MẬT: Database '{parsed.database}' không kết thúc bằng '_api_test'. "
        "Từ chối chạy test trên cơ sở dữ liệu không phải test."
    )

os.environ["DATABASE_URL"] = TEST_DB_URL

from app import create_app
from app.core.limiter import limiter
from app.core.security import create_access_token


class ApiTestCase(unittest.TestCase):
    """
    Lớp cơ sở cho toàn bộ suite test API Integration Audit của NEUFood.
    Khởi tạo ứng dụng Flask thật (đủ 9 Blueprints), tắt limiter,
    và tự động nạp lại schema/seed dữ liệu sạch trước mỗi test case.
    """

    app = None
    client = None

    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config["TESTING"] = True
        limiter.enabled = False
        from app.db.session import engine
        engine.echo = False
        cls.client = cls.app.test_client()

    def setUp(self):
        """Khôi phục database về trạng thái mẫu ban đầu trước mỗi test case."""
        self.reset_db()

    def reset_db(self):
        """Reset sạch schema public và nạp lại 01_init.sql + 02_sample.sql."""
        sql_dir = os.path.join(os.path.dirname(__file__), "sql")
        init_sql_path = os.path.join(sql_dir, "01_init.sql")
        sample_sql_path = os.path.join(sql_dir, "02_sample.sql")

        conn = psycopg.connect(TEST_DB_URL, autocommit=True)
        with conn.cursor() as cur:
            cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
            with open(init_sql_path, "r", encoding="utf-8") as f:
                cur.execute(f.read())
            with open(sample_sql_path, "r", encoding="utf-8") as f:
                cur.execute(f.read())
        conn.close()

    def execute_sql(self, sql: str, params: tuple = ()):
        """Thực thi câu lệnh SQL trực tiếp (ví dụ chỉnh sửa thời gian time-travel)."""
        conn = psycopg.connect(TEST_DB_URL, autocommit=True)
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.close()

    def query_sql(self, sql: str, params: tuple = ()):
        """Truy vấn SQL trực tiếp để kiểm tra trạng thái bảng."""
        conn = psycopg.connect(TEST_DB_URL)
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
        conn.close()
        return rows

    def login(self, email: str, password: str = "password123") -> str:
        """Đăng nhập qua endpoint /api/v1/auth/login và trả về access token."""
        resp = self.client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password}
        )
        self.assertEqual(resp.status_code, 200, f"Đăng nhập thất bại: {resp.get_data(as_text=True)}")
        data = resp.get_json()
        self.assertTrue(data.get("success"), f"Login response unsuccessful: {data}")
        return data["data"]["access_token"]

    def get_admin_token(self) -> str:
        return self.login("admin@neufood.vn")

    def get_manager_token(self) -> str:
        return self.login("manager.a2@neufood.vn")

    def get_staff_token(self) -> str:
        return self.login("shipper01@neufood.vn")

    def get_customer_token(self) -> str:
        return self.login("sinhvien@neu.edu.vn")

    def get_customer2_token(self) -> str:
        return self.login("thanhhuong@neu.edu.vn")

    def get_blacklisted_token(self) -> str:
        return self.login("boomhang@neu.edu.vn")

    def raw_jwt(self, user_id: int, role: str) -> str:
        """Tạo token trực tiếp không qua API (dùng cho test token giả lập/hạ quyền)."""
        return create_access_token({"sub": str(user_id), "role": role})

    def request(
        self,
        method: str,
        path: str,
        token: str = None,
        json: dict = None,
        query_string: dict = None,
        headers: dict = None,
    ):
        """Gửi request chuẩn kèm header Authorization Bearer token."""
        h = headers.copy() if headers else {}
        if token:
            h["Authorization"] = f"Bearer {token}"
        return self.client.open(
            path=path,
            method=method,
            json=json,
            query_string=query_string,
            headers=h,
        )

    def assert_envelope(self, resp, expected_status=200, expected_success: bool = True):
        """Kiểm tra envelope chuẩn của response: success, message, data."""
        if isinstance(expected_status, (list, tuple, set)):
            self.assertIn(
                resp.status_code,
                expected_status,
                f"Status {resp.status_code} not in {expected_status}. Body: {resp.get_data(as_text=True)}"
            )
        else:
            self.assertEqual(
                resp.status_code,
                expected_status,
                f"Status {resp.status_code} != {expected_status}. Body: {resp.get_data(as_text=True)}"
            )
        data = resp.get_json()
        self.assertIsInstance(data, dict, "Response không phải JSON object")
        self.assertIn("success", data, "Response thiếu trường 'success'")
        self.assertEqual(data["success"], expected_success, f"Trường success != {expected_success}")
        self.assertIn("message", data, "Response thiếu trường 'message'")
        self.assertIn("data", data, "Response thiếu trường 'data'")
        return data
