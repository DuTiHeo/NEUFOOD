from typing import List, Optional
from sqlalchemy.orm import Session
from app.db.models import SystemSetting


def get_all_settings(db: Session) -> List[SystemSetting]:
    """Lấy toàn bộ tham số vận hành hệ thống."""
    return db.query(SystemSetting).order_by(SystemSetting.setting_key.asc()).all()


def get_setting_by_key(db: Session, key: str, default: str = "") -> str:
    """Lấy giá trị tham số hệ thống theo key."""
    setting = db.query(SystemSetting).filter(SystemSetting.setting_key == key).first()
    return setting.setting_value if setting else default


def upsert_setting(db: Session, key: str, value: str, description: Optional[str] = None) -> SystemSetting:
    """Cập nhật hoặc tạo mới tham số hệ thống (Dành cho Admin - Chương 2.3.5)."""
    setting = db.query(SystemSetting).filter(SystemSetting.setting_key == key).first()
    if setting:
        setting.setting_value = value
        if description is not None:
            setting.description = description
    else:
        setting = SystemSetting(setting_key=key, setting_value=value, description=description)
        db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting
