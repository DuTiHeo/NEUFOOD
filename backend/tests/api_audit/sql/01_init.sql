-- ==============================================================================
-- NEUFood Database Schema (PostgreSQL)
-- Canteen A2 - Đại học Kinh tế Quốc dân (NEU)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TRIGGER FUNCTION: Tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. BẢNG USERS
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    student_id VARCHAR(30),
    role VARCHAR(20) NOT NULL DEFAULT 'customer' 
        CHECK (role IN ('customer', 'staff', 'manager', 'admin')),
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_blacklisted BOOLEAN NOT NULL DEFAULT FALSE,
    blacklist_reason TEXT,
    blacklisted_at TIMESTAMP WITH TIME ZONE,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS set_timestamp_users ON users;
CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 4. BẢNG CAMPUS_LOCATIONS (Địa điểm nội khu NEU)
CREATE TABLE IF NOT EXISTS campus_locations (
    id SERIAL PRIMARY KEY,
    building_code VARCHAR(30) UNIQUE NOT NULL,
    building_name VARCHAR(150) NOT NULL,
    default_room_note VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS set_timestamp_campus_locations ON campus_locations;
CREATE TRIGGER set_timestamp_campus_locations
BEFORE UPDATE ON campus_locations
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 5. BẢNG CATEGORIES (Danh mục món)
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS set_timestamp_categories ON categories;
CREATE TRIGGER set_timestamp_categories
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 6. BẢNG DISHES (Thực đơn món ăn Canteen A2)
CREATE TABLE IF NOT EXISTS dishes (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    short_description TEXT,
    description TEXT,
    base_price NUMERIC(12, 2) NOT NULL CHECK (base_price >= 0),
    system_fee NUMERIC(12, 2) NOT NULL DEFAULT 5000 CHECK (system_fee >= 0),
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    rating NUMERIC(3, 2) DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
    review_count INT DEFAULT 0 CHECK (review_count >= 0),
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS set_timestamp_dishes ON dishes;
CREATE TRIGGER set_timestamp_dishes
BEFORE UPDATE ON dishes
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 7. BẢNG DISH_CATEGORIES (N:N)
CREATE TABLE IF NOT EXISTS dish_categories (
    dish_id VARCHAR(100) NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    category_id VARCHAR(50) NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (dish_id, category_id)
);

-- 8. BẢNG DISH_BADGES
CREATE TABLE IF NOT EXISTS dish_badges (
    id SERIAL PRIMARY KEY,
    dish_id VARCHAR(100) NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    badge VARCHAR(50) NOT NULL
);

-- 9. BẢNG ORDERS (Đơn hàng)
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(50) PRIMARY KEY,
    order_code_suffix VARCHAR(4) NOT NULL,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    staff_id INT REFERENCES users(id) ON DELETE SET NULL,
    order_type VARCHAR(20) NOT NULL DEFAULT 'delivery' 
        CHECK (order_type IN ('delivery', 'pickup')),
    recipient_name VARCHAR(150) NOT NULL,
    recipient_phone VARCHAR(20) NOT NULL,
    campus_location_id INT REFERENCES campus_locations(id) ON DELETE SET NULL,
    room_detail VARCHAR(100),
    delivery_address TEXT NOT NULL,
    delivery_note TEXT,
    is_preorder BOOLEAN NOT NULL DEFAULT FALSE,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(30) NOT NULL DEFAULT 'CHO_XAC_NHAN'
        CHECK (status IN (
            'CHO_XAC_NHAN', 'DANG_CHUAN_BI', 'DANG_GIAO', 'SAN_SANG_LAY',
            'DA_GIAO', 'DA_BAN_GIAO', 'GIAO_THAT_BAI', 'HOAN_THANH',
            'DA_HUY_KHACH', 'TU_CHOI', 'TU_DONG_HUY', 'BO_DON_BLACKLIST',
            'KHIEU_NAI', 'DA_GIAI_QUYET'
        )),
    subtotal_amount NUMERIC(12, 2) NOT NULL CHECK (subtotal_amount >= 0),
    ship_fee NUMERIC(12, 2) NOT NULL DEFAULT 5000 CHECK (ship_fee >= 0),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0 AND total_amount <= 500000),
    payment_method VARCHAR(30) NOT NULL DEFAULT 'cod_cash' 
        CHECK (payment_method IN ('cod_cash', 'cod_vietqr')),
    payment_status VARCHAR(30) NOT NULL DEFAULT 'chua_thanh_toan' 
        CHECK (payment_status IN ('chua_thanh_toan', 'da_thanh_toan')),
    eta VARCHAR(50),
    pickup_deadline TIMESTAMP WITH TIME ZONE,
    auto_complete_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS set_timestamp_orders ON orders;
CREATE TRIGGER set_timestamp_orders
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 10. BẢNG ORDER_ITEMS (Chi tiết đơn)
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    dish_id VARCHAR(100) REFERENCES dishes(id) ON DELETE SET NULL,
    dish_name VARCHAR(200) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    base_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    quantity INT NOT NULL CHECK (quantity > 0 AND quantity <= 10),
    note TEXT,
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0)
);

-- 11. BẢNG REVIEWS
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    dish_id VARCHAR(100) NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. BẢNG COMPLAINTS (Khiếu nại)
CREATE TABLE IF NOT EXISTS complaints (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    proof_image_url TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DANG_XU_LY' 
        CHECK (status IN ('DANG_XU_LY', 'CHAP_NHAN', 'TU_CHOI', 'YEU_CAU_BO_SUNG')),
    admin_response TEXT,
    resolved_by INT REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS set_timestamp_complaints ON complaints;
CREATE TRIGGER set_timestamp_complaints
BEFORE UPDATE ON complaints
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 13. BẢNG STAFF_SHIFTS (Chốt ca & Đối soát COD)
CREATE TABLE IF NOT EXISTS staff_shifts (
    id SERIAL PRIMARY KEY,
    staff_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_orders_handled INT NOT NULL DEFAULT 0,
    expected_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
    expected_qr NUMERIC(12, 2) NOT NULL DEFAULT 0,
    actual_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
    actual_qr NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discrepancy_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discrepancy_note TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'CHO_DUYET' 
        CHECK (status IN ('CHO_DUYET', 'DA_CHOT', 'CAN_GIAI_TRINH')),
    closed_by INT REFERENCES users(id) ON DELETE SET NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS set_timestamp_staff_shifts ON staff_shifts;
CREATE TRIGGER set_timestamp_staff_shifts
BEFORE UPDATE ON staff_shifts
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 14. BẢNG SYSTEM_SETTINGS (Cấu hình hệ thống)
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS set_timestamp_system_settings ON system_settings;
CREATE TRIGGER set_timestamp_system_settings
BEFORE UPDATE ON system_settings
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 15. INDEXES
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_blacklisted ON users(is_blacklisted);

CREATE INDEX IF NOT EXISTS idx_campus_locations_code ON campus_locations(building_code);
CREATE INDEX IF NOT EXISTS idx_campus_locations_active ON campus_locations(is_active);

CREATE INDEX IF NOT EXISTS idx_dishes_available ON dishes(is_available);
CREATE INDEX IF NOT EXISTS idx_dishes_active_deleted ON dishes(is_active, is_deleted);
CREATE INDEX IF NOT EXISTS idx_dish_categories_cat ON dish_categories(category_id);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_staff_id ON orders(staff_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_type ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_code_suffix ON orders(order_code_suffix);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_dish_id ON reviews(dish_id);
CREATE INDEX IF NOT EXISTS idx_complaints_order_id ON complaints(order_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_staff_date ON staff_shifts(staff_id, shift_date);
