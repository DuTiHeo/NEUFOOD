import secrets
import time
from collections import Counter
from datetime import datetime, time as clock_time, timedelta, timezone
from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from app.db.models import Order, OrderItem, Dish, CampusLocation, User
from app.crud.setting import get_setting_by_key, get_setting_int


ACTIVE_ORDER_STATUSES = (
    "CHO_XAC_NHAN", "DANG_CHUAN_BI", "DANG_GIAO", "SAN_SANG_LAY", "GIAO_THAT_BAI",
)


class OrderCreationError(ValueError):
    def __init__(self, message: str, code: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


def generate_order_id() -> str:
    return f"NF{time.time_ns()}{secrets.randbelow(10000):04d}"


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
        raise OrderCreationError("Tài khoản không có quyền đặt hàng", "FORBIDDEN", 403)
    if user.is_blacklisted:
        raise OrderCreationError(
            "Tài khoản của bạn đã bị khóa tính năng đặt hàng do vi phạm chính sách nhận hàng/thanh toán COD. Vui lòng liên hệ Admin để giải quyết",
            "EX-10", 403,
        )
    if db.query(Order.id).filter(Order.user_id == user_id, Order.status.in_(ACTIVE_ORDER_STATUSES)).first():
        raise OrderCreationError(
            "Bạn đang có một đơn hàng chưa hoàn tất. Vui lòng hoàn thành đơn hiện tại trước khi đặt đơn mới",
            "EX-09",
        )

    if order_type not in ("delivery", "pickup") or payment_method not in ("cod_cash", "cod_vietqr"):
        raise OrderCreationError("Phương thức nhận hàng hoặc thanh toán không hợp lệ", "INVALID_ORDER")

    now = datetime.now(timezone.utc)
    if is_preorder:
        lead_minutes = max(30, get_setting_int(db, "min_preorder_lead_minutes", 30))
        if (scheduled_at is None or scheduled_at.utcoffset() is None
                or scheduled_at < now + timedelta(minutes=lead_minutes)):
            raise OrderCreationError(
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
            raise OrderCreationError("Giờ hẹn phải nằm trong khung giờ mở cửa của Canteen", "EX-08")
    elif scheduled_at is not None:
        raise OrderCreationError("Chỉ gửi scheduled_at khi đặt hẹn giờ", "EX-08")

    quantities = Counter()
    max_quantity = min(10, get_setting_int(db, "max_dish_quantity_per_order", 10))
    if not items_data:
        raise OrderCreationError("Đơn hàng phải có ít nhất một món", "EX-05")
    for item in items_data:
        quantity = item["quantity"]
        if type(quantity) is not int or quantity < 1:
            raise OrderCreationError("Số lượng phải là số nguyên dương", "EX-06")
        quantities[item["dish_id"]] += quantity
        if quantities[item["dish_id"]] > max_quantity:
            raise OrderCreationError(f"Số lượng tối đa cho mỗi món là {max_quantity} phần", "EX-06")

    dishes = {
        dish.id: dish for dish in db.query(Dish).filter(Dish.id.in_(quantities))
        .order_by(Dish.id).populate_existing().with_for_update(read=True).all()
    }
    for dish_id in quantities:
        dish = dishes.get(dish_id)
        if not dish or not dish.is_available or not dish.is_active or dish.is_deleted:
            raise OrderCreationError("Món đã hết hàng hoặc không còn được phục vụ", "EX-05")
        if (not dish.price.is_finite() or not dish.base_price.is_finite()
                or dish.price < 0 or dish.base_price < 0):
            raise OrderCreationError("Giá món ăn không hợp lệ", "EX-05")

    ship_fee = Decimal(get_setting_int(db, "delivery_fee", 5000)) if order_type == "delivery" else Decimal(0)
    resolved_address = "Quầy trả món Canteen A2"
    if order_type == "delivery":
        loc = db.query(CampusLocation).filter(CampusLocation.id == campus_location_id).populate_existing().with_for_update(read=True).first()
        if not loc or not loc.is_active:
            raise OrderCreationError("Vui lòng chọn địa điểm giao hàng nội khu NEU hợp lệ", "EX-07")
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
        raise OrderCreationError(
            f"Đơn hàng COD không được vượt quá {max_cod:,.0f} VNĐ. Vui lòng giảm số lượng món", "EX-11",
        )

    order_id = generate_order_id()
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


def get_order_by_id(db: Session, order_id: str) -> Optional[Order]:
    return db.query(Order).filter(Order.id == order_id).first()


def get_user_orders(db: Session, user_id: int) -> List[Order]:
    return db.query(Order).filter(Order.user_id == user_id).order_by(Order.created_at.desc()).all()


def get_all_orders(
    db: Session,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> Tuple[List[Order], int]:
    query = db.query(Order)
    if status and status != "all":
        query = query.filter(Order.status == status)
    total = query.count()
    items = query.order_by(Order.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return items, total


def update_order_status(
    db: Session, order: Order, new_status: str, cancelled_reason: Optional[str] = None
) -> Order:
    order.status = new_status
    if cancelled_reason is not None:
        order.cancelled_reason = cancelled_reason
    db.commit()
    db.refresh(order)
    return order
