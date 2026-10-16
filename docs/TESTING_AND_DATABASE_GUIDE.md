# HƯỚNG DẪN KIỂM THỬ API QUA POSTMAN & QUẢN TRỊ DATABASE (TABLEPLUS / MS SQL SERVER) 🧪🗄️

Tài liệu này hướng dẫn chi tiết cho 4 thành viên trong nhóm cách:
1. Thiết lập và kiểm thử các API Backend bằng **Postman** theo từng phân hệ được giao.
2. Kết nối, xem và thao tác trực tiếp với Cơ sở dữ liệu qua **TablePlus (trên macOS / Windows)** hoặc **MS SQL Server - SSMS / DBeaver (trên Windows)**.

---

## PHẦN 1: HƯỚNG DẪN XEM & QUẢN TRỊ DATABASE

Dự án **NEUFood** được cấu hình sẵn cơ sở dữ liệu **PostgreSQL 16** chạy trong Docker (hoặc cài đặt cục bộ) với đầy đủ 12 bảng và dữ liệu mẫu từ `database/init_db.sql` và `database/sample_data.sql`.

### 1.1. Thông số kết nối Database mặc định (Khi chạy Docker Compose)
Trước tiên, hãy đảm bảo Database đang chạy bằng lệnh:
```bash
docker compose up -d database
```
Thông số kết nối chuẩn:
- **Host / Server**: `127.0.0.1` (hoặc `localhost`)
- **Port**: `5432`
- **User**: `neufood_user`
- **Password**: `neufood_password`
- **Database Name**: `neufood_db`

---

### 1.2. Cách 1: Xem Database bằng TablePlus (Khuyên dùng cho macOS & cả Windows)

**TablePlus** là công cụ quản trị Database trực quan, nhẹ và hỗ trợ cả PostgreSQL lẫn MS SQL Server trên macOS và Windows.

#### Các bước kết nối trên TablePlus:
1. Tải và mở [TablePlus](https://tableplus.com/).
2. Tại màn hình chính, nhấn nút **`+` (Create a new connection)** $\rightarrow$ Chọn **PostgreSQL** $\rightarrow$ Nhấn **Create**.
3. Điền các thông số vào cửa sổ cấu hình:
   - **Name**: `NEUFood Local DB`
   - **Host**: `127.0.0.1`
   - **Port**: `5432`
   - **User**: `neufood_user`
   - **Password**: `neufood_password`
   - **Database**: `neufood_db`
4. Nhấn nút **Test** ở góc dưới bên phải. Nếu các ô chuyển sang màu xanh lá $\rightarrow$ Nhấn **Connect**.

#### Các thao tác thường dùng trong TablePlus khi code Backend:
- **Xem danh sách 12 bảng:** Cột bên trái (Sidebar) hiển thị toàn bộ 12 bảng: `users`, `campus_locations`, `categories`, `dishes`, `dish_categories`, `dish_badges`, `orders`, `order_items`, `reviews`, `complaints`, `staff_shifts`, `system_settings`.
- **Sửa nhanh dữ liệu để test:** Nháy đúp vào một ô bất kỳ trên bảng (ví dụ: sửa `is_blacklisted` của user thành `false`, hoặc sửa `status` của đơn hàng về `CHO_XAC_NHAN`), sau đó nhấn **`Cmd + S`** (macOS) hoặc **`Ctrl + S`** (Windows) để lưu xuống Database.
- **Làm mới dữ liệu sau khi gọi Postman:** Nhấn **`Cmd + R`** (macOS) hoặc **`Ctrl + R`** / **`F5`** (Windows) để thấy ngay dữ liệu mới vừa được API tạo/cập nhật.
- **Mở cửa sổ chạy câu lệnh SQL:** Nhấn **`Cmd + E`** (macOS) hoặc **`Ctrl + E`** (Windows) để mở SQL Query Editor.

---

### 1.3. Cách 2: Dành cho thành viên dùng Windows (MS SQL Server / SSMS / TablePlus Windows)

Nếu bạn đang dùng máy **Windows**, bạn có **2 phương án** để làm việc với Database:

#### Phương án A (Khuyên dùng - Đồng bộ 100% với cả nhóm, không cần sửa code):
Sử dụng **TablePlus bản Windows** hoặc **DBeaver / pgAdmin 4** kết nối thẳng vào container PostgreSQL (`127.0.0.1:5432`, user `neufood_user`, password `neufood_password`, database `neufood_db`) giống hệt mục 1.2 ở trên.

#### Phương án B (Sử dụng Microsoft SQL Server & SSMS - SQL Server Management Studio trên Windows):
Nếu máy Windows của bạn đã cài sẵn **MS SQL Server** và **SQL Server Management Studio (SSMS)** và bạn muốn xem/chạy Database trực tiếp trên MS SQL Server:

1. **Mở SQL Server Management Studio (SSMS) trên Windows:**
   - **Server type**: `Database Engine`
   - **Server name**: `localhost` (hoặc `.\SQLEXPRESS` hoặc `127.0.0.1,1433`)
   - **Authentication**:
     - Chọn *Windows Authentication* (nếu dùng tài khoản máy Windows), hoặc
     - Chọn *SQL Server Authentication* (Login: `sa`, Password: `<mật_khẩu_sa_của_bạn>`).
   - Nhấn **Connect**.
2. **Tạo Database trong SSMS:**
   - Trong cây **Object Explorer** bên trái, chuột phải vào thư mục **Databases** $\rightarrow$ Chọn **New Database...**
   - Nhập **Database name**: `neufood_db` $\rightarrow$ Nhấn **OK**.
3. **Tự động tạo 12 bảng từ SQLAlchemy Models (Không cần viết lại file SQL cho T-SQL):**
   - Vì dự án sử dụng **SQLAlchemy ORM** (`backend/app/db/models.py`), bạn chỉ cần cấu hình `DATABASE_URL` trong file `backend/.env` trỏ tới MS SQL Server và gọi `Base.metadata.create_all(bind=engine)`:
   - Cài đặt driver kết nối MS SQL Server cho Python:
     ```bash
     pip install pyodbc
     ```
   - Sửa dòng `DATABASE_URL` trong file `backend/.env`:
     ```env
     # Nếu dùng tài khoản sa (SQL Server Authentication):
     DATABASE_URL=mssql+pyodbc://sa:MatKhauCuaBan@localhost:1433/neufood_db?driver=ODBC+Driver+17+for+SQL+Server

     # Hoặc nếu dùng Windows Authentication trên SQLEXPRESS:
     DATABASE_URL=mssql+pyodbc://@localhost\SQLEXPRESS/neufood_db?driver=ODBC+Driver+17+for+SQL+Server&trusted_connection=yes
     ```
   - Chạy lệnh Python 1 dòng sau tại thư mục `backend/` để SQLAlchemy tự động sinh đủ 12 bảng trong MS SQL Server:
     ```bash
     python -c "from app.db.session import engine, Base; import app.db.models; Base.metadata.create_all(bind=engine); print('Đã tạo đủ 12 bảng trên MS SQL Server!')"
     ```
4. **Xem bảng và dữ liệu trong SSMS:**
   - Mở rộng `Databases` $\rightarrow$ `neufood_db` $\rightarrow$ `Tables`.
   - Chuột phải vào bảng cần xem (ví dụ: `dbo.users`, `dbo.orders`) $\rightarrow$ Chọn **Select Top 1000 Rows** để xem dữ liệu, hoặc **Edit Top 200 Rows** để sửa trực tiếp dữ liệu test.
   - Xem sơ đồ quan hệ (ERD) trong SSMS: Chuột phải vào **Database Diagrams** $\rightarrow$ **New Database Diagram** $\rightarrow$ Bôi đen cả 12 bảng và nhấn **Add**.

> **Lưu ý khi làm việc nhóm:** File `database/init_db.sql` và `docker-compose.yml` trên nhánh `main` sử dụng PostgreSQL làm chuẩn chung cho cả nhóm. Nếu bạn test cục bộ bằng MS SQL Server, tuyệt đối **không commit file `.env`** cá nhân lên Git.

---

## PHẦN 2: HƯỚNG DẪN KIỂM THỬ API QUA POSTMAN CHO 4 THÀNH VIÊN

### 2.1. Thiết lập Môi trường (Environment) trên Postman

Để không phải copy-paste lại địa chỉ server và JWT Token ở từng request, cả 4 thành viên hãy tạo một Environment trên Postman như sau:

1. Mở **Postman** $\rightarrow$ Nhấn vào tab **Environments** ở thanh bên trái $\rightarrow$ Nhấn dấu **`+`** tạo Environment mới tên là **`NEUFood Local`**.
2. Thêm 2 biến sau vào bảng:
   | Variable | Type | Initial Value | Current Value |
   | :--- | :--- | :--- | :--- |
   | `base_url` | default | `http://localhost:5000/api/v1` | `http://localhost:5000/api/v1` |
   | `token` | secret | *(để trống)* | *(để trống)* |
3. Nhấn **Save** và chọn **`NEUFood Local`** ở góc trên bên phải của Postman.

---

### 2.2. Tự động lưu JWT Token khi Đăng nhập (Mẹo cực nhanh)

1. Tạo một Request mới trong Postman:
   - **Method**: `POST`
   - **URL**: `{{base_url}}/auth/login`
   - **Tab Body** $\rightarrow$ Chọn **raw** $\rightarrow$ Chọn định dạng **JSON**:
     ```json
     {
       "email": "admin@neufood.vn",
       "password": "password123"
     }
     ```
2. Chuyển sang tab **Scripts** $\rightarrow$ mục **Post-response** (hoặc tab **Tests** ở Postman bản cũ), dán đoạn code tự động lưu token sau:
   ```javascript
   const res = pm.response.json();
   if (res.success && res.data && res.data.access_token) {
       pm.environment.set("token", res.data.access_token);
       console.log("Đã lưu JWT Token cho role:", res.data.user.role);
   }
   ```
3. Đối với tất cả các API yêu cầu đăng nhập:
   - Vào tab **Authorization** của Request (hoặc của cả Collection) $\rightarrow$ Chọn **Auth Type**: **`Bearer Token`** $\rightarrow$ Ô Token điền: `{{token}}`.
   - Khi muốn đổi vai trò test (từ `customer` sang `staff`, `manager`, hay `admin`), bạn chỉ cần đổi email trong request Login rồi bấm **Send**, mọi request khác sẽ tự động dùng token mới!

---

### 2.3. Danh sách 6 Tài khoản Mẫu có sẵn trong Database (`sample_data.sql`)

Mật khẩu chung cho tất cả tài khoản mẫu là: **`password123`**

| ID | Email đăng nhập | Role (`users.role`) | Mục đích sử dụng khi test trên Postman |
| :-: | :--- | :---: | :--- |
| `1` | `admin@neufood.vn` | `admin` | Test quản trị tài khoản, Blacklist COD, cấu hình hệ thống, địa điểm NEU, phân xử khiếu nại (`UC23`, `UC24`, `UC25`). |
| `2` | `manager.a2@neufood.vn` | `manager` | Test thêm/sửa/ẩn món ăn, đổi giá gốc, duyệt chốt ca COD, xem báo cáo doanh thu (`UC20`, `UC21`, `UC22`). |
| `3` | `shipper01@neufood.vn` | `staff` | Test bật/tắt còn/hết món, tiếp nhận đơn, nấu xong, bàn giao đối chiếu 4 số cuối, nộp tiền chốt ca (`UC16`–`UC20`). |
| `4` | `sinhvien@neu.edu.vn` | `customer` | Khách hàng đang có đơn `CHO_XAC_NHAN` (`NF2610153456`) và `DANG_GIAO` (`NF2610159921`), dùng để test `EX-09` (chặn đặt 2 đơn cùng lúc) và đánh giá món (`UC14`). |
| `5` | `thanhhuong@neu.edu.vn` | `customer` | Khách hàng có đơn nhận tại quầy (`NF2610157812`) và đơn đang khiếu nại (`NF2610155566`). |
| `6` | `boomhang@neu.edu.vn` | `customer` | Khách hàng đang có `is_blacklisted = TRUE`, dùng để test chặn tạo đơn COD (`BR-22`, `EX-10`). |

---

### 2.4. Kịch bản Kiểm thử Postman cho từng Thành Viên

#### 👤 Thành Viên 1 (Auth, Users, Blacklist & Settings)
1. **Test Đăng ký trùng email (`EX-01`):**
   - `POST {{base_url}}/auth/register` với `"email": "sinhvien@neu.edu.vn"` $\rightarrow$ Kỳ vọng HTTP `400` (`success: false`).
2. **Test Nhập sai mật khẩu 5 lần liên tiếp (`BR-02`, `EX-02`):**
   - `POST {{base_url}}/auth/login` với `"email": "sinhvien@neu.edu.vn", "password": "sai_mat_khau"` liên tiếp 5 lần.
   - Mở TablePlus / SSMS xem bảng `users`: cột `failed_login_attempts` tăng lên `5` và `locked_until` được gán bằng thời gian hiện tại + 15 phút.
   - Lần thứ 6 nhập đúng `"password": "password123"` vẫn phải bị chặn với HTTP `403` ("Tài khoản tạm khóa 15 phút").
3. **Test Admin gỡ/thêm Blacklist COD (`UC23`):**
   - Đăng nhập bằng `admin@neufood.vn` $\rightarrow$ Gọi `PATCH {{base_url}}/users/admin/6/blacklist` với body `{"is_blacklisted": false, "blacklist_reason": null}` $\rightarrow$ Kiểm tra trên TablePlus user ID `6` đã được gỡ Blacklist.

#### 👤 Thành Viên 2 (Dishes, Categories & Campus Locations)
1. **Test Danh sách địa điểm nội khu (`UC09`, `UC24`):**
   - `GET {{base_url}}/locations` $\rightarrow$ Trả về 8 tòa nhà (`A1`, `A2`, `B`, `C`, `D`, `KTX`, `THU_VIEN`, `NHA_VAN_HOA`).
2. **Test Bật/Tắt trạng thái Còn/Hết món (`UC16`, `BR-06`):**
   - Đăng nhập bằng `shipper01@neufood.vn` (`staff`) $\rightarrow$ `PATCH {{base_url}}/dishes/pho-bo-tai-lan/availability` với body `{"is_available": false}`.
3. **Test Chặn xóa cứng món đã có đơn hàng (`BR-04`, `EX-21`):**
   - Đăng nhập bằng `manager.a2@neufood.vn` (`manager`) $\rightarrow$ `DELETE {{base_url}}/dishes/pho-bo-tai-lan`.
   - Mở TablePlus kiểm tra bảng `dishes`: dòng `pho-bo-tai-lan` **không bị mất**, mà chỉ chuyển `is_deleted = true, is_active = false, is_available = false`.

#### 👤 Thành Viên 3 (Orders COD & State Machine 14 trạng thái)
1. **Test Chặn khách Blacklist đặt hàng (`BR-22`, `EX-10`):**
   - Đăng nhập bằng `boomhang@neu.edu.vn` $\rightarrow$ `POST {{base_url}}/orders` $\rightarrow$ Kỳ vọng HTTP `403` báo tài khoản nằm trong Blacklist COD.
2. **Test Chặn đặt quá 500.000đ (`BR-14`, `EX-11`) hoặc quá 10 phần/món (`BR-07`, `EX-06`):**
   - Gửi `POST {{base_url}}/orders` với `quantity: 12` hoặc tổng tiền `> 500000` $\rightarrow$ Kỳ vọng HTTP `400`/`422`.
3. **Test Bàn giao đơn hàng đối chiếu 4 chữ số cuối (`UC19`, `BR-18`, `EX-17`):**
   - Đăng nhập bằng `shipper01@neufood.vn` $\rightarrow$ Gọi `POST {{base_url}}/orders/NF2610159921/handover`:
     - Thử gửi `{"order_code_suffix": "0000"}` $\rightarrow$ Bị chặn HTTP `400` (`EX-17`).
     - Gửi đúng `{"order_code_suffix": "9921"}` $\rightarrow$ Thành công, kiểm tra TablePlus thấy `status = 'DA_GIAO'` và `payment_status = 'da_thanh_toan'`.

#### 👤 Thành Viên 4 (Reviews, Complaints, Shifts & Reports)
1. **Test Gửi đánh giá món ăn (`UC14`):**
   - Đăng nhập bằng `sinhvien@neu.edu.vn` (chủ của đơn `NF2610148833` đã `HOAN_THANH`) $\rightarrow$ `POST {{base_url}}/reviews` $\rightarrow$ Kiểm tra bảng `dishes` xem `rating` và `review_count` được tính lại chính xác.
2. **Test Admin phân xử khiếu nại (`UC25`, `BR-24`):**
   - Đăng nhập bằng `admin@neufood.vn` $\rightarrow$ `PATCH {{base_url}}/complaints/1/resolve` với body `{"status": "CHAP_NHAN", "admin_response": "Đã xác minh Canteen giao nhầm món, nhắc nhở ca trực Canteen A2"}` $\rightarrow$ Kiểm tra đơn `NF2610155566` chuyển sang `DA_GIAI_QUYET`.
3. **Test Chốt ca COD & Báo cáo doanh thu (`UC20`, `UC22`, `BR-25`, `EX-20`):**
   - Đăng nhập bằng `shipper01@neufood.vn` $\rightarrow$ `GET {{base_url}}/shifts/my-current-shift` và `POST {{base_url}}/shifts/submit`.
   - Đăng nhập bằng `manager.a2@neufood.vn` $\rightarrow$ `GET {{base_url}}/shifts/reports/summary` để kiểm tra số liệu thống kê doanh thu.
