from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from app.core.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=settings.rate_limit_list or ["200 per day", "50 per hour"],
    storage_uri="memory://"
)
