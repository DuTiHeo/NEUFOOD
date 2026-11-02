import uuid
from typing import Any, Dict, Optional
from flask import Blueprint, request
from pydantic import ValidationError

from app.core.chatbot_engine import (
    _format_vnd,
    _strip_accents,
    clear_conversation_history,
    generate_chat_reply,
    get_conversation_history,
    save_conversation_turn,
)
from app.core.limiter import limiter
from app.core.security import decode_access_token
from app.crud.chat import (
    get_chatbot_knowledge_context,
    get_user_active_and_recent_orders,
)
from app.crud.order import create_order, OrderError
from app.crud.user import is_token_revoked
from app.db.models import CampusLocation, Dish, User
from app.db.session import get_db
from app.schemas.chat import ChatMessageRequest, ChatResetRequest
from app.utils.helpers import api_response

chat_bp = Blueprint("chat", __name__)


def _resolve_dish(db, identifier: str) -> Optional[Dish]:
    """Tìm món ăn bằng slug ID hoặc tên món (hỗ trợ cả các biến thể slug do AI sinh ra)."""
    if not identifier:
        return None
    cleaned = identifier.strip().lower().replace("_", "-")
    # 1. Tìm chính xác theo id
    dish = (
        db.query(Dish)
        .filter(Dish.id == cleaned, Dish.is_deleted.is_(False), Dish.is_active.is_(True))
        .first()
    )
    if dish:
        return dish

    # 2. Tìm theo tên món và chuỗi chuẩn hóa
    query_name = cleaned.replace("-", " ")
    norm_query = _strip_accents(query_name)
    all_dishes = (
        db.query(Dish)
        .filter(Dish.is_deleted.is_(False), Dish.is_active.is_(True))
        .all()
    )
    for d in all_dishes:
        norm_d = _strip_accents(d.name)
        if norm_d == norm_query or norm_d in norm_query or norm_query in norm_d or d.id in cleaned or cleaned in d.id:
            return d

    return None


def _validation_errors(error: ValidationError) -> list:
    return [
        {"loc": item["loc"], "msg": item["msg"], "type": item["type"]}
        for item in error.errors()
    ]


def _extract_optional_user(db) -> Optional[Dict[str, Any]]:
    """
    Trích xuất thông tin người dùng từ JWT Bearer Token nếu có.
    Nếu không có token hoặc token hết hạn/thu hồi, trả về None để phục vụ ở chế độ Khách vãng lai (Guest)
    mà không chặn lỗi 401.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None

    payload = decode_access_token(token)
    if not payload or payload.get("type", "access") != "access":
        return None

    try:
        user_id = int(payload.get("sub"))
    except (ValueError, TypeError):
        return None

    jti = payload.get("jti")
    if jti and is_token_revoked(db, jti):
        return None

    user_row = (
        db.query(User.id, User.full_name, User.role, User.is_active, User.phone_number)
        .filter(User.id == user_id)
        .first()
    )
    if not user_row or not user_row.is_active:
        return None

    return {
        "id": user_row.id,
        "full_name": user_row.full_name,
        "role": user_row.role,
        "phone_number": user_row.phone_number,
    }


def _resolve_session_and_owner(
    requested_session_id: Optional[str],
    current_user: Optional[Dict[str, Any]],
) -> tuple[str, str]:
    """Xác định session_id trả về cho client và owner_key lưu trên Redis."""
    session_id = requested_session_id or uuid.uuid4().hex
    if current_user:
        owner_key = f"user:{current_user['id']}:{session_id}"
    else:
        owner_key = f"guest:{session_id}"
    return session_id, owner_key


@chat_bp.route("/message", methods=["POST"])
@limiter.limit("30 per minute")
def send_chat_message():
    """
    POST /api/v1/chat/message
    Tiếp nhận câu hỏi của sinh viên/khách vãng lai, kết hợp dữ liệu thực đơn, cấu hình Canteen A2
    và trạng thái đơn hàng thực tế để phản hồi qua Google Gemini 2.5 Flash (kèm Smart Fallback).
    """
    raw_json = request.get_json(silent=True)
    if not isinstance(raw_json, dict):
        return api_response(
            data=None,
            message="Dữ liệu đầu vào phải là JSON object hợp lệ",
            status_code=400,
            success=False,
        )

    try:
        dto = ChatMessageRequest.model_validate(raw_json)
    except ValidationError as err:
        return api_response(
            data=None,
            message="Nội dung tin nhắn không hợp lệ (tối đa 500 ký tự và không được để trống)",
            status_code=422,
            success=False,
            errors=_validation_errors(err),
        )

    with get_db() as db:
        current_user = _extract_optional_user(db)
        session_id, owner_key = _resolve_session_and_owner(dto.session_id, current_user)

        fallback_history = (
            [{"role": item.role, "text": item.text} for item in dto.history]
            if dto.history
            else None
        )
        history = get_conversation_history(owner_key, fallback_history=fallback_history)

        knowledge_ctx = get_chatbot_knowledge_context(db)
        user_orders = (
            get_user_active_and_recent_orders(db, user_id=current_user["id"], limit=3)
            if current_user
            else []
        )

        result = generate_chat_reply(
            user_message=dto.message,
            history=history,
            knowledge_ctx=knowledge_ctx,
            user_orders=user_orders,
            is_authenticated=current_user is not None,
            user_name=current_user["full_name"] if current_user else None,
        )

        action_payload = result.get("action")
        final_action = None

        if isinstance(action_payload, dict):
            action_type = action_payload.get("type")

            # 1. ĐẶT MÓN HỘ NGƯỜI DÙNG (CREATE_ORDER)
            if action_type == "CREATE_ORDER":
                if not current_user:
                    final_action = {
                        "type": "NEED_LOGIN",
                        "pending_order": action_payload,
                    }
                    result["reply"] += (
                        "\n\n*(Lưu ý: Bạn vui lòng **Đăng nhập** tài khoản để hệ thống có thể tạo và gửi đơn hàng trực tiếp tới Canteen A2 nhé!)*"
                    )
                elif current_user.get("role") != "customer":
                    result["reply"] += (
                        "\n\n*(Tài khoản của bạn có vai trò quản trị/nhân viên, vui lòng sử dụng tài khoản sinh viên/khách hàng để đặt món nhé!)*"
                    )
                else:
                    order_type = action_payload.get("order_type", "delivery")
                    if order_type not in ("delivery", "pickup"):
                        order_type = "delivery"

                    building_code = str(action_payload.get("building_code", "A1")).strip().upper()
                    room_detail = action_payload.get("room_detail") or "P.101"

                    campus_location_id = None
                    if order_type == "delivery":
                        loc = (
                            db.query(CampusLocation)
                            .filter(CampusLocation.building_code == building_code, CampusLocation.is_active.is_(True))
                            .first()
                        )
                        if not loc:
                            loc = db.query(CampusLocation).filter(CampusLocation.is_active.is_(True)).order_by(CampusLocation.display_order.asc()).first()
                        if loc:
                            campus_location_id = loc.id

                    recipient_name = (
                        str(action_payload.get("recipient_name") or current_user.get("full_name") or "Sinh viên NEU").strip()
                    )
                    recipient_phone = (
                        str(action_payload.get("recipient_phone") or current_user.get("phone_number") or "0988888888").strip()
                    )
                    payment_method = action_payload.get("payment_method", "cod_cash")
                    if payment_method not in ("cod_cash", "cod_vietqr"):
                        payment_method = "cod_cash"

                    raw_items = action_payload.get("items", [])
                    items_data = []
                    for raw_it in raw_items:
                        d_id = str(raw_it.get("dish_id", "")).strip()
                        qty = max(1, min(10, int(raw_it.get("quantity", 1))))
                        dish_obj = _resolve_dish(db, d_id)
                        if dish_obj and dish_obj.is_available:
                            items_data.append({
                                "dish_id": dish_obj.id,
                                "quantity": qty,
                                "note": raw_it.get("note"),
                            })

                    if not items_data:
                        result["reply"] += "\n\n*(Không tìm thấy món ăn hợp lệ hoặc món đã tạm hết hàng hôm nay để tạo đơn)*"
                    else:
                        try:
                            created_order = create_order(
                                db=db,
                                user_id=current_user["id"],
                                order_type=order_type,
                                recipient_name=recipient_name,
                                recipient_phone=recipient_phone,
                                campus_location_id=campus_location_id,
                                room_detail=room_detail if order_type == "delivery" else None,
                                delivery_address=None,
                                delivery_note="Được đặt tự động qua Trợ lý AI NEUFood",
                                is_preorder=False,
                                scheduled_at=None,
                                payment_method=payment_method,
                                items_data=items_data,
                            )
                            final_action = {
                                "type": "ORDER_CREATED",
                                "order": {
                                    "id": created_order.id,
                                    "order_code_suffix": created_order.order_code_suffix,
                                    "status": created_order.status,
                                    "status_label": "Đang chờ Canteen A2 xác nhận",
                                    "order_type": created_order.order_type,
                                    "delivery_address": created_order.delivery_address,
                                    "total_amount": int(float(created_order.total_amount)),
                                    "eta": created_order.eta,
                                    "payment_method": "Tiền mặt COD" if created_order.payment_method == "cod_cash" else "Quét mã VietQR",
                                },
                            }
                            result["reply"] += (
                                f"\n\n🎉 **NEUFood đã đặt đơn hàng thành công giúp bạn!**\n"
                                f"- Mã đơn: **{created_order.id}** (4 số cuối nhận hàng: **{created_order.order_code_suffix}**)\n"
                                f"- Trạng thái: **Đang chờ Canteen A2 xác nhận**\n"
                                f"- Địa chỉ: {created_order.delivery_address}\n"
                                f"- Tổng tiền: **{_format_vnd(created_order.total_amount)}**\n"
                                f"- Thời gian dự kiến: **{created_order.eta}**\n"
                                f"*(Khi nhận món bạn nhớ đọc 4 số cuối **{created_order.order_code_suffix}** cho nhân viên/shipper nhé!)*"
                            )
                        except OrderError as order_err:
                            final_action = {
                                "type": "ORDER_FAILED",
                                "error": str(order_err),
                                "code": order_err.code,
                            }
                            result["reply"] += f"\n\n⚠️ **Chưa thể đặt đơn hàng**: {str(order_err)}"
                        except Exception as create_exc:
                            result["reply"] += f"\n\n⚠️ **Lỗi tạo đơn**: {str(create_exc)}"

            # 2. THÊM VÀO GIỎ HÀNG (ADD_TO_CART)
            elif action_type == "ADD_TO_CART":
                cart_items = []
                for it in action_payload.get("items", []):
                    d_id = str(it.get("dish_id", "")).strip()
                    qty = max(1, min(10, int(it.get("quantity", 1))))
                    dish_obj = _resolve_dish(db, d_id)
                    if dish_obj and dish_obj.is_available:
                        cart_items.append({
                            "id": dish_obj.id,
                            "name": dish_obj.name,
                            "price": int(float(dish_obj.price)),
                            "image": dish_obj.image_url,
                            "qty": qty,
                        })
                if cart_items:
                    final_action = {
                        "type": "ADD_TO_CART",
                        "items": cart_items,
                    }
                    result["reply"] += "\n\n*(Đã thêm các món vào giỏ hàng trên giao diện giúp bạn rồi nhé!)*"

        save_conversation_turn(
            owner_key=owner_key,
            history=history,
            user_message=dto.message,
            bot_reply=result["reply"],
        )

    return api_response(
        data={
            "reply": result["reply"],
            "session_id": session_id,
            "provider": result["provider"],
            "suggested_dishes": result["suggested_dishes"],
            "action": final_action,
        },
        message="Phản hồi thành công",
        status_code=200,
    )


@chat_bp.route("/reset", methods=["POST"])
@limiter.limit("30 per minute")
def reset_chat_session():
    """
    POST /api/v1/chat/reset
    Xóa lịch sử hội thoại trên Redis của phiên chat hiện tại.
    """
    raw_json = request.get_json(silent=True)
    if raw_json is None:
        raw_json = {}
    elif not isinstance(raw_json, dict):
        return api_response(
            data=None,
            message="Dữ liệu đầu vào phải là JSON object hợp lệ",
            status_code=400,
            success=False,
        )

    try:
        dto = ChatResetRequest.model_validate(raw_json)
    except ValidationError as err:
        return api_response(
            data=None,
            message="Tham số phiên hội thoại không hợp lệ",
            status_code=422,
            success=False,
            errors=_validation_errors(err),
        )

    with get_db() as db:
        current_user = _extract_optional_user(db)
        session_id, owner_key = _resolve_session_and_owner(dto.session_id, current_user)
        cleared = clear_conversation_history(owner_key)

    return api_response(
        data={
            "session_id": uuid.uuid4().hex,
            "previous_session_id": session_id,
            "cleared": cleared,
        },
        message="Đã xóa lịch sử trò chuyện",
        status_code=200,
    )
