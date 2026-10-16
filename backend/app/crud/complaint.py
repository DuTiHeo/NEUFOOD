from typing import List, Optional
from sqlalchemy.orm import Session
from app.db.models import Complaint


def get_complaints(db: Session, user_id: Optional[int] = None) -> List[Complaint]:
    """Lấy danh sách ticket khiếu nại (UC15, UC25)."""
    query = db.query(Complaint)
    if user_id is not None:
        query = query.filter(Complaint.user_id == user_id)
    return query.order_by(Complaint.created_at.desc()).all()
