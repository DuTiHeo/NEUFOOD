from flask import Blueprint, request, g
from pydantic import ValidationError
from app.db.session import get_db
from app.crud.user import get_user_by_id, update_user
from app.core.security import jwt_required
from app.schemas.user import UserUpdateRequest
from app.utils.helpers import api_response

user_bp = Blueprint("users", __name__, url_prefix="/users")

@user_bp.route("/profile", methods=["GET"])
@jwt_required
def get_profile():
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
            "avatar_url": user.avatar_url
        })

@user_bp.route("/profile", methods=["PUT"])
@jwt_required
def update_profile():
    user_id = int(g.current_user["sub"])
    try:
        data = UserUpdateRequest(**request.get_json(force=True))
    except ValidationError as e:
        return api_response(message="Dữ liệu cập nhật không hợp lệ", errors=e.errors(), status_code=422, success=False)

    with get_db() as db:
        user = get_user_by_id(db, user_id)
        if not user:
            return api_response(message="Không tìm thấy người dùng", status_code=404, success=False)
        
        updated = update_user(db, user, data.model_dump(exclude_unset=True))
        return api_response(data={
            "id": updated.id,
            "email": updated.email,
            "full_name": updated.full_name,
            "phone_number": updated.phone_number,
            "student_id": updated.student_id,
            "role": updated.role,
            "avatar_url": updated.avatar_url
        }, message="Cập nhật hồ sơ thành công")
