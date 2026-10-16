# NEUFood - Campus Food Delivery System

Hệ thống đặt và giao đồ ăn nội bộ khuôn viên trường Đại học Kinh tế Quốc dân (NEU). Dành cho sinh viên, giảng viên và cán bộ nhân viên NEU với tốc độ giao hàng nhanh, tích hợp trợ lý AI gợi ý món ăn, theo dõi đơn hàng thời gian thực và cổng quản lý bán hàng (Admin Portal).

---

## Cấu Trúc Dự Án (Project Structure)

```text
[NeuFood]/
├── .gitignore
├── docker-compose.yml
├── README.md
│
├── database/
│   ├── README.md                          # Hướng dẫn thiết lập, tài liệu ERD
│   ├── init_db.sql                        # Schema DDL (CREATE TABLE, EXTENSION, TRIGGER, INDEX)
│   └── sample_data.sql                    # Seed data phục vụ test cục bộ
│
├── docs/
│   ├── Quy_Trinh_Nghiep_Vu.md             # Đặc tả 25 Use Cases, 25 Business Rules, 23 Exceptions & State Machine
│   ├── PHAN_CONG_BACKEND.md               # Kế hoạch phân công công việc & nhánh Git cho 4 thành viên
│   ├── API_DOCUMENTATION.md               # Đặc tả chi tiết REST API endpoints (Request/Response JSON)
│   ├── TESTING_AND_DATABASE_GUIDE.md      # Hướng dẫn test Postman & xem DB qua TablePlus (Mac) / MS SQL Server (Win)
│   ├── ARCHITECTURE.md                    # Kiến trúc tổng thể và luồng dữ liệu
│   └── GETTING_STARTED.md                 # Hướng dẫn cài đặt và khởi chạy từ A-Z
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt                   # flask, sqlalchemy, psycopg2-binary, pydantic, pyjwt, bcrypt,...
│   ├── .env.example
│   ├── run.py                             # Entrypoint khởi chạy dev server (app.run)
│   └── app/
│       ├── __init__.py                    # Hàm create_app(), cấu hình CORS, Limiter, đăng ký Blueprints
│       ├── core/
│       │   ├── __init__.py
│       │   ├── config.py                  # Cấu hình nạp biến môi trường (Pydantic / BaseSettings)
│       │   ├── limiter.py                 # Khởi tạo Flask-Limiter
│       │   └── security.py                # Hash mật khẩu, JWT encode/decode, decorator @jwt_required, @role_required
│       ├── db/
│       │   ├── __init__.py
│       │   ├── models.py                  # 12 bảng ORM SQLAlchemy khớp 100% với database/init_db.sql
│       │   └── session.py                 # Engine SQLAlchemy, scoped_session, get_db()
│       ├── schemas/                       # DTOs Pydantic xác thực request & format response (auth, user, setting, dish, location, order, review, complaint, shift)
│       ├── crud/                          # Data Access Layer thao tác với Database (user, setting, dish, location, order, review, complaint, shift)
│       ├── routes/                        # 9 Flask Blueprints (auth, user, setting, dish, location, order, review, complaint, shift)
│       ├── utils/                         # Tiện ích bổ trợ (upload file, api_response, validators)
│       │   ├── __init__.py
│       │   └── helpers.py
│       └── uploads/                       # Thư mục lưu trữ media nội bộ (được gitignore)
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.js / postcss.config.js
    ├── index.html
    ├── .env.example                       # VITE_API_BASE_URL=http://localhost:5000/api/v1
    └── src/
        ├── main.tsx                       # Điểm neo ứng dụng React (React DOM render)
        ├── App.tsx                        # Thiết lập Router, Provider bọc ngoài
        ├── routes/                        # Cấu hình danh sách routes (React Router DOM)
        │   ├── index.tsx
        │   └── ProtectedRoute.tsx         # Component chặn truy cập nếu chưa login hoặc sai role
        ├── pages/                         # Các trang giao diện phân theo chức năng/vai trò
        │   ├── auth/
        │   │   ├── LoginPage.tsx
        │   │   ├── ForgotPasswordPage.tsx
        │   │   ├── RegisterPage.tsx
        │   │   └── OAuthCallbackPage.tsx
        │   ├── admin/
        │   │   ├── AdminBaoCaoPage.tsx
        │   │   ├── AdminDonPage.tsx
        │   │   ├── AdminLoginPage.tsx
        │   │   ├── AdminMonPage.tsx
        │   │   ├── AdminSuaMonPage.tsx
        │   │   └── AdminThemMonPage.tsx
        │   ├── user/
        │   │   ├── HomePage.tsx
        │   │   ├── MenuPage.tsx
        │   │   ├── ChiTietMonPage.tsx
        │   │   ├── GioHangPage.tsx
        │   │   ├── ThanhToanPage.tsx
        │   │   ├── DonHangPage.tsx
        │   │   ├── LichSuDonHangPage.tsx
        │   │   ├── TaiKhoanPage.tsx
        │   │   ├── GanNeuPage.tsx
        │   │   ├── RecruitPage.tsx
        │   │   └── StoryPage.tsx
        │   └── not-found/
        │       └── NotFoundPage.tsx
        ├── components/
        │   ├── common/                    # Nút bấm, Ô nhập, Modal, Spinner, Bảng...
        │   │   ├── Button.tsx
        │   │   ├── Input.tsx
        │   │   ├── Modal.tsx
        │   │   └── Table.tsx
        │   ├── layout/                    # Khung sườn (Navbar, Sidebar, Footer, Layout wrapper)
        │   │   ├── MainLayout.tsx
        │   │   ├── Navbar.tsx
        │   │   ├── Sidebar.tsx
        │   │   ├── Footer.tsx
        │   │   └── BottomNav.tsx
        │   ├── dishes/
        │   │   └── FoodCard.tsx
        │   ├── chatbot/
        │   │   └── ChatbotWidget.tsx
        │   └── orders/
        │       └── OrderReviewModal.tsx
        ├── contexts/                      # React Context API (Global state)
        │   ├── AuthContext.tsx
        │   ├── ThemeContext.tsx
        │   ├── CartContext.tsx
        │   ├── OrderHistoryContext.tsx
        │   ├── MenuSearchContext.tsx
        │   ├── AdminAuthContext.tsx
        │   └── AdminDishesContext.tsx
        ├── hooks/                         # Custom React Hooks
        │   ├── useAuth.ts
        │   ├── useDebounce.ts
        │   └── useAdminDishes.ts
        ├── services/                      # Giao tiếp HTTP với Backend
        │   ├── api.ts                     # Axios client cấu hình BaseURL & Request/Response Interceptor JWT
        │   ├── authService.ts             # Các hàm gọi API auth: login, logout, getMe
        │   ├── dishService.ts
        │   └── orderService.ts
        ├── types/                         # TypeScript interfaces/types định nghĩa DTOs & Models
        │   ├── auth.ts
        │   ├── user.ts
        │   ├── dish.ts
        │   └── order.ts
        ├── constants/                     # Hằng số (Routes path, Enum roles, App settings)
        └── styles/                        # File CSS toàn cục (Tailwind/Custom styles)
            └── index.css
```

---

## Công Nghệ Sử Dụng (Tech Stack)

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Chart.js, React Router DOM v7.
- **Backend**: Python 3.11+, Flask (Application Factory), SQLAlchemy ORM, Pydantic v2 (Data Validation & Serialization), PyJWT, Bcrypt, Flask-CORS, Flask-Limiter.
- **Database**: PostgreSQL 16+ (Trigger tự động cập nhật timestamps, Index tối ưu truy vấn).
- **DevOps**: Docker, Docker Compose đa dịch vụ (Database, Backend, Frontend).

---

## Khởi Chạy Nhanh (Quick Start)

### Cách 1: Khởi chạy toàn bộ với Docker Compose
```bash
docker compose up --build -d
```
- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000/api/v1](http://localhost:5000/api/v1)
- **PostgreSQL**: `localhost:5432` (User: `neufood_user`, DB: `neufood_db`)

### Cách 2: Chạy thủ công từng phần
Xem hướng dẫn chi tiết tại [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md).

---

## Tài Liệu Kỹ Thuật Dành Cho Nhóm Phát Triển (Documentation)

Khi mới `git pull` dự án về, các bạn trong nhóm vui lòng đọc theo thứ tự sau:
1. **[Hướng dẫn Cài Đặt & Khởi Chạy (docs/GETTING_STARTED.md)](docs/GETTING_STARTED.md)**: Cài đặt môi trường, khởi chạy Docker và danh sách tài khoản test.
2. **[Đặc tả Quy Trình & Quy Tắc Nghiệp Vụ (docs/Quy_Trinh_Nghiep_Vu.md)](docs/Quy_Trinh_Nghiep_Vu.md)**: Toàn bộ 5 Actors, 25 Use Cases (`UC01`–`UC25`), 25 Business Rules (`BR-01`–`BR-25`), 23 Ngoại lệ (`EX-01`–`EX-23`) và State Machine 14 trạng thái đơn hàng.
3. **[Kế hoạch Phân Công Backend cho 4 Thành Viên (docs/PHAN_CONG_BACKEND.md)](docs/PHAN_CONG_BACKEND.md)**: Phân chia nhánh Git, phạm vi file và checklist từng thành viên.
4. **[Đặc tả REST API Endpoints (docs/API_DOCUMENTATION.md)](docs/API_DOCUMENTATION.md)**: Chi tiết URL, Request Body và Response JSON chuẩn của toàn bộ các phân hệ.
5. **[Hướng dẫn Test Postman & Xem Database qua TablePlus / MS SQL Server (docs/TESTING_AND_DATABASE_GUIDE.md)](docs/TESTING_AND_DATABASE_GUIDE.md)**: Cách cấu hình Postman tự động lưu JWT token và kết nối Database trên macOS / Windows.
6. **[Tài liệu Kiến Trúc Hệ Thống (docs/ARCHITECTURE.md)](docs/ARCHITECTURE.md)** & **[Thiết kế Cơ sở Dữ liệu & ERD (database/README.md)](database/README.md)**.
7. **[Quy tắc làm việc với Git/GitHub của nhóm (QUY TẮC LÀM VIỆC VỚI GIT-GITHUB CỦA NHÓM.md)](QUY%20T%E1%BA%AEC%20L%C3%80M%20VI%E1%BB%86C%20V%E1%BB%9AI%20GIT-GITHUB%20C%E1%BB%A6A%20NH%C3%93M.md)**.