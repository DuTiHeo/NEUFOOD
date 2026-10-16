from flask import Blueprint
from app.db.session import get_db
from app.crud.review import get_reviews_by_dish
from app.utils.helpers import api_response

review_bp = Blueprint("reviews", __name__, url_prefix="/reviews")


@review_bp.route("/dish/<dish_id>", methods=["GET"])
def list_dish_reviews(dish_id: str):
    """
    Lấy danh sách đánh giá theo món ăn (UC14).
    TODO (Thành viên 4): Bổ sung POST /api/v1/reviews để khách gửi đánh giá và cập nhật lại dish.rating, dish.review_count.
    """
    with get_db() as db:
        reviews = get_reviews_by_dish(db, dish_id)
        data = [
            {
                "id": r.id,
                "order_id": r.order_id,
                "dish_id": r.dish_id,
                "user_id": r.user_id,
                "user_name": r.user.full_name if r.user else "Sinh viên NEU",
                "rating": r.rating,
                "comment": r.comment,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in reviews
        ]
        return api_response(data=data)
