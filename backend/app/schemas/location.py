from typing import Optional
from pydantic import BaseModel, Field


class CampusLocationCreateRequest(BaseModel):
    building_code: str = Field(..., min_length=1, max_length=30)
    building_name: str = Field(..., min_length=2, max_length=150)
    default_room_note: Optional[str] = None
    is_active: bool = True
    display_order: int = 0


class CampusLocationUpdateRequest(BaseModel):
    building_code: Optional[str] = Field(None, min_length=1, max_length=30)
    building_name: Optional[str] = Field(None, min_length=2, max_length=150)
    default_room_note: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class CampusLocationResponse(BaseModel):
    id: int
    building_code: str
    building_name: str
    default_room_note: Optional[str] = None
    is_active: bool
    display_order: int

    class Config:
        from_attributes = True
