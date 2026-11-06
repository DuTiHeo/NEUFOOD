import logging
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def _build_otp_html(to_email: str, otp_code: str, purpose: str) -> str:
    """Tạo nội dung HTML định dạng đẹp mắt gửi qua email."""
    if purpose == "login_otp":
        title = "Mã Xác Thực Đăng Nhập Khẩn Cấp"
        desc = (
            "Bạn vừa yêu cầu mã xác nhận để đăng nhập vào tài khoản <strong>NEUFood</strong> "
            "hoặc mở khóa đăng nhập từ thiết bị mới."
        )
    else:
        title = "Khôi Phục Mật Khẩu Tài Khoản"
        desc = (
            "Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>NEUFood</strong> "
            f"liên kết với địa chỉ email <strong>{to_email}</strong>."
        )

    # Chia tách 6 chữ số có khoảng cách dễ nhìn
    formatted_code = " ".join(list(otp_code))

    html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f6fb; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 63, 135, 0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color: #003f87; padding: 28px 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">
                NEUFood • Canteen A2 NEU
              </h1>
              <p style="margin: 6px 0 0 0; color: #d0e2ff; font-size: 13px;">
                Hệ Thống Đặt & Giao Đồ Ăn Nội Khu Đại Học Kinh Tế Quốc Dân
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 14px 0; color: #1a202c; font-size: 18px; font-weight: 600;">
                {title}
              </h2>
              <p style="margin: 0 0 24px 0; color: #4a5568; font-size: 14px; line-height: 1.6;">
                {desc}
              </p>

              <!-- OTP Box -->
              <div style="background-color: #f7f9fd; border: 2px dashed #003f87; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
                <span style="display: block; font-size: 12px; font-weight: 600; color: #718096; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                  MÃ XÁC THỰC CỦA BẠN
                </span>
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; color: #003f87; letter-spacing: 6px;">
                  {formatted_code}
                </span>
                <span style="display: block; font-size: 12px; color: #e53e3e; margin-top: 8px; font-weight: 500;">
                  ⏳ Có hiệu lực trong vòng 5 phút (300 giây)
                </span>
              </div>

              <p style="margin: 0 0 16px 0; color: #718096; font-size: 13px; line-height: 1.5;">
                • Nhập mã này trên màn hình xác thực để tiếp tục.<br>
                • Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email hoặc đổi mật khẩu để bảo vệ tài khoản.<br>
                • <strong>Lưu ý:</strong> Nhân viên Canteen và Admin NEUFood tuyệt đối không bao giờ yêu cầu bạn cung cấp mã OTP này.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #edf2f7; text-align: center;">
              <p style="margin: 0; color: #a0aec0; font-size: 12px; line-height: 1.4;">
                Đây là email tự động từ hệ thống NEUFood.<br>
                Canteen A2 - Trường Đại học Kinh tế Quốc dân (NEU), 207 Giải Phóng, Đồng Tâm, Hai Bà Trưng, Hà Nội.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
    return html


def _build_otp_text(to_email: str, otp_code: str, purpose: str) -> str:
    """Nội dung plain text dự phòng nếu client không hỗ trợ HTML."""
    title = "Mã xác thực đăng nhập NEUFood" if purpose == "login_otp" else "Khôi phục mật khẩu NEUFood"
    return f"""NEUFood - {title}

Mã xác thực của bạn: {otp_code}

Mã này có hiệu lực trong vòng 5 phút (300 giây).
Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.
Tuyệt đối không chia sẻ mã xác thực này cho bất kỳ ai (kể cả nhân viên Canteen/Admin).

---
NEUFood - Hệ Thống Đặt Đồ Ăn Canteen A2 - Đại học Kinh tế Quốc dân
"""


def send_otp_email(to_email: str, otp_code: str, purpose: str = "reset_password") -> bool:
    """
    Gửi email chứa mã xác thực OTP qua SMTP (hỗ trợ Gmail, Outlook, SMTP server).
    - Nếu SMTP_USER và SMTP_PASSWORD chưa được cấu hình: log cảnh báo và in ra console để dev.
    - Trả về True nếu gửi thành công, False nếu gặp lỗi.
    """
    to_email = to_email.strip().lower()
    subject = (
        f"[{otp_code}] Mã xác thực đăng nhập NEUFood"
        if purpose == "login_otp"
        else f"[{otp_code}] Mã khôi phục mật khẩu NEUFood"
    )

    # 1. Kiểm tra cấu hình SMTP
    smtp_user = settings.SMTP_USER.strip() if settings.SMTP_USER else ""
    smtp_password = settings.SMTP_PASSWORD.replace(" ", "").strip() if settings.SMTP_PASSWORD else ""

    if not smtp_user or not smtp_password:
        logger.warning(
            "[OTP_EMAIL_DEV_MODE] SMTP chưa được cấu hình (thiếu SMTP_USER/SMTP_PASSWORD trong .env). "
            f"Mã OTP gửi tới '{to_email}' ({purpose}): [{otp_code}]"
        )
        return False

    # 2. Soạn thảo email đa định dạng (HTML + Text)
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    from_email = settings.SMTP_FROM_EMAIL or smtp_user
    from_header = f"{settings.SMTP_FROM_NAME} <{from_email}>"
    msg["From"] = from_header
    msg["To"] = to_email

    text_content = _build_otp_text(to_email, otp_code, purpose)
    html_content = _build_otp_html(to_email, otp_code, purpose)

    msg.attach(MIMEText(text_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    # 3. Kết nối SMTP Server và gửi thư
    try:
        logger.info(f"Đang gửi email OTP tới {to_email} qua {settings.SMTP_HOST}:{settings.SMTP_PORT}...")
        if settings.SMTP_PORT == 465:
            # SSL
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=12) as server:
                server.login(smtp_user, smtp_password)
                server.send_message(msg)
        else:
            # STARTTLS (Cổng 587 phổ biến cho Gmail)
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=12) as server:
                server.ehlo()
                if settings.SMTP_USE_TLS:
                    server.starttls()
                    server.ehlo()
                server.login(smtp_user, smtp_password)
                server.send_message(msg)

        logger.info(f"Đã gửi email OTP thành công tới {to_email}")
        return True
    except Exception as e:
        logger.error(f"Lỗi khi gửi email OTP tới {to_email}: {e}", exc_info=True)
        return False


def send_otp_email_async(to_email: str, otp_code: str, purpose: str = "reset_password"):
    """
    Gửi email OTP bất đồng bộ trong background thread để không chặn phản hồi HTTP của server.
    """
    thread = threading.Thread(
        target=send_otp_email,
        args=(to_email, otp_code, purpose),
        daemon=True,
    )
    thread.start()
