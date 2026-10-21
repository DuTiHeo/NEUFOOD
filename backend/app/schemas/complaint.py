from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class ComplaintCreateRequest(BaseModel):
    """Schema xác thực dữ liệu gửi lên khi tạo khiếu nại đơn hàng (UC15)."""
    order_id: str = Field(..., min_length=2, max_length=50, pattern=r"\S", description="Mã đơn hàng cần khiếu nại, ví dụ: NF2610155566")
    reason: str = Field(..., min_length=3, max_length=255, pattern=r"\S", description="Lý do khiếu nại ngắn gọn")
    description: str = Field(..., min_length=5, max_length=2000, pattern=r"\S", description="Mô tả chi tiết nội dung khiếu nại")
    proof_image_url: str = Field(
        ...,
        min_length=5,
        max_length=1000,
        pattern=r"^(https?://\S+|/[a-zA-Z0-9_\-\./]+)$",
        description="Đường dẫn URL ảnh minh chứng bắt buộc (EX-15), hỗ trợ URL tuyệt đối hoặc đường dẫn upload nội bộ",
    )


class ComplaintResolveRequest(BaseModel):
    """Schema xác thực dữ liệu Admin phân xử khiếu nại (UC25)."""
    status: str = Field(..., pattern="^(CHAP_NHAN|TU_CHOI)$", description="Kết quả phân xử: CHAP_NHAN hoặc TU_CHOI")
    admin_response: str = Field(..., min_length=3, max_length=2000, pattern=r"\S", description="Phản hồi và kết luận phân xử của Admin")


class ComplaintResponse(BaseModel):
    """Schema định dạng dữ liệu trả về của ticket khiếu nại."""
    id: int
    order_id: str
    user_id: int
    user_name: Optional[str] = None
    reason: str
    description: str
    proof_image_url: str
    status: str
    admin_response: Optional[str] = None
    resolved_by: Optional[int] = None
    resolved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

