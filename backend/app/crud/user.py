from datetime import datetime, timedelta, timezone
from typing import Optional, List
from sqlalchemy.orm import Session
from app.db.models import User
from app.core.security import hash_password


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Truy vấn người dùng theo ID."""
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Truy vấn người dùng theo email (đã chuẩn hóa chữ thường)."""
    return db.query(User).filter(User.email == email.strip().lower()).first()


def get_user_by_student_id(db: Session, student_id: str) -> Optional[User]:
    """Truy vấn người dùng theo mã sinh viên để kiểm tra trùng lặp (UC01, BR-01, EX-01)."""
    if not student_id or not student_id.strip():
        return None
    return db.query(User).filter(User.student_id == student_id.strip()).first()


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
    TODO (Thành viên 1): Bổ sung các hàm hỗ trợ khóa đăng nhập 15p (BR-02), quản trị user & Blacklist COD (UC23).
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
    """Cập nhật thông tin hồ sơ người dùng (UC04)."""
    for field, value in update_data.items():
        if hasattr(user, field) and value is not None:
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

