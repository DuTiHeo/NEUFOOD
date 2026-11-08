import logging
from flask import request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from app.core.config import settings

logger = logging.getLogger(__name__)

# Cấu hình storage cho Limiter: ưu tiên Redis, fallback in-memory nếu không kết nối được
storage_uri = settings.REDIS_URL if settings.REDIS_URL else "memory://"

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=settings.rate_limit_list or ["5000 per hour", "50000 per day"],
    storage_uri=storage_uri,
    strategy="fixed-window",
    in_memory_fallback_enabled=True,
    swallow_errors=True,
)


def get_client_ip() -> str:
    """Lấy địa chỉ IP thật của client, hỗ trợ X-Forwarded-For khi chạy sau reverse proxy (Vite/Nginx)."""
    if request:
        x_forwarded_for = request.headers.get("X-Forwarded-For")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        return request.remote_addr or "127.0.0.1"
    return "127.0.0.1"


def get_login_rate_limit_key() -> str:
    """
    Tạo khóa giới hạn tần suất đăng nhập theo cặp (IP + email) (BUG-01, BR-02).
    Ngăn chặn khóa nhầm toàn bộ sinh viên/cán bộ dùng chung mạng Wifi trường/KTX.
    """
    ip = get_client_ip()
    email = ""
    try:
        body = request.get_json(force=True, silent=True)
        if isinstance(body, dict):
            email = str(body.get("email", "")).strip().lower()
    except Exception:
        pass
    return f"{ip}:{email}"

