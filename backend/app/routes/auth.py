import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from flask import Blueprint, request, g
from pydantic import ValidationError
from app.core.config import settings
from app.db.models import User
from app.db.session import get_db
from app.crud.user import (
    get_user_by_email,
    get_user_by_id,
    get_user_by_student_id,
    create_user,
    record_failed_login,
    reset_login_attempts,
    update_user_password,
    revoke_token,
    is_token_revoked,
    get_device_by_token_hash,
    create_or_touch_device,
    record_device_failed_login,
    reset_device_attempts,
    revoke_all_user_devices,
)
from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    jwt_required,
    generate_device_token,
    verify_device_token,
    hash_device_token,
)
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    RefreshTokenRequest,
    LogoutRequest,
    OtpLoginRequest,
    OtpLoginVerifyRequest,
)
from app.core.limiter import limiter, get_login_rate_limit_key, get_client_ip
from app.utils.helpers import api_response

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

# Bộ nhớ tạm lưu trữ mã OTP khôi phục mật khẩu và đăng nhập OTP (UC05, BR-02, EX-04)
# Cấu trúc: {email_lower: {"otp": str, "expires_at": datetime, "daily_count": int, "date": "YYYY-MM-DD", "failed_attempts": int, "purpose": str}}
OTP_STORE: Dict[str, Dict[str, Any]] = {}
# Bộ nhớ theo dõi hạn mức OTP theo IP và Email: {f"{ip}:{email}": {"date": "YYYY-MM-DD", "count": int}}
OTP_IP_STORE: Dict[str, Dict[str, Any]] = {}


def _check_otp_rate_limit(email_key: str, client_ip: str, today_str: str) -> Optional[tuple]:
    """
    Kiểm tra hạn mức yêu cầu OTP theo EX-04:
    - Tối đa 3 lần/ngày cho mỗi cặp (email + IP)
    - Tối đa 10 lần/ngày cho mỗi email
    Trả về None nếu hợp lệ, hoặc (status_code, message) nếu vi phạm.
    """
    ip_key = f"{client_ip}:{email_key}"
    ip_entry = OTP_IP_STORE.get(ip_key, {})
    ip_count = ip_entry.get("count", 0) if ip_entry.get("date") == today_str else 0
    if ip_count >= 3:
        return 429, "Bạn đã vượt quá giới hạn gửi mã OTP tối đa 3 lần/ngày từ địa chỉ mạng này. Vui lòng thử lại vào ngày mai"

    email_entry = OTP_STORE.get(email_key, {})
    email_count = email_entry.get("daily_count", 0) if email_entry.get("date") == today_str else 0
    if email_count >= 10:
        return 429, "Tài khoản này đã vượt quá giới hạn gửi mã OTP tối đa 10 lần/ngày. Vui lòng thử lại vào ngày mai"

    return None


def _record_otp_request(
    email_key: str,
    client_ip: str,
    today_str: str,
    otp_code: str,
    expires_at: datetime,
    purpose: str = "reset_password",
):
    """Ghi nhận mã OTP mới và cập nhật bộ đếm giới hạn tần suất theo ngày (EX-04)."""
    ip_key = f"{client_ip}:{email_key}"
    ip_entry = OTP_IP_STORE.get(ip_key, {})
    ip_count = ip_entry.get("count", 0) if ip_entry.get("date") == today_str else 0
    OTP_IP_STORE[ip_key] = {"date": today_str, "count": ip_count + 1}

    email_entry = OTP_STORE.get(email_key, {})
    email_count = email_entry.get("daily_count", 0) if email_entry.get("date") == today_str else 0
    OTP_STORE[email_key] = {
        "otp": otp_code,
        "expires_at": expires_at,
        "daily_count": email_count + 1,
        "date": today_str,
        "failed_attempts": 0,
        "purpose": purpose,
    }


def _serialize_user(user: User) -> dict:
    """Chuẩn hóa thông tin tài khoản trả về cho client (UC01, UC02, UC03)."""
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "phone_number": user.phone_number,
        "student_id": user.student_id,
        "role": user.role,
        "avatar_url": user.avatar_url,
        "is_blacklisted": user.is_blacklisted,
        "blacklist_reason": user.blacklist_reason,
    }


def _parse_json_body() -> Optional[dict]:
    """Đọc và kiểm tra JSON payload an toàn, tránh văng lỗi 500 khi body rỗng hoặc sai kiểu."""
    raw = request.get_json(force=True, silent=True)
    return raw if isinstance(raw, dict) else None


def _is_locked(locked_until: Optional[datetime], now: datetime) -> bool:
    """Kiểm tra tài khoản có đang trong thời gian khóa tạm thời 15 phút hay không (BR-02, EX-02)."""
    if locked_until is None:
        return False
    normalized_locked_until = (
        locked_until.replace(tzinfo=timezone.utc)
        if locked_until.tzinfo is None
        else locked_until
    )
    return normalized_locked_until > now


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("20/minute", key_func=get_login_rate_limit_key)
def login():
    """
    Đăng nhập hệ thống & Bảo vệ chống dò mật khẩu theo thiết bị (UC02, BR-01, BR-02, EX-02).
    - Phân loại thiết bị: có device token hợp lệ -> thiết bị tin cậy; ngược lại -> thiết bị chưa xác minh.
    - Thiết bị tin cậy: sai >= 5 lần -> khóa riêng thiết bị đó 15 phút (user_devices.locked_until).
    - Thiết bị chưa xác minh: sai >= 5 lần -> khóa mọi thiết bị lạ của tài khoản 15 phút (users.locked_until).
    - Rate limit: áp dụng theo cặp (IP + email), không chặn IP thô (BUG-01).
    """
    raw_data = _parse_json_body()
    if raw_data is None:
        return api_response(
            message="Dữ liệu đầu vào phải là JSON object hợp lệ",
            status_code=400,
            success=False,
        )

    try:
        data = LoginRequest(**raw_data)
    except ValidationError as e:
        return api_response(
            message="Dữ liệu đăng nhập không hợp lệ",
            errors=e.errors(include_url=False, include_context=False),
            status_code=422,
            success=False,
        )

    now = datetime.now(timezone.utc)

    with get_db() as db:
        user = get_user_by_email(db, data.email)
        if not user:
            return api_response(
                message="Email hoặc mật khẩu không chính xác",
                status_code=401,
                success=False,
            )

        if not user.is_active:
            return api_response(
                message="Tài khoản này đã bị khóa",
                status_code=403,
                success=False,
            )

        # 1. Xác thực Device Token (nếu client gửi lên)
        device = None
        is_trusted_device = False

        if data.device_token:
            verified = verify_device_token(data.device_token)
            if verified:
                v_user_id, v_device_id = verified
                if v_user_id == user.id:
                    t_hash = hash_device_token(data.device_token)
                    dev_record = get_device_by_token_hash(db, t_hash)
                    if dev_record and not dev_record.is_revoked:
                        exp_at = dev_record.expires_at
                        if exp_at.tzinfo is None:
                            exp_at = exp_at.replace(tzinfo=timezone.utc)
                        if exp_at > now:
                            device = dev_record
                            is_trusted_device = True

        # 2. Xử lý phân nhánh: Thiết bị tin cậy vs Thiết bị chưa xác minh
        if is_trusted_device and device is not None:
            # Nhánh A: Thiết bị tin cậy
            if _is_locked(device.locked_until, now):
                return api_response(
                    message="Thiết bị này tạm thời bị khóa 15 phút do nhập sai mật khẩu quá 5 lần. Vui lòng thử lại sau hoặc đăng nhập bằng mã OTP qua email",
                    status_code=403,
                    success=False,
                )

            if not verify_password(data.password, user.password_hash):
                device = record_device_failed_login(db, device)
                if (device.failed_login_attempts or 0) >= 5:
                    return api_response(
                        message="Thiết bị này tạm thời bị khóa 15 phút do nhập sai mật khẩu quá 5 lần. Vui lòng thử lại sau hoặc đăng nhập bằng mã OTP qua email",
                        status_code=403,
                        success=False,
                    )
                remaining = max(0, 5 - (device.failed_login_attempts or 0))
                return api_response(
                    message=f"Email hoặc mật khẩu không chính xác. Bạn còn {remaining} lần thử trên thiết bị này",
                    status_code=401,
                    success=False,
                )

            # Đăng nhập đúng: reset lockout thiết bị & gia hạn TTL
            reset_device_attempts(db, device, ttl_days=settings.DEVICE_TOKEN_TTL_DAYS)
            res_device_token = data.device_token

        else:
            # Nhánh B: Thiết bị chưa xác minh (hoặc token giả/hết hạn)
            if _is_locked(user.locked_until, now):
                return api_response(
                    message="Tài khoản bị khóa tạm thời 15 phút do nhập sai mật khẩu quá 5 lần. Vui lòng đăng nhập bằng mã OTP gửi về Email để mở khóa",
                    status_code=403,
                    success=False,
                )

            if not verify_password(data.password, user.password_hash):
                user = record_failed_login(db, user)
                if (user.failed_login_attempts or 0) >= 5:
                    return api_response(
                        message="Tài khoản bị khóa tạm thời 15 phút do nhập sai mật khẩu quá 5 lần",
                        status_code=403,
                        success=False,
                    )
                return api_response(
                    message="Email hoặc mật khẩu không chính xác",
                    status_code=401,
                    success=False,
                )

            # Đăng nhập đúng: reset lockout tài khoản & cấp token thiết bị mới
            if (user.failed_login_attempts or 0) > 0 or user.locked_until is not None:
                user = reset_login_attempts(db, user)

            new_device_id = str(uuid.uuid4())
            new_device_token = generate_device_token(user.id, new_device_id)
            new_token_hash = hash_device_token(new_device_token)
            device_name = data.device_name or (request.headers.get("User-Agent", "")[:150] or "Unknown Device")
            create_or_touch_device(
                db=db,
                user_id=user.id,
                device_id=new_device_id,
                token_hash=new_token_hash,
                device_name=device_name,
                ttl_days=settings.DEVICE_TOKEN_TTL_DAYS,
            )
            res_device_token = new_device_token

        access_token = create_access_token({
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "name": user.full_name,
        })
        refresh_token = create_refresh_token({
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
        })

        return api_response(
            data={
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "Bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                "device_token": res_device_token,
                "user": _serialize_user(user),
            },
            message="Đăng nhập thành công",
            status_code=200,
        )


@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Đăng ký tài khoản khách hàng (UC01, BR-01, EX-01).
    - Kiểm tra định dạng SĐT 10 chữ số bắt đầu bằng 0 (BR-01).
    - Kiểm tra trùng lặp email và student_id trên hệ thống (EX-01).
    - Mặc định gán role = 'customer' (BR-01).
    """
    raw_data = _parse_json_body()
    if raw_data is None:
        return api_response(
            message="Dữ liệu đầu vào phải là JSON object hợp lệ",
            status_code=400,
            success=False,
        )

    try:
        data = RegisterRequest(**raw_data)
    except ValidationError as e:
        errors = e.errors(include_url=False, include_context=False)
        for err in errors:
            if "phone_number" in err.get("loc", ()):
                return api_response(
                    message="Số điện thoại không hợp lệ, phải gồm đúng 10 chữ số và bắt đầu bằng số 0",
                    errors=errors,
                    status_code=422,
                    success=False,
                )
        return api_response(
            message="Dữ liệu đăng ký không hợp lệ",
            errors=errors,
            status_code=422,
            success=False,
        )

    with get_db() as db:
        # EX-01: Kiểm tra trùng lặp Email
        if get_user_by_email(db, data.email):
            return api_response(
                message="Email đã tồn tại trên hệ thống",
                status_code=400,
                success=False,
            )

        # EX-01: Kiểm tra trùng lặp Mã sinh viên (nếu có cung cấp)
        if data.student_id and get_user_by_student_id(db, data.student_id):
            return api_response(
                message="Mã sinh viên đã tồn tại trên hệ thống",
                status_code=400,
                success=False,
            )

        # BR-01: Mặc định tạo tài khoản mới với role='customer'
        user = create_user(
            db=db,
            email=data.email,
            password=data.password,
            full_name=data.full_name,
            phone_number=data.phone_number,
            student_id=data.student_id,
            role="customer",
        )

        access_token = create_access_token({
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "name": user.full_name,
        })
        refresh_token = create_refresh_token({
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
        })

        return api_response(
            data={
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "Bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                "user": _serialize_user(user),
            },
            message="Đăng ký tài khoản thành công",
            status_code=201,
        )


@auth_bp.route("/refresh", methods=["POST"])
def refresh_token():
    """
    Làm mới Access Token bằng Refresh Token còn hiệu lực.
    - Kiểm tra định dạng JSON payload.
    - Giải mã JWT, xác minh claim type == 'refresh'.
    - Kiểm tra token chưa nằm trong danh sách đen (revoked_tokens).
    - Kiểm tra tài khoản người dùng tồn tại và đang hoạt động (User.is_active).
    - Cấp Access Token mới (15 phút) và giữ nguyên Refresh Token (hoặc cấp mới).
    """
    raw_data = _parse_json_body()
    if raw_data is None:
        return api_response(
            message="Dữ liệu đầu vào phải là JSON object hợp lệ",
            status_code=400,
            success=False,
        )

    try:
        data = RefreshTokenRequest(**raw_data)
    except ValidationError as e:
        return api_response(
            message="Dữ liệu làm mới token không hợp lệ",
            errors=e.errors(include_url=False, include_context=False),
            status_code=422,
            success=False,
        )

    payload = decode_token(data.refresh_token)
    if not payload:
        return api_response(
            message="Token làm mới không hợp lệ hoặc đã hết hạn",
            status_code=401,
            success=False,
        )

    if payload.get("type") != "refresh":
        return api_response(
            message="Loại token không hợp lệ (yêu cầu refresh token)",
            status_code=401,
            success=False,
        )

    jti = payload.get("jti")
    user_id_raw = payload.get("sub")
    try:
        user_id = int(user_id_raw)
    except (ValueError, TypeError):
        return api_response(
            message="Phiên đăng nhập không hợp lệ hoặc đã hết hạn",
            status_code=401,
            success=False,
        )

    with get_db() as db:
        if jti and is_token_revoked(db, jti):
            return api_response(
                message="Phiên đăng nhập đã bị thu hồi hoặc đăng xuất",
                status_code=401,
                success=False,
            )

        user = get_user_by_id(db, user_id)
        if not user:
            return api_response(
                message="Không tìm thấy người dùng",
                status_code=404,
                success=False,
            )

        if not user.is_active:
            return api_response(
                message="Tài khoản này đã bị khóa",
                status_code=403,
                success=False,
            )

        new_access_token = create_access_token({
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "name": user.full_name,
        })

        return api_response(
            data={
                "access_token": new_access_token,
                "refresh_token": data.refresh_token,
                "token_type": "Bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                "user": _serialize_user(user),
            },
            message="Làm mới token thành công",
            status_code=200,
        )


@auth_bp.route("/logout", methods=["POST"])
@jwt_required
def logout():
    """
    Đăng xuất hệ thống (UC03):
    Thu hồi Access Token hiện tại và Refresh Token gửi kèm vào danh sách đen.
    """
    raw_data = _parse_json_body() or {}
    refresh_token_input = raw_data.get("refresh_token")

    user_id = int(g.current_user["sub"])
    access_jti = g.current_user.get("jti")
    access_exp = g.current_user.get("exp")

    with get_db() as db:
        # 1. Thu hồi Access Token hiện tại
        if access_jti and access_exp:
            expires_at = datetime.fromtimestamp(access_exp, tz=timezone.utc)
            revoke_token(
                db=db,
                jti=access_jti,
                token_type="access",
                expires_at=expires_at,
                user_id=user_id,
                reason="logout",
            )

        # 2. Thu hồi Refresh Token nếu client cung cấp
        if refresh_token_input:
            r_payload = decode_token(refresh_token_input)
            if r_payload and r_payload.get("jti") and r_payload.get("exp"):
                r_exp = datetime.fromtimestamp(r_payload["exp"], tz=timezone.utc)
                revoke_token(
                    db=db,
                    jti=r_payload["jti"],
                    token_type="refresh",
                    expires_at=r_exp,
                    user_id=user_id,
                    reason="logout",
                )

    return api_response(data=None, message="Đăng xuất thành công", status_code=200)


@auth_bp.route("/me", methods=["GET"])
@jwt_required
def get_me():
    """Lấy thông tin người dùng của phiên đăng nhập hiện tại (UC03, UC04)."""
    user_id = int(g.current_user["sub"])
    with get_db() as db:
        user = get_user_by_id(db, user_id)
        if not user:
            return api_response(
                message="Không tìm thấy người dùng",
                status_code=404,
                success=False,
            )

        if not user.is_active:
            return api_response(
                message="Tài khoản này đã bị khóa",
                status_code=403,
                success=False,
            )

        return api_response(
            data=_serialize_user(user),
            message="Thành công",
            status_code=200,
        )


@auth_bp.route("/change-password", methods=["POST"])
@jwt_required
def change_password():
    """Đổi mật khẩu tài khoản khi đang đăng nhập (UC05)."""
    raw_data = _parse_json_body()
    if raw_data is None:
        return api_response(
            message="Dữ liệu đầu vào phải là JSON object hợp lệ",
            status_code=400,
            success=False,
        )

    try:
        data = ChangePasswordRequest(**raw_data)
    except ValidationError as e:
        return api_response(
            message="Dữ liệu đổi mật khẩu không hợp lệ",
            errors=e.errors(include_url=False, include_context=False),
            status_code=422,
            success=False,
        )

    user_id = int(g.current_user["sub"])
    with get_db() as db:
        user = get_user_by_id(db, user_id)
        if not user:
            return api_response(
                message="Không tìm thấy người dùng",
                status_code=404,
                success=False,
            )

        if not user.is_active:
            return api_response(
                message="Tài khoản này đã bị khóa",
                status_code=403,
                success=False,
            )

        if not verify_password(data.old_password, user.password_hash):
            return api_response(
                message="Mật khẩu hiện tại không chính xác",
                status_code=400,
                success=False,
            )

        if data.new_password == data.old_password or verify_password(data.new_password, user.password_hash):
            return api_response(
                message="Mật khẩu mới không được trùng với mật khẩu hiện tại",
                status_code=400,
                success=False,
            )

        update_user_password(db, user, data.new_password)

        # Thu hồi Access Token hiện tại để bắt buộc đăng nhập lại hoặc làm mới
        access_jti = g.current_user.get("jti")
        access_exp = g.current_user.get("exp")
        if access_jti and access_exp:
            expires_at = datetime.fromtimestamp(access_exp, tz=timezone.utc)
            revoke_token(
                db=db,
                jti=access_jti,
                token_type="access",
                expires_at=expires_at,
                user_id=user.id,
                reason="change_password",
            )

        return api_response(
            data=None,
            message="Đổi mật khẩu thành công",
            status_code=200,
        )


@auth_bp.route("/login/otp/request", methods=["POST"])
def request_login_otp():
    """
    Yêu cầu gửi mã OTP để đăng nhập khẩn cấp / mở khóa khi bị khóa thiết bị lạ (BR-02.4, EX-02, EX-04).
    - Hạn mức: tối đa 3 lần/ngày cho mỗi cặp (email + IP) và tối đa 10 lần/ngày cho mỗi email (EX-04).
    - Hiệu lực OTP: đúng 5 phút (300 giây).
    """
    raw_data = _parse_json_body()
    if raw_data is None:
        return api_response(
            message="Dữ liệu đầu vào phải là JSON object hợp lệ",
            status_code=400,
            success=False,
        )

    try:
        data = OtpLoginRequest(**raw_data)
    except ValidationError as e:
        return api_response(
            message="Dữ liệu yêu cầu OTP đăng nhập không hợp lệ",
            errors=e.errors(include_url=False, include_context=False),
            status_code=422,
            success=False,
        )

    email_key = data.email.strip().lower()
    client_ip = get_client_ip()
    now = datetime.now(timezone.utc)
    today_str = now.date().isoformat()

    with get_db() as db:
        user = get_user_by_email(db, email_key)
        if not user:
            return api_response(
                message="Email không tồn tại trên hệ thống",
                status_code=404,
                success=False,
            )

        if not user.is_active:
            return api_response(
                message="Tài khoản này đã bị khóa",
                status_code=403,
                success=False,
            )

    limit_err = _check_otp_rate_limit(email_key, client_ip, today_str)
    if limit_err:
        status_code, msg = limit_err
        return api_response(
            message=msg,
            status_code=status_code,
            success=False,
        )

    otp_code = f"{random.randint(0, 999999):06d}"
    _record_otp_request(
        email_key=email_key,
        client_ip=client_ip,
        today_str=today_str,
        otp_code=otp_code,
        expires_at=now + timedelta(minutes=5),
        purpose="login_otp",
    )

    resp_data = {
        "email": email_key,
        "expires_in_seconds": 300,
    }
    if settings.FLASK_DEBUG:
        resp_data["otp_debug"] = otp_code

    return api_response(
        data=resp_data,
        message="Mã OTP đăng nhập đã được gửi tới email của bạn (hiệu lực 5 phút)",
        status_code=200,
    )


@auth_bp.route("/login/otp/verify", methods=["POST"])
def verify_login_otp():
    """
    Xác minh mã OTP đăng nhập, mở khóa tài khoản và nâng cấp thiết bị hiện tại thành thiết bị tin cậy (BR-02.4, EX-02, EX-04).
    - Nhập sai mã OTP liên tiếp 5 lần -> Hủy mã OTP ngay lập tức (EX-04).
    - Xác minh thành công -> Mở khóa tài khoản (reset locked_until), cấp JWT tokens và device token tin cậy mới.
    """
    raw_data = _parse_json_body()
    if raw_data is None:
        return api_response(
            message="Dữ liệu đầu vào phải là JSON object hợp lệ",
            status_code=400,
            success=False,
        )

    try:
        data = OtpLoginVerifyRequest(**raw_data)
    except ValidationError as e:
        return api_response(
            message="Dữ liệu xác thực OTP đăng nhập không hợp lệ",
            errors=e.errors(include_url=False, include_context=False),
            status_code=422,
            success=False,
        )

    email_key = data.email.strip().lower()
    otp_input = data.otp.strip()
    now = datetime.now(timezone.utc)

    entry = OTP_STORE.get(email_key)
    if not entry or not entry.get("otp") or entry.get("purpose") != "login_otp":
        return api_response(
            message="Mã xác nhận OTP không hợp lệ hoặc đã hết hiệu lực",
            status_code=400,
            success=False,
        )

    expires_at = entry.get("expires_at")
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at is None or now > expires_at:
        return api_response(
            message="Mã xác nhận OTP đã hết hiệu lực (quá 5 phút). Vui lòng yêu cầu gửi lại mã OTP",
            status_code=400,
            success=False,
        )

    if str(entry.get("otp")) != otp_input:
        entry["failed_attempts"] = (entry.get("failed_attempts") or 0) + 1
        if entry["failed_attempts"] >= 5:
            entry["otp"] = None
            entry["expires_at"] = None
            return api_response(
                message="Mã OTP đã bị hủy do nhập sai quá 5 lần. Vui lòng yêu cầu mã mới",
                status_code=400,
                success=False,
            )
        remaining = 5 - entry["failed_attempts"]
        return api_response(
            message=f"Mã xác nhận OTP không chính xác. Bạn còn {remaining} lần thử",
            status_code=400,
            success=False,
        )

    # Vô hiệu hóa OTP sau khi dùng
    entry["otp"] = None
    entry["expires_at"] = None

    with get_db() as db:
        user = get_user_by_email(db, email_key)
        if not user:
            return api_response(
                message="Không tìm thấy người dùng",
                status_code=404,
                success=False,
            )

        if not user.is_active:
            return api_response(
                message="Tài khoản này đã bị khóa",
                status_code=403,
                success=False,
            )

        # Mở khóa tài khoản (nếu đang bị khóa bởi nhánh thiết bị lạ)
        if (user.failed_login_attempts or 0) > 0 or user.locked_until is not None:
            user = reset_login_attempts(db, user)

        # Cấp mã device_token mới cho thiết bị này -> nâng cấp thành thiết bị tin cậy
        new_device_id = str(uuid.uuid4())
        new_device_token = generate_device_token(user.id, new_device_id)
        new_token_hash = hash_device_token(new_device_token)
        device_name = data.device_name or (request.headers.get("User-Agent", "")[:150] or "Unknown Device (OTP Login)")
        create_or_touch_device(
            db=db,
            user_id=user.id,
            device_id=new_device_id,
            token_hash=new_token_hash,
            device_name=device_name,
            ttl_days=settings.DEVICE_TOKEN_TTL_DAYS,
        )

        access_token = create_access_token({
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "name": user.full_name,
        })
        refresh_token = create_refresh_token({
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
        })

        return api_response(
            data={
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "Bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                "device_token": new_device_token,
                "user": _serialize_user(user),
            },
            message="Đăng nhập thành công bằng mã OTP",
            status_code=200,
        )


@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    """
    Yêu cầu gửi mã OTP 6 chữ số để khôi phục mật khẩu (UC05, EX-04).
    - Giới hạn: tối đa 3 lần/ngày cho mỗi cặp (email + IP) và tối đa 10 lần/ngày cho mỗi email (EX-04).
    - Mã OTP có hiệu lực trong vòng 5 phút kể từ thời điểm tạo (EX-04).
    """
    raw_data = _parse_json_body()
    if raw_data is None:
        return api_response(
            message="Dữ liệu đầu vào phải là JSON object hợp lệ",
            status_code=400,
            success=False,
        )

    try:
        data = ForgotPasswordRequest(**raw_data)
    except ValidationError as e:
        return api_response(
            message="Dữ liệu yêu cầu khôi phục mật khẩu không hợp lệ",
            errors=e.errors(include_url=False, include_context=False),
            status_code=422,
            success=False,
        )

    email_key = data.email.strip().lower()
    client_ip = get_client_ip()
    now = datetime.now(timezone.utc)
    today_str = now.date().isoformat()

    with get_db() as db:
        user = get_user_by_email(db, email_key)
        if not user:
            return api_response(
                message="Email không tồn tại trên hệ thống",
                status_code=404,
                success=False,
            )

        if not user.is_active:
            return api_response(
                message="Tài khoản này đã bị khóa",
                status_code=403,
                success=False,
            )

    limit_err = _check_otp_rate_limit(email_key, client_ip, today_str)
    if limit_err:
        status_code, msg = limit_err
        return api_response(
            message=msg,
            status_code=status_code,
            success=False,
        )

    # EX-04: Sinh mã OTP 6 chữ số với thời hạn 5 phút
    otp_code = f"{random.randint(0, 999999):06d}"
    _record_otp_request(
        email_key=email_key,
        client_ip=client_ip,
        today_str=today_str,
        otp_code=otp_code,
        expires_at=now + timedelta(minutes=5),
        purpose="reset_password",
    )

    resp_data = {
        "email": email_key,
        "expires_in_seconds": 300,
        "daily_count": OTP_STORE[email_key]["daily_count"],
    }
    if settings.FLASK_DEBUG:
        resp_data["otp_debug"] = otp_code

    return api_response(
        data=resp_data,
        message="Mã OTP khôi phục mật khẩu đã được gửi (hiệu lực 5 phút)",
        status_code=200,
    )


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    """
    Xác thực mã OTP và đặt lại mật khẩu mới (UC05, BR-02, EX-04).
    - Kiểm tra OTP tồn tại, chưa quá hạn 5 phút và khớp chính xác (EX-04).
    - Sai liên tiếp 5 lần -> Hủy mã OTP ngay lập tức (EX-04).
    - Cập nhật mật khẩu mới đồng thời mở khóa/reset bộ đếm đăng nhập sai và thu hồi toàn bộ token thiết bị (BR-02).
    """
    raw_data = _parse_json_body()
    if raw_data is None:
        return api_response(
            message="Dữ liệu đầu vào phải là JSON object hợp lệ",
            status_code=400,
            success=False,
        )

    try:
        data = ResetPasswordRequest(**raw_data)
    except ValidationError as e:
        return api_response(
            message="Dữ liệu đặt lại mật khẩu không hợp lệ",
            errors=e.errors(include_url=False, include_context=False),
            status_code=422,
            success=False,
        )

    email_key = data.email.strip().lower()
    otp_input = data.otp.strip()
    now = datetime.now(timezone.utc)

    # EX-04: Kiểm tra sự tồn tại và hiệu lực 5 phút của mã OTP trong OTP_STORE
    entry = OTP_STORE.get(email_key)
    if not entry or not entry.get("otp") or entry.get("purpose") != "reset_password":
        return api_response(
            message="Mã xác nhận OTP không hợp lệ hoặc đã hết hiệu lực",
            status_code=400,
            success=False,
        )

    expires_at = entry.get("expires_at")
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at is None or now > expires_at:
        return api_response(
            message="Mã xác nhận OTP đã hết hiệu lực (quá 5 phút). Vui lòng yêu cầu gửi lại mã OTP",
            status_code=400,
            success=False,
        )

    if str(entry.get("otp")) != otp_input:
        entry["failed_attempts"] = (entry.get("failed_attempts") or 0) + 1
        if entry["failed_attempts"] >= 5:
            entry["otp"] = None
            entry["expires_at"] = None
            return api_response(
                message="Mã OTP đã bị hủy do nhập sai quá 5 lần. Vui lòng yêu cầu mã mới",
                status_code=400,
                success=False,
            )
        remaining = 5 - entry["failed_attempts"]
        return api_response(
            message=f"Mã xác nhận OTP không chính xác. Bạn còn {remaining} lần thử",
            status_code=400,
            success=False,
        )

    with get_db() as db:
        user = get_user_by_email(db, email_key)
        if not user:
            return api_response(
                message="Không tìm thấy người dùng",
                status_code=404,
                success=False,
            )

        # Cập nhật mật khẩu mới và reset failed_login_attempts = 0, locked_until = None, thu hồi devices (UC05, BR-02)
        update_user_password(db, user, data.new_password)

    # Vô hiệu hóa mã OTP sau khi đã sử dụng thành công
    entry["otp"] = None
    entry["expires_at"] = None

    return api_response(
        data=None,
        message="Đặt lại mật khẩu thành công",
        status_code=200,
    )

