from typing import Optional, Tuple
from flask import Blueprint, request, g
from pydantic import ValidationError
from app.db.session import get_db
from app.crud.user import (
    get_user_by_id,
    get_user_by_phone,
    get_user_by_student_id,
    update_user,
    get_all_users,
    has_active_orders,
    admin_update_user_status,
    admin_update_user_blacklist,
)
from app.core.security import jwt_required, role_required
from app.schemas.user import (
    VALID_USER_ROLES,
    UserUpdateRequest,
    AdminUserStatusUpdateRequest,
    AdminUserBlacklistUpdateRequest,
)
from app.utils.helpers import api_response

user_bp = Blueprint("users", __name__, url_prefix="/users")


def _serialize_user(user) -> dict:
    """Chuẩn hóa dữ liệu tài khoản người dùng trả về qua API (UC04, UC23)."""
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "phone_number": user.phone_number,
        "student_id": user.student_id,
        "role": user.role,
        "avatar_url": user.avatar_url,
        "is_active": user.is_active,
        "is_blacklisted": user.is_blacklisted,
        "blacklist_reason": user.blacklist_reason,
        "blacklisted_at": user.blacklisted_at.isoformat() if user.blacklisted_at else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _parse_json_body() -> Optional[dict]:
    """Đọc và kiểm tra payload JSON là một dictionary hợp lệ, tránh lỗi 500 khi payload rỗng/sai kiểu."""
    raw = request.get_json(force=True, silent=True)
    return raw if isinstance(raw, dict) else None


def _parse_bool_query(value: Optional[str]) -> Tuple[Optional[bool], bool]:
    """
    Phân tích tham số truy vấn kiểu boolean (is_blacklisted, is_active).
    Trả về tuple (parsed_bool_or_none, is_valid).
    """
    if value is None or value.strip() == "":
        return None, True
    normalized = value.strip().lower()
    if normalized in ("true", "1"):
        return True, True
    if normalized in ("false", "0"):
        return False, True
    return None, False


def _format_validation_errors(exc: ValidationError) -> list:
    """Chuẩn hóa danh sách lỗi từ Pydantic v2 đảm bảo tuần tự hóa JSON an toàn tuyệt đối."""
    return exc.errors(include_url=False, include_context=False)


@user_bp.route("/profile", methods=["GET"])
@jwt_required
def get_profile():
    """
    UC04: Xem thông tin hồ sơ cá nhân của người dùng đang đăng nhập.
    Áp dụng cho mọi vai trò đã xác thực JWT (customer, staff, manager, admin).
    """
    user_id = int(g.current_user["sub"])
    with get_db() as db:
        user = get_user_by_id(db, user_id)
        if not user:
            return api_response(
                message="Không tìm thấy người dùng",
                status_code=404,
                success=False,
            )
        if not user.is_active:
            return api_response(
                message="Tài khoản này đã bị khóa",
                status_code=403,
                success=False,
            )
        return api_response(
            data=_serialize_user(user),
            message="Thành công",
            status_code=200,
        )


@user_bp.route("/profile", methods=["PUT"])
@jwt_required
def update_profile():
    """
    UC04: Cập nhật thông tin hồ sơ cá nhân (full_name, phone_number, student_id, avatar_url).
    - BR-01, EX-03: Kiểm tra định dạng SĐT 10 chữ số bắt đầu bằng 0 (^0\\d{9}$) và chống trùng SĐT với tài khoản khác.
    - BR-01, EX-01: Chống trùng Mã sinh viên (student_id) với tài khoản khác.
    """
    raw_data = _parse_json_body()
    if raw_data is None:
        return api_response(
            message="Dữ liệu đầu vào phải là JSON object hợp lệ",
            status_code=400,
            success=False,
        )

    try:
        data = UserUpdateRequest(**raw_data)
    except ValidationError as e:
        errors = _format_validation_errors(e)
        has_phone_error = any("phone_number" in err.get("loc", ()) for err in errors)
        if has_phone_error:
            return api_response(
                message="Số điện thoại không hợp lệ, phải gồm đúng 10 chữ số và bắt đầu bằng số 0",
                errors=errors,
                status_code=422,
                success=False,
            )
        return api_response(
            message="Dữ liệu cập nhật không hợp lệ",
            errors=errors,
            status_code=422,
            success=False,
        )

    update_data = data.model_dump(exclude_unset=True)

    # EX-03: Chặn trường hợp client gửi tường minh {"phone_number": null}
    if "phone_number" in update_data and update_data["phone_number"] is None:
        return api_response(
            message="Số điện thoại không hợp lệ, phải gồm đúng 10 chữ số và bắt đầu bằng số 0",
            status_code=422,
            success=False,
        )

    # Chặn trường hợp client gửi tường minh {"full_name": null}
    if "full_name" in update_data and update_data["full_name"] is None:
        return api_response(
            message="Họ và tên không được để trống",
            status_code=422,
            success=False,
        )

    user_id = int(g.current_user["sub"])
    with get_db() as db:
        user = get_user_by_id(db, user_id)
        if not user:
            return api_response(
                message="Không tìm thấy người dùng",
                status_code=404,
                success=False,
            )
        if not user.is_active:
            return api_response(
                message="Tài khoản này đã bị khóa",
                status_code=403,
                success=False,
            )

        # EX-03: Kiểm tra trùng lặp số điện thoại với tài khoản khác
        if "phone_number" in update_data and update_data["phone_number"] is not None:
            existing_phone_user = get_user_by_phone(db, update_data["phone_number"])
            if existing_phone_user and existing_phone_user.id != user.id:
                return api_response(
                    message="Số điện thoại đã được sử dụng bởi tài khoản khác",
                    status_code=400,
                    success=False,
                )

        # BR-01, EX-01: Kiểm tra trùng lặp mã sinh viên với tài khoản khác
        if "student_id" in update_data and update_data["student_id"] is not None:
            existing_student_user = get_user_by_student_id(db, update_data["student_id"])
            if existing_student_user and existing_student_user.id != user.id:
                return api_response(
                    message="Mã sinh viên đã tồn tại trên hệ thống",
                    status_code=400,
                    success=False,
                )

        updated = update_user(db, user, update_data)
        return api_response(
            data=_serialize_user(updated),
            message="Cập nhật hồ sơ thành công",
            status_code=200,
        )


@user_bp.route("/admin/all", methods=["GET"])
@role_required("admin")
def admin_list_users():
    """
    UC23: Quản trị viên xem danh sách toàn bộ người dùng, hỗ trợ lọc theo vai trò (role),
    trạng thái danh sách đen COD (is_blacklisted), trạng thái hoạt động (is_active) và từ khóa (search).
    """
    role_param = request.args.get("role")
    if role_param is not None and role_param.strip() != "":
        role_filter = role_param.strip().lower()
        if role_filter not in VALID_USER_ROLES:
            return api_response(
                message="Vai trò lọc không hợp lệ, chỉ chấp nhận: customer, staff, manager, admin",
                status_code=400,
                success=False,
            )
    else:
        role_filter = None

    is_blacklisted_filter, ok_bl = _parse_bool_query(request.args.get("is_blacklisted"))
    if not ok_bl:
        return api_response(
            message="Tham số is_blacklisted không hợp lệ, chỉ chấp nhận true hoặc false",
            status_code=400,
            success=False,
        )

    is_active_filter, ok_act = _parse_bool_query(request.args.get("is_active"))
    if not ok_act:
        return api_response(
            message="Tham số is_active không hợp lệ, chỉ chấp nhận true hoặc false",
            status_code=400,
            success=False,
        )

    search_param = request.args.get("search")
    search_filter = search_param.strip() if search_param and search_param.strip() else None

    admin_id = int(g.current_user["sub"])
    with get_db() as db:
        admin_user = get_user_by_id(db, admin_id)
        if not admin_user:
            return api_response(
                message="Không tìm thấy người dùng",
                status_code=404,
                success=False,
            )
        if not admin_user.is_active:
            return api_response(
                message="Tài khoản này đã bị khóa",
                status_code=403,
                success=False,
            )

        users = get_all_users(
            db,
            role=role_filter,
            is_blacklisted=is_blacklisted_filter,
            is_active=is_active_filter,
            search=search_filter,
        )
        return api_response(
            data=[_serialize_user(u) for u in users],
            message="Lấy danh sách người dùng thành công",
            status_code=200,
        )


@user_bp.route("/admin/<int:user_id>/status", methods=["PATCH"])
@role_required("admin")
def admin_change_user_status(user_id: int):
    """
    UC23: Quản trị viên khóa/mở khóa tài khoản (is_active) hoặc phân quyền vai trò (role).
    - BR-02: Khi mở khóa (is_active = True), tự động reset failed_login_attempts = 0 và locked_until = None.
    - EX-22: Chặn khóa tài khoản (is_active = False) nếu người dùng đang có đơn hàng chưa hoàn tất.
    """
    raw_data = _parse_json_body()
    if raw_data is None:
        return api_response(
            message="Dữ liệu đầu vào phải là JSON object hợp lệ",
            status_code=400,
            success=False,
        )

    try:
        data = AdminUserStatusUpdateRequest(**raw_data)
    except ValidationError as e:
        return api_response(
            message="Dữ liệu cập nhật trạng thái không hợp lệ",
            errors=_format_validation_errors(e),
            status_code=422,
            success=False,
        )

    admin_id = int(g.current_user["sub"])
    with get_db() as db:
        admin_user = get_user_by_id(db, admin_id)
        if not admin_user:
            return api_response(
                message="Không tìm thấy người dùng",
                status_code=404,
                success=False,
            )
        if not admin_user.is_active:
            return api_response(
                message="Tài khoản này đã bị khóa",
                status_code=403,
                success=False,
            )

        target_user = get_user_by_id(db, user_id)
        if not target_user:
            return api_response(
                message="Không tìm thấy người dùng",
                status_code=404,
                success=False,
            )

        # Bảo vệ tài khoản Admin không tự khóa hoặc tự hạ quyền của chính mình
        if target_user.id == admin_id:
            if data.is_active is False:
                return api_response(
                    message="Quản trị viên không thể tự khóa tài khoản của chính mình",
                    status_code=400,
                    success=False,
                )
            if data.role is not None and data.role != target_user.role:
                return api_response(
                    message="Quản trị viên không thể tự thay đổi vai trò của chính mình",
                    status_code=400,
                    success=False,
                )

        # EX-22: Chặn khóa tài khoản đang có đơn hàng chưa hoàn tất (BR-08)
        if data.is_active is False and has_active_orders(db, target_user.id):
            return api_response(
                message="Không thể khóa tài khoản đang có đơn hàng chưa hoàn tất. Vui lòng hoàn tất hoặc hủy các đơn hàng trước",
                status_code=400,
                success=False,
            )

        updated_user = admin_update_user_status(
            db,
            target_user,
            is_active=data.is_active,
            role=data.role,
        )
        return api_response(
            data=_serialize_user(updated_user),
            message="Cập nhật trạng thái tài khoản thành công",
            status_code=200,
        )


@user_bp.route("/admin/<int:user_id>/blacklist", methods=["PATCH"])
@role_required("admin")
def admin_change_user_blacklist(user_id: int):
    """
    UC23, BR-22: Quản trị viên đưa tài khoản vi phạm vào danh sách đen COD (is_blacklisted = True)
    hoặc gỡ khỏi danh sách đen COD (is_blacklisted = False).
    """
    raw_data = _parse_json_body()
    if raw_data is None:
        return api_response(
            message="Dữ liệu đầu vào phải là JSON object hợp lệ",
            status_code=400,
            success=False,
        )

    try:
        data = AdminUserBlacklistUpdateRequest(**raw_data)
    except ValidationError as e:
        return api_response(
            message="Dữ liệu cập nhật danh sách đen không hợp lệ",
            errors=_format_validation_errors(e),
            status_code=422,
            success=False,
        )

    admin_id = int(g.current_user["sub"])
    with get_db() as db:
        admin_user = get_user_by_id(db, admin_id)
        if not admin_user:
            return api_response(
                message="Không tìm thấy người dùng",
                status_code=404,
                success=False,
            )
        if not admin_user.is_active:
            return api_response(
                message="Tài khoản này đã bị khóa",
                status_code=403,
                success=False,
            )

        target_user = get_user_by_id(db, user_id)
        if not target_user:
            return api_response(
                message="Không tìm thấy người dùng",
                status_code=404,
                success=False,
            )

        # Bảo vệ tài khoản Admin không tự đưa chính mình vào danh sách đen COD
        if target_user.id == admin_id and data.is_blacklisted is True:
            return api_response(
                message="Quản trị viên không thể tự đưa tài khoản của chính mình vào danh sách đen",
                status_code=400,
                success=False,
            )

        updated_user = admin_update_user_blacklist(
            db,
            target_user,
            is_blacklisted=data.is_blacklisted,
            blacklist_reason=data.blacklist_reason,
        )
        msg = (
            "Đã đưa tài khoản vào danh sách đen COD"
            if data.is_blacklisted
            else "Đã gỡ tài khoản khỏi danh sách đen COD"
        )
        return api_response(
            data=_serialize_user(updated_user),
            message=msg,
            status_code=200,
        )

