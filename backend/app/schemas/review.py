from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class ReviewCreateRequest(BaseModel):
    order_id: str = Field(..., min_length=2)
    dish_id: str = Field(..., min_length=2)
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


class ReviewResponse(BaseModel):
    id: int
    order_id: str
    dish_id: str
    user_id: Optional[int] = None
    rating: int
    comment: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
