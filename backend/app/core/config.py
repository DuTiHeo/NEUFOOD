import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    # App Settings
    FLASK_ENV: str = "development"
    FLASK_DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 5000

    # Security & JWT
    SECRET_KEY: str = "neufood_super_secret_jwt_key_please_change_in_production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440 # 24 hours

    # Database
    DATABASE_URL: str = "postgresql://neufood_user:neufood_password@localhost:5432/neufood_db"

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Rate Limiting
    RATELIMIT_DEFAULT: str = "200/day;50/hour"

    # Uploads
    UPLOAD_FOLDER: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
    MAX_CONTENT_LENGTH: int = 16 * 1024 * 1024 # 16 MB

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
