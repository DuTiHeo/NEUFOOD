import os
import uuid
from typing import Any, Optional
from flask import jsonify, Response
from werkzeug.utils import secure_filename
from app.core.config import settings

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}

def api_response(
    data: Any = None,
    message: str = "Thành công",
    status_code: int = 200,
    success: bool = True,
    errors: Optional[list] = None
) -> Response:
    """Helper chuẩn hóa cấu trúc JSON trả về cho client."""
    response_payload = {
        "success": success,
        "message": message,
        "data": data
    }
    if errors is not None:
        response_payload["errors"] = errors
    return jsonify(response_payload), status_code

def allowed_file(filename: str) -> bool:
    """Kiểm tra phần mở rộng file upload có hợp lệ không."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def save_upload_file(file_storage) -> Optional[str]:
    """Lưu file upload vào thư mục uploads và trả về tên file duy nhất."""
    if not file_storage or file_storage.filename == "":
        return None
    
    if not allowed_file(file_storage.filename):
        return None

    filename = secure_filename(file_storage.filename)
    ext = filename.rsplit(".", 1)[1].lower()
    unique_filename = f"{uuid.uuid4().hex}.{ext}"
    
    os.makedirs(settings.UPLOAD_FOLDER, exist_ok=True)
    destination = os.path.join(settings.UPLOAD_FOLDER, unique_filename)
    file_storage.save(destination)
    
    return unique_filename
