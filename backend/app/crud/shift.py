from typing import List, Optional
from sqlalchemy.orm import Session
from app.db.models import StaffShift


def get_shifts(db: Session, staff_id: Optional[int] = None) -> List[StaffShift]:
    """Lấy danh sách ca làm việc & đối soát COD (UC20, BR-25)."""
    query = db.query(StaffShift)
    if staff_id is not None:
        query = query.filter(StaffShift.staff_id == staff_id)
    return query.order_by(StaffShift.shift_date.desc(), StaffShift.id.desc()).all()
