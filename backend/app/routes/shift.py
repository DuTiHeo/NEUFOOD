from flask import Blueprint, g
from app.db.session import get_db
from app.crud.shift import get_shifts
from app.core.security import role_required
from app.utils.helpers import api_response

shift_bp = Blueprint("shifts", __name__, url_prefix="/shifts")


@shift_bp.route("", methods=["GET"])
@role_required("staff", "manager", "admin")
def list_shifts():
    """
    Xem danh sách ca làm việc & đối soát COD (UC20, UC22, BR-25, EX-20).
    TODO (Thành viên 4): Bổ sung GET /my-current-shift, POST /submit, PATCH /<id>/close và GET /reports/summary.
    """
    role = g.current_user.get("role")
    user_id = int(g.current_user["sub"])
    with get_db() as db:
        shifts = get_shifts(db, staff_id=user_id if role == "staff" else None)
        data = [
            {
                "id": s.id,
                "staff_id": s.staff_id,
                "staff_name": s.staff.full_name if s.staff else None,
                "shift_date": s.shift_date.isoformat() if s.shift_date else None,
                "total_orders_handled": s.total_orders_handled,
                "expected_cash": float(s.expected_cash),
                "expected_qr": float(s.expected_qr),
                "actual_cash": float(s.actual_cash),
                "actual_qr": float(s.actual_qr),
                "discrepancy_amount": float(s.discrepancy_amount),
                "discrepancy_note": s.discrepancy_note,
                "status": s.status,
                "closed_by": s.closed_by,
                "closed_at": s.closed_at.isoformat() if s.closed_at else None,
            }
            for s in shifts
        ]
        return api_response(data=data)
