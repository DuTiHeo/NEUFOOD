from typing import Any, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator

# BR-01: Số điện thoại di động hợp lệ tại Việt Nam gồm đúng 10 chữ số và bắt đầu bằng số 0
VN_PHONE_REGEX = r"^0\d{9}$"


class LoginRequest(BaseModel):
    """Schema đầu vào đăng nhập hệ thống (UC02, BR-02, EX-02)."""
    email: EmailStr
    # Đặt min_length=1 để mọi mật khẩu nhập sai độ dài bất kỳ >= 1 đều đi vào luồng đếm failed_login_attempts (BR-02)
    password: str = Field(..., min_length=1, max_length=128)


class RegisterRequest(BaseModel):
    """Schema đầu vào đăng ký tài khoản khách hàng (UC01, BR-01, EX-01)."""
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=150)
    phone_number: str = Field(..., pattern=VN_PHONE_REGEX)
    student_id: Optional[str] = Field(default=None, max_length=30)

    @field_validator("full_name", "phone_number", mode="before")
    @classmethod
    def strip_strings(cls, v: Any) -> Any:
        """Chuẩn hóa khoảng trắng ở hai đầu cho họ tên và số điện thoại (BR-01)."""
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("student_id", mode="before")
    @classmethod
    def normalize_student_id(cls, v: Any) -> Optional[str]:
        """Chuẩn hóa mã sinh viên: chuyển chuỗi rỗng về None để tránh lỗi trùng student_id rỗng (BR-01, EX-01)."""
        if v is None:
            return None
        if isinstance(v, str):
            cleaned = v.strip()
            return cleaned if cleaned else None
        return v


class ChangePasswordRequest(BaseModel):
    """Schema đầu vào đổi mật khẩu khi đang đăng nhập (UC05)."""
    old_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=6, max_length=128)


class ForgotPasswordRequest(BaseModel):
    """Schema đầu vào yêu cầu gửi mã OTP khôi phục mật khẩu (UC05, EX-04)."""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Schema đầu vào đặt lại mật khẩu bằng mã OTP (UC05, BR-02, EX-04)."""
    email: EmailStr
    otp: str = Field(..., min_length=1, max_length=20)
    new_password: str = Field(..., min_length=6, max_length=128)


class RefreshTokenRequest(BaseModel):
    """Schema yêu cầu cấp lại Access Token qua Refresh Token."""
    refresh_token: str = Field(..., min_length=10, description="JWT Refresh Token hợp lệ")


class LogoutRequest(BaseModel):
    """Schema tùy chọn gửi kèm refresh_token khi đăng xuất để thu hồi cả cặp token."""
    refresh_token: Optional[str] = Field(default=None, description="Refresh token cần thu hồi cùng lúc")


class TokenResponse(BaseModel):
    """Schema phản hồi thông tin xác thực JWT (UC01, UC02)."""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "Bearer"
    expires_in: Optional[int] = None
    user: dict


