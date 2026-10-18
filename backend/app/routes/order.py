from flask import Blueprint, request, g
from pydantic import ValidationError
from app.db.session import get_db
from app.crud.order import (
    create_order, cancel_order, get_order_by_id, get_user_orders, get_all_orders, update_order_status, OrderError
)
from app.core.security import jwt_required, role_required
from app.schemas.order import OrderCreateRequest, OrderStatusUpdateRequest
from app.utils.helpers import api_response

order_bp = Blueprint("orders", __name__, url_prefix="/orders")


def _serialize_order(o: object) -> dict:
    return {
        "id": o.id,
        "order_code_suffix": o.order_code_suffix,
        "user_id": o.user_id,
        "staff_id": o.staff_id,
        "order_type": o.order_type,
        "status": o.status,
        "recipient_name": o.recipient_name,
        "recipient_phone": o.recipient_phone,
        "campus_location_id": o.campus_location_id,
        "room_detail": o.room_detail,
        "delivery_address": o.delivery_address,
        "delivery_note": o.delivery_note,
        "is_preorder": o.is_preorder,
        "scheduled_at": o.scheduled_at.isoformat() if o.scheduled_at else None,
        "payment_method": o.payment_method,
        "payment_status": o.payment_status,
        "subtotal_amount": float(o.subtotal_amount),
        "ship_fee": float(o.ship_fee),
        "total_amount": float(o.total_amount),
        "eta": o.eta,
        "cancelled_reason": o.cancelled_reason,
        "delivered_at": o.delivered_at.isoformat() if o.delivered_at else None,
        "completed_at": o.completed_at.isoformat() if o.completed_at else None,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "items": [
            {
                "id": i.id,
                "dish_id": i.dish_id,
                "dish_name": i.dish_name,
                "unit_price": float(i.unit_price),
                "base_price": float(i.base_price),
                "quantity": i.quantity,
                "note": i.note,
                "subtotal": float(i.subtotal),
            }
            for i in o.items
        ],
    }


@order_bp.route("", methods=["POST"])
@role_required("customer")
def submit_order():
    """Tạo đơn COD (UC08–UC10); nghiệp vụ và giao dịch nằm trong CRUD."""
    try:
        user_id = int(g.current_user["sub"])
    except (KeyError, TypeError, ValueError):
        return api_response(message="Phiên đăng nhập không hợp lệ", status_code=401, success=False)

    try:
        data = OrderCreateRequest.model_validate(request.get_json(silent=True))
    except ValidationError as e:
        return api_response(message="Dữ liệu đơn hàng không hợp lệ", errors=e.errors(include_context=False), status_code=422, success=False)

    try:
        with get_db() as db:
            order = create_order(
                db=db,
                user_id=user_id,
                order_type=data.order_type,
                recipient_name=data.recipient_name,
                recipient_phone=data.recipient_phone,
                campus_location_id=data.campus_location_id,
                room_detail=data.room_detail,
                delivery_address=data.delivery_address,
                delivery_note=data.delivery_note,
                is_preorder=data.is_preorder,
                scheduled_at=data.scheduled_at,
                payment_method=data.payment_method,
                items_data=[item.model_dump() for item in data.items],
            )
            return api_response(
                data=_serialize_order(order), message="Đặt hàng thành công", status_code=201,
            )
    except OrderError as e:
        return api_response(message=str(e), errors=[{"code": e.code}], status_code=e.status_code, success=False)


@order_bp.route("/<order_id>/cancel", methods=["POST"])
@role_required("customer")
def cancel_my_order(order_id: str):
    """UC12 không yêu cầu body; quyền sở hữu và trạng thái được kiểm tra trong CRUD."""
    try:
        user_id = int(g.current_user["sub"])
    except (KeyError, TypeError, ValueError):
        return api_response(message="Phiên đăng nhập không hợp lệ", status_code=401, success=False)
    try:
        with get_db() as db:
            order = cancel_order(db, order_id, user_id)
            return api_response(data=_serialize_order(order), message="Hủy đơn hàng thành công")
    except OrderError as e:
        return api_response(message=str(e), errors=[{"code": e.code}], status_code=e.status_code, success=False)


@order_bp.route("", methods=["GET"])
@jwt_required
def get_my_orders():
    user_id = int(g.current_user["sub"])
    with get_db() as db:
        orders = get_user_orders(db, user_id)
        data = [_serialize_order(o) for o in orders]
        return api_response(data=data)


@order_bp.route("/<order_id>", methods=["GET"])
@jwt_required
def get_order_details(order_id: str):
    with get_db() as db:
        order = get_order_by_id(db, order_id)
        if not order:
            return api_response(message="Không tìm thấy đơn hàng", status_code=404, success=False)
        return api_response(data=_serialize_order(order))


@order_bp.route("/admin/all", methods=["GET"])
@role_required("staff", "manager", "admin")
def get_all_orders_admin():
    status = request.args.get("status")
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 20))

    with get_db() as db:
        orders, total = get_all_orders(db, status=status, page=page, limit=limit)
        items = [_serialize_order(o) for o in orders]
        return api_response(data={"items": items, "total": total, "page": page, "limit": limit})


@order_bp.route("/<order_id>/status", methods=["PATCH"])
@role_required("staff", "manager", "admin")
def update_status(order_id: str):
    try:
        data = OrderStatusUpdateRequest(**request.get_json(force=True))
    except ValidationError as e:
        return api_response(message="Trạng thái không hợp lệ", errors=e.errors(), status_code=422, success=False)

    try:
        with get_db() as db:
            order = get_order_by_id(db, order_id)
            if not order:
                return api_response(message="Không tìm thấy đơn hàng", status_code=404, success=False)
            updated = update_order_status(db, order, data.status, data.cancelled_reason)
            return api_response(
                data={"id": updated.id, "status": updated.status},
                message="Cập nhật trạng thái thành công",
            )
    except OrderError as e:
        return api_response(message=str(e), errors=[{"code": e.code}], status_code=e.status_code, success=False)
