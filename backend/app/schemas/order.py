from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

VALID_ORDER_STATUSES = (
    "^(CHO_XAC_NHAN|DANG_CHUAN_BI|DANG_GIAO|SAN_SANG_LAY|"
    "DA_GIAO|DA_BAN_GIAO|GIAO_THAT_BAI|HOAN_THANH|"
    "DA_HUY_KHACH|TU_CHOI|TU_DONG_HUY|BO_DON_BLACKLIST|"
    "KHIEU_NAI|DA_GIAI_QUYET)$"
)


class OrderItemCreate(BaseModel):
    dish_id: str
    quantity: int = Field(..., gt=0, le=10)
    note: Optional[str] = None


class OrderItemResponse(BaseModel):
    id: int
    dish_id: Optional[str] = None
    dish_name: str
    unit_price: float
    base_price: float = 0
    quantity: int
    note: Optional[str] = None
    subtotal: float

    class Config:
        from_attributes = True


class OrderCreateRequest(BaseModel):
    order_type: str = Field(default="delivery", pattern="^(delivery|pickup)$")
    recipient_name: str = Field(..., min_length=2)
    recipient_phone: str = Field(..., min_length=10, max_length=20)
    campus_location_id: Optional[int] = None
    room_detail: Optional[str] = None
    delivery_address: Optional[str] = None
    delivery_note: Optional[str] = None
    is_preorder: bool = False
    scheduled_at: Optional[datetime] = None
    payment_method: str = Field(default="cod_cash", pattern="^(cod_cash|cod_vietqr)$")
    items: List[OrderItemCreate] = Field(..., min_length=1)


class OrderStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern=VALID_ORDER_STATUSES)
    cancelled_reason: Optional[str] = None


class OrderResponse(BaseModel):
    id: str
    order_code_suffix: str
    user_id: Optional[int] = None
    staff_id: Optional[int] = None
    order_type: str
    recipient_name: str
    recipient_phone: str
    campus_location_id: Optional[int] = None
    room_detail: Optional[str] = None
    delivery_address: str
    delivery_note: Optional[str] = None
    is_preorder: bool
    scheduled_at: Optional[datetime] = None
    status: str
    subtotal_amount: float
    ship_fee: float
    total_amount: float
    payment_method: str
    payment_status: str
    eta: Optional[str] = None
    created_at: Optional[datetime] = None
    items: List[OrderItemResponse] = []

    class Config:
        from_attributes = True
