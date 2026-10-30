from flask import Blueprint, request, g
from pydantic import ValidationError

from app.db.session import get_db
from app.crud.review import get_reviews_by_dish, create_review, ReviewError
from app.core.security import role_required
from app.schemas.review import ReviewCreateRequest
from app.utils.helpers import api_response

review_bp = Blueprint("reviews", __name__, url_prefix="/reviews")


def _serialize_review(r) -> dict:
    return {
        "id": r.id,
        "order_id": r.order_id,
        "dish_id": r.dish_id,
        "user_id": r.user_id,
        "user_name": r.user.full_name if r.user else "Sinh viên NEU",
        "rating": r.rating,
        "comment": r.comment,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@review_bp.route("/dish/<dish_id>", methods=["GET"])
def list_dish_reviews(dish_id: str):
    """
    Lấy danh sách đánh giá theo món ăn (UC14).
    """
    with get_db() as db:
        reviews = get_reviews_by_dish(db, dish_id)
        data = [_serialize_review(r) for r in reviews]
        return api_response(data=data)


@review_bp.route("", methods=["POST"])
@role_required("customer")
def submit_review():
    """
    Tạo đánh giá món ăn cho đơn hàng đã giao/hoàn thành (UC14).
    """
    try:
        user_id = int(g.current_user["sub"])
    except (KeyError, TypeError, ValueError):
        return api_response(message="Phiên đăng nhập không hợp lệ", status_code=401, success=False)

    try:
        data = ReviewCreateRequest.model_validate(request.get_json(silent=True))
    except ValidationError as e:
        return api_response(
            message="Dữ liệu đánh giá không hợp lệ",
            errors=e.errors(include_context=False),
            status_code=422,
            success=False,
        )

    try:
        with get_db() as db:
            review = create_review(
                db=db,
                user_id=user_id,
                order_id=data.order_id,
                dish_id=data.dish_id,
                rating=data.rating,
                comment=data.comment,
            )
            return api_response(
                data=_serialize_review(review),
                message="Đánh giá món ăn thành công",
                status_code=201,
            )
    except ReviewError as e:
        return api_response(message=str(e), errors=[{"code": e.code}], status_code=e.status_code, success=False)

