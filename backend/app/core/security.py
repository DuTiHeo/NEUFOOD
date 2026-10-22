import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Optional, Dict, Any
import bcrypt
import jwt
from flask import request, g
from .config import settings
from app.utils.helpers import api_response

def hash_password(password: str) -> str:
    """Bcrypt password hashing."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed password."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Encode JWT access token với thời hạn ngắn (15 phút), chứa type='access' và jti duy nhất."""
    to_encode = data.copy()
    to_encode.setdefault("type", "access")
    to_encode.setdefault("jti", str(uuid.uuid4()))
    now_utc = datetime.now(timezone.utc)
    if expires_delta:
        expire = now_utc + expires_delta
    else:
        expire = now_utc + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": now_utc})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def create_refresh_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Encode JWT refresh token với thời hạn dài (7 ngày), chứa type='refresh' và jti duy nhất."""
    to_encode = data.copy()
    to_encode["type"] = "refresh"
    to_encode.setdefault("jti", str(uuid.uuid4()))
    now_utc = datetime.now(timezone.utc)
    if expires_delta:
        expire = now_utc + expires_delta
    else:
        expire = now_utc + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "iat": now_utc})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Giải mã an toàn JWT token (cả access token và refresh token)."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception):
        return None

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate JWT access token."""
    return decode_token(token)

def jwt_required(f):
    """Decorator to enforce valid JWT Bearer authentication kèm kiểm tra danh sách đen token."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header or not auth_header.startswith("Bearer "):
            return api_response(
                data=None,
                message="Yêu cầu đăng nhập để truy cập tài nguyên này",
                status_code=401,
                success=False,
            )
        
        token = auth_header.split(" ")[1]
        payload = decode_access_token(token)
        if not payload:
            return api_response(
                data=None,
                message="Phiên đăng nhập không hợp lệ hoặc đã hết hạn",
                status_code=401,
                success=False,
            )
        
        # Chặn nếu gửi nhầm Refresh Token vào endpoint yêu cầu Access Token
        token_type = payload.get("type", "access")
        if token_type != "access":
            return api_response(
                data=None,
                message="Phiên đăng nhập không hợp lệ hoặc đã hết hạn",
                status_code=401,
                success=False,
            )

        user_id_raw = payload.get("sub")
        try:
            user_id = int(user_id_raw)
        except (ValueError, TypeError):
            return api_response(
                data=None,
                message="Phiên đăng nhập không hợp lệ hoặc đã hết hạn",
                status_code=401,
                success=False,
            )

        from app.db.session import get_db
        from app.db.models import User
        from app.crud.user import is_token_revoked

        jti = payload.get("jti")
        with get_db() as db:
            # Kiểm tra token đã bị thu hồi (đăng xuất hoặc đổi mật khẩu)
            if jti and is_token_revoked(db, jti):
                return api_response(
                    data=None,
                    message="Phiên đăng nhập đã bị thu hồi hoặc đăng xuất",
                    status_code=401,
                    success=False,
                )

            db_user = db.query(User.id, User.is_active).filter(User.id == user_id).first()
            if db_user and not db_user.is_active:
                return api_response(
                    data=None,
                    message="Tài khoản này đã bị khóa",
                    status_code=403,
                    success=False,
                )

        g.current_user = payload
        return f(*args, **kwargs)
    return decorated_function

def role_required(*allowed_roles: str):
    """Decorator to enforce role-based access control (RBAC)."""
    def decorator(f):
        @wraps(f)
        @jwt_required
        def decorated_function(*args, **kwargs):
            user = getattr(g, "current_user", None)
            if not user or user.get("role") not in allowed_roles:
                return api_response(
                    data=None,
                    message="Bạn không có quyền thực hiện hành động này",
                    status_code=403,
                    success=False,
                )
            return f(*args, **kwargs)
        return decorated_function
    return decorator
