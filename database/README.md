# Tài Liệu Thiết Kế Cơ Sở Dữ Liệu NEUFood (12 Bảng Chuẩn Nghiệp Vụ) 🗄️

Hệ thống cơ sở dữ liệu quan hệ cho **NEUFood** sử dụng **PostgreSQL 16+** (tương thích với SQLAlchemy ORM cho cả MS SQL Server), hỗ trợ ràng buộc toàn vẹn dữ liệu (`CHECK CONSTRAINT`), trigger tự động cập nhật `updated_at` và chỉ mục tối ưu truy vấn.

---

## 1. Sơ Đồ Thực Thể Quan Hệ (Entity-Relationship Diagram - 12 Bảng)

```mermaid
erDiagram
    USERS ||--o{ ORDERS : "places (user_id)"
    USERS ||--o{ ORDERS : "handles (staff_id)"
    USERS ||--o{ REVIEWS : "writes"
    USERS ||--o{ COMPLAINTS : "submits"
    USERS ||--o{ STAFF_SHIFTS : "works"
    CAMPUS_LOCATIONS ||--o{ ORDERS : "delivers to"
    CATEGORIES ||--o{ DISH_CATEGORIES : "contains"
    DISHES ||--o{ DISH_CATEGORIES : "belongs to"
    DISHES ||--o{ DISH_BADGES : "has"
    DISHES ||--o{ ORDER_ITEMS : "ordered in"
    DISHES ||--o{ REVIEWS : "reviewed in"
    ORDERS ||--|{ ORDER_ITEMS : "consists of"
    ORDERS ||--o{ REVIEWS : "includes"
    ORDERS ||--o| COMPLAINTS : "has ticket"

    USERS {
        int id PK
        string email UK
        string password_hash
        string full_name
        string phone_number
        string student_id
        string role "customer | staff | manager | admin"
        string avatar_url
        boolean is_active
        boolean is_blacklisted
        text blacklist_reason
        timestamp blacklisted_at
        int failed_login_attempts
        timestamp locked_until
        timestamp created_at
        timestamp updated_at
    }

    CAMPUS_LOCATIONS {
        int id PK
        string building_code UK "A1, A2, B, C, D, KTX..."
        string building_name
        string default_room_note
        boolean is_active
        int display_order
        timestamp created_at
        timestamp updated_at
    }

    CATEGORIES {
        string id PK "slug: com-hop, mi-pho..."
        string name
        string description
        int display_order
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    DISHES {
        string id PK "slug: pho-bo-tai-lan..."
        string name
        string short_description
        text description
        numeric base_price "Giá gốc Canteen A"
        numeric system_fee "Phụ phí 5000đ"
        numeric price "base_price + 5000đ"
        numeric rating
        int review_count
        string image_url
        boolean is_available
        boolean is_active
        boolean is_deleted "Soft Delete (BR-04)"
        timestamp created_at
        timestamp updated_at
    }

    DISH_CATEGORIES {
        string dish_id PK,FK
        string category_id PK,FK
    }

    DISH_BADGES {
        int id PK
        string dish_id FK
        string badge "bestSeller | hot | new"
    }

    ORDERS {
        string id PK "NF2610153456"
        string order_code_suffix "4 số cuối (BR-18)"
        int user_id FK
        int staff_id FK
        string order_type "delivery | pickup"
        string recipient_name
        string recipient_phone
        int campus_location_id FK
        string room_detail
        text delivery_address
        text delivery_note
        boolean is_preorder
        timestamp scheduled_at
        string status "14 trạng thái State Machine"
        numeric subtotal_amount
        numeric ship_fee "5000đ hoặc 0đ"
        numeric total_amount "<= 500000đ (BR-14)"
        string payment_method "cod_cash | cod_vietqr"
        string payment_status "chua_thanh_toan | da_thanh_toan"
        string eta
        timestamp pickup_deadline
        timestamp auto_complete_at
        timestamp delivered_at
        timestamp completed_at
        text cancelled_reason
        timestamp created_at
        timestamp updated_at
    }

    ORDER_ITEMS {
        int id PK
        string order_id FK
        string dish_id FK
        string dish_name
        numeric unit_price
        numeric base_price
        int quantity "1..10 (BR-07)"
        string note
        numeric subtotal
    }

    REVIEWS {
        int id PK
        string order_id FK
        string dish_id FK
        int user_id FK
        int rating "1..5"
        text comment
        timestamp created_at
    }

    COMPLAINTS {
        int id PK
        string order_id UK,FK
        int user_id FK
        string reason
        text description
        text proof_image_url
        string status "DANG_XU_LY | CHAP_NHAN | TU_CHOI"
        text admin_response
        int resolved_by FK
        timestamp resolved_at
        timestamp created_at
        timestamp updated_at
    }

    STAFF_SHIFTS {
        int id PK
        int staff_id FK
        date shift_date
        int total_orders_handled
        numeric expected_cash
        numeric expected_qr
        numeric actual_cash
        numeric actual_qr
        numeric discrepancy_amount
        text discrepancy_note
        string status "CHO_DUYET | DA_CHOT | CAN_GIAI_TRINH"
        int closed_by FK
        timestamp closed_at
        timestamp created_at
        timestamp updated_at
    }

    SYSTEM_SETTINGS {
        string setting_key PK
        string setting_value
        text description
        timestamp updated_at
    }
```

---

## 2. Chi Tiết Các Tệp Trong Thư Mục `database/`

- [`init_db.sql`](./init_db.sql): Định nghĩa DDL hoàn chỉnh cho 12 bảng, Khóa chính, Khóa ngoại, Ràng buộc `CHECK`, Trigger tự động cập nhật `updated_at`, và hệ thống Indexes.
- [`sample_data.sql`](./sample_data.sql): Dữ liệu mẫu chuẩn nghiệp vụ gồm 6 tài khoản (4 roles + tài khoản Blacklist COD), 8 tòa nhà nội khu NEU, 8 danh mục, 65 món ăn & combo (đồng bộ đầy đủ từ giao diện frontend cũ), 11 tham số hệ thống, 6 đơn hàng trải rộng các trạng thái, đánh giá, khiếu nại và biên bản chốt ca COD.
- [`erd.html`](./erd.html): Sơ đồ ERD tương tác trực quan mở trực tiếp trên trình duyệt.

---

## 3. Hướng Dẫn Khởi Tạo & Xem Database

- **Khởi chạy tự động qua Docker Compose:**
  ```bash
  docker compose up -d database
  ```
- **Xem trực quan bằng TablePlus (macOS / Windows) hoặc MS SQL Server (Windows):**
  Xem hướng dẫn chi tiết từng bước tại **[docs/TESTING_AND_DATABASE_GUIDE.md](../docs/TESTING_AND_DATABASE_GUIDE.md)**.
