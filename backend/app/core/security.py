from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Optional, Dict, Any
import bcrypt
import jwt
from flask import request, jsonify, g
from .config import settings

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
    """Encode JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate JWT access token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception):
        return None

def jwt_required(f):
    """Decorator to enforce valid JWT Bearer authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"success": False, "message": "Yêu cầu đăng nhập để truy cập tài nguyên này"}), 401
        
        token = auth_header.split(" ")[1]
        payload = decode_access_token(token)
        if not payload:
            return jsonify({"success": False, "message": "Phiên đăng nhập không hợp lệ hoặc đã hết hạn"}), 401
        
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
                return jsonify({"success": False, "message": "Bạn không có quyền thực hiện hành động này"}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator
