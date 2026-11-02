import logging
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
