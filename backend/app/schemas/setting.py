import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, ConfigDict, Field, field_validator

# Các khóa cấu hình số nguyên dương (> 0) theo BR-07, BR-15, BR-17, BR-20, BR-23
POSITIVE_INT_KEYS: Dict[str, str] = {
    "order_timeout_minutes": "Thời gian order_timeout_minutes phải là số nguyên dương lớn hơn 0",
    "pickup_hold_minutes": "Thời gian pickup_hold_minutes phải là số nguyên dương lớn hơn 0",
    "auto_complete_minutes": "Thời gian auto_complete_minutes phải là số nguyên dương lớn hơn 0",
    "complaint_window_hours": "Thời gian complaint_window_hours phải là số nguyên dương lớn hơn 0",
    "max_dish_quantity_per_order": "Số lượng max_dish_quantity_per_order phải là số nguyên dương lớn hơn 0",
    "min_preorder_lead_minutes": "Thời gian min_preorder_lead_minutes phải là số nguyên dương lớn hơn 0",
}

# Các khóa cấu hình tiền tệ không âm (>= 0) theo BR-12, BR-14
NON_NEGATIVE_INT_KEYS: Dict[str, str] = {
    "system_maintenance_fee": "Phụ phí bảo trì hệ thống phải là số nguyên không âm (>= 0)",
    "delivery_fee": "Phí giao hàng phải là số nguyên không âm (>= 0)",
    "max_cod_amount": "Hạn mức COD phải là số nguyên không âm (>= 0)",
}

# Định dạng giờ Canteen HH:MM (00:00 - 23:59) theo BR-08
TIME_REGEX = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def validate_setting_value(key: str, value: str) -> Tuple[bool, Optional[str]]:
    """
    Kiểm tra tính hợp lệ của giá trị cấu hình theo từng khóa nghiệp vụ:
    - Số nguyên dương > 0: order_timeout_minutes, pickup_hold_minutes, auto_complete_minutes,
      complaint_window_hours, max_dish_quantity_per_order, min_preorder_lead_minutes.
    - Tiền tệ >= 0: system_maintenance_fee, delivery_fee, max_cod_amount.
    - Giờ mở/đóng Canteen: canteen_open_time, canteen_close_time theo định dạng HH:MM.
    - Các khóa khác: chuỗi từ 1 đến 255 ký tự (sau khi strip).
    Trả về: (is_valid, error_message_or_none)
    """
    cleaned = value.strip()
    if not cleaned:
        return False, "Giá trị cấu hình không được để trống"

    if key in POSITIVE_INT_KEYS:
        try:
            val_int = int(cleaned)
            if val_int <= 0:
                return False, POSITIVE_INT_KEYS[key]
        except ValueError:
            return False, POSITIVE_INT_KEYS[key]
        return True, None

    if key in NON_NEGATIVE_INT_KEYS:
        try:
            val_int = int(cleaned)
            if val_int < 0:
                return False, NON_NEGATIVE_INT_KEYS[key]
        except ValueError:
            return False, NON_NEGATIVE_INT_KEYS[key]
        return True, None

    if key in ("canteen_open_time", "canteen_close_time"):
        if not TIME_REGEX.match(cleaned):
            return False, "Định dạng giờ mở/đóng cửa không hợp lệ, phải là HH:MM (00:00 - 23:59)"
        return True, None

    if len(cleaned) > 255:
        return False, "Giá trị cấu hình không được vượt quá 255 ký tự"

    return True, None


class SystemSettingUpdateRequest(BaseModel):
    """Schema yêu cầu cập nhật một tham số hệ thống (UC23)."""
    setting_value: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=500)

    @field_validator("setting_value")
    @classmethod
    def validate_setting_value_strip(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Giá trị cấu hình không được để trống")
        return cleaned

    @field_validator("description")
    @classmethod
    def validate_description_strip(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return v.strip()
        return None


class SystemSettingBulkItem(BaseModel):
    """Schema phần tử trong yêu cầu cập nhật hàng loạt tham số (UC23)."""
    setting_key: str = Field(..., min_length=1, max_length=50)
    setting_value: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=500)

    @field_validator("setting_key")
    @classmethod
    def validate_key(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Khóa cấu hình không được để trống")
        return cleaned

    @field_validator("setting_value")
    @classmethod
    def validate_value(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Giá trị cấu hình không được để trống")
        return cleaned

    @field_validator("description")
    @classmethod
    def validate_description_strip(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return v.strip()
        return None


class SystemSettingBulkUpdateRequest(BaseModel):
    """Schema yêu cầu cập nhật hàng loạt tham số hệ thống trong một request (UC23)."""
    settings: List[SystemSettingBulkItem] = Field(..., min_length=1)


class SystemSettingResponse(BaseModel):
    """Schema chuẩn hóa thông tin tham số hệ thống trả về API (UC23)."""
    setting_key: str
    setting_value: str
    description: Optional[str] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
