from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.db.models import Category, Dish, DishBadge, OrderItem


SYSTEM_FEE = Decimal("5000")


def get_system_maintenance_fee(db: Session) -> Decimal:
    """
    Đọc phụ phí bảo trì hệ thống (system_maintenance_fee) từ bảng system_settings
    theo BR-12; fallback về Decimal('5000') nếu chưa được cấu hình hoặc lỗi parse.
    """
    try:
        from app.crud.setting import get_setting_by_key
        fee_str = get_setting_by_key(db, "system_maintenance_fee", "5000")
        return Decimal(str(fee_str))
    except Exception:
        return Decimal("5000")


class UnknownCategoryIds(ValueError):
    def __init__(self, category_ids: List[str]):
        self.category_ids = category_ids
        super().__init__(f"Danh mục không hợp lệ: {', '.join(category_ids)}")


def get_categories(db: Session) -> List[Category]:
    return (
        db.query(Category)
        .filter(Category.is_active.is_(True))
        .order_by(Category.display_order.asc(), Category.id.asc())
        .all()
    )


def get_dishes(
    db: Session,
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> Tuple[List[Dish], int]:
    """Return active, non-deleted dishes with optional category/search filters."""
    query = db.query(Dish).filter(Dish.is_deleted.is_(False), Dish.is_active.is_(True))

    if category_id and category_id != "all":
        query = query.filter(
            Dish.categories.any(
                and_(Category.id == category_id, Category.is_active.is_(True))
            )
        )

    if search and search.strip():
        search_filter = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Dish.name.ilike(search_filter),
                Dish.short_description.ilike(search_filter),
                Dish.description.ilike(search_filter),
            )
        )

    total = query.count()
    items = (
        query.order_by(Dish.name.asc(), Dish.id.asc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return items, total


def get_dish_by_id(
    db: Session, dish_id: str, include_deleted: bool = False
) -> Optional[Dish]:
    query = db.query(Dish).filter(Dish.id == dish_id)
    if not include_deleted:
        query = query.filter(Dish.is_deleted.is_(False))
    return query.first()


def validate_category_ids(db: Session, category_ids: List[str]) -> None:
    requested_ids = set(category_ids)
    if not requested_ids:
        return

    valid_ids = {
        category_id
        for (category_id,) in db.query(Category.id)
        .filter(Category.id.in_(requested_ids), Category.is_active.is_(True))
        .all()
    }
    invalid_ids = sorted(requested_ids - valid_ids)
    if invalid_ids:
        raise UnknownCategoryIds(invalid_ids)


def create_dish(db: Session, data: dict) -> Dish:
    """Create a dish using the dynamic BR-12 system fee and calculated listing price."""
    values = data.copy()
    category_ids = values.pop("category_ids", [])
    badges = values.pop("badges", [])
    validate_category_ids(db, category_ids)

    system_fee = get_system_maintenance_fee(db)
    base_price = Decimal(str(values.pop("base_price")))
    values["base_price"] = base_price
    values["system_fee"] = system_fee
    values["price"] = base_price + system_fee

    dish = Dish(**values)
    if category_ids:
        dish.categories = (
            db.query(Category)
            .filter(Category.id.in_(set(category_ids)), Category.is_active.is_(True))
            .all()
        )
    dish.badges = [DishBadge(badge=badge) for badge in dict.fromkeys(badges)]
    db.add(dish)
    db.flush()
    db.refresh(dish)
    return dish


def update_dish(db: Session, dish: Dish, update_data: dict) -> Dish:
    values = update_data.copy()
    category_ids = values.pop("category_ids", None)
    badges = values.pop("badges", None)

    if category_ids is not None:
        validate_category_ids(db, category_ids)
        dish.categories = (
            db.query(Category)
            .filter(Category.id.in_(set(category_ids)), Category.is_active.is_(True))
            .all()
            if category_ids
            else []
        )

    for field, value in values.items():
        setattr(dish, field, value)

    if "base_price" in values:
        dish.base_price = Decimal(str(dish.base_price))
        system_fee = get_system_maintenance_fee(db)
        dish.system_fee = system_fee
        dish.price = dish.base_price + system_fee

    if badges is not None:
        dish.badges = [DishBadge(badge=badge) for badge in dict.fromkeys(badges)]

    db.flush()
    db.refresh(dish)
    return dish


def get_cart_unavailable_dishes(db: Session, dish_ids: List[str]) -> List[Dict[str, str]]:
    """Return every cart item that cannot currently be ordered (BR-06 / EX-05)."""
    unique_ids = list(dict.fromkeys(dish_ids))
    dishes = {
        dish.id: dish
        for dish in db.query(Dish).filter(Dish.id.in_(unique_ids)).all()
    }

    unavailable = []
    for dish_id in unique_ids:
        dish = dishes.get(dish_id)
        if dish is None:
            unavailable.append(
                {"id": dish_id, "name": dish_id, "reason": "Không tìm thấy món ăn"}
            )
        elif dish.is_deleted or not dish.is_active:
            unavailable.append(
                {"id": dish.id, "name": dish.name, "reason": "Món không còn được phục vụ"}
            )
        elif not dish.is_available:
            unavailable.append(
                {"id": dish.id, "name": dish.name, "reason": "Món đã hết hàng trong ngày"}
            )
    return unavailable


def set_dish_availability(db: Session, dish: Dish, is_available: bool) -> Dish:
    dish.is_available = is_available
    db.flush()
    db.refresh(dish)
    return dish


def delete_dish(db: Session, dish: Dish) -> bool:
    """Soft-delete dishes with order history; hard-delete unused dishes (BR-04)."""
    has_orders = (
        db.query(OrderItem.id)
        .filter(OrderItem.dish_id == dish.id)
        .first()
        is not None
    )
    if has_orders:
        dish.is_deleted = True
        dish.is_active = False
        dish.is_available = False
        db.flush()
        return True

    db.delete(dish)
    db.flush()
    return False
