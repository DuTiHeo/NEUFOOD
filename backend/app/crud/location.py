from typing import List, Optional

from sqlalchemy.orm import Session

from app.db.models import CampusLocation, Order


TERMINAL_ORDER_STATUSES = {
    "HOAN_THANH",
    "DA_HUY_KHACH",
    "TU_CHOI",
    "TU_DONG_HUY",
    "BO_DON_BLACKLIST",
    "DA_GIAI_QUYET",
}


def get_locations(db: Session, active_only: bool = True) -> List[CampusLocation]:
    """List campus locations in their configured display order."""
    query = db.query(CampusLocation)
    if active_only:
        query = query.filter(CampusLocation.is_active.is_(True))
    return query.order_by(CampusLocation.display_order.asc(), CampusLocation.id.asc()).all()


def get_location_by_id(db: Session, location_id: int) -> Optional[CampusLocation]:
    return db.query(CampusLocation).filter(CampusLocation.id == location_id).first()


def get_location_by_code(
    db: Session, building_code: str, exclude_id: Optional[int] = None
) -> Optional[CampusLocation]:
    query = db.query(CampusLocation).filter(CampusLocation.building_code == building_code)
    if exclude_id is not None:
        query = query.filter(CampusLocation.id != exclude_id)
    return query.first()


def create_location(db: Session, data: dict) -> CampusLocation:
    location = CampusLocation(**data)
    db.add(location)
    db.flush()
    db.refresh(location)
    return location


def update_location(
    db: Session, location: CampusLocation, update_data: dict
) -> CampusLocation:
    for field, value in update_data.items():
        setattr(location, field, value)
    db.flush()
    db.refresh(location)
    return location


def has_nonterminal_orders(db: Session, location_id: int) -> bool:
    return (
        db.query(Order.id)
        .filter(
            Order.campus_location_id == location_id,
            Order.status.notin_(TERMINAL_ORDER_STATUSES),
        )
        .first()
        is not None
    )


def delete_or_deactivate_location(
    db: Session, location: CampusLocation
) -> bool:
    """Deactivate a location in use by an unfinished order; otherwise delete it."""
    if has_nonterminal_orders(db, location.id):
        location.is_active = False
        db.flush()
        return True

    db.delete(location)
    db.flush()
    return False
