from flask import Flask
from .auth import auth_bp
from .user import user_bp
from .setting import setting_bp
from .dish import dish_bp
from .location import location_bp
from .order import order_bp
from .review import review_bp
from .complaint import complaint_bp
from .shift import shift_bp


def register_routes(app: Flask):
    """Đăng ký tất cả các Flask Blueprints với tiền tố /api/v1."""
    api_prefix = "/api/v1"
    # Phân hệ TV1: Xác thực, Người dùng, Blacklist & Cấu hình hệ thống
    app.register_blueprint(auth_bp, url_prefix=f"{api_prefix}/auth")
    app.register_blueprint(user_bp, url_prefix=f"{api_prefix}/users")
    app.register_blueprint(setting_bp, url_prefix=f"{api_prefix}/settings")

    # Phân hệ TV2: Thực đơn, Danh mục & Địa điểm nội khu NEU
    app.register_blueprint(dish_bp, url_prefix=f"{api_prefix}/dishes")
    app.register_blueprint(location_bp, url_prefix=f"{api_prefix}/locations")

    # Phân hệ TV3: Đặt hàng COD & State Machine 14 trạng thái
    app.register_blueprint(order_bp, url_prefix=f"{api_prefix}/orders")

    # Phân hệ TV4: Đánh giá, Khiếu nại, Chốt ca COD & Báo cáo doanh thu
    app.register_blueprint(review_bp, url_prefix=f"{api_prefix}/reviews")
    app.register_blueprint(complaint_bp, url_prefix=f"{api_prefix}/complaints")
    app.register_blueprint(shift_bp, url_prefix=f"{api_prefix}/shifts")
