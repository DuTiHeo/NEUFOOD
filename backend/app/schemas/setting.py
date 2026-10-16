from typing import Optional
from pydantic import BaseModel, Field


class SystemSettingUpdateRequest(BaseModel):
    setting_value: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class SystemSettingResponse(BaseModel):
    setting_key: str
    setting_value: str
    description: Optional[str] = None

    class Config:
        from_attributes = True
