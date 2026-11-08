"""Durable draft and consent gate. Orders remains the source of business validation."""
import re
import uuid
from datetime import datetime, timedelta, timezone

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Literal

from app.crud.order import create_order, OrderError
from app.db.models import User, Order, CampusLocation
from app.db.chat_models import ChatOrderDraft, ChatDeliveryPreference
from app.schemas.order import OrderCreateRequest, OrderItemCreate


class DraftUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: Optional[list[OrderItemCreate]] = Field(default=None, min_length=1, max_length=50)
    order_type: Optional[Literal["delivery", "pickup"]] = None
    recipient_name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    recipient_phone: Optional[str] = Field(default=None, pattern=r"^0[35789][0-9]{8}$")
    building_code: Optional[str] = Field(default=None, min_length=1, max_length=30)
    room_detail: Optional[str] = Field(default=None, max_length=100)
    delivery_note: Optional[str] = Field(default=None, max_length=1000)
    payment_method: Optional[Literal["cod_cash", "cod_vietqr"]] = None
    is_preorder: Optional[bool] = Field(default=None, strict=True)
    scheduled_at: Optional[str] = Field(default=None, max_length=50)
    order_for_self: Optional[bool] = Field(default=None, strict=True)
    notes_confirmed: Optional[bool] = Field(default=None, strict=True)


def lock_customer(db, user_id):
    user = db.query(User).filter(User.id == user_id).populate_existing().with_for_update().first()
    if not user or not user.is_active or user.role != "customer":
        raise OrderError("Vui lòng đăng nhập bằng tài khoản khách hàng", "FORBIDDEN", 403)
    return user


def current_draft(db, user_id, session_id):
    return db.query(ChatOrderDraft).filter_by(user_id=user_id, session_id=session_id).order_by(
        ChatOrderDraft.expires_at.desc()).populate_existing().with_for_update().first()


def draft_context(db, user, session_id):
    draft = current_draft(db, user.id, session_id)
    pref = db.get(ChatDeliveryPreference, user.id)
    return {
        "profile_name": user.full_name,
        "profile_phone": user.phone_number if re.fullmatch(r"0[35789][0-9]{8}", user.phone_number or "") else None,
        "saved_delivery": pref.details if pref else None,
        "draft": draft.payload if draft and not draft.order_id and aware(draft.expires_at) > now() else None,
        "vietnam_time": now().astimezone(timezone(timedelta(hours=7))).isoformat(),
    }


def now():
    return datetime.now(timezone.utc)


def aware(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def order_args(db, payload):
    missing = [label for key, label in (
        ("items", "món ăn và số lượng"), ("order_type", "giao tận nơi hay nhận tại quầy"),
        ("recipient_name", "họ tên người nhận"), ("recipient_phone", "SĐT người nhận"),
        ("payment_method", "tiền mặt hay VietQR khi nhận hàng"),
    ) if not payload.get(key)]
    if type(payload.get("is_preorder")) is not bool:
        missing.append("nhận ngay hay hẹn ngày giờ cụ thể")
    location = None
    if payload.get("order_type") == "delivery":
        if not payload.get("building_code") or not (payload.get("room_detail") or "").strip():
            missing.append("tòa nhà NEU và phòng/vị trí nhận cụ thể")
        else:
            location = db.query(CampusLocation).filter_by(
                building_code=payload["building_code"].upper(), is_active=True).first()
            if not location:
                raise OrderError("Địa điểm không hợp lệ hoặc đã tạm ngưng", "EX-07")
    if payload.get("is_preorder") and not payload.get("scheduled_at"):
        missing.append("ngày giờ hẹn có múi giờ Việt Nam")
    if missing:
        return None, missing
    data = {key: payload.get(key) for key in (
        "order_type", "recipient_name", "recipient_phone", "room_detail", "delivery_note",
        "payment_method", "is_preorder", "scheduled_at", "items")}
    data["campus_location_id"] = location.id if location else None
    if not data["is_preorder"]:
        data["scheduled_at"] = None
    if data["order_type"] == "pickup":
        data["room_detail"] = None
    dto = OrderCreateRequest.model_validate(data)
    args = dto.model_dump(exclude={"items"})
    args["items_data"] = [item.model_dump() for item in dto.items]
    return args, []


def order_summary(order):
    return {
        "items": [{"dish_id": i.dish_id, "name": i.dish_name, "quantity": i.quantity,
                   "unit_price": str(i.unit_price), "subtotal": str(i.subtotal), "note": i.note, "portions": i.portions or []}
                  for i in order.items],
        "recipient_name": order.recipient_name, "recipient_phone": order.recipient_phone,
        "order_type": order.order_type, "delivery_address": order.delivery_address,
        "delivery_note": order.delivery_note, "payment_method": order.payment_method,
        "scheduled_at": order.scheduled_at.isoformat() if order.scheduled_at else None,
        "subtotal": str(order.subtotal_amount), "ship_fee": str(order.ship_fee),
        "total_amount": str(order.total_amount),
    }


def preview(db, user_id, args):
    # Validate through Orders without persisting an Order or starting its SLA.
    savepoint = db.begin_nested()
    try:
        order = create_order(db=db, user_id=user_id, **args)
        return order_summary(order)
    finally:
        savepoint.rollback()


def draft_action(draft, action_type="ORDER_CONFIRMATION"):
    return {"type": action_type, "draft_id": draft.id, "revision": draft.revision,
            "expires_at": aware(draft.expires_at).isoformat(), "summary": draft.quote,
            "recipient": {key: draft.payload.get(key) or "" for key in ("recipient_name", "recipient_phone")}}


def summary_text(summary):
    money = lambda value: f"{float(value):,.0f}đ".replace(",", ".")
    lines = ["**Bạn kiểm tra và xác nhận đơn này nhé:**"]
    for item in summary["items"]:
        lines.append(f"- {item['name']} × {item['quantity']}: {money(item['unit_price'])}/phần = {money(item['subtotal'])}; ghi chú: {item['note'] or 'Không có'}")
    scheduled = summary["scheduled_at"]
    if scheduled:
        scheduled = datetime.fromisoformat(scheduled).astimezone(timezone(timedelta(hours=7))).strftime("%H:%M %d/%m/%Y (giờ Việt Nam)")
    lines += [f"- Người nhận: {summary['recipient_name']} — {summary['recipient_phone']}",
              f"- {'Giao tận nơi' if summary['order_type'] == 'delivery' else 'Nhận tại quầy'}: {summary['delivery_address']}",
              f"- Thời gian: {scheduled or 'Làm ngay'}",
              f"- Thanh toán khi nhận: {'Tiền mặt' if summary['payment_method'] == 'cod_cash' else 'VietQR'}",
              f"- Lưu ý giao hàng: {summary['delivery_note'] or 'Không có'}",
              f"- Tiền món: {money(summary['subtotal'])}; phí giao: {money(summary['ship_fee'])}",
              f"**Tổng COD: {money(summary['total_amount'])}** (giá món đã gồm phí hệ thống)",
              "Bấm Xác nhận đặt đơn hoặc nhắn ‘đồng ý đặt đơn’. Bạn cũng có thể sửa hoặc bỏ đơn nháp."]
    return "\n".join(lines)


def prepare_draft(db, user, session_id, changes):
    if user.is_blacklisted:
        raise OrderError("Tài khoản đang bị Blacklist COD", "EX-10", 403)
    update = DraftUpdate.model_validate(changes).model_dump(exclude_unset=True)
    if any(selection.get("addon_ids") for item in update.get("items") or []
           for selection in item.get("portions", [])):
        raise OrderError("Vui lòng chọn phần thêm tại trang chi tiết món ăn.", "CHAT_PORTIONS_UNSUPPORTED", 409)
    draft = current_draft(db, user.id, session_id)
    if not draft or draft.order_id or aware(draft.expires_at) <= now():
        draft = ChatOrderDraft(id=uuid.uuid4().hex, user_id=user.id, session_id=session_id,
                              payload={}, revision=0, expires_at=now())
        db.add(draft)
    payload = dict(draft.payload)
    if (type(update.get("order_for_self")) is bool
            and update["order_for_self"] != payload.get("order_for_self")):
        for key in ("recipient_name", "recipient_phone"):
            payload.pop(key, None)
    payload.update(update)
    if payload.get("order_for_self") is None:
        payload["order_for_self"] = True
    for key, value in {"payment_method": "cod_cash", "is_preorder": False,
                       "notes_confirmed": True}.items():
        if payload.get(key) is None:
            payload[key] = value
    if payload.get("order_for_self") is True:
        pref = db.get(ChatDeliveryPreference, user.id)
        defaults = {**(pref.details if pref else {}), "recipient_name": user.full_name,
                    "recipient_phone": user.phone_number}
        for key, value in defaults.items():
            if value and (key in ("recipient_name", "recipient_phone") or not payload.get(key)):
                if key != "recipient_phone" or re.fullmatch(r"0[35789][0-9]{8}", value):
                    payload[key] = value
    draft.payload = payload
    draft.revision += 1
    draft.quote = None
    draft.expires_at = now() + timedelta(minutes=30)
    db.flush()
    args, missing = order_args(db, payload)
    if missing:
        recipient = payload.get("recipient_name") or "chưa có tên"
        phone = payload.get("recipient_phone") or "chưa có SĐT"
        return (f"Người nhận: {recipient} — {phone}. Bạn có thể bấm Sửa thông tin đặt hàng nếu đặt hộ.\n"
                + "Bạn cho mình biết thêm: " + "; ".join(missing) + ".", draft_action(draft, "ORDER_COLLECTING"))
    draft.quote = preview(db, user.id, args)
    db.flush()
    return summary_text(draft.quote), draft_action(draft)


def confirm_draft(db, user, session_id, draft_id, revision):
    draft = db.query(ChatOrderDraft).filter_by(id=draft_id, user_id=user.id, session_id=session_id).populate_existing().with_for_update().first()
    if not draft or draft.revision != revision:
        raise OrderError("Bản xác nhận đã thay đổi. Vui lòng xem lại đơn mới nhất.", "STALE_DRAFT", 409)
    if draft.order_id:
        return created_action(db.get(Order, draft.order_id))
    if aware(draft.expires_at) <= now() or not draft.quote:
        raise OrderError("Đơn nháp đã hết hạn hoặc chưa đủ thông tin. Vui lòng kiểm tra lại.", "DRAFT_EXPIRED", 409)
    args, missing = order_args(db, draft.payload)
    if missing:
        raise OrderError("Đơn chưa đủ thông tin", "INCOMPLETE_DRAFT", 409)
    savepoint = db.begin_nested()
    try:
        order = create_order(db=db, user_id=user.id, **args)
        actual = order_summary(order)
        if actual != draft.quote:
            savepoint.rollback()
            draft.quote = actual
            draft.revision += 1
            draft.expires_at = now() + timedelta(minutes=30)
            db.flush()
            return "Thông tin/giá đã thay đổi, vui lòng xác nhận lại.\n" + summary_text(actual), draft_action(draft)
        draft.order_id = order.id
        if draft.payload["order_for_self"]:
            pref = db.get(ChatDeliveryPreference, user.id)
            details = {k: draft.payload.get(k) for k in ("recipient_name", "recipient_phone")}
            if order.order_type == "delivery":
                details.update({k: draft.payload.get(k) for k in ("building_code", "room_detail")})
            elif pref:
                details.update({k: pref.details.get(k) for k in ("building_code", "room_detail")})
            if pref:
                pref.details = details
            else:
                db.add(ChatDeliveryPreference(user_id=user.id, details=details))
        db.flush()
        result = created_action(order)
        savepoint.commit()
        return result
    except Exception:
        if savepoint.is_active:
            savepoint.rollback()
        raise


def created_action(order):
    summary = order_summary(order)
    summary.update(id=order.id, order_code_suffix=order.order_code_suffix, status=order.status,
                   status_label="Đang chờ Canteen A2 xác nhận" if order.status == "CHO_XAC_NHAN" else order.status,
                   eta=order.eta)
    return (f"Đơn **{order.id}** đã được tạo. Mã nhận hàng: **{order.order_code_suffix}**. "
            f"Trạng thái: {summary['status_label']}. Thanh toán COD khi nhận hàng.",
            {"type": "ORDER_CREATED", "order": summary})


def discard_draft(db, user_id, session_id):
    db.query(ChatOrderDraft).filter_by(user_id=user_id, session_id=session_id, order_id=None).update(
        {ChatOrderDraft.quote: None, ChatOrderDraft.expires_at: now(), ChatOrderDraft.revision: ChatOrderDraft.revision + 1},
        synchronize_session=False)
