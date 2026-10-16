from typing import List, Optional
from sqlalchemy.orm import Session
from app.db.models import CampusLocation


def get_locations(db: Session, active_only: bool = True) -> List[CampusLocation]:
    """Lấy danh sách các tòa nhà/địa điểm giao hàng nội khu NEU (UC09, UC24)."""
    query = db.query(CampusLocation)
    if active_only:
        query = query.filter(CampusLocation.is_active == True)
    return query.order_by(CampusLocation.display_order.asc(), CampusLocation.id.asc()).all()


def get_location_by_id(db: Session, location_id: int) -> Optional[CampusLocation]:
    return db.query(CampusLocation).filter(CampusLocation.id == location_id).first()
