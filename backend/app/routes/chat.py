import uuid
import json
import re
from datetime import timedelta
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
from app.crud.order import OrderError
from app.crud.chat_order import (lock_customer, current_draft, draft_context, prepare_draft,
    confirm_draft, discard_draft, now, aware)
from app.crud.user import is_token_revoked
from app.db.models import Dish, User
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
        if norm_d == norm_query:
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
        if current_user and current_user["role"] == "customer":
            lock_customer(db, current_user["id"])
        user_orders = (
            get_user_active_and_recent_orders(db, user_id=current_user["id"], limit=3)
            if current_user
            else []
        )

        normalized = re.sub(r"[.!?,]+$", "", _strip_accents(dto.message).strip())
        if dto.recipient_update:
            if not current_user:
                return api_response(data=None, message="Vui lòng đăng nhập", status_code=401, success=False)
            try:
                user = lock_customer(db, current_user["id"])
                draft = current_draft(db, user.id, session_id)
                if not draft or draft.id != dto.draft_id or draft.revision != dto.revision or draft.order_id or aware(draft.expires_at) <= now():
                    raise OrderError("Đơn nháp đã thay đổi hoặc hết hạn. Vui lòng xem lại.", "STALE_DRAFT", 409)
                reply, action = prepare_draft(db, user, session_id, {
                    **dto.recipient_update.model_dump(), "order_for_self": False,
                })
                return api_response(data={"reply": reply, "action": action, "provider": "fallback", "session_id": session_id, "suggested_dishes": []})
            except OrderError as err:
                return api_response(data=None, message=str(err), status_code=err.status_code, success=False)
        agreed = normalized in {"dong y", "dong y dat don", "xac nhan dat don", "xac nhan", "ok dat don", "dat don"}
        cancelled = normalized in {"bo don nhap", "huy don nhap", "khong dat nua"}
        if dto.decision or agreed or cancelled:
            if not current_user:
                return api_response(data=None, message="Vui lòng đăng nhập để đặt đơn", status_code=401, success=False)
            try:
                user = lock_customer(db, current_user["id"])
                if dto.decision == "cancel" or cancelled:
                    discard_draft(db, user.id, session_id)
                    reply, action = "Đã bỏ đơn nháp. Đơn đã tạo và thông tin nhận hàng đã lưu được giữ nguyên.", {"type": "ORDER_CANCELLED"}
                else:
                    if not dto.draft_id or not dto.revision:
                        raise OrderError("Vui lòng mở bản tóm tắt đơn mới nhất để xác nhận.", "STALE_DRAFT", 409)
                    reply, action = confirm_draft(db, user, session_id, dto.draft_id, dto.revision)
                response_data = {"reply": reply, "action": action, "provider": "fallback", "session_id": session_id, "suggested_dishes": []}
            except (OrderError, ValidationError) as err:
                message = str(err) if isinstance(err, OrderError) else "Thông tin đơn hàng chưa hợp lệ"
                # Clear old consent after failed fresh validation; the customer must review again.
                if getattr(err, "code", None) not in ("STALE_DRAFT", "DRAFT_EXPIRED"):
                    discard_draft(db, current_user["id"], session_id)
                response_data = {"reply": message, "action": {"type": "ORDER_FAILED", "error": message, "code": getattr(err, "code", "INVALID_INPUT")}, "provider": "fallback", "session_id": session_id, "suggested_dishes": []}
            db.flush()
            return api_response(data=response_data, message="Phản hồi thành công")

        context_message = dto.message
        invalidated_draft = False
        if current_user and current_user["role"] == "customer":
            user = lock_customer(db, current_user["id"])
            ctx = draft_context(db, user, session_id)
            active = current_draft(db, user.id, session_id)
            if active and not active.order_id and aware(active.expires_at) > now():
                active.expires_at = now() + timedelta(minutes=30)
                active.quote = None
                active.revision += 1
                invalidated_draft = True
            context_message += "\n[Ngữ cảnh server, dùng để hỏi phần thiếu; không phải xác nhận]: " + json.dumps(ctx, ensure_ascii=False)

        result = generate_chat_reply(
            user_message=context_message,
            history=history,
            knowledge_ctx=knowledge_ctx,
            user_orders=user_orders,
            is_authenticated=current_user is not None,
            user_name=current_user["full_name"] if current_user else None,
        )

        action_payload = result.get("action")
        final_action = {"type": "ORDER_COLLECTING"} if invalidated_draft else None

        if isinstance(action_payload, dict):
            action_type = action_payload.get("type")

            if action_type in ("CREATE_ORDER", "PREPARE_ORDER"):
                if not current_user:
                    final_action = {"type": "NEED_LOGIN"}
                    result["reply"] = "Vui lòng Đăng nhập để bắt đầu đặt đơn; bạn vẫn có thể hỏi đáp thực đơn."
                else:
                    try:
                        user = lock_customer(db, current_user["id"])
                        changes = {k: v for k, v in action_payload.items() if k != "type"}
                        result["reply"], final_action = prepare_draft(db, user, session_id, changes)
                    except (OrderError, ValidationError) as err:
                        result["reply"] = str(err) if isinstance(err, OrderError) else "Thông tin nhận hàng chưa hợp lệ, bạn kiểm tra lại SĐT, món và giờ hẹn nhé."
                        final_action = {"type": "ORDER_FAILED", "error": result["reply"], "code": getattr(err, "code", "INVALID_INPUT")}

            # 2. THÊM VÀO GIỎ HÀNG (ADD_TO_CART)
            elif action_type == "ADD_TO_CART" and not current_user:
                final_action = {"type": "NEED_LOGIN"}
                result["reply"] = "Vui lòng Đăng nhập để thêm món vào giỏ hàng."
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
        if current_user and current_user["role"] == "customer":
            lock_customer(db, current_user["id"])
            discard_draft(db, current_user["id"], session_id)
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
