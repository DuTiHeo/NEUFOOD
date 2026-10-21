from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    display_order: int = 0
    is_active: bool = True


class DishCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=2, max_length=100)
    name: str = Field(..., min_length=2, max_length=200)
    short_description: Optional[str] = None
    description: Optional[str] = None
    base_price: Decimal = Field(..., ge=0)
    image_url: Optional[str] = None
    category_ids: List[str] = Field(default_factory=list)
    badges: List[str] = Field(default_factory=list)
    is_available: bool = True


class DishUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(None, min_length=2, max_length=200)
    short_description: Optional[str] = None
    description: Optional[str] = None
    base_price: Optional[Decimal] = Field(None, ge=0)
    image_url: Optional[str] = None
    category_ids: Optional[List[str]] = None
    badges: Optional[List[str]] = None
    is_available: Optional[bool] = None
    is_active: Optional[bool] = None


class DishAvailabilityUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_available: bool


class CartValidateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dish_ids: List[str] = Field(..., min_length=1)


class DishResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    short_description: Optional[str] = None
    description: Optional[str] = None
    base_price: Decimal
    system_fee: Decimal = Decimal("5000")
    price: Decimal
    rating: Decimal = Decimal("5.0")
    review_count: int = 0
    image_url: Optional[str] = None
    is_available: bool = True
    is_active: bool = True
    category_ids: List[str] = Field(default_factory=list)
    badges: List[str] = Field(default_factory=list)
