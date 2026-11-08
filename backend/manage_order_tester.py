"""Privileged operator command; not exposed through profile/registration APIs."""
import argparse
import getpass
from app.db.models import User
from app.db.session import get_db
from app.core.security import hash_password


def set_exemption(db, email, enabled, password=None):
    user = db.query(User).filter(User.email == email).with_for_update().first()
    if user is None:
        if not enabled or not password:
            raise ValueError("Không tìm thấy tài khoản; cần --create khi cấp lần đầu")
        user = User(email=email, full_name="NEUFood Tester", phone_number="", role="customer",
                    password_hash=hash_password(password))
        db.add(user)
    if user.role != "customer":
        raise ValueError("Chỉ cấp ngoại lệ cho tài khoản customer")
    user.ordering_hours_exempt = enabled
    db.flush()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["grant", "revoke"])
    parser.add_argument("--email", default="tester@neufood.com")
    parser.add_argument("--create", action="store_true", help="Tạo nếu chưa có; không đổi mật khẩu tài khoản đã tồn tại")
    args = parser.parse_args()
    if args.create and args.action != "grant":
        parser.error("--create chỉ dùng với grant")
    password = getpass.getpass("Mật khẩu tài khoản tester mới: ") if args.create else None
    with get_db() as db:
        set_exemption(db, args.email, args.action == "grant", password)
    print("Đã cập nhật quyền ngoại lệ khung giờ và ngày nghỉ Chủ nhật.")
