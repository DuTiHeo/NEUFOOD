import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

# Xác định đường dẫn tuyệt đối tới thư mục backend và tệp .env
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = BASE_DIR / ".env"

# Tải trước các biến môi trường từ file .env vào os.environ
load_dotenv(dotenv_path=ENV_PATH)


class Settings(BaseSettings):
    """
    Quản lý tập trung toàn bộ cấu hình hệ thống Backend.
    Tự động đọc từ file .env thông qua load_dotenv() và Pydantic BaseSettings,
    kèm giá trị mặc định an toàn cho môi trường development.
    """
    model_config = SettingsConfigDict(
        env_file=ENV_PATH,
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # 1. Cấu hình ứng dụng Flask (App Settings)
    FLASK_ENV: str = Field(default_factory=lambda: os.getenv("FLASK_ENV", "development"))
    FLASK_DEBUG: bool = Field(default_factory=lambda: os.getenv("FLASK_DEBUG", "1").lower() in ("1", "true", "yes"))
    HOST: str = Field(default_factory=lambda: os.getenv("HOST", "0.0.0.0"))
    PORT: int = Field(default_factory=lambda: int(os.getenv("PORT", "5000")))

    # 2. Bảo mật & Xác thực JWT (Security & JWT)
    SECRET_KEY: str = Field(
        default_factory=lambda: os.getenv("SECRET_KEY", "neufood_super_secret_jwt_key_please_change_in_production")
    )
    JWT_ALGORITHM: str = Field(default_factory=lambda: os.getenv("JWT_ALGORITHM", "HS256"))
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default_factory=lambda: int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
    )  # 15 phút cho Access Token ngắn hạn
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(
        default_factory=lambda: int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    )  # 7 ngày cho Refresh Token dài hạn

    # 3. Cơ sở dữ liệu (Database Connection)
    DATABASE_URL: str = Field(
        default_factory=lambda: os.getenv(
            "DATABASE_URL",
            "postgresql://neufood_user:neufood_password@localhost:5432/neufood_db"
        )
    )

    # 4. Redis Cache & Token Blacklist (Tier 1)
    REDIS_URL: str = Field(
        default_factory=lambda: os.getenv("REDIS_URL", "redis://localhost:6379/0")
    )

    # 5. Phân quyền chia sẻ tài nguyên (CORS Allowed Origins)
    CORS_ORIGINS: str = Field(
        default_factory=lambda: os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
        )
    )

    # 6. Giới hạn tần suất gọi API (Rate Limiting)
    RATELIMIT_DEFAULT: str = Field(
        default_factory=lambda: os.getenv("RATELIMIT_DEFAULT", "200/day;50/hour")
    )

    # 7. Quản lý thư mục tệp tải lên (File Uploads)
    UPLOAD_FOLDER: str = Field(
        default_factory=lambda: os.getenv("UPLOAD_FOLDER", str(BASE_DIR / "app" / "uploads"))
    )
    MAX_CONTENT_LENGTH: int = Field(
        default_factory=lambda: int(os.getenv("MAX_CONTENT_LENGTH", str(16 * 1024 * 1024)))
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def rate_limit_list(self) -> List[str]:
        """Tách danh sách rate limits từ chuỗi ngăn cách bởi dấu chấm phẩy."""
        return [limit.strip() for limit in self.RATELIMIT_DEFAULT.split(";") if limit.strip()]


settings = Settings()

# Đảm bảo đường dẫn UPLOAD_FOLDER luôn là đường dẫn tuyệt đối
if not os.path.isabs(settings.UPLOAD_FOLDER):
    settings.UPLOAD_FOLDER = str((BASE_DIR / settings.UPLOAD_FOLDER).resolve())

