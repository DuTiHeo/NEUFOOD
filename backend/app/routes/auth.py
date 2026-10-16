from flask import Blueprint, request, g
from pydantic import ValidationError
from app.db.session import get_db
from app.crud.user import get_user_by_email, create_user, get_user_by_id
from app.core.security import verify_password, create_access_token, jwt_required
from app.schemas.auth import LoginRequest, RegisterRequest
from app.utils.helpers import api_response

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Đăng nhập hệ thống (UC02, BR-01, BR-02, EX-02).
    TODO (Thành viên 1): Bổ sung kiểm tra locked_until và tăng failed_login_attempts khi sai mật khẩu 5 lần (BR-02, EX-02).
    """
    try:
        data = LoginRequest(**request.get_json(force=True))
    except ValidationError as e:
        return api_response(message="Dữ liệu đăng nhập không hợp lệ", errors=e.errors(), status_code=422, success=False)

    with get_db() as db:
        user = get_user_by_email(db, data.email)
        if not user or not verify_password(data.password, user.password_hash):
            return api_response(message="Email hoặc mật khẩu không chính xác", status_code=401, success=False)

        if not user.is_active:
            return api_response(message="Tài khoản này đã bị khóa", status_code=403, success=False)

        token = create_access_token({
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "name": user.full_name,
        })

        return api_response(
            data={
                "access_token": token,
                "token_type": "Bearer",
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "full_name": user.full_name,
                    "phone_number": user.phone_number,
                    "student_id": user.student_id,
                    "role": user.role,
                    "avatar_url": user.avatar_url,
                    "is_blacklisted": user.is_blacklisted,
                    "blacklist_reason": user.blacklist_reason,
                },
            },
            message="Đăng nhập thành công",
        )


@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Đăng ký tài khoản khách hàng (UC01, BR-01, EX-01).
    TODO (Thành viên 1): Kiểm tra định dạng SĐT 10 số và kiểm tra trùng student_id (EX-01).
    """
    try:
        data = RegisterRequest(**request.get_json(force=True))
    except ValidationError as e:
        return api_response(message="Dữ liệu đăng ký không hợp lệ", errors=e.errors(), status_code=422, success=False)

    with get_db() as db:
        existing = get_user_by_email(db, data.email)
        if existing:
            return api_response(message="Email này đã được sử dụng", status_code=400, success=False)

        user = create_user(
            db=db,
            email=data.email,
            password=data.password,
            full_name=data.full_name,
            phone_number=data.phone_number,
            student_id=data.student_id,
            role="customer",
        )

        token = create_access_token({
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "name": user.full_name,
        })

        return api_response(
            data={
                "access_token": token,
                "token_type": "Bearer",
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "full_name": user.full_name,
                    "phone_number": user.phone_number,
                    "student_id": user.student_id,
                    "role": user.role,
                    "is_blacklisted": user.is_blacklisted,
                },
            },
            message="Đăng ký tài khoản thành công",
            status_code=201,
        )


@auth_bp.route("/logout", methods=["POST"])
@jwt_required
def logout():
    """Đăng xuất hệ thống (UC03)."""
    return api_response(message="Đăng xuất thành công")


@auth_bp.route("/me", methods=["GET"])
@jwt_required
def get_me():
    user_id = int(g.current_user["sub"])
    with get_db() as db:
        user = get_user_by_id(db, user_id)
        if not user:
            return api_response(message="Không tìm thấy người dùng", status_code=404, success=False)

        return api_response(data={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "phone_number": user.phone_number,
            "student_id": user.student_id,
            "role": user.role,
            "avatar_url": user.avatar_url,
            "is_blacklisted": user.is_blacklisted,
            "blacklist_reason": user.blacklist_reason,
        })
