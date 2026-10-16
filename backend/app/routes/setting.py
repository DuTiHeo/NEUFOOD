from flask import Blueprint, request
from pydantic import ValidationError
from app.db.session import get_db
from app.crud.setting import get_all_settings, upsert_setting
from app.core.security import role_required
from app.schemas.setting import SystemSettingUpdateRequest
from app.utils.helpers import api_response

setting_bp = Blueprint("settings", __name__, url_prefix="/settings")


@setting_bp.route("", methods=["GET"])
def list_settings():
    """Lấy danh sách tham số vận hành hệ thống (Phí ship, phí bảo trì, thời gian timeout...)."""
    with get_db() as db:
        settings = get_all_settings(db)
        data = [
            {
                "setting_key": s.setting_key,
                "setting_value": s.setting_value,
                "description": s.description,
            }
            for s in settings
        ]
        return api_response(data=data)


@setting_bp.route("/<setting_key>", methods=["PUT"])
@role_required("admin")
def update_setting(setting_key: str):
    """Cập nhật tham số hệ thống (Độc quyền Admin - Chương 2.3.5)."""
    try:
        data = SystemSettingUpdateRequest(**request.get_json(force=True))
    except ValidationError as e:
        return api_response(message="Dữ liệu cấu hình không hợp lệ", errors=e.errors(), status_code=422, success=False)

    with get_db() as db:
        updated = upsert_setting(db, setting_key, data.setting_value, data.description)
        return api_response(
            data={
                "setting_key": updated.setting_key,
                "setting_value": updated.setting_value,
                "description": updated.description,
            },
            message="Cập nhật tham số hệ thống thành công",
        )
