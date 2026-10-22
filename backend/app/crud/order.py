import secrets
import time
from collections import Counter
from datetime import datetime, time as clock_time, timedelta, timezone
from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from app.db.models import Order, OrderItem, Dish, CampusLocation, User, Complaint
from app.crud.setting import get_setting_by_key, get_setting_int


ACTIVE_ORDER_STATUSES = (
    "CHO_XAC_NHAN", "DANG_CHUAN_BI", "DANG_GIAO", "SAN_SANG_LAY", "GIAO_THAT_BAI",
)


class OrderError(ValueError):
    def __init__(self, message: str, code: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


def generate_order_id(db: Optional[Session] = None) -> str:
    """
    Sinh mã đơn hàng theo BR-18: NF + YYMMDD + 4 chữ số ngẫu nhiên (Ví dụ: NF2610153456, 12 ký tự).
    """
    yymmdd = datetime.now().strftime("%y%m%d")
    for _ in range(10):
        candidate = f"NF{yymmdd}{secrets.randbelow(10000):04d}"
        if db is None or not db.query(Order.id).filter(Order.id == candidate).first():
            return candidate
    return f"NF{yymmdd}{secrets.randbelow(10000):04d}"


def create_order(
    db: Session,
    user_id: Optional[int],
    order_type: str,
    recipient_name: str,
    recipient_phone: str,
    campus_location_id: Optional[int],
    room_detail: Optional[str],
    delivery_address: Optional[str],
    delivery_note: Optional[str],
    is_preorder: bool,
    scheduled_at,
    payment_method: str,
    items_data: list,
) -> Order:
    """Tạo COD nguyên tử; caller commit/rollback qua get_db()."""
    # Khóa khách thay vì khóa đơn: khách chưa có đơn vẫn cần chống hai request đồng thời.
    user = db.query(User).filter(User.id == user_id).populate_existing().with_for_update().first()
    if not user or not user.is_active or user.role != "customer":
        raise OrderError("Tài khoản không có quyền đặt hàng", "FORBIDDEN", 403)
    if user.is_blacklisted:
        raise OrderError(
            "Tài khoản của bạn đã bị khóa tính năng đặt hàng do vi phạm chính sách nhận hàng/thanh toán COD. Vui lòng liên hệ Admin để giải quyết",
            "EX-10", 403,
        )
    sync_overdue_orders(db, user_id=user_id)
    if db.query(Order.id).filter(Order.user_id == user_id, Order.status.in_(ACTIVE_ORDER_STATUSES)).first():
        raise OrderError(
            "Bạn đang có một đơn hàng chưa hoàn tất. Vui lòng hoàn thành đơn hiện tại trước khi đặt đơn mới",
            "EX-09",
        )

    if order_type not in ("delivery", "pickup") or payment_method not in ("cod_cash", "cod_vietqr"):
        raise OrderError("Phương thức nhận hàng hoặc thanh toán không hợp lệ", "INVALID_ORDER")

    now = datetime.now(timezone.utc)
    if is_preorder:
        lead_minutes = max(30, get_setting_int(db, "min_preorder_lead_minutes", 30))
        if (scheduled_at is None or scheduled_at.utcoffset() is None
                or scheduled_at < now + timedelta(minutes=lead_minutes)):
            raise OrderError(
                f"Đơn hẹn trước phải cách thời điểm hiện tại tối thiểu {lead_minutes} phút", "EX-08",
            )
        scheduled_at = scheduled_at.astimezone(timezone.utc)
        local_time = scheduled_at.astimezone(timezone(timedelta(hours=7))).time()
        open_time = clock_time.fromisoformat(get_setting_by_key(db, "canteen_open_time", "06:30"))
        close_time = clock_time.fromisoformat(get_setting_by_key(db, "canteen_close_time", "19:30"))
        if open_time < close_time:
            is_open = open_time <= local_time < close_time
        else:
            is_open = open_time != close_time and (local_time >= open_time or local_time < close_time)
        if not is_open:
            raise OrderError("Giờ hẹn phải nằm trong khung giờ mở cửa của Canteen", "EX-08")
    elif scheduled_at is not None:
        raise OrderError("Chỉ gửi scheduled_at khi đặt hẹn giờ", "EX-08")

    quantities = Counter()
    max_quantity = min(10, get_setting_int(db, "max_dish_quantity_per_order", 10))
    if not items_data:
        raise OrderError("Đơn hàng phải có ít nhất một món", "EX-05")
    for item in items_data:
        quantity = item["quantity"]
        if type(quantity) is not int or quantity < 1:
            raise OrderError("Số lượng phải là số nguyên dương", "EX-06")
        quantities[item["dish_id"]] += quantity
        if quantities[item["dish_id"]] > max_quantity:
            raise OrderError(f"Số lượng tối đa cho mỗi món là {max_quantity} phần", "EX-06")

    dishes = {
        dish.id: dish for dish in db.query(Dish).filter(Dish.id.in_(quantities))
        .order_by(Dish.id).populate_existing().with_for_update(read=True).all()
    }
    for dish_id in quantities:
        dish = dishes.get(dish_id)
        if not dish or not dish.is_available or not dish.is_active or dish.is_deleted:
            raise OrderError("Món đã hết hàng hoặc không còn được phục vụ", "EX-05")
        if (not dish.price.is_finite() or not dish.base_price.is_finite()
                or dish.price < 0 or dish.base_price < 0):
            raise OrderError("Giá món ăn không hợp lệ", "EX-05")

    ship_fee = Decimal(get_setting_int(db, "delivery_fee", 5000)) if order_type == "delivery" else Decimal(0)
    resolved_address = "Quầy trả món Canteen A2"
    if order_type == "delivery":
        loc = db.query(CampusLocation).filter(CampusLocation.id == campus_location_id).populate_existing().with_for_update(read=True).first()
        if not loc or not loc.is_active:
            raise OrderError("Vui lòng chọn địa điểm giao hàng nội khu NEU hợp lệ", "EX-07")
        prefix = f"{room_detail}, " if room_detail else ""
        resolved_address = f"{prefix}{loc.building_name}, Đại học Kinh tế Quốc dân"
    else:
        campus_location_id = None
        room_detail = None

    subtotal_amount = sum((dishes[key].price * quantity for key, quantity in quantities.items()), Decimal(0))
    total_amount = subtotal_amount + ship_fee
    # Hai trần vẫn được bảo vệ bởi CHECK của schema PostgreSQL hiện hành.
    max_cod = min(500000, get_setting_int(db, "max_cod_amount", 500000))
    if ship_fee < 0 or total_amount > max_cod:
        raise OrderError(
            f"Đơn hàng COD không được vượt quá {max_cod:,.0f} VNĐ. Vui lòng giảm số lượng món", "EX-11",
        )

    order_id = generate_order_id(db)
    order_code_suffix = order_id[-4:]

    order = Order(
        id=order_id,
        order_code_suffix=order_code_suffix,
        user_id=user_id,
        order_type=order_type,
        recipient_name=recipient_name,
        recipient_phone=recipient_phone,
        campus_location_id=campus_location_id,
        room_detail=room_detail,
        delivery_address=resolved_address,
        delivery_note=delivery_note,
        is_preorder=is_preorder,
        scheduled_at=scheduled_at,
        status="CHO_XAC_NHAN",
        subtotal_amount=subtotal_amount,
        ship_fee=ship_fee,
        total_amount=total_amount,
        payment_method=payment_method,
        payment_status="chua_thanh_toan",
        eta="15 - 25 phút" if order_type == "delivery" else "10 - 15 phút",
        created_at=now,
    )
    db.add(order)

    for item in items_data:
        dish = dishes[item["dish_id"]]
        dish_name = dish.name
        unit_price = dish.price
        base_price = dish.base_price
        quantity = item["quantity"]
        subtotal = unit_price * quantity

        order_item = OrderItem(
            order_id=order_id,
            dish_id=item["dish_id"],
            dish_name=dish_name,
            unit_price=unit_price,
            base_price=base_price,
            quantity=quantity,
            note=item.get("note"),
            subtotal=subtotal,
        )
        db.add(order_item)

    db.flush()
    return order


def cancel_order(db: Session, order_id: str, user_id: int) -> Order:
    """UC12: chỉ chủ đơn còn chờ xác nhận được hủy; caller quản lý giao dịch."""
    user = db.query(User).filter(User.id == user_id).with_for_update(read=True).first()
    if not user or not user.is_active or user.role != "customer":
        raise OrderError("Tài khoản không có quyền hủy đơn", "FORBIDDEN", 403)
    order = db.query(Order).filter(
        Order.id == order_id, Order.user_id == user_id,
    ).populate_existing().with_for_update().first()
    if not order:
        raise OrderError("Không tìm thấy đơn hàng", "NOT_FOUND", 404)
    sync_overdue_orders(db, order_id=order.id)
    if order.status != "CHO_XAC_NHAN":
        message = ("Bếp đã bắt đầu nấu đơn hàng của bạn, không thể hủy đơn vào lúc này"
                   if order.status == "DANG_CHUAN_BI" else "Chỉ được hủy đơn khi đang chờ xác nhận")
        raise OrderError(message, "EX-12")
    order.status = "DA_HUY_KHACH"
    db.flush()
    return order


def sync_overdue_orders(db: Session, user_id: Optional[int] = None, order_id: Optional[str] = None):
    """BR16/EX13: đồng bộ tự hủy và hoàn tất khi truy cập, trong giao dịch caller."""
    timeout = max(1, get_setting_int(db, "order_timeout_minutes", 10))
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=timeout)
    query = db.query(Order)
    if user_id is not None:
        query = query.filter(Order.user_id == user_id)
    if order_id is not None:
        query = query.filter(Order.id == order_id)
    query.filter(Order.status == "CHO_XAC_NHAN", Order.created_at < cutoff).update(
        {Order.status: "TU_DONG_HUY", Order.cancelled_reason: "Canteen không xác nhận đơn trong thời hạn"},
        synchronize_session="fetch",
    )
    candidates = query.filter(
        Order.status.in_(("DA_GIAO", "DA_BAN_GIAO")), Order.payment_status == "da_thanh_toan",
        Order.delivered_at.isnot(None), Order.auto_complete_at <= now, ~Order.complaint.has(),
    ).order_by(Order.id).populate_existing().with_for_update(skip_locked=True).all()
    for order in candidates:
        # Kiểm tra lại sau khóa để thấy khiếu nại đã commit trong lúc chờ xử lý.
        if not db.query(Complaint.id).filter(Complaint.order_id == order.id).first():
            order.status = "HOAN_THANH"
            order.completed_at = now
    if candidates:
        db.flush()


def confirm_order_receipt(db: Session, order_id: str, user_id: int) -> Order:
    user = db.query(User).filter(User.id == user_id).with_for_update(read=True).first()
    if not user or not user.is_active or user.role != "customer":
        raise OrderError("Tài khoản không có quyền xác nhận nhận hàng", "FORBIDDEN", 403)
    order = db.query(Order).filter(
        Order.id == order_id, Order.user_id == user_id,
    ).populate_existing().with_for_update().first()
    if not order:
        raise OrderError("Không tìm thấy đơn hàng", "NOT_FOUND", 404)
    if (order.status not in ("DA_GIAO", "DA_BAN_GIAO", "HOAN_THANH")
            or order.payment_status != "da_thanh_toan" or order.delivered_at is None
            or db.query(Complaint.id).filter(Complaint.order_id == order.id).first()):
        raise OrderError("Chỉ được xác nhận đơn đã bàn giao, thanh toán và không có khiếu nại", "EX-13")
    if order.status != "HOAN_THANH":
        order.status = "HOAN_THANH"
        order.completed_at = datetime.now(timezone.utc)
        db.flush()
    return order


def get_order_by_id(db: Session, order_id: str) -> Optional[Order]:
    sync_overdue_orders(db, order_id=order_id)
    return db.query(Order).filter(Order.id == order_id).first()


def get_user_orders(db: Session, user_id: int) -> List[Order]:
    sync_overdue_orders(db, user_id=user_id)
    return db.query(Order).filter(Order.user_id == user_id).order_by(Order.created_at.desc()).all()


def get_all_orders(
    db: Session,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> Tuple[List[Order], int]:
    sync_overdue_orders(db)
    query = db.query(Order)
    if status and status != "all":
        query = query.filter(Order.status == status)
    total = query.count()
    items = query.order_by(Order.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return items, total


def update_order_status(
    db: Session, order: Order, new_status: str, cancelled_reason: Optional[str] = None,
    staff_id: Optional[int] = None,
) -> Order:
    # Đọc lại sau khi lấy khóa để không ghi đè đơn vừa được khách hủy.
    db.refresh(order, with_for_update=True)
    if order.status == "DA_HUY_KHACH" or new_status == "DA_HUY_KHACH":
        raise OrderError("Đơn đã hủy không thể cập nhật; khách hủy qua endpoint /cancel", "EX-12")
    actor = db.query(User).filter(User.id == staff_id).first()
    if not actor or not actor.is_active or actor.role not in ("staff", "manager"):
        raise OrderError("Tài khoản không có quyền vận hành đơn", "FORBIDDEN", 403)
    sync_overdue_orders(db, order_id=order.id)
    if order.status == "TU_DONG_HUY":
        raise OrderError("Đơn đã quá thời hạn xác nhận và đã tự động hủy", "EX-16")
    if order.status == "CHO_XAC_NHAN" and new_status in ("DANG_CHUAN_BI", "TU_CHOI"):
        if new_status == "TU_CHOI":
            if not (cancelled_reason or "").strip():
                raise OrderError("Cần nhập lý do từ chối đơn", "INVALID_REASON")
            order.cancelled_reason = cancelled_reason.strip()
        order.staff_id = staff_id
    elif order.status == "DANG_CHUAN_BI" and new_status == (
        "DANG_GIAO" if order.order_type == "delivery" else "SAN_SANG_LAY"
    ):
        if new_status == "SAN_SANG_LAY":
            hold_minutes = max(1, get_setting_int(db, "pickup_hold_minutes", 30))
            order.pickup_deadline = datetime.now(timezone.utc) + timedelta(minutes=hold_minutes)
    else:
        raise OrderError("Không được chuyển trạng thái đơn theo bước này", "INVALID_TRANSITION")
    order.status = new_status
    db.flush()
    return order


def _lock_delivery_order(db: Session, order_id: str, staff_id: int):
    actor = db.query(User).filter(User.id == staff_id).first()
    if not actor or not actor.is_active or actor.role not in ("staff", "manager"):
        raise OrderError("Tài khoản không có quyền bàn giao hoặc xử lý sự cố", "FORBIDDEN", 403)
    owner = db.query(Order.user_id).filter(Order.id == order_id).first()
    if owner is None:
        raise OrderError("Không tìm thấy đơn hàng", "NOT_FOUND", 404)
    # Cùng thứ tự khóa khách → đơn như tạo/hủy đơn để tránh deadlock.
    user = db.query(User).filter(User.id == owner[0]).populate_existing().with_for_update().first()
    order = db.query(Order).filter(Order.id == order_id).populate_existing().with_for_update().first()
    if not order:
        raise OrderError("Không tìm thấy đơn hàng", "NOT_FOUND", 404)
    return order, user


def _blacklist_abandoned_order(db: Session, order: Order, user: Optional[User], staff_id: int, reason: str, now):
    if user is None:
        raise OrderError("Đơn không còn tài khoản khách để ghi nhận Blacklist COD", "CUSTOMER_NOT_FOUND")
    order.status = "BO_DON_BLACKLIST"
    order.cancelled_reason = reason
    order.staff_id = staff_id
    if not user.is_blacklisted or user.blacklisted_at is None:
        user.blacklisted_at = now
    user.is_blacklisted = True
    user.blacklist_reason = reason
    db.flush()


def handover_order(db: Session, order_id: str, staff_id: int, order_code_suffix: str) -> Order:
    order, user = _lock_delivery_order(db, order_id, staff_id)
    if order.payment_status != "chua_thanh_toan" or not (
        (order.order_type == "delivery" and order.status in ("DANG_GIAO", "GIAO_THAT_BAI"))
        or (order.order_type == "pickup" and order.status == "SAN_SANG_LAY")
    ):
        raise OrderError("Đơn không ở trạng thái cho phép bàn giao COD", "INVALID_TRANSITION")
    now = datetime.now(timezone.utc)
    if order.status in ("SAN_SANG_LAY", "GIAO_THAT_BAI"):
        if order.pickup_deadline is None:
            raise OrderError("Đơn chưa có hạn nhận tại quầy hợp lệ", "EX-18")
        if now > order.pickup_deadline:
            _blacklist_abandoned_order(db, order, user, staff_id, "Khách quá hạn nhận món tại quầy", now)
            raise OrderError("Đã quá hạn nhận món; đơn bị đóng và tài khoản bị Blacklist COD", "EX-18")
    if not secrets.compare_digest(order.order_code_suffix, order_code_suffix):
        raise OrderError("Mã 4 số cuối không khớp. Vui lòng đọc đúng mã đơn trước khi bàn giao", "EX-17")
    order.status = "DA_GIAO" if order.status == "DANG_GIAO" else "DA_BAN_GIAO"
    order.payment_status = "da_thanh_toan"
    order.staff_id = staff_id
    order.delivered_at = now
    order.auto_complete_at = now + timedelta(minutes=max(1, get_setting_int(db, "auto_complete_minutes", 30)))
    db.flush()
    return order


def report_delivery_issue(db: Session, order_id: str, staff_id: int, issue_type: str, reason: str) -> Order:
    order, user = _lock_delivery_order(db, order_id, staff_id)
    if order.payment_status != "chua_thanh_toan" or not (
        (order.order_type == "delivery" and order.status in ("DANG_GIAO", "GIAO_THAT_BAI"))
        or (order.order_type == "pickup" and order.status == "SAN_SANG_LAY")
    ):
        raise OrderError("Đơn không ở trạng thái cho phép báo sự cố COD", "INVALID_TRANSITION")
    if not reason.strip():
        raise OrderError("Cần nhập lý do sự cố", "INVALID_REASON")
    now = datetime.now(timezone.utc)
    if issue_type == "no_answer":
        if order.status != "DANG_GIAO" or order.order_type != "delivery":
            raise OrderError("Chỉ đơn đang giao tận nơi được báo không liên lạc được", "EX-18")
        order.status = "GIAO_THAT_BAI"
        order.cancelled_reason = reason.strip()
        order.staff_id = staff_id
        order.pickup_deadline = now + timedelta(minutes=max(1, get_setting_int(db, "pickup_hold_minutes", 30)))
    elif issue_type == "pickup_timeout":
        if (order.status not in ("SAN_SANG_LAY", "GIAO_THAT_BAI")
                or order.pickup_deadline is None or now <= order.pickup_deadline):
            raise OrderError("Đơn chưa quá hạn nhận món tại quầy", "EX-18")
        _blacklist_abandoned_order(db, order, user, staff_id, reason.strip(), now)
    elif issue_type == "refuse_payment":
        _blacklist_abandoned_order(db, order, user, staff_id, reason.strip(), now)
    else:
        raise OrderError("Loại sự cố không hợp lệ", "INVALID_ISSUE")
    db.flush()
    return order