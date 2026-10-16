from typing import List
from sqlalchemy.orm import Session
from app.db.models import Review


def get_reviews_by_dish(db: Session, dish_id: str) -> List[Review]:
    """Lấy danh sách đánh giá của một món ăn (UC14)."""
    return db.query(Review).filter(Review.dish_id == dish_id).order_by(Review.created_at.desc()).all()
