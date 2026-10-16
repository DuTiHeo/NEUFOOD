from typing import Optional, List
from sqlalchemy.orm import Session
from app.db.models import User
from app.core.security import hash_password


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email.strip().lower()).first()


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
    Tạo tài khoản mới với role mặc định 'customer' khớp CHECK CONSTRAINT trong init_db.sql.
    TODO (Thành viên 1): Bổ sung các hàm hỗ trợ khóa đăng nhập 15p (BR-02), quản trị user & Blacklist COD (UC23).
    """
    hashed = hash_password(password)
    user = User(
        email=email.strip().lower(),
        password_hash=hashed,
        full_name=full_name,
        phone_number=phone_number,
        student_id=student_id,
        role=role,
        is_active=True,
        is_blacklisted=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user: User, update_data: dict) -> User:
    for field, value in update_data.items():
        if hasattr(user, field) and value is not None:
            setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user
