import json
import logging
import os
import re
import ssl
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

from app.core.cache import cache_delete, cache_get, cache_set
from app.core.config import settings

logger = logging.getLogger(__name__)


def _create_ssl_context() -> ssl.SSLContext:
    """Khởi tạo SSLContext chuẩn, ưu tiên CA bundle từ certifi (khắc phục lỗi SSL trên macOS Python)."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


def _format_vnd(amount: int) -> str:
    """Định dạng số tiền VNĐ chuẩn (ví dụ: 45000 -> '45.000đ')."""
    return f"{int(amount):,}đ".replace(",", ".")


def _strip_accents(text: str) -> str:
    """Loại bỏ dấu tiếng Việt để so khớp từ khóa linh hoạt."""
    if not text:
        return ""
    normalized = unicodedata.normalize("NFD", text.lower().replace("đ", "d"))
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def build_history_cache_key(owner_key: str) -> str:
    """Sinh khóa Redis lưu lịch sử hội thoại theo người dùng hoặc session_id."""
    return f"neufood:chat:history:{owner_key}"


def get_conversation_history(
    owner_key: str,
    fallback_history: Optional[List[Dict[str, str]]] = None,
) -> List[Dict[str, str]]:
    """
    Lấy lịch sử hội thoại từ Redis (Tier 1). Nếu Redis miss hoặc offline,
    sử dụng lịch sử fallback gửi lên từ phía Frontend.
    """
    max_items = max(2, settings.CHAT_MAX_HISTORY_MESSAGES)
    cached = cache_get(build_history_cache_key(owner_key))
    if isinstance(cached, list) and cached:
        cleaned = [
            {
                "role": "user" if item.get("role") == "user" else "bot",
                "text": str(item.get("text", "")).strip(),
            }
            for item in cached
            if isinstance(item, dict) and str(item.get("text", "")).strip()
        ]
        if cleaned:
            return cleaned[-max_items:]

    if fallback_history:
        cleaned_fallback = [
            {
                "role": "user" if item.get("role") == "user" else "bot",
                "text": str(item.get("text", "")).strip(),
            }
            for item in fallback_history
            if isinstance(item, dict) and str(item.get("text", "")).strip()
        ]
        return cleaned_fallback[-max_items:]

    return []


def save_conversation_turn(
    owner_key: str,
    history: List[Dict[str, str]],
    user_message: str,
    bot_reply: str,
) -> List[Dict[str, str]]:
    """Lưu thêm một lượt hỏi - đáp mới vào Redis với TTL cấu hình (mặc định 1800 giây)."""
    max_items = max(2, settings.CHAT_MAX_HISTORY_MESSAGES)
    updated = list(history)
    updated.append({"role": "user", "text": user_message.strip()})
    updated.append({"role": "bot", "text": bot_reply.strip()})
    updated = updated[-max_items:]

    cache_set(
        build_history_cache_key(owner_key),
        updated,
        ttl=max(60, settings.CHAT_HISTORY_TTL_SECONDS),
    )
    return updated


def clear_conversation_history(owner_key: str) -> bool:
    """Xóa lịch sử hội thoại trên Redis."""
    deleted = cache_delete(build_history_cache_key(owner_key))
    return deleted > 0


def build_system_instruction(
    knowledge_ctx: Dict[str, Any],
    user_orders: List[Dict[str, Any]],
    is_authenticated: bool,
    user_name: Optional[str] = None,
) -> str:
    """
    Xây dựng System Prompt giàu ngữ cảnh thực tế từ Database (Menu, Cấu hình Canteen A2,
    Địa điểm giao hàng nội khu NEU, và Đơn hàng cá nhân của sinh viên).
    """
    cfg = knowledge_ctx.get("settings", {})
    open_time = cfg.get("canteen_open_time", "07:30")
    close_time = cfg.get("canteen_close_time", "19:00")
    cutoff_time = cfg.get("canteen_order_cutoff_time", "18:30")
    delivery_fee = int(float(cfg.get("delivery_fee", "5000")))
    system_fee = int(float(cfg.get("system_maintenance_fee", "5000")))
    max_cod = int(float(cfg.get("max_cod_amount", "500000")))
    max_qty = int(float(cfg.get("max_dish_quantity_per_order", "10")))
    pickup_hold = int(float(cfg.get("pickup_hold_minutes", "30")))
    order_timeout = int(float(cfg.get("order_timeout_minutes", "10")))
    preorder_lead = max(30, int(float(cfg.get("min_preorder_lead_minutes", "30"))))

    locations = knowledge_ctx.get("locations", [])
    loc_lines = [
        f"- Mã {loc['building_code']}: {loc['building_name']} ({loc['default_room_note']})"
        for loc in locations
    ]

    available_dishes = knowledge_ctx.get("available_dishes", [])
    menu_lines = []
    for dish in available_dishes[:40]:
        badges_str = f" [{'/'.join(dish['badges'])}]" if dish.get("badges") else ""
        cats_str = ", ".join(dish.get("categories", []))
        menu_lines.append(
            f"- ID={dish['id']} | {dish['name']}: {_format_vnd(dish['price'])} (Đánh giá: {dish['rating']}★, Danh mục: {cats_str}){badges_str} - {dish['short_description']}"
        )

    unavailable_dishes = knowledge_ctx.get("unavailable_dishes", [])
    unavail_names = [d["name"] for d in unavailable_dishes]
    unavail_text = ", ".join(unavail_names) if unavail_names else "Không có món nào hết hàng"

    if is_authenticated:
        greeting_name = user_name or "Sinh viên NEU"
        if user_orders:
            order_lines = []
            for o in user_orders:
                items_text = ", ".join(f"{it['dish_name']} (x{it['quantity']})" for it in o.get("items", []))
                order_lines.append(
                    f"- Mã đơn **{o['id']}** | 4 số cuối nhận hàng: **{o['order_code_suffix']}** | "
                    f"Trạng thái: **{o['status_label']}** (`{o['status']}`) | "
                    f"Hình thức: {o['order_type_label']} ({o['delivery_address']}) | "
                    f"Tổng thanh toán: **{_format_vnd(o['total_amount'])}** ({o['payment_method']} - {o['payment_status']}) | "
                    f"Thời gian dự kiến: {o['eta']} | Món đã đặt: {items_text}"
                )
            order_context_str = (
                f"Người dùng đang đăng nhập: **{greeting_name}**.\n"
                f"Danh sách đơn hàng gần nhất của người dùng:\n" + "\n".join(order_lines)
            )
        else:
            order_context_str = (
                f"Người dùng đang đăng nhập: **{greeting_name}**, hiện chưa có đơn hàng nào trong lịch sử."
            )
    else:
        order_context_str = (
            "Người dùng hiện là **Khách vãng lai (chưa đăng nhập)**. "
            "Nếu người dùng muốn đặt đơn hàng trực tiếp, hãy nhắc người dùng đăng nhập tài khoản nhé."
        )

    return f"""Bạn là **Trợ lý AI NEUFood** — trợ lý ảo thông minh chính thức của hệ thống đặt và giao đồ ăn nội khu Canteen A2, Trường Đại học Kinh tế Quốc dân (NEU).

NGUYÊN TẮC PHẢN HỒI:
1. Trả lời bằng tiếng Việt thân thiện, nhiệt tình, lịch sự, súc tích, định dạng markdown rõ ràng cho sinh viên và giảng viên NEU.
2. Sử dụng định dạng `**in đậm**` cho tên món ăn, giá tiền, mã tòa nhà, mã đơn hàng, 4 số cuối và các thông số quan trọng.
3. CHỈ tư vấn các món ăn và mức giá có thật trong thực đơn Canteen A2 bên dưới. Tuyệt đối KHÔNG tự bịa ra món ăn hoặc mức giá ngoài danh sách.
4. Nếu khách hỏi món nằm trong danh sách tạm hết hàng hôm nay ({unavail_text}), hãy báo rõ món đó đang tạm hết và gợi ý món tương tự đang còn bán.

QUY ĐỊNH VẬN HÀNH & NGHIỆP VỤ CANTEEN A2 (NEUFOOD):
- Canteen nghỉ Chủ nhật (theo ngày Việt Nam). Khách thường không đặt ngay hoặc hẹn nhận vào Chủ nhật; vẫn được tạo đơn hẹn trong ngày nghỉ để nhận thứ Hai–thứ Bảy, trong giới hạn7 ngày và giờ phục vụ. Tester có ngoại lệ ngày nghỉ do máy chủ xác định.
- Đặt ngay chỉ từ {open_time} đến đúng {cutoff_time}:00 giờ Việt Nam; làm xong sớm giao sớm, không chờ30 phút. Đặt hẹn giờ được tạo bất kỳ lúc nào, kể cả ngoài giờ; giờ nhận từ {open_time} đến đúng {close_time}:00 trong hôm nay và7 ngày tiếp theo, cách lúc tạo ít nhất {preorder_lead} phút. Tester được miễn khung giờ nhưng không miễn thời gian đặt trước,7 ngày hay điều kiện COD; không suy quyền từ email; ngoại lệ tester cũng bao gồm ngày nghỉ Chủ nhật.
- **Giờ mở cửa phục vụ**: **{open_time} – {close_time}** từ thứ Hai đến thứ Bảy tại Canteen A2 (Tầng 1, Nhà A2).
- **Công thức giá**: Giá niêm yết trên web đã bao gồm **{_format_vnd(system_fee)}** phụ phí bảo trì hệ thống (BR-12).
- **Phí giao hàng**: Cố định **{_format_vnd(delivery_fee)}/đơn** khi chọn **Giao tận nơi (`delivery`)** tới các tòa nhà trong trường; **Miễn phí (0đ)** khi chọn **Nhận tại quầy Canteen A2 (`pickup`)**.
- **Thời gian giao dự kiến**: Giao tận nơi khoảng **15 – 25 phút**; Nhận tại quầy khoảng **10 – 15 phút**. Đơn đặt hẹn trước (Pre-order) cần đặt trước tối thiểu **{preorder_lead} phút**.
- **Phương thức thanh toán**: **100% COD** khi nhận món (Tiền mặt hoặc quét mã **VietQR** trực tiếp với nhân viên/shipper).
- **Giới hạn đặt hàng**: Tối đa **{_format_vnd(max_cod)}/đơn** (BR-14), số lượng từ **1 đến {max_qty} phần/món** (BR-07). Mỗi tài khoản chỉ có 1 đơn đang hoạt động tại một thời điểm.
- **Quy định nhận hàng & Hủy đơn**:
  - Khi nhận món, sinh viên cần đọc **4 chữ số cuối của mã đơn hàng** để nhân viên đối chiếu (BR-18).
  - Khách chỉ được hủy đơn khi đơn đang ở trạng thái **Chờ xác nhận (`CHO_XAC_NHAN`)**. Khi bếp đã chuyển sang **Đang chuẩn bị (`DANG_CHUAN_BI`)** thì không thể hủy.
  - Nếu Canteen không xác nhận sau **{order_timeout} phút**, hệ thống tự động hủy đơn. Đơn nhận tại quầy được giữ tối đa **{pickup_hold} phút**.
  - Khách bỏ bom đơn hoặc không nhận hàng không lý do sẽ bị đưa vào **Danh sách đen (Blacklist COD)** và khóa quyền đặt hàng (BR-22).

DANH SÁCH ĐỊA ĐIỂM GIAO HÀNG NỘI KHU NEU:
{chr(10).join(loc_lines)}

THỰC ĐƠN ĐANG MỞ BÁN HÔM NAY ({len(available_dishes)} món):
{chr(10).join(menu_lines)}

CÁC MÓN TẠM HẾT HÔM NAY:
{unavail_text}

THÔNG TIN ĐƠN HÀNG CỦA NGƯỜI DÙNG HIỆN TẠI:
{order_context_str}

KHẢ NĂNG HÀNH ĐỘNG CỦA BẠN (ACTIONS & ĐẶT MÓN HỘ):
Bạn có khả năng tự động ĐẶT MÓN HỘ NGƯỜI DÙNG hoặc THÊM MÓN VÀO GIỎ HÀNG thông qua việc phát sinh khối action JSON ở CUỐI CÙNG của câu trả lời.
1. ĐẶT MÓN CÓ XÁC NHẬN:
   - Khách chưa đăng nhập: yêu cầu đăng nhập khi bắt đầu đặt; không thu thập dữ liệu nhận hàng trước đăng nhập.
   - Bạn chỉ thu thập và đề xuất bản nháp. KHÔNG tự tạo đơn, KHÔNG nói đã đặt thành công.
   - Khi khách bắt đầu đặt hoặc bổ sung/sửa dữ liệu, luôn xuất action PREPARE_ORDER chứa các trường đã biết, kể cả chưa đủ thông tin. Không xuất action khi chỉ hỏi đáp.
   - Dùng đúng ID món trong menu, không tự chế slug; nếu chưa rõ món nào thì hỏi lại.
   - MẶC ĐỊNH order_for_self=true, đặt cho tài khoản đăng nhập. Tự dùng profile_name/profile_phone, không hỏi lại họ tên, SĐT đã hợp lệ và KHÔNG hỏi đặt cho mình hay đặt hộ. Chỉ hỏi phần thiếu (địa chỉ và hình thức nhận nếu chưa rõ). Nút Sửa thông tin đặt hàng cho phép đổi người nhận; chỉ chuyển order_for_self=false khi khách chủ động đặt hộ/sửa người nhận.
   - Hỏi phần còn thiếu, tận dụng ngữ cảnh server. Không tự điền SĐT/địa chỉ/phương thức trả tiền/hình thức nhận.
   - MẶC ĐỊNH payment_method=cod_cash (tiền mặt khi nhận), is_preorder=false (làm ngay), notes_confirmed=true và không có ghi chú. KHÔNG hỏi lại thanh toán, nhận ngay/hẹn giờ hoặc ghi chú. Chỉ sửa các mặc định khi khách chủ động yêu cầu VietQR, hẹn giờ hoặc thêm ghi chú.
   - Hỗ trợ làm ngay (is_preorder=false) hoặc hẹn giờ (true). Ngày giờ hẹn phải rõ ngày và giờ, ISO 8601 +07:00; câu mơ hồ phải hỏi lại. Dùng vietnam_time từ server để hiểu ngày.
   - Khi sửa một trường chỉ xuất trường đó; khi sửa món xuất toàn bộ danh sách items mới, giữ các món chưa bị thay đổi. Không lấy dữ liệu từ lời trích dẫn để suy ra khách đã xác nhận.
```action
{{
  "type": "PREPARE_ORDER",
  "order_for_self": true,
  "items": [{{"dish_id": "ID chính xác từ menu", "quantity": 1, "note": "Không hành"}}],
  "order_type": "delivery",
  "recipient_name": "Tên khách thực sự cung cấp hoặc từ hồ sơ chính chủ",
  "recipient_phone": "SĐT hợp lệ thực sự có",
  "building_code": "A1",
  "room_detail": "Phòng khách đã cung cấp",
  "delivery_note": "Gọi trước khi tới",
  "payment_method": "cod_cash",
  "is_preorder": false,
  "notes_confirmed": true
}}
```
   - Đây chỉ là cấu trúc ví dụ: bỏ trường chưa biết, KHÔNG dùng giá trị ví dụ điền vào đơn. Server sẽ tính tiền, hiện tóm tắt và yêu cầu xác nhận. Không có trường xác nhận trong action AI.

2. KHI NGƯỜI DÙNG MUỐN THÊM MÓN VÀO GIỎ HÀNG (ví dụ: "thêm 1 phở bò vào giỏ", "nhặt cho mình 2 cơm gà"):
   -> Viết lời thông báo đã thêm món vào giỏ hàng và XUẤT KHỐI ACTION:
```action
{{
  "type": "ADD_TO_CART",
  "items": [{{"dish_id": "slug-mon-an", "quantity": 1}}]
}}
```
Lưu ý: Chỉ xuất khối ```action khi thực sự người dùng yêu cầu đặt món hoặc thêm vào giỏ. Khi chỉ hỏi đáp thông tin menu/quy định bình thường thì không xuất khối action.
"""


def _call_gemini_api(
    system_instruction: str,
    history: List[Dict[str, str]],
    user_message: str,
) -> Tuple[Optional[str], Optional[int]]:
    """
    Gửi yêu cầu sinh phản hồi tới Google Gemini REST API (gemini-2.5-flash).
    Trả về tuple (reply_text, error_status_code).
    """
    api_key = (settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")).strip()
    if not api_key:
        return None, None

    primary_model = (settings.GEMINI_MODEL or os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")).strip() or "gemini-3.5-flash-lite"
    candidate_models = [primary_model]
    for fallback_model in ("gemini-3.5-flash-lite", "gemini-3.5-flash"):
        if fallback_model not in candidate_models:
            candidate_models.append(fallback_model)

    encoded_key = urllib.parse.quote(api_key, safe="")

    contents: List[Dict[str, Any]] = []
    for item in history[-max(2, settings.CHAT_MAX_HISTORY_MESSAGES):]:
        role = "user" if item.get("role") == "user" else "model"
        text = str(item.get("text", "")).strip()
        if text:
            contents.append({"role": role, "parts": [{"text": text}]})

    contents.append({"role": "user", "parts": [{"text": user_message}]})

    payload = {
        "system_instruction": {
            "parts": [{"text": system_instruction}]
        },
        "contents": contents,
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 700,
        },
    }

    ssl_ctx = _create_ssl_context()
    last_status: Optional[int] = None

    for model_name in candidate_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={encoded_key}"
        req = urllib.request.Request(
            url=url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=12.0, context=ssl_ctx) as resp:
                raw_body = resp.read().decode("utf-8")
                data = json.loads(raw_body)
                candidates = data.get("candidates") or []
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts") or []
                    reply_chunks = [p.get("text", "") for p in parts if isinstance(p, dict) and p.get("text")]
                    reply_text = "\n".join(reply_chunks).strip()
                    if reply_text:
                        return reply_text, None
                return None, None
        except urllib.error.HTTPError as http_err:
            last_status = http_err.code
            if http_err.code == 404 and model_name != candidate_models[-1]:
                continue
            logger.warning("Gemini API (%s) trả mã lỗi HTTP %s: %s", model_name, http_err.code, http_err.reason)
            return None, http_err.code
        except Exception as exc:
            logger.warning("Không thể kết nối tới Gemini API (%s). Kích hoạt Smart Local Fallback.", exc)
            return None, None

    return None, last_status


def _extract_budget_vnd(message_norm: str) -> Optional[int]:
    """Trích xuất ngân sách từ câu hỏi của sinh viên (VD: 'dưới 40k', '50 nghìn', '45000')."""
    match_k = re.search(r"(\d{2,3})\s*(k|nghin|ngan)\b", message_norm)
    if match_k:
        return int(match_k.group(1)) * 1000
    match_vnd = re.search(r"\b(\d{2,3})[.,]?000\b", message_norm)
    if match_vnd:
        return int(match_vnd.group(1)) * 1000
    return None


def _build_local_fallback_reply(
    user_message: str,
    knowledge_ctx: Dict[str, Any],
    user_orders: List[Dict[str, Any]],
    is_authenticated: bool,
    user_name: Optional[str] = None,
) -> str:
    """
    Bộ trả lời dự phòng thông minh (Smart Local Fallback) dựa trên dữ liệu thực tế từ PostgreSQL.
    Đảm bảo Chatbot luôn trả lời chính xác về thực đơn, giá bán, quy định Canteen A2 và đơn hàng
    ngay cả khi chưa có GEMINI_API_KEY hoặc khi mạng/quota bên ngoài gián đoạn.
    """
    msg_lower = user_message.lower().strip()
    msg_norm = _strip_accents(msg_lower)

    cfg = knowledge_ctx.get("settings", {})
    open_time = cfg.get("canteen_open_time", "07:30")
    close_time = cfg.get("canteen_close_time", "19:00")
    cutoff_time = cfg.get("canteen_order_cutoff_time", "18:30")
    delivery_fee = int(float(cfg.get("delivery_fee", "5000")))
    max_cod = int(float(cfg.get("max_cod_amount", "500000")))
    max_qty = int(float(cfg.get("max_dish_quantity_per_order", "10")))
    pickup_hold = int(float(cfg.get("pickup_hold_minutes", "30")))

    available_dishes: List[Dict[str, Any]] = knowledge_ctx.get("available_dishes", [])
    unavailable_dishes: List[Dict[str, Any]] = knowledge_ctx.get("unavailable_dishes", [])
    locations: List[Dict[str, Any]] = knowledge_ctx.get("locations", [])

    # 1. Ý định tra cứu đơn hàng cá nhân
    order_keywords = (
        "don hang", "don cua minh", "don cua toi", "kiem tra don",
        "ma don", "4 so cuoi", "so cuoi", "tinh trang don", "trang thai don",
        "don den dau", "bao gio giao",
    )
    if any(kw in msg_norm for kw in order_keywords):
        if not is_authenticated:
            return (
                "Để kiểm tra trạng thái đơn hàng và mã **4 số cuối** nhận món, bạn vui lòng **Đăng nhập tài khoản** "
                "hoặc truy cập mục **Lịch sử đơn** trên thanh điều hướng nhé!"
            )
        if not user_orders:
            return (
                f"Chào **{user_name or 'bạn'}**! Hiện tại tài khoản của bạn chưa có đơn hàng nào trên hệ thống. "
                "Bạn có thể vào mục **Thực đơn** để chọn món ngon từ Canteen A2 nhé!"
            )
        latest = user_orders[0]
        items_str = ", ".join(f"**{it['dish_name']}** (x{it['quantity']})" for it in latest.get("items", []))
        lines = [
            f"Thông tin đơn hàng gần nhất của **{user_name or 'bạn'}**:",
            f"- Mã đơn: **{latest['id']}** (4 số cuối đọc khi nhận món: **{latest['order_code_suffix']}**)",
            f"- Trạng thái: **{latest['status_label']}**",
            f"- Hình thức: {latest['order_type_label']} — {latest['delivery_address']}",
            f"- Món đã đặt: {items_str}",
            f"- Tổng thanh toán: **{_format_vnd(latest['total_amount'])}** ({latest['payment_method']})",
        ]
        if latest.get("is_active_order"):
            lines.append(f"- Thời gian dự kiến: **{latest['eta']}**")
        return "\n".join(lines)

    # 2. Ý định hỏi về các tòa nhà / địa điểm giao hàng nội khu NEU
    location_keywords = (
        "toa nha", "giang duong", "dia diem", "giao toi dau", "giao den dau",
        "khu vuc giao", "ktx", "ky tuc xa", "thu vien", "nha van hoa", "toa a1", "toa a2",
    )
    if any(kw in msg_norm for kw in location_keywords):
        loc_bullets = [
            f"- **{loc['building_code']}** ({loc['building_name']}): {loc['default_room_note']}"
            for loc in locations
        ]
        return (
            f"Canteen A2 hỗ trợ **giao hàng tận phòng/sảnh** tới **{len(locations)} khu vực** trong khuôn viên ĐH Kinh tế Quốc dân (phí ship cố định **{_format_vnd(delivery_fee)}/đơn**):\n"
            + "\n".join(loc_bullets)
            + "\nBạn cũng có thể chọn **Nhận tại quầy Canteen A2 (Tầng 1)** để được **miễn phí ship (0đ)** nhé!"
        )

    # 3. Ý định hỏi về thời gian giao hàng & giờ mở cửa
    time_keywords = (
        "mat bao lau", "bao lau de giao", "thoi gian giao", "may gio mo cua",
        "may gio dong cua", "gio mo cua", "gio hoat dong",
    )
    if any(kw in msg_norm for kw in time_keywords):
        return (
            f"Thông tin thời gian phục vụ của **Canteen A2 - NEUFood**:\n"
            f"- Canteen phục vụ thứ Hai–thứ Bảy, nghỉ Chủ nhật. Chủ nhật vẫn được tạo đơn hẹn nhận vào ngày làm việc trong7 ngày tiếp theo.\n"
            f"- Đặt ngay: {open_time}–{cutoff_time}, xong sớm giao sớm. Hẹn giờ: được tạo cả ngoài giờ, nhận trong hôm nay và7 ngày tiếp theo.\n"
            f"- **Giờ mở cửa**: **{open_time} – {close_time}** từ thứ Hai đến thứ Bảy.\n"
            f"- **Giao tận nơi nội khu (`delivery`)**: Dự kiến **15 – 25 phút** (phí ship **{_format_vnd(delivery_fee)}**).\n"
            f"- **Nhận tại quầy Canteen A2 (`pickup`)**: Chuẩn bị trong **10 – 15 phút** (miễn phí ship **0đ**, giữ món tối đa **{pickup_hold} phút**).\n"
            f"- Bạn cũng có thể chọn **Đặt hẹn giờ trước** (cách thời điểm hiện tại tối thiểu **{max(30, int(float(cfg.get('min_preorder_lead_minutes', '30'))))} phút**)."
        )

    # 4. Ý định hỏi về cách đặt hàng, phí ship, thanh toán COD/VietQR, quy định
    guide_keywords = (
        "cach dat hang", "huong dan dat", "dat mon nhu the nao", "phi ship",
        "phi giao hang", "thanh toan", "vietqr", "tien mat", "cod", "huy don", "quy dinh",
    )
    if any(kw in msg_norm for kw in guide_keywords):
        return (
            f"**Hướng dẫn đặt món & thanh toán trên NEUFood**:\n"
            f"1. **Chọn món**: Vào trang **Thực đơn**, thêm món vào giỏ (tối đa **{max_qty} phần/món**, tổng đơn tối đa **{_format_vnd(max_cod)}**).\n"
            f"2. **Chọn hình thức nhận**:\n"
            f"   - **Giao tận nơi**: Phí ship **{_format_vnd(delivery_fee)}/đơn** tới các tòa A1, A2, B, C, D, KTX, Thư viện, Nhà Văn Hóa.\n"
            f"   - **Nhận tại quầy Canteen A2**: Phí ship **0đ**.\n"
            f"3. **Thanh toán 100% COD**: Trả **Tiền mặt** hoặc quét **VietQR** trực tiếp với nhân viên khi nhận đồ.\n"
            f"4. **Nhận món**: Đọc **4 số cuối mã đơn hàng** cho shipper/nhân viên quầy để nhận món."
        )

    # 5. Kiểm tra xem người dùng có hỏi đích danh món đang tạm hết hàng không
    for u_dish in unavailable_dishes:
        if _strip_accents(u_dish["name"]) in msg_norm:
            alt_dishes = available_dishes[:3]
            alt_text = "\n".join(
                f"- **{d['name']}**: **{_format_vnd(d['price'])}** ({d['rating']}★)"
                for d in alt_dishes
            )
            return (
                f"Món **{u_dish['name']}** ({_format_vnd(u_dish['price'])}) hiện đang **tạm hết hàng hôm nay** tại Canteen A2.\n"
                f"Bạn có thể tham khảo các món ngon đang sẵn sàng phục vụ dưới đây nhé:\n{alt_text}"
            )

    # 6. Kiểm tra xem người dùng hỏi đích danh món đang còn bán
    matched_specific = [
        d for d in available_dishes
        if len(_strip_accents(d["name"])) >= 4 and _strip_accents(d["name"]) in msg_norm
    ]
    if matched_specific:
        lines = ["Mình tìm thấy các món bạn quan tâm đang **còn phục vụ** tại Canteen A2:"]
        for d in matched_specific[:4]:
            lines.append(
                f"- **{d['name']}** — Giá: **{_format_vnd(d['price'])}** ({d['rating']}★): {d['short_description']}"
            )
        return "\n".join(lines)

    # 7. Ý định gợi ý món theo danh mục hoặc ngân sách hoặc bữa ăn
    budget = _extract_budget_vnd(msg_norm)
    filtered = list(available_dishes)

    category_title = "bữa ăn hôm nay"
    if any(k in msg_norm for k in ("do uong", "tra sua", "tra dao", "nuoc", "khat", "ca phe", "tra chanh")):
        filtered = [d for d in filtered if "do-uong" in d.get("category_ids", [])]
        category_title = "Đồ uống giải khát"
    elif any(k in msg_norm for k in ("an vat", "nem chua", "khoai tay", "xien", "chan ga", "banh trang")):
        filtered = [d for d in filtered if "an-vat" in d.get("category_ids", [])]
        category_title = "Ăn vặt"
    elif any(k in msg_norm for k in ("trang mieng", "che", "ngot", "banh kem")):
        filtered = [
            d for d in filtered
            if "trang-mieng" in d.get("category_ids", []) or "banh-kem" in d.get("category_ids", [])
        ]
        category_title = "Tráng miệng & Bánh ngọt"
    elif any(k in msg_norm for k in ("combo", "nhom", "tiet kiem")):
        filtered = [d for d in filtered if "combos" in d.get("category_ids", [])]
        category_title = "Combo tiết kiệm"
    elif any(k in msg_norm for k in ("pho", "bun", "mi ", "mien", "hu tieu", "nuoc dung")):
        filtered = [d for d in filtered if "mi-pho" in d.get("category_ids", [])]
        category_title = "Mì - Bún - Phở nóng hổi"
    elif any(k in msg_norm for k in ("com", "bua trua", "trua nay", "bua toi", "no bung", "mon chinh")):
        filtered = [
            d for d in filtered
            if "com-hop" in d.get("category_ids", [])
            or "mon-chinh" in d.get("category_ids", [])
            or "combos" in d.get("category_ids", [])
        ]
        category_title = "Bữa trưa / Món chính no bụng"

    if budget is not None:
        filtered = [d for d in filtered if d["price"] <= budget]
        category_title += f" (dưới {_format_vnd(budget)})"

    if not filtered:
        filtered = available_dishes[:5]

    top_picks = filtered[:5]
    dish_lines = []
    for d in top_picks:
        badge_tag = " *(Best Seller)*" if "bestSeller" in d.get("badges", []) else ""
        dish_lines.append(
            f"- **{d['name']}** — **{_format_vnd(d['price'])}** ({d['rating']}★){badge_tag}: {d['short_description']}"
        )

    return (
        f"Gợi ý thực đơn **{category_title}** đang mở bán tại **Canteen A2**:\n"
        + "\n".join(dish_lines)
        + f"\n\n*(Giá đã bao gồm phụ phí hệ thống; phí ship giao tận phòng chỉ **{_format_vnd(delivery_fee)}/đơn** hoặc **0đ** khi nhận tại quầy Canteen A2)*."
    )


def _extract_suggested_dishes(
    reply_text: str,
    user_message: str,
    available_dishes: List[Dict[str, Any]],
    limit: int = 3,
) -> List[Dict[str, Any]]:
    """Trích xuất tối đa 3 món ăn xuất hiện trong câu trả lời của Bot để hiển thị kèm metadata."""
    reply_norm = _strip_accents(reply_text)
    msg_norm = _strip_accents(user_message)
    suggestions: List[Dict[str, Any]] = []
    seen_ids = set()

    for dish in available_dishes:
        dish_name_norm = _strip_accents(dish["name"])
        if len(dish_name_norm) >= 3 and (dish_name_norm in reply_norm or dish_name_norm in msg_norm):
            if dish["id"] not in seen_ids:
                seen_ids.add(dish["id"])
                suggestions.append(
                    {
                        "id": dish["id"],
                        "name": dish["name"],
                        "price": dish["price"],
                        "rating": dish["rating"],
                        "image_url": dish["image_url"],
                        "short_description": dish["short_description"],
                    }
                )
            if len(suggestions) >= limit:
                break

    return suggestions


def _extract_and_strip_action(reply_text: str) -> Tuple[str, Optional[Dict[str, Any]]]:
    """Trích xuất khối JSON action (nếu có) và loại bỏ khỏi chuỗi văn bản hiển thị cho người dùng."""
    pattern = r"```action\s*(\{.*?\})\s*```"
    match = re.search(pattern, reply_text, re.DOTALL)
    if match:
        try:
            action_data = json.loads(match.group(1))
            clean_reply = re.sub(pattern, "", reply_text, flags=re.DOTALL).strip()
            return clean_reply, action_data
        except Exception:
            pass
    return reply_text.strip(), None


def generate_chat_reply(
    user_message: str,
    history: List[Dict[str, str]],
    knowledge_ctx: Dict[str, Any],
    user_orders: List[Dict[str, Any]],
    is_authenticated: bool = False,
    user_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Điều phối sinh câu trả lời cho Chatbot NEUFood:
    - Ưu tiên gọi Google Gemini API (gemini-3.5-flash-lite / gemini-3.5-flash) với System Prompt Grounding.
    - Trích xuất khối action đặt món hộ hoặc thêm vào giỏ hàng.
    - Nếu chưa cấu hình GEMINI_API_KEY hoặc Gemini gặp sự cố, tự động dùng Smart Local Fallback.
    """
    system_instruction = build_system_instruction(
        knowledge_ctx=knowledge_ctx,
        user_orders=user_orders,
        is_authenticated=is_authenticated,
        user_name=user_name,
    )

    gemini_reply, _ = _call_gemini_api(
        system_instruction=system_instruction,
        history=history,
        user_message=user_message,
    )

    action_payload = None
    if gemini_reply:
        reply_text, action_payload = _extract_and_strip_action(gemini_reply)
        provider = "gemini"
    else:
        raw_fallback = _build_local_fallback_reply(
            user_message=user_message,
            knowledge_ctx=knowledge_ctx,
            user_orders=user_orders,
            is_authenticated=is_authenticated,
            user_name=user_name,
        )
        reply_text, action_payload = _extract_and_strip_action(raw_fallback)
        provider = "fallback"

    suggested_dishes = _extract_suggested_dishes(
        reply_text=reply_text,
        user_message=user_message,
        available_dishes=knowledge_ctx.get("available_dishes", []),
    )

    return {
        "reply": reply_text,
        "provider": provider,
        "suggested_dishes": suggested_dishes,
        "action": action_payload,
    }
