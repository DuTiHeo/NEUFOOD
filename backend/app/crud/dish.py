from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.db.models import Dish, Category, DishBadge, OrderItem


def get_categories(db: Session) -> List[Category]:
    return db.query(Category).filter(Category.is_active == True).order_by(Category.display_order.asc()).all()


def get_dishes(
    db: Session,
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> Tuple[List[Dish], int]:
    """Lấy danh sách món ăn chưa bị xóa mềm (BR-04)."""
    query = db.query(Dish).filter(Dish.is_deleted == False, Dish.is_active == True)

    if category_id and category_id != "all":
        query = query.filter(Dish.categories.any(Category.id == category_id))

    if search:
        search_filter = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Dish.name.ilike(search_filter),
                Dish.short_description.ilike(search_filter),
                Dish.description.ilike(search_filter),
            )
        )

    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()
    return items, total


def get_dish_by_id(db: Session, dish_id: str) -> Optional[Dish]:
    return db.query(Dish).filter(Dish.id == dish_id, Dish.is_deleted == False).first()


def create_dish(db: Session, data: dict) -> Dish:
    """
    Thêm món ăn mới và tự động tính price = base_price + system_fee (BR-12).
    """
    category_ids = data.pop("category_ids", [])
    badges = data.pop("badges", [])
    base_price = float(data.get("base_price", 0))
    system_fee = float(data.get("system_fee", 5000))
    data["base_price"] = base_price
    data["system_fee"] = system_fee
    data["price"] = base_price + system_fee

    dish = Dish(**data)
    if category_ids:
        categories = db.query(Category).filter(Category.id.in_(category_ids)).all()
        dish.categories = categories

    db.add(dish)
    db.commit()

    if badges:
        for b in badges:
            db.add(DishBadge(dish_id=dish.id, badge=b))
        db.commit()

    db.refresh(dish)
    return dish


def update_dish(db: Session, dish: Dish, update_data: dict) -> Dish:
    category_ids = update_data.pop("category_ids", None)
    badges = update_data.pop("badges", None)

    for field, value in update_data.items():
        if hasattr(dish, field) and value is not None:
            setattr(dish, field, value)

    if "base_price" in update_data or "system_fee" in update_data:
        dish.price = float(dish.base_price) + float(dish.system_fee)

    if category_ids is not None:
        categories = db.query(Category).filter(Category.id.in_(category_ids)).all()
        dish.categories = categories

    if badges is not None:
        db.query(DishBadge).filter(DishBadge.dish_id == dish.id).delete()
        for b in badges:
            db.add(DishBadge(dish_id=dish.id, badge=b))

    db.commit()
    db.refresh(dish)
    return dish


def delete_dish(db: Session, dish: Dish) -> bool:
    """
    Xóa hoặc ẩn món ăn theo BR-04 & EX-21:
    Nếu món đã từng xuất hiện trong order_items thì chỉ thực hiện Soft Delete (is_deleted = True).
    Trả về True nếu đã Soft Delete, False nếu xóa cứng.
    """
    has_orders = db.query(OrderItem).filter(OrderItem.dish_id == dish.id).first() is not None
    if has_orders:
        dish.is_deleted = True
        dish.is_active = False
        dish.is_available = False
        db.commit()
        return True

    db.delete(dish)
    db.commit()
    return False
