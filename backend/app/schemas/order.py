from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

VALID_ORDER_STATUSES = (
    "^(CHO_XAC_NHAN|DANG_CHUAN_BI|DANG_GIAO|SAN_SANG_LAY|"
    "DA_GIAO|DA_BAN_GIAO|GIAO_THAT_BAI|HOAN_THANH|"
    "DA_HUY_KHACH|TU_CHOI|TU_DONG_HUY|BO_DON_BLACKLIST|"
    "KHIEU_NAI|DA_GIAI_QUYET)$"
)


class PortionSelection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slot_id: str = Field(..., min_length=1, max_length=100)
    choice_id: str = Field(..., min_length=1, max_length=100)
    addon_ids: List[str] = Field(default_factory=list, max_length=20)


class OrderItemCreate(BaseModel):
    dish_id: str = Field(..., min_length=1, max_length=100)
    quantity: int = Field(..., strict=True, gt=0, le=10)
    note: Optional[str] = None
    portions: List[PortionSelection] = Field(default_factory=list, max_length=40)
    expected_unit_price: Optional[Decimal] = Field(default=None, ge=0, allow_inf_nan=False)


class OrderItemResponse(BaseModel):
    id: int
    dish_id: Optional[str] = None
    dish_name: str
    unit_price: float
    base_price: float = 0
    quantity: int
    note: Optional[str] = None
    subtotal: float
    portions: list = Field(default_factory=list)

    class Config:
        from_attributes = True


class OrderCreateRequest(BaseModel):
    order_type: str = Field(default="delivery", pattern="^(delivery|pickup)$")
    recipient_name: str = Field(..., min_length=2, max_length=150, pattern=r"\S")
    recipient_phone: str = Field(..., pattern=r"^0[35789][0-9]{8}$")
    campus_location_id: Optional[int] = Field(default=None, strict=True, gt=0)
    room_detail: Optional[str] = Field(default=None, max_length=100)
    delivery_address: Optional[str] = None
    delivery_note: Optional[str] = None
    is_preorder: bool = Field(default=False, strict=True)
    scheduled_at: Optional[AwareDatetime] = None
    payment_method: str = Field(default="cod_cash", pattern="^(cod_cash|cod_vietqr)$")
    deposit_token: Optional[str] = Field(default=None, max_length=4096)
    expected_pricing: Optional[dict] = None
    items: List[OrderItemCreate] = Field(..., min_length=1)


class OrderStatusUpdateRequest(BaseModel):
    phone_confirmed: bool = Field(default=False, strict=True)
    status: str = Field(..., pattern=VALID_ORDER_STATUSES)
    cancelled_reason: Optional[str] = None

    @model_validator(mode="after")
    def require_rejection_reason(self):
        if self.status == "TU_CHOI" and not (self.cancelled_reason or "").strip():
            raise ValueError("Cần nhập lý do từ chối đơn")
        return self


class OrderProcessRequest(BaseModel):
    phone_confirmed: bool = Field(default=False, strict=True)
    action: str = Field(..., pattern="^(accept|reject)$")
    reason: Optional[str] = None

    @model_validator(mode="after")
    def require_rejection_reason(self):
        if self.action == "reject" and not (self.reason or "").strip():
            raise ValueError("Cần nhập lý do từ chối đơn")
        return self


class OrderHandoverRequest(BaseModel):
    order_code_suffix: str = Field(..., strict=True, pattern=r"^[0-9]{4}$")


class OrderIssueRequest(BaseModel):
    issue_type: str = Field(..., pattern="^(no_answer|refuse_payment|pickup_timeout)$")
    reason: str = Field(..., min_length=1, pattern=r"\S")


class OrderResponse(BaseModel):
    bulk_pricing: dict = Field(default_factory=dict)
    cod_due: Optional[float] = None
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
    pickup_deadline: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    auto_complete_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    items: List[OrderItemResponse] = []

    class Config:
        from_attributes = True
