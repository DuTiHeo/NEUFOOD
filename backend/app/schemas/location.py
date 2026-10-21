from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CampusLocationCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    building_code: str = Field(..., min_length=1, max_length=30)
    building_name: str = Field(..., min_length=2, max_length=150)
    default_room_note: Optional[str] = None
    is_active: bool = True
    display_order: int = Field(default=0, ge=0)

    @field_validator("building_code")
    @classmethod
    def normalize_building_code(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("building_code không được để trống")
        return normalized

    @field_validator("building_name")
    @classmethod
    def trim_building_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("building_name không được để trống")
        return normalized


class CampusLocationUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    building_code: Optional[str] = Field(None, min_length=1, max_length=30)
    building_name: Optional[str] = Field(None, min_length=2, max_length=150)
    default_room_note: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = Field(None, ge=0)

    @field_validator("building_code")
    @classmethod
    def normalize_building_code(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("building_code không được để trống")
        return normalized

    @field_validator("building_name")
    @classmethod
    def trim_building_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("building_name không được để trống")
        return normalized


class CampusLocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    building_code: str
    building_name: str
    default_room_note: Optional[str] = None
    is_active: bool
    display_order: int
