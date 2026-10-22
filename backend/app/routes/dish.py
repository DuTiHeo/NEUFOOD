from flask import Blueprint, request
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from app.core.security import role_required
from app.crud.dish import (
    UnknownCategoryIds,
    create_dish,
    delete_dish,
    get_cart_unavailable_dishes,
    get_categories,
    get_dish_by_id,
    get_dishes,
    set_dish_availability,
    update_dish,
)
from app.crud.review import get_reviews_by_dish
from app.db.session import get_db
from app.schemas.dish import (
    CartValidateRequest,
    DishAvailabilityUpdateRequest,
    DishCreateRequest,
    DishUpdateRequest,
)
from app.utils.helpers import api_response, save_upload_file

dish_bp = Blueprint("dishes", __name__, url_prefix="/dishes")


def _serialize_review(review) -> dict:
    return {
        "id": review.id,
        "order_id": review.order_id,
        "dish_id": review.dish_id,
        "user_id": review.user_id,
        "user_name": review.user.full_name if review.user else "Sinh viên NEU",
        "rating": review.rating,
        "comment": review.comment,
        "created_at": review.created_at.isoformat() if review.created_at else None,
    }


def _serialize_dish(dish, reviews=None) -> dict:
    result = {
        "id": dish.id,
        "name": dish.name,
        "short_description": dish.short_description,
        "description": dish.description,
        "base_price": float(dish.base_price),
        "system_fee": float(dish.system_fee),
        "price": float(dish.price),
        "rating": float(dish.rating) if dish.rating is not None else 5.0,
        "review_count": dish.review_count or 0,
        "image": dish.image_url,
        "image_url": dish.image_url,
        "is_available": dish.is_available,
        "is_active": dish.is_active,
        "category_ids": [category.id for category in dish.categories],
        "categoryIds": [category.id for category in dish.categories],
        "badges": [badge.badge for badge in dish.badges],
    }
    if reviews is not None:
        result["reviews"] = [_serialize_review(review) for review in reviews]
    return result


def _validation_errors(error: ValidationError) -> list:
    return [
        {"loc": item["loc"], "msg": item["msg"], "type": item["type"]}
        for item in error.errors()
    ]


def _json_object_or_error():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return None, api_response(
            message="Dữ liệu đầu vào phải là JSON object hợp lệ",
            status_code=400,
            success=False,
        )
    return payload, None


@dish_bp.route("/categories", methods=["GET"])
def list_categories():
    with get_db() as db:
        data = [
            {
                "id": category.id,
                "name": category.name,
                "description": category.description,
                "display_order": category.display_order,
            }
            for category in get_categories(db)
        ]
        return api_response(data=data)


@dish_bp.route("", methods=["GET"])
def list_dishes():
    try:
        page = int(request.args.get("page", "1"))
        limit = int(request.args.get("limit", "20"))
    except (TypeError, ValueError):
        return api_response(
            message="page và limit phải là số nguyên hợp lệ",
            status_code=422,
            success=False,
        )

    if page < 1 or not 1 <= limit <= 100:
        return api_response(
            message="page phải từ 1 trở lên và limit phải từ 1 đến 100",
            status_code=422,
            success=False,
        )

    category_id = request.args.get("category")
    search = request.args.get("search")
    with get_db() as db:
        dishes, total = get_dishes(
            db,
            category_id=category_id,
            search=search,
            page=page,
            limit=limit,
        )
        return api_response(
            data={
                "items": [_serialize_dish(dish) for dish in dishes],
                "total": total,
                "page": page,
                "limit": limit,
            }
        )


@dish_bp.route("/validate-cart", methods=["POST"])
def validate_cart():
    payload, error_response = _json_object_or_error()
    if error_response:
        return error_response
    try:
        data = CartValidateRequest(**payload)
    except ValidationError as error:
        return api_response(
            message="Danh sách món trong giỏ không hợp lệ",
            errors=_validation_errors(error),
            status_code=422,
            success=False,
        )

    with get_db() as db:
        unavailable = get_cart_unavailable_dishes(db, data.dish_ids)
        return api_response(
            data={"is_valid": not unavailable, "unavailable_dishes": unavailable}
        )


@dish_bp.route("/upload-image", methods=["POST"])
@role_required("manager")
def upload_dish_image():
    image = request.files.get("file")
    if image is None or not image.filename:
        return api_response(
            message="Vui lòng chọn file ảnh trong trường 'file'",
            status_code=400,
            success=False,
        )

    filename = save_upload_file(image)
    if filename is None:
        return api_response(
            message="Định dạng ảnh không được hỗ trợ (chỉ nhận PNG, JPG, JPEG, WEBP, GIF)",
            status_code=400,
            success=False,
        )

    return api_response(
        data={"filename": filename, "image_url": f"/uploads/{filename}"},
        message="Tải ảnh món ăn thành công",
        status_code=201,
    )


@dish_bp.route("/<dish_id>/availability", methods=["PATCH"])
@role_required("staff", "manager")
def update_dish_availability(dish_id: str):
    payload, error_response = _json_object_or_error()
    if error_response:
        return error_response
    try:
        data = DishAvailabilityUpdateRequest(**payload)
    except ValidationError as error:
        return api_response(
            message="Dữ liệu trạng thái món không hợp lệ",
            errors=_validation_errors(error),
            status_code=422,
            success=False,
        )

    with get_db() as db:
        dish = get_dish_by_id(db, dish_id)
        if dish is None:
            return api_response(
                message="Không tìm thấy món ăn",
                status_code=404,
                success=False,
            )
        updated = set_dish_availability(db, dish, data.is_available)
        return api_response(
            data=_serialize_dish(updated),
            message="Đã cập nhật trạng thái còn/hết món",
        )


@dish_bp.route("/<dish_id>", methods=["GET"])
def get_dish(dish_id: str):
    with get_db() as db:
        dish = get_dish_by_id(db, dish_id)
        if dish is None:
            return api_response(
                message="Không tìm thấy món ăn",
                status_code=404,
                success=False,
            )
        return api_response(
            data=_serialize_dish(dish, get_reviews_by_dish(db, dish.id))
        )


@dish_bp.route("", methods=["POST"])
@role_required("manager")
def add_dish():
    payload, error_response = _json_object_or_error()
    if error_response:
        return error_response
    try:
        data = DishCreateRequest(**payload)
    except ValidationError as error:
        return api_response(
            message="Dữ liệu món ăn không hợp lệ",
            errors=_validation_errors(error),
            status_code=422,
            success=False,
        )

    with get_db() as db:
        if get_dish_by_id(db, data.id, include_deleted=True) is not None:
            return api_response(
                message=f"Mã món '{data.id}' đã tồn tại",
                status_code=409,
                success=False,
            )
        try:
            created = create_dish(db, data.model_dump())
        except UnknownCategoryIds as error:
            return api_response(
                message="Có danh mục không tồn tại hoặc đã ngừng hoạt động",
                errors=[{"code": "INVALID_CATEGORY_IDS", "category_ids": error.category_ids}],
                status_code=400,
                success=False,
            )
        except IntegrityError:
            db.rollback()
            return api_response(
                message="Mã món đã tồn tại",
                status_code=409,
                success=False,
            )
        return api_response(
            data=_serialize_dish(created),
            message="Thêm món ăn thành công",
            status_code=201,
        )


@dish_bp.route("/<dish_id>", methods=["PUT"])
@role_required("manager")
def edit_dish(dish_id: str):
    payload, error_response = _json_object_or_error()
    if error_response:
        return error_response
    try:
        data = DishUpdateRequest(**payload)
    except ValidationError as error:
        return api_response(
            message="Dữ liệu cập nhật không hợp lệ",
            errors=_validation_errors(error),
            status_code=422,
            success=False,
        )

    with get_db() as db:
        dish = get_dish_by_id(db, dish_id)
        if dish is None:
            return api_response(
                message="Không tìm thấy món ăn",
                status_code=404,
                success=False,
            )
        update_data = data.model_dump(exclude_unset=True)
        for field in ("name", "base_price", "is_available", "is_active"):
            if field in update_data and update_data[field] is None:
                return api_response(
                    message=f"Trường '{field}' không được để null",
                    status_code=422,
                    success=False,
                )
        try:
            updated = update_dish(db, dish, update_data)
        except UnknownCategoryIds as error:
            return api_response(
                message="Có danh mục không tồn tại hoặc đã ngừng hoạt động",
                errors=[{"code": "INVALID_CATEGORY_IDS", "category_ids": error.category_ids}],
                status_code=400,
                success=False,
            )
        return api_response(
            data=_serialize_dish(updated), message="Cập nhật món ăn thành công"
        )


@dish_bp.route("/<dish_id>", methods=["DELETE"])
@role_required("manager")
def remove_dish(dish_id: str):
    with get_db() as db:
        dish = get_dish_by_id(db, dish_id)
        if dish is None:
            return api_response(
                message="Không tìm thấy món ăn",
                status_code=404,
                success=False,
            )
        was_soft_deleted = delete_dish(db, dish)
        if was_soft_deleted:
            return api_response(
                data={"id": dish_id, "soft_deleted": True},
                message="Món đã có lịch sử đơn hàng; hệ thống đã ẩn và ngừng kinh doanh món (BR-04, EX-21)",
            )
        return api_response(
            data={"id": dish_id, "soft_deleted": False},
            message="Đã xóa món ăn thành công",
        )
