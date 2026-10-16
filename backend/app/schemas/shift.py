from typing import Optional
from datetime import date, datetime
from pydantic import BaseModel, Field


class ShiftSubmitRequest(BaseModel):
    actual_cash: float = Field(..., ge=0)
    actual_qr: float = Field(..., ge=0)
    discrepancy_note: Optional[str] = None


class ShiftCloseRequest(BaseModel):
    status: str = Field(..., pattern="^(DA_CHOT|CAN_GIAI_TRINH)$")
    discrepancy_note: Optional[str] = None


class StaffShiftResponse(BaseModel):
    id: int
    staff_id: int
    shift_date: date
    total_orders_handled: int
    expected_cash: float
    expected_qr: float
    actual_cash: float
    actual_qr: float
    discrepancy_amount: float
    discrepancy_note: Optional[str] = None
    status: str
    closed_by: Optional[int] = None
    closed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
