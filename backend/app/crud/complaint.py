from datetime import datetime, timedelta, timezone
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload

from app.db.models import Complaint, Order, User
from app.crud.setting import get_setting_int

COMPLAINABLE_ORDER_STATUSES = ("DA_GIAO", "DA_BAN_GIAO", "HOAN_THANH")


class ComplaintError(ValueError):
    """Lỗi nghiệp vụ của Complaints; route đọc code/status_code để trả response."""

    def __init__(self, message: str, code: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


def get_complaints(db: Session, user_id: Optional[int] = None) -> List[Complaint]:
    """Lấy danh sách ticket khiếu nại (UC15, UC25). Eager load user để tránh N+1."""
    query = db.query(Complaint).options(joinedload(Complaint.user))
    if user_id is not None:
        query = query.filter(Complaint.user_id == user_id)
    return query.order_by(Complaint.created_at.desc(), Complaint.id.desc()).all()


def get_complaint_by_id(db: Session, complaint_id: int) -> Optional[Complaint]:
    """Lấy chi tiết 01 khiếu nại theo ID."""
    return db.query(Complaint).options(joinedload(Complaint.user)).filter(Complaint.id == complaint_id).first()


def create_complaint(
    db: Session,
    user_id: int,
    order_id: str,
    reason: str,
    description: str,
    proof_image_url: str,
) -> Complaint:
    """
    UC15: Khách gửi khiếu nại đơn hàng (BR-23, BR-24, EX-14, EX-15).
    Caller quản lý commit/rollback.
    """
    clean_reason = reason.strip() if reason else ""
    clean_desc = description.strip() if description else ""
    clean_img = proof_image_url.strip() if proof_image_url else ""
    if not clean_reason or not clean_desc or not clean_img:
        raise ComplaintError("Nội dung khiếu nại không được để trống hoặc chỉ chứa khoảng trắng", "INVALID_INPUT", 400)

    user = db.query(User).filter(User.id == user_id).with_for_update(read=True).first()
    if not user or not user.is_active or user.role != "customer":
        raise ComplaintError("Tài khoản không có quyền khiếu nại", "FORBIDDEN", 403)

    order = db.query(Order).filter(Order.id == order_id, Order.user_id == user_id).with_for_update().first()
    if not order:
        raise ComplaintError("Không tìm thấy đơn hàng", "NOT_FOUND", 404)

    # Kiểm tra trùng lặp trước: nếu đơn đã có khiếu nại (kể cả trạng thái đơn đã đổi sang KHIEU_NAI) -> trả lỗi EX-15
    existing = db.query(Complaint.id).filter(Complaint.order_id == order_id).first()
    if existing:
        raise ComplaintError("Mỗi đơn hàng chỉ được tạo tối đa 01 khiếu nại", "EX-15", 400)

    if order.status not in COMPLAINABLE_ORDER_STATUSES:
        raise ComplaintError("Chỉ được khiếu nại đơn đã giao hoặc hoàn thành", "EX-14", 400)

    if not order.delivered_at:
        raise ComplaintError("Đơn hàng chưa được ghi nhận thời điểm giao", "EX-14", 400)

    delivered_at = order.delivered_at
    if delivered_at.tzinfo is None:
        delivered_at = delivered_at.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    window_hours = get_setting_int(db, "complaint_window_hours", 24)
    if now - delivered_at > timedelta(hours=window_hours):
        raise ComplaintError(
            f"Đã quá thời hạn khiếu nại đơn hàng ({window_hours} giờ)",
            "EX-14",
            400,
        )

    complaint = Complaint(
        order_id=order_id,
        user_id=user_id,
        reason=clean_reason,
        description=clean_desc,
        proof_image_url=clean_img,
        status="DANG_XU_LY",
    )
    db.add(complaint)

    # Đổi trạng thái đơn hàng sang KHIEU_NAI
    order.status = "KHIEU_NAI"

    db.flush()
    return complaint


def resolve_complaint(
    db: Session,
    admin_id: int,
    complaint_id: int,
    status: str,
    admin_response: str,
) -> Complaint:
    """
    UC25: Admin độc quyền phân xử khiếu nại (BR-24).
    Caller quản lý commit/rollback.
    """
    if status not in ("CHAP_NHAN", "TU_CHOI"):
        raise ComplaintError("Trạng thái xử lý không hợp lệ", "INVALID_STATUS", 400)

    clean_response = admin_response.strip() if admin_response else ""
    if not clean_response:
        raise ComplaintError("Phản hồi giải quyết khiếu nại không được để trống", "INVALID_INPUT", 400)

    admin = db.query(User).filter(User.id == admin_id).with_for_update(read=True).first()
    if not admin or not admin.is_active or admin.role != "admin":
        raise ComplaintError("Chỉ quản trị viên mới có quyền xử lý khiếu nại", "FORBIDDEN", 403)

    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).with_for_update().first()
    if not complaint:
        raise ComplaintError("Không tìm thấy khiếu nại", "NOT_FOUND", 404)

    if complaint.status != "DANG_XU_LY":
        raise ComplaintError("Khiếu nại đã được xử lý trước đó", "COMPLAINT_ALREADY_RESOLVED", 400)

    order = db.query(Order).filter(Order.id == complaint.order_id).with_for_update().first()
    if not order:
        raise ComplaintError("Không tìm thấy đơn hàng tương ứng với khiếu nại", "NOT_FOUND", 404)
    if order.status != "KHIEU_NAI":
        raise ComplaintError("Đơn hàng không ở trạng thái khiếu nại", "INVALID_ORDER_STATUS", 400)

    order.status = "DA_GIAI_QUYET"

    now = datetime.now(timezone.utc)
    complaint.status = status
    complaint.admin_response = clean_response
    complaint.resolved_by = admin_id
    complaint.resolved_at = now
    complaint.updated_at = now

    db.flush()
    return complaint


