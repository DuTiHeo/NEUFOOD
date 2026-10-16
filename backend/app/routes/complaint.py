from flask import Blueprint, g
from app.db.session import get_db
from app.crud.complaint import get_complaints
from app.core.security import jwt_required
from app.utils.helpers import api_response

complaint_bp = Blueprint("complaints", __name__, url_prefix="/complaints")


@complaint_bp.route("", methods=["GET"])
@jwt_required
def list_complaints():
    """
    Xem danh sách khiếu nại (UC15, UC25, BR-23, BR-24).
    TODO (Thành viên 4): Bổ sung POST /api/v1/complaints (kiểm tra trong vòng 24h theo BR-23, EX-14, EX-15)
    và PATCH /api/v1/complaints/<id>/resolve (độc quyền Admin theo BR-24).
    """
    role = g.current_user.get("role")
    user_id = int(g.current_user["sub"])
    with get_db() as db:
        items = get_complaints(db, user_id=None if role == "admin" else user_id)
        data = [
            {
                "id": c.id,
                "order_id": c.order_id,
                "user_id": c.user_id,
                "reason": c.reason,
                "description": c.description,
                "proof_image_url": c.proof_image_url,
                "status": c.status,
                "admin_response": c.admin_response,
                "resolved_by": c.resolved_by,
                "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in items
        ]
        return api_response(data=data)
