from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from app.db.models import Review, Order, OrderItem, Dish, User

REVIEWABLE_ORDER_STATUSES = ("DA_GIAO", "DA_BAN_GIAO", "HOAN_THANH")


class ReviewError(ValueError):
    """Lỗi nghiệp vụ của Reviews; route đọc code/status_code để trả response."""

    def __init__(self, message: str, code: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


def get_reviews_by_dish(db: Session, dish_id: str) -> List[Review]:
    """Lấy danh sách đánh giá của một món ăn (UC14). Dùng joinedload tránh N+1 truy vấn."""
    return (
        db.query(Review)
        .options(joinedload(Review.user))
        .filter(Review.dish_id == dish_id)
        .order_by(Review.created_at.desc(), Review.id.desc())
        .all()
    )


def create_review(
    db: Session, user_id: int, order_id: str, dish_id: str, rating: int, comment: Optional[str],
) -> Review:
    """UC14: khách đánh giá món trong đơn đã giao của chính mình. Caller quản lý commit/rollback."""
    if type(rating) is not int or not (1 <= rating <= 5):
        raise ReviewError("Số sao đánh giá phải là số nguyên từ 1 đến 5", "INVALID_RATING", 400)

    user = db.query(User).filter(User.id == user_id).with_for_update(read=True).first()
    if not user or not user.is_active or user.role != "customer":
        raise ReviewError("Tài khoản không có quyền đánh giá", "FORBIDDEN", 403)

    order = db.query(Order).filter(Order.id == order_id, Order.user_id == user_id).first()
    if not order:
        raise ReviewError("Không tìm thấy đơn hàng", "NOT_FOUND", 404)
    if order.status not in REVIEWABLE_ORDER_STATUSES:
        raise ReviewError("Chỉ được đánh giá đơn đã giao hoặc hoàn thành", "ORDER_NOT_REVIEWABLE")

    in_order = db.query(OrderItem.id).filter(
        OrderItem.order_id == order_id, OrderItem.dish_id == dish_id,
    ).first()
    if not in_order:
        raise ReviewError("Món ăn không thuộc đơn hàng này", "DISH_NOT_IN_ORDER")

    # Khóa dòng món: các review đồng thời cùng một món xếp hàng, nên kiểm tra trùng bên dưới là chính xác.
    dish = db.query(Dish).filter(Dish.id == dish_id).populate_existing().with_for_update().first()
    if not dish:
        raise ReviewError("Không tìm thấy món ăn", "NOT_FOUND", 404)

    if db.query(Review.id).filter(Review.order_id == order_id, Review.dish_id == dish_id).first():
        raise ReviewError("Bạn đã đánh giá món này trong đơn này rồi", "REVIEW_DUPLICATE")

    clean_comment = comment.strip() if comment else None
    review = Review(
        order_id=order_id, dish_id=dish_id, user_id=user_id,
        rating=rating, comment=clean_comment or None,
    )
    db.add(review)

    # Trung bình tăng dần: không phụ thuộc vào số review trong bảng, giữ nguyên rating/lượt đánh giá của seed.
    old_count = dish.review_count or 0
    if old_count == 0 or dish.rating is None:
        new_avg = Decimal(rating)
    else:
        new_avg = (Decimal(str(dish.rating)) * old_count + rating) / (old_count + 1)
    dish.rating = new_avg.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    dish.review_count = old_count + 1

    db.flush()
    return review

