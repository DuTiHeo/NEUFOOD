"""One Vietnam-time policy for checkout, Orders and chatbot."""
from datetime import datetime, time, timedelta, timezone
from app.crud.setting import get_setting_by_key, get_setting_int

VIETNAM = timezone(timedelta(hours=7))


class OrderError(ValueError):
    def __init__(self, message: str, code: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


def get_order_policy(db, user, now=None):
    return {
        "server_now": (now or datetime.now(timezone.utc)).isoformat(),
        "open_time": get_setting_by_key(db, "canteen_open_time", "07:30"),
        "order_cutoff_time": get_setting_by_key(db, "canteen_order_cutoff_time", "18:30"),
        "close_time": get_setting_by_key(db, "canteen_close_time", "19:00"),
        "min_lead_minutes": max(30, get_setting_int(db, "min_preorder_lead_minutes", 30)),
        "max_days": 7,
        "closed_weekdays": [7],
        "exempt_hours": bool(user.ordering_hours_exempt),
    }


def validate_order_time(policy, is_preorder, scheduled_at, now):
    local_now = now.astimezone(VIETNAM)
    opening = time.fromisoformat(policy["open_time"])
    cutoff = time.fromisoformat(policy["order_cutoff_time"])
    closing = time.fromisoformat(policy["close_time"])
    if not opening < cutoff <= closing:
        raise OrderError("Cấu hình giờ phục vụ không hợp lệ. Vui lòng liên hệ Admin.", "ORDER_HOURS_CONFIG", 503)
    if is_preorder:
        if (scheduled_at is None or scheduled_at.utcoffset() is None
                or scheduled_at < now + timedelta(minutes=policy["min_lead_minutes"])):
            raise OrderError(f"Thời gian hẹn nhận phải cách thời điểm đặt hàng ít nhất {policy['min_lead_minutes']} phút.", "EX-08")
        local_schedule = scheduled_at.astimezone(VIETNAM)
        if not local_now.date() <= local_schedule.date() <= local_now.date() + timedelta(days=policy["max_days"]):
            raise OrderError("Chỉ được hẹn nhận trong hôm nay và 7 ngày tiếp theo (giờ Việt Nam).", "SCHEDULE_DATE_RANGE")
        if not policy["exempt_hours"] and local_schedule.isoweekday() == 7:
            raise OrderError("Canteen nghỉ Chủ nhật. Vui lòng hẹn nhận từ thứ Hai đến thứ Bảy trong khung giờ phục vụ.", "SCHEDULE_CLOSED_DAY")
        if not policy["exempt_hours"] and not opening <= local_schedule.time() <= closing:
            raise OrderError(f"Thời gian hẹn nhận phải nằm trong khung giờ từ {policy['open_time']} đến {policy['close_time']}.", "SCHEDULE_OUTSIDE_HOURS")
    elif scheduled_at is not None:
        raise OrderError("Chỉ gửi scheduled_at khi đặt hẹn giờ", "EX-08")
    elif not policy["exempt_hours"] and local_now.isoweekday() == 7:
        raise OrderError("Canteen nghỉ Chủ nhật nên không nhận đơn đặt ngay. Bạn có thể đặt hẹn nhận từ thứ Hai đến thứ Bảy trong khung giờ phục vụ.", "ORDER_CLOSED_DAY")
    elif not policy["exempt_hours"] and not opening <= local_now.time() <= cutoff:
        raise OrderError(f"Canteen nhận đơn đặt ngay từ {policy['open_time']} đến {policy['order_cutoff_time']} từ thứ Hai đến thứ Bảy và phục vụ đến {policy['close_time']}. Bạn có thể đặt hẹn giờ cho thời gian phục vụ phù hợp.", "ORDER_OUTSIDE_HOURS")


def has_sunday_schedule_conflict(order):
    from app.db.models import ACTIVE_ORDER_STATUSES
    return bool(order.is_preorder and order.scheduled_at and order.status in ACTIVE_ORDER_STATUSES
                and order.scheduled_at.astimezone(VIETNAM).isoweekday() == 7
                and not (order.user and order.user.ordering_hours_exempt))
