from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

# BR-01, EX-03: Số điện thoại di động Việt Nam hợp lệ gồm đúng 10 chữ số và bắt đầu bằng số 0
VN_PHONE_REGEX = r"^0\d{9}$"

# UC23: Danh sách 4 vai trò hợp lệ trong hệ thống NEUFood
VALID_USER_ROLES = ("customer", "staff", "manager", "admin")
UserRoleType = Literal["customer", "staff", "manager", "admin"]


class UserResponse(BaseModel):
    """Schema phản hồi thông tin tài khoản người dùng (UC04, UC23)."""

    id: int
    email: EmailStr
    full_name: str
    phone_number: Optional[str] = None
    student_id: Optional[str] = None
    role: str
    avatar_url: Optional[str] = None
    is_active: bool
    is_blacklisted: bool = False
    blacklist_reason: Optional[str] = None
    blacklisted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserUpdateRequest(BaseModel):
    """Schema cập nhật thông tin hồ sơ cá nhân (UC04, BR-01, EX-01, EX-03)."""

    full_name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    phone_number: Optional[str] = Field(default=None, pattern=VN_PHONE_REGEX)
    student_id: Optional[str] = Field(default=None, max_length=30)
    avatar_url: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("full_name", "phone_number", mode="before")
    @classmethod
    def strip_non_empty_fields(cls, v):
        if v is not None and isinstance(v, str):
            return v.strip()
        return v

    @field_validator("student_id", "avatar_url", mode="before")
    @classmethod
    def normalize_nullable_strings(cls, v):
        if isinstance(v, str):
            stripped = v.strip()
            return stripped if stripped else None
        return v


class AdminUserStatusUpdateRequest(BaseModel):
    """Schema quản trị viên khóa/mở khóa hoặc phân quyền tài khoản (UC23, BR-02, EX-22)."""

    is_active: Optional[bool] = None
    role: Optional[UserRoleType] = None

    @model_validator(mode="after")
    def validate_at_least_one_field(self):
        if self.is_active is None and self.role is None:
            raise ValueError("Phải cung cấp ít nhất một trong hai trường: is_active hoặc role")
        return self


class AdminUserBlacklistUpdateRequest(BaseModel):
    """Schema quản trị viên cập nhật trạng thái danh sách đen COD (UC23, BR-22)."""

    is_blacklisted: bool
    blacklist_reason: Optional[str] = Field(default=None, max_length=500)

    @field_validator("blacklist_reason", mode="before")
    @classmethod
    def normalize_blacklist_reason(cls, v):
        if isinstance(v, str):
            stripped = v.strip()
            return stripped if stripped else None
        return v


class ChangePasswordRequest(BaseModel):
    """Schema đổi mật khẩu (bảo toàn tương thích ngược)."""

    old_password: str
    new_password: str

