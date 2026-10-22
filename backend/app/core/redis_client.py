import logging
from typing import Optional
import redis
from redis.exceptions import RedisError
from app.core.config import settings

logger = logging.getLogger(__name__)

# Khởi tạo ConnectionPool duy nhất toàn cục với socket timeout ngắn để tránh chặn request
_redis_pool: Optional[redis.ConnectionPool] = None


def get_redis_pool() -> redis.ConnectionPool:
    """Khởi tạo hoặc trả về Redis ConnectionPool duy nhất."""
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = redis.ConnectionPool.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_timeout=2.0,
            socket_connect_timeout=2.0,
            retry_on_timeout=True,
        )
    return _redis_pool


def get_redis_client() -> Optional[redis.Redis]:
    """Lấy instance Redis client từ pool, bắt lỗi nếu không thể kết nối."""
    try:
        pool = get_redis_pool()
        return redis.Redis(connection_pool=pool)
    except Exception as e:
        logger.warning(f"Không thể khởi tạo Redis client từ URL {settings.REDIS_URL}: {e}")
        return None


def check_redis_health() -> bool:
    """Kiểm tra trạng thái kết nối tới Redis (Healthcheck)."""
    try:
        client = get_redis_client()
        if client is None:
            return False
        return bool(client.ping())
    except (RedisError, Exception) as e:
        logger.warning(f"Redis Healthcheck thất bại: {e}")
        return False


def is_redis_revoked(jti: str) -> Optional[bool]:
    """
    Kiểm tra JTI có tồn tại trong danh sách đen Redis (Tier 1) hay không.
    Trả về:
        - True: Token nằm trong blacklist Redis (Cache Hit).
        - False: Token không nằm trong blacklist Redis (Cache Miss / Chưa thu hồi).
        - None: Lỗi kết nối Redis (Kích hoạt Graceful Fallback sang DB).
    """
    if not jti:
        return False

    try:
        client = get_redis_client()
        if client is None:
            return None
        key = f"revoked_token:{jti}"
        exists = client.exists(key)
        return bool(exists > 0)
    except (RedisError, Exception) as e:
        logger.warning(f"Lỗi truy vấn Redis cho key revoked_token:{jti} ({e}). Kích hoạt Graceful Fallback sang PostgreSQL.")
        return None


def set_redis_revoked(jti: str, ttl: int, reason: Optional[str] = None) -> bool:
    """
    Lưu JTI vào danh sách đen Redis (Tier 1) kèm thời gian sống TTL (giây).
    Nếu ttl <= 0, bỏ qua không lưu vì token đã hết hạn tự nhiên.
    Trả về:
        - True nếu ghi thành công vào Redis.
        - False nếu thất bại hoặc ttl <= 0 (vẫn an toàn vì DB đã lưu).
    """
    if not jti or ttl <= 0:
        return False

    try:
        client = get_redis_client()
        if client is None:
            return False
        key = f"revoked_token:{jti}"
        val = reason if reason and reason.strip() else "revoked"
        client.set(name=key, value=val, ex=int(ttl))
        return True
    except (RedisError, Exception) as e:
        logger.warning(f"Lỗi ghi nhận Redis cho key revoked_token:{jti} ({e}). Hệ thống vẫn an toàn nhờ PostgreSQL Tier 2.")
        return False
