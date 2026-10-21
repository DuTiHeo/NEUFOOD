import re
from datetime import date, datetime
from typing import Optional
from flask import Blueprint, request, g
from pydantic import ValidationError

from app.db.session import get_db
from app.crud.shift import (
    get_shifts,
    get_shift_by_id,
    get_current_shift_summary,
    submit_shift,
    close_shift,
    get_revenue_report,
    get_vn_today,
    ShiftError,
)
from app.core.security import role_required
from app.schemas.shift import ShiftSubmitRequest, ShiftCloseRequest
from app.utils.helpers import api_response


shift_bp = Blueprint("shifts", __name__, url_prefix="/shifts")

DATE_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _parse_report_date(date_str: Optional[str]) -> Optional[date]:
    if not date_str:
        return None
    if not DATE_REGEX.match(date_str):
        raise ValueError("Invalid format")
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    if not (2000 <= d.year <= 2100):
        raise ValueError("Year out of range")
    return d


def _serialize_shift(s) -> dict:
    return {
        "id": s.id,
        "staff_id": s.staff_id,
        "staff_name": s.staff.full_name if s.staff else None,
        "shift_date": s.shift_date.isoformat() if s.shift_date else None,
        "total_orders_handled": s.total_orders_handled,
        "expected_cash": float(s.expected_cash),
        "expected_qr": float(s.expected_qr),
        "actual_cash": float(s.actual_cash),
        "actual_qr": float(s.actual_qr),
        "discrepancy_amount": float(s.discrepancy_amount),
        "discrepancy_note": s.discrepancy_note,
        "status": s.status,
        "closed_by": s.closed_by,
        "closed_at": s.closed_at.isoformat() if s.closed_at else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


@shift_bp.route("", methods=["GET"])
@role_required("staff", "manager", "admin")
def list_shifts():
    """
    Xem danh sách ca làm việc & đối soát COD (UC20, BR-25).
    Nhân viên xem ca của mình; Quản lý và Admin xem toàn bộ hệ thống.
    """
    try:
        user_id = int(g.current_user["sub"])
    except (KeyError, TypeError, ValueError):
        return api_response(message="Phiên đăng nhập không hợp lệ", status_code=401, success=False)

    role = g.current_user.get("role")
    with get_db() as db:
        shifts = get_shifts(db, staff_id=user_id if role == "staff" else None)
        data = [_serialize_shift(s) for s in shifts]
        return api_response(data=data)


@shift_bp.route("/my-current-shift", methods=["GET"])
@role_required("staff", "manager")
def my_current_shift():
    """
    Xem thông số tổng hợp ca hiện tại trong ngày của nhân viên (UC20).
    Trả về tổng số đơn đã giao, tiền mặt dự kiến và QR dự kiến.
    """
    try:
        user_id = int(g.current_user["sub"])
    except (KeyError, TypeError, ValueError):
        return api_response(message="Phiên đăng nhập không hợp lệ", status_code=401, success=False)

    try:
        with get_db() as db:
            summary = get_current_shift_summary(db, staff_id=user_id)
            return api_response(data=summary)
    except ShiftError as e:
        return api_response(message=str(e), errors=[{"code": e.code}], status_code=e.status_code, success=False)


@shift_bp.route("/reports/summary", methods=["GET"])
@role_required("manager", "admin")
def reports_summary():
    """
    Báo cáo tổng hợp doanh thu và số lượng đơn hàng theo khoảng ngày (giờ VN) (UC22, Quyết định D8).
    Query parameters: from_date (YYYY-MM-DD), to_date (YYYY-MM-DD). Mặc định là ngày hôm nay.
    """
    from_date_str = request.args.get("from_date")
    to_date_str = request.args.get("to_date")

    try:
        from_date = _parse_report_date(from_date_str) or get_vn_today()
        to_date = _parse_report_date(to_date_str) or get_vn_today()
    except ValueError:
        return api_response(
            message="Định dạng ngày không hợp lệ, yêu cầu định dạng YYYY-MM-DD (năm 2000-2100)",
            errors=[{"code": "INVALID_DATE_FORMAT"}],
            status_code=422,
            success=False,
        )

    try:
        with get_db() as db:
            report = get_revenue_report(db, from_date, to_date)
            return api_response(data=report, message="Lấy báo cáo doanh thu thành công")
    except ShiftError as e:
        return api_response(message=str(e), errors=[{"code": e.code}], status_code=e.status_code, success=False)


@shift_bp.route("/submit", methods=["POST"])
@role_required("staff")
def submit_shift_endpoint():
    """
    Nhân viên nộp số liệu kiểm đếm COD cuối ca (UC20, BR-25, EX-20).
    Tính độ lệch discrepancy_amount; nếu lệch != 0 bắt buộc có giải trình.
    """
    try:
        user_id = int(g.current_user["sub"])
    except (KeyError, TypeError, ValueError):
        return api_response(message="Phiên đăng nhập không hợp lệ", status_code=401, success=False)

    try:
        data = ShiftSubmitRequest.model_validate(request.get_json(silent=True))
    except ValidationError as e:
        return api_response(
            message="Dữ liệu nộp chốt ca không hợp lệ",
            errors=e.errors(include_context=False),
            status_code=422,
            success=False,
        )

    try:
        with get_db() as db:
            shift, is_new = submit_shift(
                db=db,
                staff_id=user_id,
                actual_cash=data.actual_cash,
                actual_qr=data.actual_qr,
                discrepancy_note=data.discrepancy_note,
            )
            return api_response(
                data=_serialize_shift(shift),
                message="Nộp số liệu chốt ca thành công",
                status_code=201 if is_new else 200,
            )
    except ShiftError as e:
        return api_response(message=str(e), errors=[{"code": e.code}], status_code=e.status_code, success=False)


@shift_bp.route("/<int(max=2147483647):shift_id>/close", methods=["PATCH"])
@role_required("manager", "admin")
def close_shift_endpoint(shift_id: int):
    """
    Quản lý hoặc Admin duyệt chốt ca COD (UC20, BR-25, Quyết định D7).
    """
    try:
        closer_id = int(g.current_user["sub"])
    except (KeyError, TypeError, ValueError):
        return api_response(message="Phiên đăng nhập không hợp lệ", status_code=401, success=False)

    try:
        data = ShiftCloseRequest.model_validate(request.get_json(silent=True))
    except ValidationError as e:
        return api_response(
            message="Dữ liệu duyệt chốt ca không hợp lệ",
            errors=e.errors(include_context=False),
            status_code=422,
            success=False,
        )

    try:
        with get_db() as db:
            shift = close_shift(
                db=db,
                closer_id=closer_id,
                shift_id=shift_id,
                status=data.status,
                discrepancy_note=data.discrepancy_note,
            )
            return api_response(
                data=_serialize_shift(shift),
                message="Duyệt chốt ca thành công",
                status_code=200,
            )
    except ShiftError as e:
        return api_response(message=str(e), errors=[{"code": e.code}], status_code=e.status_code, success=False)


@shift_bp.route("/<int(max=2147483647):shift_id>", methods=["GET"])
@role_required("staff", "manager", "admin")
def get_shift_detail(shift_id: int):
    """
    Xem chi tiết 01 ca làm việc theo ID.
    """
    try:
        user_id = int(g.current_user["sub"])
    except (KeyError, TypeError, ValueError):
        return api_response(message="Phiên đăng nhập không hợp lệ", status_code=401, success=False)

    role = g.current_user.get("role")
    with get_db() as db:
        shift = get_shift_by_id(db, shift_id)
        if not shift or (role == "staff" and shift.staff_id != user_id):
            return api_response(message="Không tìm thấy ca làm việc", errors=[{"code": "NOT_FOUND"}], status_code=404, success=False)

        return api_response(data=_serialize_shift(shift))

