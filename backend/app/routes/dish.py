from flask import Blueprint, request
from pydantic import ValidationError
from app.db.session import get_db
from app.crud.dish import (
    get_dishes, get_dish_by_id, create_dish, update_dish, delete_dish, get_categories
)
from app.core.security import role_required
from app.schemas.dish import DishCreateRequest, DishUpdateRequest
from app.utils.helpers import api_response

dish_bp = Blueprint("dishes", __name__, url_prefix="/dishes")


def _serialize_dish(d) -> dict:
    return {
        "id": d.id,
        "name": d.name,
        "short_description": d.short_description,
        "description": d.description,
        "base_price": float(d.base_price),
        "system_fee": float(d.system_fee),
        "price": float(d.price),
        "rating": float(d.rating) if d.rating else 5.0,
        "review_count": d.review_count,
        "image": d.image_url,
        "image_url": d.image_url,
        "is_available": d.is_available,
        "is_active": d.is_active,
        "category_ids": [c.id for c in d.categories],
        "categoryIds": [c.id for c in d.categories],
        "badges": [b.badge for b in d.badges],
    }


@dish_bp.route("/categories", methods=["GET"])
def list_categories():
    with get_db() as db:
        categories = get_categories(db)
        data = [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "display_order": c.display_order,
            }
            for c in categories
        ]
        return api_response(data=data)


@dish_bp.route("", methods=["GET"])
def list_dishes():
    category = request.args.get("category")
    search = request.args.get("search")
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 20))

    with get_db() as db:
        dishes, total = get_dishes(db, category_id=category, search=search, page=page, limit=limit)
        items = [_serialize_dish(d) for d in dishes]
        return api_response(data={"items": items, "total": total, "page": page, "limit": limit})


@dish_bp.route("/<dish_id>", methods=["GET"])
def get_dish(dish_id: str):
    with get_db() as db:
        dish = get_dish_by_id(db, dish_id)
        if not dish:
            return api_response(message="Không tìm thấy món ăn", status_code=404, success=False)
        return api_response(data=_serialize_dish(dish))


@dish_bp.route("", methods=["POST"])
@role_required("manager", "admin")
def add_dish():
    """
    Thêm món ăn mới (UC21, BR-12).
    TODO (Thành viên 2): Bổ sung PATCH /<dish_id>/availability (UC16), POST /validate-cart (EX-05) và POST /upload-image.
    """
    try:
        data = DishCreateRequest(**request.get_json(force=True))
    except ValidationError as e:
        return api_response(message="Dữ liệu món ăn không hợp lệ", errors=e.errors(), status_code=422, success=False)

    with get_db() as db:
        existing = get_dish_by_id(db, data.id)
        if existing:
            return api_response(message=f"Mã món '{data.id}' đã tồn tại", status_code=400, success=False)

        dish_dict = {
            "id": data.id,
            "name": data.name,
            "short_description": data.short_description,
            "description": data.description,
            "base_price": data.base_price,
            "system_fee": data.system_fee,
            "image_url": data.image_url,
            "is_available": data.is_available,
            "category_ids": data.category_ids,
            "badges": data.badges,
        }
        created = create_dish(db, dish_dict)
        return api_response(
            data=_serialize_dish(created),
            message="Thêm món ăn thành công",
            status_code=201,
        )


@dish_bp.route("/<dish_id>", methods=["PUT"])
@role_required("manager", "admin")
def edit_dish(dish_id: str):
    try:
        data = DishUpdateRequest(**request.get_json(force=True))
    except ValidationError as e:
        return api_response(message="Dữ liệu cập nhật không hợp lệ", errors=e.errors(), status_code=422, success=False)

    with get_db() as db:
        dish = get_dish_by_id(db, dish_id)
        if not dish:
            return api_response(message="Không tìm thấy món ăn", status_code=404, success=False)

        update_dict = data.model_dump(exclude_unset=True)
        updated = update_dish(db, dish, update_dict)
        return api_response(data=_serialize_dish(updated), message="Cập nhật món ăn thành công")


@dish_bp.route("/<dish_id>", methods=["DELETE"])
@role_required("manager", "admin")
def remove_dish(dish_id: str):
    with get_db() as db:
        dish = get_dish_by_id(db, dish_id)
        if not dish:
            return api_response(message="Không tìm thấy món ăn", status_code=404, success=False)
        was_soft_deleted = delete_dish(db, dish)
        if was_soft_deleted:
            return api_response(
                data={"id": dish_id, "soft_deleted": True},
                message="Món ăn đã có lịch sử đơn hàng, hệ thống đã chuyển sang trạng thái Ẩn/Ngừng kinh doanh (BR-04, EX-21)",
            )
        return api_response(data={"id": dish_id, "soft_deleted": False}, message="Đã xóa món ăn thành công")
