import os
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from app.core.config import settings
from app.core.limiter import limiter
from app.routes import register_routes
from app.db.session import engine, Base

def create_app() -> Flask:
    """Hàm Factory khởi tạo và cấu hình ứng dụng Flask."""
    app = Flask(__name__)

    # Cấu hình CORS
    CORS(
        app,
        resources={r"/api/*": {"origins": settings.cors_origins_list}},
        supports_credentials=True
    )

    # Khởi tạo Flask-Limiter
    limiter.init_app(app)

    # Đăng ký Blueprints
    register_routes(app)

    # Route phục vụ file uploads tĩnh
    os.makedirs(settings.UPLOAD_FOLDER, exist_ok=True)
    @app.route("/uploads/<path:filename>")
    def uploaded_file(filename):
        return send_from_directory(settings.UPLOAD_FOLDER, filename)

    # Health check route
    @app.route("/health", methods=["GET"])
    def health_check():
        return jsonify({"status": "healthy", "service": "neufood-backend"}), 200

    # Global Error Handlers
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"success": False, "message": "Endpoint không tồn tại"}), 404

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"success": False, "message": "Lỗi máy chủ nội bộ"}), 500

    @app.errorhandler(429)
    def ratelimit_handler(e):
        return jsonify({"success": False, "message": "Bạn đã gửi quá nhiều yêu cầu, vui lòng thử lại sau"}), 429

    return app
