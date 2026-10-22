from datetime import datetime, timedelta, timezone
from typing import Optional, List
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.db.models import User, Order, ACTIVE_ORDER_STATUSES, RevokedToken
from app.core.security import hash_password
from app.core.redis_client import is_redis_revoked, set_redis_revoked

# Các trường hồ sơ cho phép gán giá trị None khi người dùng xóa thông tin tùy chọn (UC04)
NULLABLE_PROFILE_FIELDS = {"student_id", "avatar_url"}


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Truy vấn người dùng theo ID."""
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Truy vấn người dùng theo email (đã chuẩn hóa chữ thường)."""
    return db.query(User).filter(User.email == email.strip().lower()).first()


def get_user_by_student_id(db: Session, student_id: str) -> Optional[User]:
    """Truy vấn người dùng theo mã sinh viên để kiểm tra trùng lặp (UC01, UC04, BR-01, EX-01)."""
    if not student_id or not student_id.strip():
        return None
    return db.query(User).filter(User.student_id == student_id.strip()).first()


def get_user_by_phone(db: Session, phone_number: str) -> Optional[User]:
    """Truy vấn người dùng theo số điện thoại để kiểm tra trùng lặp (UC04, BR-01, EX-03)."""
    if not phone_number or not phone_number.strip():
        return None
    return db.query(User).filter(User.phone_number == phone_number.strip()).first()


def create_user(
    db: Session,
    email: str,
    password: str,
    full_name: str,
    phone_number: str,
    student_id: Optional[str] = None,
    role: str = "customer",
) -> User:
    """
    Tạo tài khoản mới với role mặc định 'customer' khớp CHECK CONSTRAINT trong init_db.sql (UC01, BR-01).
    """
    hashed = hash_password(password)
    normalized_student_id = student_id.strip() if student_id and student_id.strip() else None
    user = User(
        email=email.strip().lower(),
        password_hash=hashed,
        full_name=full_name.strip(),
        phone_number=phone_number.strip(),
        student_id=normalized_student_id,
        role=role,
        is_active=True,
        is_blacklisted=False,
        failed_login_attempts=0,
        locked_until=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user: User, update_data: dict) -> User:
    """Cập nhật thông tin hồ sơ người dùng (UC04, BR-01, EX-01, EX-03)."""
    for field, value in update_data.items():
        if not hasattr(user, field):
            continue
        if value is not None or field in NULLABLE_PROFILE_FIELDS:
            setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def record_failed_login(db: Session, user: User) -> User:
    """
    Ghi nhận lần đăng nhập sai mật khẩu và khóa tạm thời 15 phút nếu chạm mốc >= 5 lần liên tiếp (UC02, BR-02, EX-02).
    """
    now = datetime.now(timezone.utc)
    if user.locked_until is not None:
        locked_until = (
            user.locked_until.replace(tzinfo=timezone.utc)
            if user.locked_until.tzinfo is None
            else user.locked_until
        )
        # Nếu thời gian khóa 15 phút của đợt trước đã hết hạn, reset bộ đếm trước khi ghi nhận lần sai mới
        if locked_until <= now:
            user.failed_login_attempts = 0
            user.locked_until = None

    user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
    # BR-02 & EX-02: Nhập sai mật khẩu liên tiếp chạm mốc >= 5 lần -> khóa 15 phút
    if user.failed_login_attempts >= 5:
        user.locked_until = now + timedelta(minutes=15)

    db.commit()
    db.refresh(user)
    return user


def reset_login_attempts(db: Session, user: User) -> User:
    """Reset bộ đếm số lần đăng nhập sai và mở khóa tạm thời sau khi đăng nhập thành công (UC02, BR-02)."""
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()
    db.refresh(user)
    return user


def update_user_password(db: Session, user: User, new_password: str) -> User:
    """
    Cập nhật mật khẩu mới (đã băm Bcrypt) và đồng thời mở khóa/reset bộ đếm đăng nhập sai (UC05, BR-02, EX-04).
    """
    user.password_hash = hash_password(new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()
    db.refresh(user)
    return user


def get_all_users(
    db: Session,
    role: Optional[str] = None,
    is_blacklisted: Optional[bool] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
) -> List[User]:
    """
    Truy vấn danh sách toàn bộ tài khoản người dùng có hỗ trợ lọc theo vai trò,
    trạng thái danh sách đen COD, trạng thái hoạt động và từ khóa tìm kiếm (UC23).
    """
    query = db.query(User)

    if role is not None and role.strip():
        query = query.filter(User.role == role.strip())

    if is_blacklisted is not None:
        query = query.filter(User.is_blacklisted == is_blacklisted)

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    if search is not None and search.strip():
        keyword = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.full_name.ilike(keyword),
                User.email.ilike(keyword),
                User.phone_number.ilike(keyword),
                User.student_id.ilike(keyword),
            )
        )

    return query.order_by(User.id.asc()).all()


def has_active_orders(db: Session, user_id: int) -> bool:
    """
    Kiểm tra xem người dùng (khách đặt đơn hoặc nhân viên phụ trách) có đang có đơn hàng
    chưa hoàn tất hay không (UC23, BR-08, EX-22).
    """
    active_order = (
        db.query(Order.id)
        .filter(
            or_(Order.user_id == user_id, Order.staff_id == user_id),
            Order.status.in_(ACTIVE_ORDER_STATUSES),
        )
        .first()
    )
    return active_order is not None


def admin_update_user_status(
    db: Session,
    user: User,
    is_active: Optional[bool] = None,
    role: Optional[str] = None,
) -> User:
    """
    Quản trị viên khóa/mở khóa hoặc phân quyền tài khoản (UC23, BR-02, EX-22).
    Khi mở khóa (is_active = True), đồng thời reset failed_login_attempts = 0 và locked_until = None (BR-02).
    """
    if is_active is not None:
        user.is_active = is_active
        if is_active is True:
            user.failed_login_attempts = 0
            user.locked_until = None

    if role is not None:
        user.role = role

    db.commit()
    db.refresh(user)
    return user


def admin_update_user_blacklist(
    db: Session,
    user: User,
    is_blacklisted: bool,
    blacklist_reason: Optional[str] = None,
) -> User:
    """
    Quản trị viên đưa tài khoản vào hoặc gỡ khỏi danh sách đen COD (UC23, BR-22).
    """
    if is_blacklisted is True:
        user.is_blacklisted = True
        user.blacklist_reason = (
            blacklist_reason.strip()
            if blacklist_reason and blacklist_reason.strip()
            else "Vi phạm chính sách nhận hàng/thanh toán COD"
        )
        user.blacklisted_at = datetime.now(timezone.utc)
    else:
        user.is_blacklisted = False
        user.blacklist_reason = None
        user.blacklisted_at = None

    db.commit()
    db.refresh(user)
    return user


def revoke_token(
    db: Session,
    jti: str,
    token_type: str,
    expires_at: datetime,
    user_id: Optional[int] = None,
    reason: Optional[str] = None,
) -> RevokedToken:
    """
    Lưu trữ mã định danh JTI vào danh sách đen token bị thu hồi.
    Cơ chế Hybrid Two-Tier:
    1. Tier 2: Lưu trữ bền vững vào PostgreSQL (revoked_tokens).
    2. Tier 1: Nạp vào Redis Cache với TTL bằng thời gian sống còn lại của token.
    Graceful Degradation: Nếu Redis offline, token vẫn được thu hồi an toàn trong PostgreSQL.
    """
    # Chuẩn hóa timezone UTC cho expires_at
    normalized_expires_at = (
        expires_at.replace(tzinfo=timezone.utc)
        if expires_at.tzinfo is None
        else expires_at
    )
    now = datetime.now(timezone.utc)
    ttl = int((normalized_expires_at - now).total_seconds())

    # Tier 2: Lưu vào PostgreSQL (tránh duplicate key)
    existing = db.query(RevokedToken).filter(RevokedToken.jti == jti).first()
    if existing:
        # Nếu đã tồn tại trong DB, vẫn cố gắng đảm bảo đã có trong Redis nếu còn hạn
        if ttl > 0:
            set_redis_revoked(jti=jti, ttl=ttl, reason=reason or existing.reason)
        return existing

    revoked = RevokedToken(
        jti=jti,
        token_type=token_type,
        user_id=user_id,
        expires_at=normalized_expires_at,
        reason=reason,
        revoked_at=now,
    )
    db.add(revoked)
    db.commit()
    db.refresh(revoked)

    # Tier 1: Nạp vào Redis cache với TTL tương ứng
    if ttl > 0:
        set_redis_revoked(jti=jti, ttl=ttl, reason=reason)

    return revoked


def is_token_revoked(db: Session, jti: str) -> bool:
    """
    Kiểm tra xem token có nằm trong danh sách đen bị thu hồi hay không.
    Cơ chế Two-Tier Cache & Graceful Fallback:
    - Tier 1: Kiểm tra Redis Cache O(1). Nếu hit -> trả về True ngay.
    - Tier 2: Fallback sang PostgreSQL O(log N) nếu cache miss hoặc Redis lỗi.
      + Nếu PostgreSQL có bản ghi: Backfill nạp lại vào Redis (nếu Redis online) -> trả về True.
      + Nếu PostgreSQL không có bản ghi: trả về False.
    - Chịu lỗi (Fault Tolerance): Không bao giờ quăng ngoại lệ làm crash HTTP 500 khi Redis offline.
    """
    if not jti:
        return False

    # Tier 1: Kiểm tra Redis In-Memory Cache
    redis_status = is_redis_revoked(jti)
    if redis_status is True:
        return True

    # Tier 2: Fallback sang PostgreSQL khi Redis miss (False) hoặc Redis offline (None)
    revoked_record = db.query(RevokedToken).filter(RevokedToken.jti == jti).first()
    if revoked_record is not None:
        # Backfill vào Redis nếu Redis đang kết nối được (redis_status is False)
        if redis_status is not None:
            now = datetime.now(timezone.utc)
            exp = (
                revoked_record.expires_at.replace(tzinfo=timezone.utc)
                if revoked_record.expires_at.tzinfo is None
                else revoked_record.expires_at
            )
            ttl = int((exp - now).total_seconds())
            if ttl > 0:
                set_redis_revoked(jti=jti, ttl=ttl, reason=revoked_record.reason)
        return True

    return False


def cleanup_expired_revoked_tokens(db: Session) -> int:
    """Xóa các token trong danh sách đen đã quá hạn tự nhiên để giảm tải dung lượng DB."""
    now = datetime.now(timezone.utc)
    deleted_count = db.query(RevokedToken).filter(RevokedToken.expires_at < now).delete()
    db.commit()
    return deleted_count



