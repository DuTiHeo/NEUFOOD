from typing import List, Optional
from pydantic import BaseModel, Field


class CategoryResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    display_order: int = 0
    is_active: bool = True

    class Config:
        from_attributes = True


class DishCreateRequest(BaseModel):
    id: str = Field(..., min_length=2, max_length=100)
    name: str = Field(..., min_length=2, max_length=200)
    short_description: Optional[str] = None
    description: Optional[str] = None
    base_price: float = Field(..., ge=0)
    system_fee: float = Field(default=5000, ge=0)
    price: Optional[float] = Field(default=None, ge=0)
    image_url: Optional[str] = None
    category_ids: List[str] = []
    badges: List[str] = []
    is_available: bool = True


class DishUpdateRequest(BaseModel):
    name: Optional[str] = None
    short_description: Optional[str] = None
    description: Optional[str] = None
    base_price: Optional[float] = Field(None, ge=0)
    system_fee: Optional[float] = Field(None, ge=0)
    price: Optional[float] = Field(None, ge=0)
    image_url: Optional[str] = None
    category_ids: Optional[List[str]] = None
    badges: Optional[List[str]] = None
    is_available: Optional[bool] = None
    is_active: Optional[bool] = None


class DishResponse(BaseModel):
    id: str
    name: str
    short_description: Optional[str] = None
    description: Optional[str] = None
    base_price: float
    system_fee: float = 5000
    price: float
    rating: float = 5.0
    review_count: int = 0
    image_url: Optional[str] = None
    is_available: bool = True
    is_active: bool = True
    category_ids: List[str] = []
    badges: List[str] = []

    class Config:
        from_attributes = True
