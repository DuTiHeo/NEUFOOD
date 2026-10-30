from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class ReviewCreateRequest(BaseModel):
    """Schema xác thực dữ liệu gửi lên khi tạo đánh giá món ăn (UC14)."""
    order_id: str = Field(..., min_length=2, max_length=50, description="Mã đơn hàng, ví dụ: NF2610148833")
    dish_id: str = Field(..., min_length=2, max_length=100, description="Slug ID của món ăn, ví dụ: com-ga-xoi-mo")
    rating: int = Field(..., strict=True, ge=1, le=5, description="Số sao đánh giá từ 1 đến 5 sao")
    comment: Optional[str] = Field(default=None, max_length=1000, description="Nhận xét của khách hàng (tối đa 1000 ký tự)")


class ReviewResponse(BaseModel):
    """Schema định dạng dữ liệu trả về của một đánh giá."""
    id: int
    order_id: str
    dish_id: str
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    rating: int
    comment: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

