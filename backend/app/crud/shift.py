import math
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload

from app.db.models import StaffShift, Order, User, OrderItem

VN_TZ = timezone(timedelta(hours=7))


class ShiftError(ValueError):
    """Lỗi nghiệp vụ của Shifts; route đọc code/status_code để trả response."""

    def __init__(self, message: str, code: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


def get_vn_today() -> date:
    """Lấy ngày hiện tại theo giờ Việt Nam (UTC+7)."""
    return datetime.now(VN_TZ).date()


def get_vn_date_interval(from_date: date, to_date: date):
    """
    Trả về khoảng thời gian nửa mở [start_utc, end_utc)
    từ 00:00:00 ngày from_date đến 00:00:00 ngày to_date + 1 theo múi giờ Việt Nam (UTC+7).
    """
    start_vn = datetime(from_date.year, from_date.month, from_date.day, 0, 0, 0, tzinfo=VN_TZ)
    next_day = to_date + timedelta(days=1)
    end_vn = datetime(next_day.year, next_day.month, next_day.day, 0, 0, 0, tzinfo=VN_TZ)
    return start_vn.astimezone(timezone.utc), end_vn.astimezone(timezone.utc)


def get_shifts(db: Session, staff_id: Optional[int] = None) -> List[StaffShift]:
    """Lấy danh sách ca làm việc & đối soát COD (UC20, BR-25). Eager load staff để tránh N+1."""
    query = db.query(StaffShift).options(joinedload(StaffShift.staff))
    if staff_id is not None:
        query = query.filter(StaffShift.staff_id == staff_id)
    return query.order_by(StaffShift.shift_date.desc(), StaffShift.id.desc()).all()


def get_shift_by_id(db: Session, shift_id: int) -> Optional[StaffShift]:
    """Lấy chi tiết 01 ca làm việc theo ID."""
    return db.query(StaffShift).options(joinedload(StaffShift.staff)).filter(StaffShift.id == shift_id).first()


def calculate_staff_shift_orders(db: Session, staff_id: int, target_date: date):
    """
    Tính tổng số đơn và tiền dự kiến nhân viên đã bàn giao thành công trong ngày.
    Lọc các đơn: staff_id, payment_status == 'da_thanh_toan', delivered_at trong khoảng nửa mở của ngày (giờ VN).
    """
    start_utc, end_utc = get_vn_date_interval(target_date, target_date)

    orders = db.query(Order).filter(
        Order.staff_id == staff_id,
        Order.payment_status == "da_thanh_toan",
        Order.delivered_at.isnot(None),
        Order.delivered_at >= start_utc,
        Order.delivered_at < end_utc,
    ).all()

    total_orders = len(orders)
    expected_cash = sum((Decimal(str(o.total_amount)) for o in orders if o.payment_method == "cod_cash"), Decimal("0.00"))
    expected_qr = sum((Decimal(str(o.total_amount)) for o in orders if o.payment_method == "cod_vietqr"), Decimal("0.00"))

    return total_orders, expected_cash, expected_qr


def get_current_shift_summary(db: Session, staff_id: int, target_date: Optional[date] = None) -> dict:
    """
    UC20: Xem tổng hợp ca hiện tại của nhân viên (expected_cash, expected_qr, total_orders).
    """
    staff = db.query(User).filter(User.id == staff_id).first()
    if not staff:
        raise ShiftError("Không tìm thấy nhân viên", "NOT_FOUND", 404)

    today_vn = target_date or get_vn_today()
    total_orders, expected_cash, expected_qr = calculate_staff_shift_orders(db, staff_id, today_vn)

    current_shift = db.query(StaffShift).filter(
        StaffShift.staff_id == staff_id,
        StaffShift.shift_date == today_vn,
    ).first()

    return {
        "staff_id": staff_id,
        "staff_name": staff.full_name,
        "shift_date": today_vn.isoformat(),
        "total_orders_handled": total_orders,
        "expected_cash": float(expected_cash),
        "expected_qr": float(expected_qr),
        "actual_cash": float(current_shift.actual_cash) if current_shift else 0.0,
        "actual_qr": float(current_shift.actual_qr) if current_shift else 0.0,
        "discrepancy_amount": float(current_shift.discrepancy_amount) if current_shift else 0.0,
        "discrepancy_note": current_shift.discrepancy_note if current_shift else None,
        "status": current_shift.status if current_shift else None,
        "shift_id": current_shift.id if current_shift else None,
    }


def submit_shift(
    db: Session,
    staff_id: int,
    actual_cash: float,
    actual_qr: float,
    discrepancy_note: Optional[str] = None,
) -> tuple[StaffShift, bool]:
    """
    UC20: Nhân viên nộp số liệu chốt ca COD cuối ngày (BR-25, EX-20, Quyết định D6).
    Khóa độc quyền nhân viên để chặn hoàn toàn race condition tạo 2 ca cùng ngày.
    """
    # Phòng vệ giá trị không hợp lệ (NaN, Inf, số âm hoặc tràn cột NUMERIC(12,2))
    if (
        math.isnan(actual_cash)
        or math.isinf(actual_cash)
        or actual_cash < 0
        or actual_cash > 9999999999.99
        or math.isnan(actual_qr)
        or math.isinf(actual_qr)
        or actual_qr < 0
        or actual_qr > 9999999999.99
    ):
        raise ShiftError("Số tiền kiểm đếm không hợp lệ hoặc vượt quá giới hạn", "INVALID_AMOUNT", 400)

    # 1. Khóa ĐỘC QUYỀN nhân viên (không dùng read=True) để tuần tự hóa các request submit cùng staff
    staff = db.query(User).filter(User.id == staff_id).with_for_update().first()
    if not staff or not staff.is_active or staff.role != "staff":
        raise ShiftError("Tài khoản không có quyền nộp chốt ca", "FORBIDDEN", 403)

    today_vn = get_vn_today()

    # 2. Tìm ca làm việc của ngày hôm nay sau khi đã có khóa độc quyền
    shift = db.query(StaffShift).filter(
        StaffShift.staff_id == staff_id,
        StaffShift.shift_date == today_vn,
    ).with_for_update().first()

    if shift and shift.status == "DA_CHOT":
        raise ShiftError("Ca làm việc hôm nay đã được chốt đóng, không thể nộp lại", "SHIFT_ALREADY_CLOSED", 400)

    is_new = shift is None

    # 3. Tính toán expected_* sau khi đã khóa độc quyền để bảo đảm số liệu mới nhất
    total_orders, expected_cash, expected_qr = calculate_staff_shift_orders(db, staff_id, today_vn)

    actual_cash_dec = Decimal(str(actual_cash)).quantize(Decimal("0.01"))
    actual_qr_dec = Decimal(str(actual_qr)).quantize(Decimal("0.01"))
    actual_total = actual_cash_dec + actual_qr_dec
    expected_total = expected_cash + expected_qr
    discrepancy = (actual_total - expected_total).quantize(Decimal("0.01"))

    clean_note = discrepancy_note.strip() if discrepancy_note else None
    if discrepancy != Decimal("0.00"):
        if not clean_note:
            raise ShiftError("Lệch tiền COD bắt buộc phải có giải trình (EX-20)", "EX-20", 400)
        status = "CAN_GIAI_TRINH"
    else:
        status = "CHO_DUYET"

    now = datetime.now(timezone.utc)
    if shift:
        shift.total_orders_handled = total_orders
        shift.expected_cash = expected_cash
        shift.expected_qr = expected_qr
        shift.actual_cash = actual_cash_dec
        shift.actual_qr = actual_qr_dec
        shift.discrepancy_amount = discrepancy
        shift.discrepancy_note = clean_note
        shift.status = status
        shift.updated_at = now
    else:
        shift = StaffShift(
            staff_id=staff_id,
            shift_date=today_vn,
            total_orders_handled=total_orders,
            expected_cash=expected_cash,
            expected_qr=expected_qr,
            actual_cash=actual_cash_dec,
            actual_qr=actual_qr_dec,
            discrepancy_amount=discrepancy,
            discrepancy_note=clean_note,
            status=status,
            created_at=now,
            updated_at=now,
        )
        db.add(shift)

    db.flush()
    return shift, is_new


def close_shift(
    db: Session,
    closer_id: int,
    shift_id: int,
    status: str,
    discrepancy_note: Optional[str] = None,
) -> StaffShift:
    """
    UC20: Quản lý hoặc Admin duyệt chốt ca COD (Quyết định D7).
    """
    # 1. Kiểm tra status đầu vào trước khi thực hiện khóa DB
    if status not in ("DA_CHOT", "CAN_GIAI_TRINH"):
        raise ShiftError("Trạng thái chốt ca không hợp lệ", "INVALID_STATUS", 400)

    closer = db.query(User).filter(User.id == closer_id).with_for_update(read=True).first()
    if not closer or not closer.is_active or closer.role not in ("manager", "admin"):
        raise ShiftError("Chỉ Quản lý hoặc Admin mới có quyền duyệt chốt ca", "FORBIDDEN", 403)

    shift = db.query(StaffShift).filter(StaffShift.id == shift_id).with_for_update().first()
    if not shift:
        raise ShiftError("Không tìm thấy ca làm việc", "NOT_FOUND", 404)

    if shift.status == "DA_CHOT":
        raise ShiftError("Ca làm việc này đã được chốt trước đó", "SHIFT_ALREADY_CLOSED", 400)

    clean_note = discrepancy_note.strip() if discrepancy_note else None

    if status == "DA_CHOT":
        # Nếu có lệch tiền, bắt buộc phải có giải trình từ nhân viên hoặc quản lý
        if shift.discrepancy_amount != Decimal("0.00"):
            if not shift.discrepancy_note and not clean_note:
                raise ShiftError("Ca có chênh lệch tiền bắt buộc phải có ghi chú giải trình trước khi chốt", "EX-20", 400)

        shift.status = "DA_CHOT"
        shift.closed_by = closer_id
        shift.closed_at = datetime.now(timezone.utc)
    else:  # CAN_GIAI_TRINH
        shift.status = "CAN_GIAI_TRINH"

    if clean_note:
        shift.discrepancy_note = clean_note

    shift.updated_at = datetime.now(timezone.utc)
    db.flush()
    return shift


COMPLETED_ORDER_STATUSES = (
    "DA_GIAO", "DA_BAN_GIAO", "HOAN_THANH", "KHIEU_NAI", "DA_GIAI_QUYET"
)
CANCELLED_OR_REJECTED_ORDER_STATUSES = (
    "DA_HUY_KHACH", "TU_CHOI", "TU_DONG_HUY"
)
BLACKLISTED_ORDER_STATUSES = (
    "BO_DON_BLACKLIST",
)


def get_revenue_report(db: Session, from_date: date, to_date: date) -> dict:
    """
    UC22: Báo cáo tổng hợp doanh thu và đơn hàng theo khoảng ngày (giờ VN) (Quyết định D8).
    """
    if from_date > to_date:
        raise ShiftError("from_date không được lớn hơn to_date", "INVALID_DATE_RANGE", 400)

    if (to_date - from_date).days > 365:
        raise ShiftError("Khoảng thời gian báo cáo không được vượt quá 366 ngày", "DATE_RANGE_TOO_LONG", 400)

    start_utc, end_utc = get_vn_date_interval(from_date, to_date)

    # Lọc tất cả đơn hàng được tạo trong khoảng ngày này [start_utc, end_utc)
    all_orders = db.query(Order).filter(
        Order.created_at >= start_utc,
        Order.created_at < end_utc,
    ).all()

    total_orders = len(all_orders)
    completed_orders = sum(
        1 for o in all_orders if o.payment_status == "da_thanh_toan" and o.status in COMPLETED_ORDER_STATUSES
    )
    cancelled_or_rejected_orders = sum(
        1 for o in all_orders if o.status in CANCELLED_OR_REJECTED_ORDER_STATUSES
    )
    blacklisted_orders = sum(
        1 for o in all_orders if o.status in BLACKLISTED_ORDER_STATUSES
    )

    # Tính toán tài chính CHỈ trên các đơn đã thu tiền (payment_status == 'da_thanh_toan')
    paid_orders = [o for o in all_orders if o.payment_status == "da_thanh_toan"]
    paid_order_ids = [o.id for o in paid_orders]

    gross_revenue = sum((Decimal(str(o.total_amount)) for o in paid_orders), Decimal("0.00"))
    ship_fee_total = sum((Decimal(str(o.ship_fee)) for o in paid_orders), Decimal("0.00"))

    if paid_order_ids:
        items = db.query(OrderItem).filter(OrderItem.order_id.in_(paid_order_ids)).all()
    else:
        items = []

    canteen_net_revenue = sum((Decimal(str(i.base_price)) * i.quantity for i in items), Decimal("0.00"))
    system_fee_total = sum(
        ((Decimal(str(i.unit_price)) - Decimal(str(i.base_price))) * i.quantity for i in items),
        Decimal("0.00"),
    )

    # Thống kê top món bán chạy (sắp xếp theo quantity desc, revenue desc, dish_id desc)
    dish_stats = {}
    for i in items:
        if i.dish_id not in dish_stats:
            dish_stats[i.dish_id] = {
                "dish_id": i.dish_id,
                "dish_name": i.dish_name,
                "total_quantity": 0,
                "total_revenue": Decimal("0.00"),
            }
        dish_stats[i.dish_id]["total_quantity"] += i.quantity
        dish_stats[i.dish_id]["total_revenue"] += Decimal(str(i.subtotal))

    sorted_dishes = sorted(
        dish_stats.values(),
        key=lambda d: (d["total_quantity"], d["total_revenue"], d["dish_id"] or ""),
        reverse=True,
    )[:5]

    top_dishes = [
        {
            "dish_id": d["dish_id"],
            "dish_name": d["dish_name"],
            "total_quantity": d["total_quantity"],
            "total_revenue": float(d["total_revenue"]),
        }
        for d in sorted_dishes
    ]

    return {
        "from_date": from_date.isoformat(),
        "to_date": to_date.isoformat(),
        "total_orders": total_orders,
        "completed_orders": completed_orders,
        "cancelled_or_rejected_orders": cancelled_or_rejected_orders,
        "blacklisted_orders": blacklisted_orders,
        "gross_revenue": float(gross_revenue),
        "canteen_net_revenue": float(canteen_net_revenue),
        "system_fee_total": float(system_fee_total),
        "ship_fee_total": float(ship_fee_total),
        "top_dishes": top_dishes,
    }
