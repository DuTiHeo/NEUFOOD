from flask import Blueprint, request
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from app.core.security import role_required
from app.crud.location import (
    create_location,
    delete_or_deactivate_location,
    get_location_by_code,
    get_location_by_id,
    get_locations,
    update_location,
)
from app.db.session import get_db
from app.schemas.location import CampusLocationCreateRequest, CampusLocationUpdateRequest
from app.utils.helpers import api_response

location_bp = Blueprint("locations", __name__, url_prefix="/locations")


def _serialize_location(location) -> dict:
    return {
        "id": location.id,
        "building_code": location.building_code,
        "building_name": location.building_name,
        "default_room_note": location.default_room_note,
        "is_active": location.is_active,
        "display_order": location.display_order,
    }


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


@role_required("admin")
def _list_all_locations():
    with get_db() as db:
        return api_response(data=[_serialize_location(item) for item in get_locations(db, active_only=False)])


@location_bp.route("", methods=["GET"])
def list_campus_locations():
    """List active campus locations; only admins may include inactive entries."""
    include_inactive = request.args.get("all", "false").strip().lower() == "true"
    if include_inactive:
        return _list_all_locations()

    with get_db() as db:
        locations = get_locations(db, active_only=True)
        return api_response(data=[_serialize_location(item) for item in locations])


@location_bp.route("", methods=["POST"])
@role_required("admin")
def add_location():
    payload, error_response = _json_object_or_error()
    if error_response:
        return error_response
    try:
        data = CampusLocationCreateRequest(**payload)
    except ValidationError as error:
        return api_response(
            message="Dữ liệu địa điểm không hợp lệ",
            errors=_validation_errors(error),
            status_code=422,
            success=False,
        )

    location_data = data.model_dump()
    location_data["building_code"] = location_data["building_code"].strip().upper()
    with get_db() as db:
        if get_location_by_code(db, location_data["building_code"]):
            return api_response(
                message="Mã tòa nhà đã tồn tại",
                status_code=409,
                success=False,
            )
        try:
            location = create_location(db, location_data)
        except IntegrityError:
            db.rollback()
            return api_response(
                message="Mã tòa nhà đã tồn tại",
                status_code=409,
                success=False,
            )
        return api_response(
            data=_serialize_location(location),
            message="Thêm địa điểm thành công",
            status_code=201,
        )


@location_bp.route("/<int:location_id>", methods=["PUT"])
@role_required("admin")
def edit_location(location_id: int):
    payload, error_response = _json_object_or_error()
    if error_response:
        return error_response
    try:
        data = CampusLocationUpdateRequest(**payload)
    except ValidationError as error:
        return api_response(
            message="Dữ liệu cập nhật địa điểm không hợp lệ",
            errors=_validation_errors(error),
            status_code=422,
            success=False,
        )

    update_data = data.model_dump(exclude_unset=True)
    if "building_code" in update_data and update_data["building_code"] is not None:
        update_data["building_code"] = update_data["building_code"].strip().upper()

    with get_db() as db:
        location = get_location_by_id(db, location_id)
        if location is None:
            return api_response(
                message="Không tìm thấy địa điểm",
                status_code=404,
                success=False,
            )
        if "building_code" in update_data and update_data["building_code"] is None:
            return api_response(
                message="building_code không được để null",
                status_code=422,
                success=False,
            )
        if "building_name" in update_data and update_data["building_name"] is None:
            return api_response(
                message="building_name không được để null",
                status_code=422,
                success=False,
            )
        for field in ("is_active", "display_order"):
            if field in update_data and update_data[field] is None:
                return api_response(
                    message=f"{field} không được để null",
                    status_code=422,
                    success=False,
                )
        if update_data.get("building_code") and get_location_by_code(
            db, update_data["building_code"], exclude_id=location_id
        ):
            return api_response(
                message="Mã tòa nhà đã tồn tại",
                status_code=409,
                success=False,
            )
        try:
            updated = update_location(db, location, update_data)
        except IntegrityError:
            db.rollback()
            return api_response(
                message="Mã tòa nhà đã tồn tại",
                status_code=409,
                success=False,
            )
        return api_response(
            data=_serialize_location(updated), message="Cập nhật địa điểm thành công"
        )


@location_bp.route("/<int:location_id>", methods=["DELETE"])
@role_required("admin")
def remove_location(location_id: int):
    with get_db() as db:
        location = get_location_by_id(db, location_id)
        if location is None:
            return api_response(
                message="Không tìm thấy địa điểm",
                status_code=404,
                success=False,
            )

        location_data = _serialize_location(location)
        deactivated = delete_or_deactivate_location(db, location)
        if deactivated:
            return api_response(
                data={"id": location_id, "is_active": False, "deactivated": True},
                message="Địa điểm đang được đơn chưa kết thúc sử dụng; hệ thống đã tạm ngưng phục vụ thay vì xóa cứng",
            )
        return api_response(
            data={"id": location_id, "deleted": True, "location": location_data},
            message="Đã xóa địa điểm thành công",
        )
