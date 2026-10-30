import os
from app import create_app
from app.core.config import settings

# Khởi tạo instance Flask app qua Factory
app = create_app()

if __name__ == "__main__":
    # Đọc cấu hình mạng và debug từ .env qua settings
    app.run(
        host=settings.HOST,
        port=settings.PORT,
        debug=settings.FLASK_DEBUG
    )
