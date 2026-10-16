from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class ComplaintCreateRequest(BaseModel):
    order_id: str = Field(..., min_length=2)
    reason: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=5)
    proof_image_url: str = Field(..., min_length=5)


class ComplaintResolveRequest(BaseModel):
    status: str = Field(..., pattern="^(CHAP_NHAN|TU_CHOI)$")
    admin_response: str = Field(..., min_length=3)


class ComplaintResponse(BaseModel):
    id: int
    order_id: str
    user_id: int
    reason: str
    description: str
    proof_image_url: str
    status: str
    admin_response: Optional[str] = None
    resolved_by: Optional[int] = None
    resolved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
