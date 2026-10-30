from typing import Optional
from datetime import date, datetime
from pydantic import BaseModel, Field


class ShiftSubmitRequest(BaseModel):
    """Schema xác thực nhân viên nộp tiền chốt ca COD (UC20)."""
    actual_cash: float = Field(..., ge=0, le=9999999999.99, allow_inf_nan=False, description="Số tiền mặt thực tế kiểm đếm (VNĐ)")
    actual_qr: float = Field(..., ge=0, le=9999999999.99, allow_inf_nan=False, description="Số tiền QR thực tế sao kê (VNĐ)")
    discrepancy_note: Optional[str] = Field(default=None, max_length=1000, description="Giải trình nếu có chênh lệch tiền COD (EX-20)")


class ShiftCloseRequest(BaseModel):
    """Schema xác thực Quản lý / Admin duyệt chốt ca COD (UC20)."""
    status: str = Field(..., pattern="^(DA_CHOT|CAN_GIAI_TRINH)$", description="Trạng thái duyệt: DA_CHOT hoặc CAN_GIAI_TRINH")
    discrepancy_note: Optional[str] = Field(default=None, max_length=1000, description="Ghi chú xác nhận của Quản lý / Admin")


class StaffShiftResponse(BaseModel):
    """Schema định dạng dữ liệu trả về của bản ghi ca làm việc."""
    id: int
    staff_id: int
    staff_name: Optional[str] = None
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
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CurrentShiftSummaryResponse(BaseModel):
    """Schema định dạng dữ liệu tổng hợp ca làm việc hiện tại trong ngày."""
    staff_id: int
    staff_name: Optional[str] = None
    shift_date: date
    total_orders_handled: int
    expected_cash: float
    expected_qr: float
    actual_cash: float = 0.0
    actual_qr: float = 0.0
    discrepancy_amount: float = 0.0
    discrepancy_note: Optional[str] = None
    status: Optional[str] = None
    shift_id: Optional[int] = None


class TopDishReport(BaseModel):
    """Schema định dạng thông tin món ăn bán chạy trong báo cáo doanh thu."""
    dish_id: Optional[str] = None
    dish_name: str
    total_quantity: int
    total_revenue: float


class RevenueReportResponse(BaseModel):
    """Schema định dạng dữ liệu tổng hợp báo cáo doanh thu Canteen (UC22)."""
    from_date: Optional[date] = None
    to_date: Optional[date] = None
    total_orders: int
    completed_orders: int
    cancelled_or_rejected_orders: int
    blacklisted_orders: int
    gross_revenue: float
    canteen_net_revenue: float
    system_fee_total: float
    ship_fee_total: float
    top_dishes: list[TopDishReport]


