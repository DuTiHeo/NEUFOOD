import random
import time
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from app.db.models import Order, OrderItem, Dish, CampusLocation


def generate_order_id() -> str:
    timestamp_part = str(int(time.time()))[-6:]
    random_part = random.randint(1000, 9999)
    return f"NF{timestamp_part}{random_part}"


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
    """
    Tạo đơn hàng COD chuẩn nghiệp vụ (UC10, BR-05, BR-13, BR-14, BR-18).
    TODO (Thành viên 3): Bổ sung kiểm tra Blacklist COD (BR-22, EX-10), tối đa 01 đơn hoạt động (BR-08, EX-09),
    hẹn trước >= 30p (BR-11, EX-08), và hạn mức COD <= 500.000đ (BR-14, EX-11).
    """
    order_id = generate_order_id()
    order_code_suffix = order_id[-4:]
    ship_fee = 5000.0 if order_type == "delivery" else 0.0

    resolved_address = delivery_address or "Quầy trả món Canteen A2, Đại học Kinh tế Quốc dân"
    if order_type == "delivery" and campus_location_id:
        loc = db.query(CampusLocation).filter(CampusLocation.id == campus_location_id).first()
        if loc and not delivery_address:
            prefix = f"{room_detail}, " if room_detail else ""
            resolved_address = f"{prefix}{loc.building_name}, Đại học Kinh tế Quốc dân"

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
        subtotal_amount=0,
        ship_fee=ship_fee,
        total_amount=0,
        payment_method=payment_method,
        payment_status="chua_thanh_toan",
        eta="15 - 25 phút" if order_type == "delivery" else "10 - 15 phút",
    )
    db.add(order)

    subtotal_amount = 0.0
    for item in items_data:
        dish = db.query(Dish).filter(Dish.id == item["dish_id"]).first()
        dish_name = dish.name if dish else item["dish_id"]
        unit_price = float(dish.price) if dish else 0.0
        base_price = float(dish.base_price) if dish else 0.0
        quantity = int(item["quantity"])
        subtotal = unit_price * quantity
        subtotal_amount += subtotal

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

    order.subtotal_amount = subtotal_amount
    order.total_amount = subtotal_amount + ship_fee
    db.commit()
    db.refresh(order)
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
