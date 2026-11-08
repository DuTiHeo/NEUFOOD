from typing import Any, Dict, List
from sqlalchemy.orm import Session

from app.core.cache import cache_get, cache_set
from app.crud.order import sync_overdue_orders
from app.db.models import (
    ACTIVE_ORDER_STATUSES,
    CampusLocation,
    Category,
    Dish,
    Order,
    SystemSetting,
)

CHAT_KNOWLEDGE_CACHE_KEY = "neufood:chat:knowledge_context"
CHAT_KNOWLEDGE_CACHE_TTL = 120  # 2 phút

ORDER_STATUS_LABELS: Dict[str, str] = {
    "CHO_XAC_NHAN": "Đang chờ Canteen A2 xác nhận",
    "DANG_CHUAN_BI": "Bếp Canteen A2 đang chuẩn bị món",
    "DANG_GIAO": "Shipper đang trên đường giao tới phòng/tòa nhà",
    "SAN_SANG_LAY": "Món đã sẵn sàng tại quầy Canteen A2 Tầng 1 (chờ khách tới nhận)",
    "DA_GIAO": "Đã giao hàng thành công",
    "DA_BAN_GIAO": "Đã bàn giao tại quầy Canteen A2",
    "HOAN_THANH": "Đã hoàn thành",
    "DA_HUY_KHACH": "Khách hàng đã hủy đơn",
    "TU_CHOI": "Canteen A2 từ chối nhận đơn",
    "TU_DONG_HUY": "Tự động hủy do quá thời hạn xác nhận",
    "GIAO_THAT_BAI": "Giao hàng thất bại (đang lưu giữ tạm tại quầy Canteen A2)",
    "BO_DON_BLACKLIST": "Bỏ đơn vi phạm chính sách nhận hàng COD (Blacklist)",
    "KHIEU_NAI": "Đang xử lý khiếu nại",
    "DA_GIAI_QUYET": "Khiếu nại đã được giải quyết",
}


def get_chatbot_knowledge_context(db: Session) -> Dict[str, Any]:
    """
    Truy vấn dữ liệu ngữ cảnh thực tế từ PostgreSQL phục vụ Grounding cho Chatbot AI:
    - Danh mục món ăn (Categories)
    - Thực đơn món đang còn phục vụ (available_dishes) và món tạm hết hôm nay (unavailable_dishes)
    - Danh sách tòa nhà/địa điểm giao hàng nội khu NEU (locations)
    - Các tham số vận hành hệ thống Canteen A2 (settings)
    Kết quả được lưu đệm trên Redis trong 120 giây để tối ưu tốc độ phản hồi.
    """
    cached = cache_get(CHAT_KNOWLEDGE_CACHE_KEY)
    if isinstance(cached, dict) and "available_dishes" in cached:
        return cached

    categories = (
        db.query(Category)
        .filter(Category.is_active.is_(True))
        .order_by(Category.display_order.asc(), Category.id.asc())
        .all()
    )
    category_list = [
        {"id": cat.id, "name": cat.name, "description": cat.description or ""}
        for cat in categories
    ]

    dishes = (
        db.query(Dish)
        .filter(Dish.is_deleted.is_(False), Dish.is_active.is_(True))
        .order_by(Dish.is_available.desc(), Dish.rating.desc(), Dish.review_count.desc(), Dish.name.asc())
        .all()
    )

    available_dishes: List[Dict[str, Any]] = []
    unavailable_dishes: List[Dict[str, Any]] = []

    for dish in dishes:
        dish_info = {
            "id": dish.id,
            "name": dish.name,
            "short_description": dish.short_description or "",
            "price": int(float(dish.price)),
            "base_price": int(float(dish.base_price)),
            "rating": round(float(dish.rating), 1) if dish.rating is not None else 5.0,
            "review_count": int(dish.review_count or 0),
            "image_url": dish.image_url or "",
            "is_available": bool(dish.is_available),
            "categories": [c.name for c in dish.categories if c.is_active],
            "category_ids": [c.id for c in dish.categories if c.is_active],
            "badges": [b.badge for b in dish.badges],
        }
        if dish.is_available:
            available_dishes.append(dish_info)
        else:
            unavailable_dishes.append(dish_info)

    locations = (
        db.query(CampusLocation)
        .filter(CampusLocation.is_active.is_(True))
        .order_by(CampusLocation.display_order.asc(), CampusLocation.id.asc())
        .all()
    )
    location_list = [
        {
            "id": loc.id,
            "building_code": loc.building_code,
            "building_name": loc.building_name,
            "default_room_note": loc.default_room_note or "",
        }
        for loc in locations
    ]

    settings_rows = db.query(SystemSetting).all()
    settings_map: Dict[str, str] = {
        "canteen_open_time": "07:30",
        "canteen_close_time": "19:00",
        "canteen_order_cutoff_time": "18:30",
        "delivery_fee": "5000",
        "system_maintenance_fee": "5000",
        "max_cod_amount": "500000",
        "max_dish_quantity_per_order": "10",
        "order_timeout_minutes": "10",
        "pickup_hold_minutes": "30",
        "min_preorder_lead_minutes": "30",
    }
    for row in settings_rows:
        settings_map[row.setting_key] = row.setting_value

    context_data = {
        "categories": category_list,
        "available_dishes": available_dishes,
        "unavailable_dishes": unavailable_dishes,
        "locations": location_list,
        "settings": settings_map,
    }

    cache_set(CHAT_KNOWLEDGE_CACHE_KEY, context_data, ttl=CHAT_KNOWLEDGE_CACHE_TTL)
    return context_data


def get_user_active_and_recent_orders(
    db: Session, user_id: int, limit: int = 3
) -> List[Dict[str, Any]]:
    """
    Đồng bộ trạng thái quá hạn và lấy danh sách các đơn hàng gần nhất của sinh viên đang đăng nhập
    để Trợ lý AI trả lời câu hỏi về tiến độ đơn hàng, mã 4 số cuối nhận hàng (BR-18), tổng tiền.
    """
    sync_overdue_orders(db, user_id=user_id)

    orders = (
        db.query(Order)
        .filter(Order.user_id == user_id)
        .order_by(Order.created_at.desc())
        .limit(max(1, limit))
        .all()
    )

    result: List[Dict[str, Any]] = []
    for order in orders:
        items_summary = [
            {
                "dish_name": item.dish_name,
                "quantity": item.quantity,
                "unit_price": int(float(item.unit_price)),
                "subtotal": int(float(item.subtotal)),
            }
            for item in order.items
        ]
        result.append(
            {
                "id": order.id,
                "order_code_suffix": order.order_code_suffix,
                "status": order.status,
                "status_label": ORDER_STATUS_LABELS.get(order.status, order.status),
                "is_active_order": order.status in ACTIVE_ORDER_STATUSES,
                "order_type": order.order_type,
                "order_type_label": "Giao tận nơi nội khu NEU" if order.order_type == "delivery" else "Nhận trực tiếp tại quầy Canteen A2",
                "delivery_address": order.delivery_address,
                "subtotal_amount": int(float(order.subtotal_amount)),
                "ship_fee": int(float(order.ship_fee)),
                "total_amount": int(float(order.total_amount)),
                "payment_method": "Tiền mặt COD" if order.payment_method == "cod_cash" else "Quét mã VietQR khi nhận hàng",
                "payment_status": "Đã thanh toán" if order.payment_status == "da_thanh_toan" else "Chưa thanh toán (Thu khi nhận món)",
                "eta": order.eta or ("15 - 25 phút" if order.order_type == "delivery" else "10 - 15 phút"),
                "cancelled_reason": order.cancelled_reason,
                "created_at": order.created_at.isoformat() if order.created_at else None,
                "items": items_summary,
            }
        )
    return result
