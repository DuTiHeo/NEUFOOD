from flask import Blueprint, request, g
from pydantic import ValidationError

from app.db.session import get_db
from app.crud.complaint import (
    get_complaints,
    get_complaint_by_id,
    create_complaint,
    resolve_complaint,
    ComplaintError,
)
from app.core.security import jwt_required, role_required
from app.schemas.complaint import ComplaintCreateRequest, ComplaintResolveRequest
from app.utils.helpers import api_response

complaint_bp = Blueprint("complaints", __name__, url_prefix="/complaints")


def _serialize_complaint(c) -> dict:
    return {
        "id": c.id,
        "order_id": c.order_id,
        "user_id": c.user_id,
        "user_name": c.user.full_name if c.user else "Sinh viên NEU",
        "reason": c.reason,
        "description": c.description,
        "proof_image_url": c.proof_image_url,
        "status": c.status,
        "admin_response": c.admin_response,
        "resolved_by": c.resolved_by,
        "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


@complaint_bp.route("", methods=["GET"])
@jwt_required
def list_complaints():
    """
    Xem danh sách khiếu nại (UC15, UC25, BR-23, BR-24).
    Admin xem toàn bộ; Khách hàng xem danh sách của chính mình.
    """
    try:
        user_id = int(g.current_user["sub"])
    except (KeyError, TypeError, ValueError):
        return api_response(message="Phiên đăng nhập không hợp lệ", status_code=401, success=False)

    role = g.current_user.get("role")
    with get_db() as db:
        items = get_complaints(db, user_id=None if role == "admin" else user_id)
        data = [_serialize_complaint(c) for c in items]
        return api_response(data=data)


@complaint_bp.route("/<int(max=2147483647):complaint_id>", methods=["GET"])
@jwt_required
def get_complaint_detail(complaint_id: int):
    """
    Xem chi tiết một khiếu nại. Khách chỉ xem được khiếu nại của chính mình, Admin xem tất cả.
    Trả về 404 cho cả hai trường hợp không tồn tại hoặc của người khác (bảo mật ID).
    """
    try:
        user_id = int(g.current_user["sub"])
    except (KeyError, TypeError, ValueError):
        return api_response(message="Phiên đăng nhập không hợp lệ", status_code=401, success=False)

    role = g.current_user.get("role")
    with get_db() as db:
        complaint = get_complaint_by_id(db, complaint_id)
        if not complaint or (role != "admin" and complaint.user_id != user_id):
            return api_response(message="Không tìm thấy khiếu nại", errors=[{"code": "NOT_FOUND"}], status_code=404, success=False)

        return api_response(data=_serialize_complaint(complaint))


@complaint_bp.route("", methods=["POST"])
@role_required("customer")
def submit_complaint():
    """
    Gửi ticket khiếu nại đơn hàng (UC15, BR-23, EX-14, EX-15).
    Đơn hàng phải đã giao/hoàn thành và trong vòng complaint_window_hours (mặc định 24h).
    """
    try:
        user_id = int(g.current_user["sub"])
    except (KeyError, TypeError, ValueError):
        return api_response(message="Phiên đăng nhập không hợp lệ", status_code=401, success=False)

    try:
        data = ComplaintCreateRequest.model_validate(request.get_json(silent=True))
    except ValidationError as e:
        return api_response(
            message="Dữ liệu khiếu nại không hợp lệ",
            errors=e.errors(include_context=False),
            status_code=422,
            success=False,
        )

    try:
        with get_db() as db:
            complaint = create_complaint(
                db=db,
                user_id=user_id,
                order_id=data.order_id,
                reason=data.reason,
                description=data.description,
                proof_image_url=data.proof_image_url,
            )
            return api_response(
                data=_serialize_complaint(complaint),
                message="Gửi khiếu nại thành công",
                status_code=201,
            )
    except ComplaintError as e:
        return api_response(message=str(e), errors=[{"code": e.code}], status_code=e.status_code, success=False)


@complaint_bp.route("/<int(max=2147483647):complaint_id>/resolve", methods=["PATCH"])
@role_required("admin")
def resolve_complaint_endpoint(complaint_id: int):
    """
    Admin phân xử khiếu nại (UC25, BR-24).
    Chấp nhận (CHAP_NHAN) hoặc Từ chối (TU_CHOI) khiếu nại.
    Đổi trạng thái đơn hàng sang DA_GIAI_QUYET.
    """
    try:
        admin_id = int(g.current_user["sub"])
    except (KeyError, TypeError, ValueError):
        return api_response(message="Phiên đăng nhập không hợp lệ", status_code=401, success=False)

    try:
        data = ComplaintResolveRequest.model_validate(request.get_json(silent=True))
    except ValidationError as e:
        return api_response(
            message="Dữ liệu xử lý khiếu nại không hợp lệ",
            errors=e.errors(include_context=False),
            status_code=422,
            success=False,
        )

    try:
        with get_db() as db:
            complaint = resolve_complaint(
                db=db,
                admin_id=admin_id,
                complaint_id=complaint_id,
                status=data.status,
                admin_response=data.admin_response,
            )
            return api_response(
                data=_serialize_complaint(complaint),
                message="Xử lý khiếu nại thành công",
                status_code=200,
            )
    except ComplaintError as e:
        return api_response(message=str(e), errors=[{"code": e.code}], status_code=e.status_code, success=False)

