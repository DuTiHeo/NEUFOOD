from datetime import datetime, date, timezone
from sqlalchemy import (
    Column, Integer, String, Text, Numeric, Boolean, DateTime, Date, ForeignKey, Table
)
from sqlalchemy.orm import relationship
from .session import Base

# 7. Bảng liên kết N:N giữa Dish và Category
dish_categories = Table(
    "dish_categories",
    Base.metadata,
    Column("dish_id", String(100), ForeignKey("dishes.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", String(50), ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    """3. Bảng USERS - Lưu trữ 4 vai trò: customer, staff, manager, admin."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    phone_number = Column(String(20), nullable=False)
    student_id = Column(String(30), nullable=True)
    role = Column(String(20), nullable=False, default="customer", index=True)  # 'customer' | 'staff' | 'manager' | 'admin'
    avatar_url = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    is_blacklisted = Column(Boolean, nullable=False, default=False, index=True)
    blacklist_reason = Column(Text, nullable=True)
    blacklisted_at = Column(DateTime(timezone=True), nullable=True)
    failed_login_attempts = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    orders = relationship("Order", foreign_keys="Order.user_id", back_populates="user")
    handled_orders = relationship("Order", foreign_keys="Order.staff_id", back_populates="staff")
    reviews = relationship("Review", back_populates="user")
    complaints = relationship("Complaint", foreign_keys="Complaint.user_id", back_populates="user")
    shifts = relationship("StaffShift", foreign_keys="StaffShift.staff_id", back_populates="staff")


class CampusLocation(Base):
    """4. Bảng CAMPUS_LOCATIONS - Danh mục tòa nhà/địa điểm giao hàng nội khu NEU."""
    __tablename__ = "campus_locations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    building_code = Column(String(30), unique=True, nullable=False, index=True)
    building_name = Column(String(150), nullable=False)
    default_room_note = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    display_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    orders = relationship("Order", back_populates="campus_location")


class Category(Base):
    """5. Bảng CATEGORIES - Danh mục món ăn."""
    __tablename__ = "categories"

    id = Column(String(50), primary_key=True)  # slug: 'com-hop', 'mi-pho'
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    dishes = relationship("Dish", secondary=dish_categories, back_populates="categories")


class Dish(Base):
    """6. Bảng DISHES - Thực đơn món ăn Canteen A2 (Giá niêm yết = base_price + system_fee)."""
    __tablename__ = "dishes"

    id = Column(String(100), primary_key=True)  # slug: 'pho-bo-tai-lan', 'bun-bo-hue'
    name = Column(String(200), nullable=False)
    short_description = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    base_price = Column(Numeric(12, 2), nullable=False, default=0)
    system_fee = Column(Numeric(12, 2), nullable=False, default=5000)
    price = Column(Numeric(12, 2), nullable=False)
    rating = Column(Numeric(3, 2), default=5.0)
    review_count = Column(Integer, default=0)
    image_url = Column(Text, nullable=True)
    is_available = Column(Boolean, nullable=False, default=True, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    is_deleted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    categories = relationship("Category", secondary=dish_categories, back_populates="dishes")
    badges = relationship("DishBadge", back_populates="dish", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="dish", cascade="all, delete-orphan")


class DishBadge(Base):
    """8. Bảng DISH_BADGES - Nhãn nổi bật của món ăn (hot, bestSeller, new)."""
    __tablename__ = "dish_badges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dish_id = Column(String(100), ForeignKey("dishes.id", ondelete="CASCADE"), nullable=False)
    badge = Column(String(50), nullable=False)

    dish = relationship("Dish", back_populates="badges")


class Order(Base):
    """9. Bảng ORDERS - Đơn hàng COD với State Machine 14 trạng thái."""
    __tablename__ = "orders"

    id = Column(String(50), primary_key=True)  # 'NF2610153456'
    order_code_suffix = Column(String(4), nullable=False, index=True)  # 4 chữ số cuối đối chiếu khi nhận hàng (BR-18)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    staff_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    order_type = Column(String(20), nullable=False, default="delivery", index=True)  # 'delivery' | 'pickup'
    recipient_name = Column(String(150), nullable=False)
    recipient_phone = Column(String(20), nullable=False)
    campus_location_id = Column(Integer, ForeignKey("campus_locations.id", ondelete="SET NULL"), nullable=True)
    room_detail = Column(String(100), nullable=True)
    delivery_address = Column(Text, nullable=False)
    delivery_note = Column(Text, nullable=True)
    is_preorder = Column(Boolean, nullable=False, default=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(30), nullable=False, default="CHO_XAC_NHAN", index=True)
    subtotal_amount = Column(Numeric(12, 2), nullable=False, default=0)
    ship_fee = Column(Numeric(12, 2), nullable=False, default=5000)
    total_amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(String(30), nullable=False, default="cod_cash")  # 'cod_cash' | 'cod_vietqr'
    payment_status = Column(String(30), nullable=False, default="chua_thanh_toan")  # 'chua_thanh_toan' | 'da_thanh_toan'
    eta = Column(String(50), nullable=True)
    pickup_deadline = Column(DateTime(timezone=True), nullable=True)
    auto_complete_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", foreign_keys=[user_id], back_populates="orders")
    staff = relationship("User", foreign_keys=[staff_id], back_populates="handled_orders")
    campus_location = relationship("CampusLocation", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="order", cascade="all, delete-orphan")
    complaint = relationship("Complaint", back_populates="order", uselist=False, cascade="all, delete-orphan")


class OrderItem(Base):
    """10. Bảng ORDER_ITEMS - Chi tiết từng món trong đơn hàng."""
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(String(50), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    dish_id = Column(String(100), ForeignKey("dishes.id", ondelete="SET NULL"), nullable=True)
    dish_name = Column(String(200), nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    base_price = Column(Numeric(12, 2), nullable=False, default=0)
    quantity = Column(Integer, nullable=False, default=1)
    note = Column(Text, nullable=True)
    subtotal = Column(Numeric(12, 2), nullable=False)

    order = relationship("Order", back_populates="items")


class Review(Base):
    """11. Bảng REVIEWS - Đánh giá món ăn sau khi nhận hàng (UC14)."""
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(String(50), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    dish_id = Column(String(100), ForeignKey("dishes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    rating = Column(Integer, nullable=False)  # 1 - 5
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    order = relationship("Order", back_populates="reviews")
    dish = relationship("Dish", back_populates="reviews")
    user = relationship("User", back_populates="reviews")


class Complaint(Base):
    """12. Bảng COMPLAINTS - Khiếu nại đơn hàng do Admin độc quyền xử lý (UC15, UC25)."""
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(String(50), ForeignKey("orders.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reason = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    proof_image_url = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="DANG_XU_LY", index=True)  # 'DANG_XU_LY' | 'CHAP_NHAN' | 'TU_CHOI'
    admin_response = Column(Text, nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    order = relationship("Order", back_populates="complaint")
    user = relationship("User", foreign_keys=[user_id], back_populates="complaints")
    resolver = relationship("User", foreign_keys=[resolved_by])


class StaffShift(Base):
    """13. Bảng STAFF_SHIFTS - Chốt ca và đối soát tiền COD cuối ca của nhân viên (UC20, BR-25)."""
    __tablename__ = "staff_shifts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    staff_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    shift_date = Column(Date, nullable=False, default=date.today)
    total_orders_handled = Column(Integer, nullable=False, default=0)
    expected_cash = Column(Numeric(12, 2), nullable=False, default=0)
    expected_qr = Column(Numeric(12, 2), nullable=False, default=0)
    actual_cash = Column(Numeric(12, 2), nullable=False, default=0)
    actual_qr = Column(Numeric(12, 2), nullable=False, default=0)
    discrepancy_amount = Column(Numeric(12, 2), nullable=False, default=0)
    discrepancy_note = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="CHO_DUYET")  # 'CHO_DUYET' | 'DA_CHOT' | 'CAN_GIAI_TRINH'
    closed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    staff = relationship("User", foreign_keys=[staff_id], back_populates="shifts")
    closer = relationship("User", foreign_keys=[closed_by])


class SystemSetting(Base):
    """14. Bảng SYSTEM_SETTINGS - Cấu hình tham số vận hành hệ thống."""
    __tablename__ = "system_settings"

    setting_key = Column(String(50), primary_key=True)
    setting_value = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
