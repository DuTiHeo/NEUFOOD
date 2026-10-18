from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.db.models import SystemSetting


def get_all_settings(db: Session) -> List[SystemSetting]:
    """Lấy toàn bộ tham số vận hành hệ thống (UC23)."""
    return db.query(SystemSetting).order_by(SystemSetting.setting_key.asc()).all()


def get_setting_by_key(db: Session, key: str, default: str = "") -> str:
    """Lấy giá trị tham số hệ thống theo key dưới dạng chuỗi (UC23)."""
    setting = db.query(SystemSetting).filter(SystemSetting.setting_key == key).first()
    return setting.setting_value if setting else default


def get_setting_model_by_key(db: Session, key: str) -> Optional[SystemSetting]:
    """Lấy đối tượng ORM SystemSetting theo key (hoặc None nếu không tìm thấy) (UC23)."""
    return db.query(SystemSetting).filter(SystemSetting.setting_key == key).first()


def get_setting_int(db: Session, key: str, default: int = 0) -> int:
    """Lấy giá trị tham số hệ thống kiểu int theo key với fallback default (UC23)."""
    val = get_setting_by_key(db, key, "")
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


def upsert_setting(db: Session, key: str, value: str, description: Optional[str] = None) -> SystemSetting:
    """Cập nhật hoặc tạo mới tham số hệ thống (Dành cho Admin - Chương 2.3.5, UC23)."""
    now = datetime.now(timezone.utc)
    setting = db.query(SystemSetting).filter(SystemSetting.setting_key == key).first()
    if setting:
        setting.setting_value = value
        if description is not None:
            setting.description = description
        setting.updated_at = now
    else:
        setting = SystemSetting(
            setting_key=key,
            setting_value=value,
            description=description,
            updated_at=now,
        )
        db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting


def bulk_upsert_settings(db: Session, items: List[Dict[str, Any]]) -> List[SystemSetting]:
    """Cập nhật hoặc tạo mới hàng loạt tham số hệ thống trong một transaction (UC23)."""
    now = datetime.now(timezone.utc)
    results = []
    for item in items:
        key = item["setting_key"]
        val = item["setting_value"]
        desc = item.get("description")

        setting = db.query(SystemSetting).filter(SystemSetting.setting_key == key).first()
        if setting:
            setting.setting_value = val
            if desc is not None:
                setting.description = desc
            setting.updated_at = now
        else:
            setting = SystemSetting(
                setting_key=key,
                setting_value=val,
                description=desc,
                updated_at=now,
            )
            db.add(setting)
        results.append(setting)

    db.commit()
    for s in results:
        db.refresh(s)
    return results
