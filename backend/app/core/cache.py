import json
import logging
from typing import Any, Optional
import redis
from app.core.config import settings

logger = logging.getLogger(__name__)

# Khởi tạo Redis client connection pool
_redis_client: Optional[redis.Redis] = None


def get_redis_client() -> Optional[redis.Redis]:
    """Trả về Redis client singleton hoặc None nếu không kết nối được."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    if not settings.REDIS_URL:
        return None

    try:
        client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_timeout=2.0,
            socket_connect_timeout=2.0,
        )
        # Kiểm tra kết nối
        client.ping()
        _redis_client = client
        logger.info("Đã kết nối thành công tới Redis: %s", settings.REDIS_URL)
        return _redis_client
    except Exception as e:
        logger.warning("Không thể kết nối tới Redis (%s): %s. Chế độ cache sẽ tạm thời bị vô hiệu.", settings.REDIS_URL, e)
        return None


def cache_get(key: str) -> Optional[Any]:
    """Lấy dữ liệu từ cache Redis, giải mã từ chuỗi JSON."""
    client = get_redis_client()
    if client is None:
        return None
    try:
        raw = client.get(key)
        if raw is not None:
            return json.loads(raw)
        return None
    except Exception as e:
        logger.debug("Lỗi đọc cache Redis cho key %s: %s", key, e)
        return None


def cache_set(key: str, value: Any, ttl: int = 300) -> bool:
    """Lưu dữ liệu vào cache Redis dưới dạng JSON với thời gian sống (TTL) tính bằng giây (mặc định 5 phút)."""
    client = get_redis_client()
    if client is None:
        return False
    try:
        serialized = json.dumps(value, ensure_ascii=False)
        client.set(key, serialized, ex=ttl)
        return True
    except Exception as e:
        logger.debug("Lỗi ghi cache Redis cho key %s: %s", key, e)
        return False


def cache_delete(*keys: str) -> int:
    """Xóa một hoặc nhiều keys khỏi cache Redis."""
    client = get_redis_client()
    if client is None or not keys:
        return 0
    try:
        return client.delete(*keys)
    except Exception as e:
        logger.debug("Lỗi xóa cache Redis cho keys %s: %s", keys, e)
        return 0


def cache_delete_pattern(pattern: str) -> int:
    """Xóa tất cả các keys khớp với pattern (ví dụ 'neufood:dishes:*')."""
    client = get_redis_client()
    if client is None:
        return 0
    try:
        deleted = 0
        cursor = 0
        while True:
            cursor, keys = client.scan(cursor=cursor, match=pattern, count=100)
            if keys:
                deleted += client.delete(*keys)
            if cursor == 0:
                break
        return deleted
    except Exception as e:
        logger.debug("Lỗi xóa cache Redis theo pattern %s: %s", pattern, e)
        return 0
