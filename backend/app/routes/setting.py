from typing import Optional
from flask import Blueprint, g, request
from pydantic import ValidationError

from app.core.security import role_required
from app.crud.setting import (
    bulk_upsert_settings,
    get_all_settings,
    get_setting_by_key,
    get_setting_model_by_key,
    upsert_setting,
)
from app.crud.user import get_user_by_id
from app.db.models import SystemSetting
from app.db.session import get_db
from app.schemas.setting import (
    SystemSettingBulkUpdateRequest,
    SystemSettingUpdateRequest,
    validate_setting_value,
)
from app.utils.helpers import api_response

setting_bp = Blueprint("settings", __name__, url_prefix="/settings")


def _serialize_setting(s: SystemSetting) -> dict:
    """Chuẩn hóa dữ liệu tham số hệ thống trả về API (UC23)."""
    return {
        "setting_key": s.setting_key,
        "setting_value": s.setting_value,
        "description": s.description,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


def _parse_json_body() -> Optional[dict]:
    """Đọc và kiểm tra payload JSON là một dictionary hợp lệ, tránh lỗi khi payload rỗng hoặc sai kiểu."""
    raw = request.get_json(force=True, silent=True)
    return raw if isinstance(raw, dict) else None


@setting_bp.route("", methods=["GET"])
def list_settings():
    """Lấy danh sách toàn bộ tham số vận hành hệ thống (UC23, Mục 2.10 API Docs)."""
    with get_db() as db:
        settings = get_all_settings(db)
        return api_response(
            data=[_serialize_setting(s) for s in settings],
            message="Lấy danh sách tham số cấu hình thành công",
            status_code=200,
        )


@setting_bp.route("/bulk", methods=["PUT"])
@role_required("admin")
def update_settings_bulk():
    """Cập nhật hàng loạt tham số hệ thống trong một giao dịch (Độc quyền Admin - UC23)."""
    body = _parse_json_body()
    if body is None:
        return api_response(
            message="Dữ liệu đầu vào phải là JSON object hợp lệ",
            status_code=400,
            success=False,
        )

    with get_db() as db:
        # Kiểm tra trạng thái tài khoản admin
        admin_id = int(g.current_user["sub"])
        admin_user = get_user_by_id(db, admin_id)
        if not admin_user:
            return api_response(
                message="Không tìm thấy người dùng",
                status_code=404,
                success=False,
            )
        if not admin_user.is_active:
            return api_response(
                message="Tài khoản này đã bị khóa",
                status_code=403,
                success=False,
            )

        # Validate schema bulk
        try:
            bulk_data = SystemSettingBulkUpdateRequest(**body)
        except ValidationError as e:
            errors = e.errors(include_url=False, include_context=False)
            for err in errors:
                msg = str(err.get("msg", ""))
                if "Giá trị cấu hình không được để trống" in msg:
                    return api_response(
                        message="Giá trị cấu hình không được để trống",
                        errors=errors,
                        status_code=422,
                        success=False,
                    )
            return api_response(
                message="Dữ liệu cấu hình không hợp lệ",
                errors=errors,
                status_code=422,
                success=False,
            )

        new_open_time = None
        new_close_time = None
        items_to_update = []

        # Validate từng item và điều kiện biên theo từng key
        for item in bulk_data.settings:
            is_valid, err_msg = validate_setting_value(item.setting_key, item.setting_value)
            if not is_valid:
                return api_response(
                    message=err_msg,
                    status_code=422,
                    success=False,
                )

            if item.setting_key == "canteen_open_time":
                new_open_time = item.setting_value
            elif item.setting_key == "canteen_close_time":
                new_close_time = item.setting_value

            items_to_update.append({
                "setting_key": item.setting_key,
                "setting_value": item.setting_value,
                "description": item.description,
            })

        # Kiểm tra logic quan hệ thời gian Canteen: canteen_open_time < canteen_close_time (BR-08)
        target_open = new_open_time if new_open_time is not None else get_setting_by_key(db, "canteen_open_time", "")
        target_close = new_close_time if new_close_time is not None else get_setting_by_key(db, "canteen_close_time", "")
        if (new_open_time is not None or new_close_time is not None) and target_open and target_close:
            if target_open >= target_close:
                return api_response(
                    message="Giờ mở cửa Canteen phải trước giờ đóng cửa",
                    status_code=422,
                    success=False,
                )

        updated_settings = bulk_upsert_settings(db, items_to_update)
        return api_response(
            data=[_serialize_setting(s) for s in updated_settings],
            message="Cập nhật danh sách cấu hình hệ thống thành công",
            status_code=200,
        )


@setting_bp.route("/<setting_key>", methods=["GET"])
def get_setting(setting_key: str):
    """Lấy chi tiết một tham số cấu hình theo khóa (UC23, Mục 2.10 API Docs)."""
    with get_db() as db:
        setting = get_setting_model_by_key(db, setting_key)
        if not setting:
            return api_response(
                message=f"Không tìm thấy cấu hình với khóa '{setting_key}'",
                status_code=404,
                success=False,
            )
        return api_response(
            data=_serialize_setting(setting),
            message="Lấy thông tin cấu hình thành công",
            status_code=200,
        )


@setting_bp.route("/<setting_key>", methods=["PUT"])
@role_required("admin")
def update_setting(setting_key: str):
    """Cập nhật một tham số hệ thống theo khóa (Độc quyền Admin - UC23)."""
    body = _parse_json_body()
    if body is None:
        return api_response(
            message="Dữ liệu đầu vào phải là JSON object hợp lệ",
            status_code=400,
            success=False,
        )

    with get_db() as db:
        # Kiểm tra trạng thái tài khoản admin
        admin_id = int(g.current_user["sub"])
        admin_user = get_user_by_id(db, admin_id)
        if not admin_user:
            return api_response(
                message="Không tìm thấy người dùng",
                status_code=404,
                success=False,
            )
        if not admin_user.is_active:
            return api_response(
                message="Tài khoản này đã bị khóa",
                status_code=403,
                success=False,
            )

        # Validate schema
        try:
            data = SystemSettingUpdateRequest(**body)
        except ValidationError as e:
            errors = e.errors(include_url=False, include_context=False)
            for err in errors:
                msg = str(err.get("msg", ""))
                if "Giá trị cấu hình không được để trống" in msg:
                    return api_response(
                        message="Giá trị cấu hình không được để trống",
                        errors=errors,
                        status_code=422,
                        success=False,
                    )
            return api_response(
                message="Dữ liệu cấu hình không hợp lệ",
                errors=errors,
                status_code=422,
                success=False,
            )

        # Validate logic biên theo từng setting_key
        is_valid, err_msg = validate_setting_value(setting_key, data.setting_value)
        if not is_valid:
            return api_response(
                message=err_msg,
                status_code=422,
                success=False,
            )

        # Kiểm tra logic quan hệ thời gian Canteen: canteen_open_time < canteen_close_time (BR-08)
        if setting_key == "canteen_open_time":
            close_time = get_setting_by_key(db, "canteen_close_time", "")
            if close_time and data.setting_value >= close_time:
                return api_response(
                    message="Giờ mở cửa Canteen phải trước giờ đóng cửa",
                    status_code=422,
                    success=False,
                )
        elif setting_key == "canteen_close_time":
            open_time = get_setting_by_key(db, "canteen_open_time", "")
            if open_time and open_time >= data.setting_value:
                return api_response(
                    message="Giờ mở cửa Canteen phải trước giờ đóng cửa",
                    status_code=422,
                    success=False,
                )

        updated = upsert_setting(db, setting_key, data.setting_value, data.description)
        return api_response(
            data=_serialize_setting(updated),
            message="Cập nhật tham số hệ thống thành công",
            status_code=200,
        )
