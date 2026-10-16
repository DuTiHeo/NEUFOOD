from flask import Blueprint, request
from app.db.session import get_db
from app.crud.location import get_locations
from app.utils.helpers import api_response

location_bp = Blueprint("locations", __name__, url_prefix="/locations")


@location_bp.route("", methods=["GET"])
def list_campus_locations():
    """
    Lấy danh mục địa điểm nội khu NEU (UC09, UC24, BR-09).
    TODO (Thành viên 2): Bổ sung POST / PUT / DELETE cho Admin và kiểm tra BR-10, EX-23.
    """
    include_inactive = request.args.get("all", "false").lower() == "true"
    with get_db() as db:
        locations = get_locations(db, active_only=not include_inactive)
        data = [
            {
                "id": loc.id,
                "building_code": loc.building_code,
                "building_name": loc.building_name,
                "default_room_note": loc.default_room_note,
                "is_active": loc.is_active,
                "display_order": loc.display_order,
            }
            for loc in locations
        ]
        return api_response(data=data)
