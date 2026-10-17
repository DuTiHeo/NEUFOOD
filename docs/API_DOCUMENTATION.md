# NEUFood REST API Documentation (Chuẩn Nghiệp Vụ v1) 📡

Tài liệu đặc tả chi tiết toàn bộ các giao diện lập trình ứng dụng RESTful API cho hệ thống **NEUFood**, đồng bộ 100% với [`docs/Quy_Trinh_Nghiep_Vu.md`](./Quy_Trinh_Nghiep_Vu.md), [`docs/PHAN_CONG_BACKEND.md`](./PHAN_CONG_BACKEND.md) và [`database/init_db.sql`](../database/init_db.sql).

- **Phiên bản API**: `v1`
- **Tiền tố gốc (Base URL)**: `http://localhost:5000/api/v1`
- **Định dạng dữ liệu**: `application/json`
- **Cơ chế xác thực**: Bearer Token (JSON Web Token - JWT) trong Header: `Authorization: Bearer <access_token>`
- **4 Vai trò (Roles) trong JWT Payload**: `customer`, `staff`, `manager`, `admin`

---

## 1. Định Dạng Phản Hồi Chuẩn (Standard Response Format)

Mọi phản hồi từ API đều sử dụng hàm helper `api_response(data, message, status_code, success, errors)` trong `backend/app/utils/helpers.py`:

**Thành công (`200 OK`, `201 Created`):**
```json
{
  "success": true,
  "message": "Thông báo trạng thái thực hiện",
  "data": { ... }
}
```

**Thất bại / Vi phạm Business Rule / Ngoại lệ (`400`, `401`, `403`, `404`, `422`):**
```json
{
  "success": false,
  "message": "Nội dung lỗi chi tiết theo kịch bản EX-01 -> EX-23",
  "data": null,
  "errors": [ ... ]
}
```

---

## 2. Phân Hệ Thành Viên 1: Xác Thực, Người Dùng, Blacklist & Cấu Hình (`/auth`, `/users`, `/settings`)

### 2.1. Đăng Ký Tài Khoản Khách Hàng (`UC01`, `BR-01`, `EX-01`)
- **Endpoint**: `POST /api/v1/auth/register`
- **Quyền hạn**: Public (Không yêu cầu JWT)
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "email": "sinhvien_moi@neu.edu.vn",
  "password": "password123",
  "full_name": "Nguyễn Văn Sinh Viên",
  "phone_number": "0912345678",
  "student_id": "11218888"
}
```
- **Ràng buộc dữ liệu (`schemas/auth.py`)**:
  - `email`: Bắt buộc, chuỗi email hợp lệ RFC chuẩn (`EmailStr`).
  - `password`: Bắt buộc, độ dài từ 6 đến 128 ký tự (`min_length=6, max_length=128`).
  - `full_name`: Bắt buộc, từ 2 đến 150 ký tự, tự động cắt tỉa khoảng trắng hai đầu (`strip`).
  - `phone_number`: Bắt buộc, số di động Việt Nam hợp lệ gồm đúng 10 chữ số bắt đầu bằng `0` (`^0\d{9}$`) theo `BR-01`.
  - `student_id`: Không bắt buộc (Optional), tối đa 30 ký tự; chuỗi rỗng tự động chuyển thành `null` (`None`).
- **Quy tắc nghiệp vụ & Kịch bản ngoại lệ**:
  - `BR-01`: Tài khoản đăng ký mới luôn được gán vai trò mặc định `role = "customer"`.
  - `EX-01`: Nếu `email` đã tồn tại trên hệ thống $\rightarrow$ Trả về `400 Bad Request` (`"Email đã tồn tại trên hệ thống (EX-01)"`).
  - `EX-01`: Nếu `student_id` đã được liên kết với một tài khoản khác $\rightarrow$ Trả về `400 Bad Request` (`"Mã sinh viên đã tồn tại trên hệ thống (EX-01)"`).
  - `BR-01` / Lỗi Validate: Nếu `phone_number` không đúng định dạng 10 số bắt đầu bằng 0 $\rightarrow$ Trả về `422 Unprocessable Entity` (`"Số điện thoại không hợp lệ, phải gồm đúng 10 chữ số và bắt đầu bằng số 0 (BR-01)"`).
  - Request body không phải JSON object hợp lệ $\rightarrow$ Trả về `400 Bad Request` (`"Dữ liệu đầu vào phải là JSON object hợp lệ"`).
- **Response (`201 Created`)**:
```json
{
  "success": true,
  "message": "Đăng ký tài khoản thành công",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "user": {
      "id": 2,
      "email": "sinhvien_moi@neu.edu.vn",
      "full_name": "Nguyễn Văn Sinh Viên",
      "phone_number": "0912345678",
      "student_id": "11218888",
      "role": "customer",
      "avatar_url": null,
      "is_blacklisted": false,
      "blacklist_reason": null
    }
  }
}
```
- **Response lỗi (`400 Bad Request` - Trùng Email / MSSV)**:
```json
{
  "success": false,
  "message": "Email đã tồn tại trên hệ thống (EX-01)",
  "data": null
}
```
- **Response lỗi (`422 Unprocessable Entity` - Sai định dạng SĐT)**:
```json
{
  "success": false,
  "message": "Số điện thoại không hợp lệ, phải gồm đúng 10 chữ số và bắt đầu bằng số 0 (BR-01)",
  "data": null,
  "errors": [
    {
      "loc": ["phone_number"],
      "msg": "String should match pattern '^0\\d{9}$'",
      "type": "string_pattern_mismatch"
    }
  ]
}
```

### 2.2. Đăng Nhập Hệ Thống & Bảo Vệ Chống Dò Mật Khẩu (`UC02`, `BR-01`, `BR-02`, `EX-02`)
- **Endpoint**: `POST /api/v1/auth/login`
- **Quyền hạn**: Public (Không yêu cầu JWT)
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "email": "admin@neufood.vn",
  "password": "password123"
}
```
- **Ràng buộc dữ liệu (`schemas/auth.py`)**:
  - `email`: Bắt buộc, định dạng email chuẩn (`EmailStr`).
  - `password`: Bắt buộc, chuỗi từ 1 đến 128 ký tự (`min_length=1`).
- **Quy tắc nghiệp vụ & Cơ chế bảo mật (`BR-02`, `EX-02`)**:
  - **Kiểm tra trạng thái tài khoản trước khi xác thực mật khẩu**:
    - Nếu tài khoản có `is_active == false` $\rightarrow$ Trả lỗi `403 Forbidden` (`"Tài khoản này đã bị khóa"`).
    - Nếu tài khoản đang trong thời gian khóa tạm thời 15 phút (`locked_until > now()`) $\rightarrow$ Trả lỗi `403 Forbidden` (`"Tài khoản bị khóa tạm thời 15 phút do nhập sai mật khẩu quá 5 lần (EX-02)"`).
  - **Xác thực mật khẩu**:
    - Nếu sai mật khẩu: Tăng `failed_login_attempts += 1`.
      - Khi `failed_login_attempts < 5` $\rightarrow$ Trả lỗi `401 Unauthorized` (`"Email hoặc mật khẩu không chính xác"`).
      - Khi chạm mốc `failed_login_attempts >= 5` lần liên tiếp $\rightarrow$ Thiết lập `locked_until = now() + 15 minutes` và trả ngay `403 Forbidden` (`"Tài khoản bị khóa tạm thời 15 phút do nhập sai mật khẩu quá 5 lần (EX-02)"`).
    - Nếu đúng mật khẩu:
      - Reset `failed_login_attempts = 0` và xóa mốc khóa `locked_until = null`.
      - Cấp JWT Access Token chứa payload (`sub`, `email`, `role`, `name`) có hiệu lực mặc định 24 giờ.
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "user": {
      "id": 1,
      "email": "admin@neufood.vn",
      "full_name": "Nguyễn Quản Trị (Admin)",
      "phone_number": "0988888888",
      "student_id": "ADMIN01",
      "role": "admin",
      "avatar_url": null,
      "is_blacklisted": false,
      "blacklist_reason": null
    }
  }
}
```
- **Response lỗi (`401 Unauthorized` - Sai mật khẩu < 5 lần)**:
```json
{
  "success": false,
  "message": "Email hoặc mật khẩu không chính xác",
  "data": null
}
```
- **Response lỗi (`403 Forbidden` - Khóa tạm thời 15 phút do sai 5 lần)**:
```json
{
  "success": false,
  "message": "Tài khoản bị khóa tạm thời 15 phút do nhập sai mật khẩu quá 5 lần (EX-02)",
  "data": null
}
```
- **Response lỗi (`403 Forbidden` - Tài khoản bị vô hiệu hóa `is_active=False`)**:
```json
{
  "success": false,
  "message": "Tài khoản này đã bị khóa",
  "data": null
}
```

### 2.3. Lấy Thông Tin Phiên Hiện Tại (`UC03`, `UC04`)
- **Endpoint**: `GET /api/v1/auth/me`
- **Quyền hạn**: Authenticated (`@jwt_required` - Tất cả các role: `customer`, `staff`, `manager`, `admin`)
- **Headers**: `Authorization: Bearer <access_token>`
- **Quy tắc nghiệp vụ**:
  - Trích xuất định danh người dùng từ claim `sub` trong JWT.
  - Kiểm tra người dùng tồn tại và tài khoản đang kích hoạt (`is_active == true`).
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Thành công",
  "data": {
    "id": 1,
    "email": "admin@neufood.vn",
    "full_name": "Nguyễn Quản Trị (Admin)",
    "phone_number": "0988888888",
    "student_id": "ADMIN01",
    "role": "admin",
    "avatar_url": null,
    "is_blacklisted": false,
    "blacklist_reason": null
  }
}
```
- **Response lỗi mẫu**:
  - `401 Unauthorized` (Thiếu hoặc Token hết hạn): `{"success": false, "message": "Token không hợp lệ hoặc đã hết hạn", "data": null}`
  - `403 Forbidden` (Tài khoản bị vô hiệu hóa): `{"success": false, "message": "Tài khoản này đã bị khóa", "data": null}`
  - `404 Not Found` (Không tìm thấy user): `{"success": false, "message": "Không tìm thấy người dùng", "data": null}`

### 2.4. Đăng Xuất Hệ Thống (`UC03`)
- **Endpoint**: `POST /api/v1/auth/logout`
- **Quyền hạn**: Authenticated (`@jwt_required`)
- **Headers**: `Authorization: Bearer <access_token>`
- **Request Body**: Không yêu cầu (None)
- **Quy tắc xử lý**:
  - Kiểm tra JWT hợp lệ của phiên làm việc.
  - Phía Client khi nhận phản hồi `200` sẽ xóa Token khỏi `localStorage` / Session Storage.
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Đăng xuất thành công",
  "data": null
}
```
- **Response lỗi (`401 Unauthorized`)**:
```json
{
  "success": false,
  "message": "Thiếu token xác thực trong header Authorization",
  "data": null
}
```

### 2.5. Đổi Mật Khẩu Tài Khoản (`UC05`)
- **Endpoint**: `POST /api/v1/auth/change-password`
- **Quyền hạn**: Authenticated (`@jwt_required`)
- **Headers**:
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`
- **Request Body**:
```json
{
  "old_password": "password123",
  "new_password": "newpassword456"
}
```
- **Ràng buộc dữ liệu (`schemas/auth.py`)**:
  - `old_password`: Bắt buộc, độ dài từ 1 đến 128 ký tự.
  - `new_password`: Bắt buộc, độ dài từ 6 đến 128 ký tự (`min_length=6, max_length=128`).
- **Quy tắc nghiệp vụ**:
  - Kiểm tra `old_password` có khớp với hash mật khẩu hiện tại trong DB hay không. Nếu sai $\rightarrow$ Trả về `400 Bad Request` (`"Mật khẩu hiện tại không chính xác"`).
  - Kiểm tra `new_password` không được trùng với mật khẩu hiện tại (`old_password` hoặc hash DB). Nếu trùng $\rightarrow$ Trả về `400 Bad Request` (`"Mật khẩu mới không được trùng với mật khẩu hiện tại"`).
  - Mật khẩu mới được băm bảo mật bằng thuật toán Argon2/Bcrypt thông qua hàm `update_user_password(db, user, new_password)`.
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Đổi mật khẩu thành công",
  "data": null
}
```
- **Response lỗi (`400 Bad Request` - Mật khẩu cũ không đúng)**:
```json
{
  "success": false,
  "message": "Mật khẩu hiện tại không chính xác",
  "data": null
}
```
- **Response lỗi (`400 Bad Request` - Trùng mật khẩu cũ)**:
```json
{
  "success": false,
  "message": "Mật khẩu mới không được trùng với mật khẩu hiện tại",
  "data": null
}
```
- **Response lỗi (`422 Unprocessable Entity` - Mật khẩu mới < 6 ký tự)**:
```json
{
  "success": false,
  "message": "Dữ liệu đổi mật khẩu không hợp lệ",
  "data": null,
  "errors": [
    {
      "loc": ["new_password"],
      "msg": "String should have at least 6 characters",
      "type": "string_too_short"
    }
  ]
}
```

### 2.6. Quên Mật Khẩu & Gửi Mã OTP (`UC05`, `EX-04`)
- **Endpoint**: `POST /api/v1/auth/forgot-password`
- **Quyền hạn**: Public (Không yêu cầu JWT)
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "email": "sinhvien@neu.edu.vn"
}
```
- **Ràng buộc dữ liệu (`schemas/auth.py`)**:
  - `email`: Bắt buộc, chuỗi email hợp lệ RFC chuẩn (`EmailStr`).
- **Quy tắc nghiệp vụ & Kịch bản ngoại lệ (`EX-04`)**:
  - Kiểm tra email có tồn tại trên hệ thống hay không; nếu không tồn tại $\rightarrow$ Trả về `404 Not Found` (`"Email không tồn tại trên hệ thống"`).
  - Kiểm tra tài khoản có bị vô hiệu hóa `is_active == false` hay không; nếu bị khóa $\rightarrow$ Trả về `403 Forbidden` (`"Tài khoản này đã bị khóa"`).
  - **Giới hạn số lần gửi OTP (`EX-04`)**: Tối đa 3 lần/ngày/email (`daily_count >= 3` bị chặn) $\rightarrow$ Trả về `400 Bad Request` (`"Bạn đã vượt quá giới hạn gửi mã OTP tối đa 3 lần/ngày. Vui lòng thử lại vào ngày mai (EX-04)"`).
  - **Hiệu lực OTP (`EX-04`)**: Mã OTP gồm đúng 6 chữ số ngẫu nhiên (`000000` - `999999`), có thời hạn hiệu lực chính xác `5 phút` (300 giây) kể từ thời điểm tạo.
  - **Cơ chế lưu trữ in-memory & Hỗ trợ Dev/Test**: Lưu trữ trong `OTP_STORE` tại `routes/auth.py`. Trong môi trường phát triển (dev/test), trường `otp_debug` được trả kèm trong `data` phản hồi để tạo điều kiện kiểm thử tự động và test Postman mà không cần cấu hình Mail Server bên ngoài.
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Mã OTP khôi phục mật khẩu đã được gửi (hiệu lực 5 phút)",
  "data": {
    "email": "sinhvien@neu.edu.vn",
    "otp_debug": "582103",
    "expires_in_seconds": 300,
    "daily_count": 1
  }
}
```
- **Response lỗi (`400 Bad Request` - Vượt quá 3 lần/ngày)**:
```json
{
  "success": false,
  "message": "Bạn đã vượt quá giới hạn gửi mã OTP tối đa 3 lần/ngày. Vui lòng thử lại vào ngày mai (EX-04)",
  "data": null
}
```
- **Response lỗi (`404 Not Found` - Email không tồn tại)**:
```json
{
  "success": false,
  "message": "Email không tồn tại trên hệ thống",
  "data": null
}
```

### 2.7. Đặt Lại Mật Khẩu Bằng Mã OTP (`UC05`, `BR-02`, `EX-04`)
- **Endpoint**: `POST /api/v1/auth/reset-password`
- **Quyền hạn**: Public (Không yêu cầu JWT)
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "email": "sinhvien@neu.edu.vn",
  "otp": "582103",
  "new_password": "newpassword123"
}
```
- **Ràng buộc dữ liệu (`schemas/auth.py`)**:
  - `email`: Bắt buộc, chuỗi email hợp lệ RFC chuẩn (`EmailStr`).
  - `otp`: Bắt buộc, chuỗi mã OTP từ 1 đến 20 ký tự.
  - `new_password`: Bắt buộc, mật khẩu mới có độ dài từ 6 đến 128 ký tự (`min_length=6, max_length=128`).
- **Quy tắc nghiệp vụ & Kịch bản ngoại lệ (`BR-02`, `EX-04`)**:
  - **Kiểm tra OTP (`EX-04`)**:
    - Nếu không tìm thấy OTP trong bộ nhớ hoặc OTP đã bị hủy trước đó $\rightarrow$ Trả về `400 Bad Request` (`"Mã xác nhận OTP không hợp lệ hoặc đã hết hiệu lực (EX-04)"`).
    - Nếu thời điểm xác thực vượt quá hạn 5 phút (`now > expires_at`) $\rightarrow$ Trả về `400 Bad Request` (`"Mã xác nhận OTP đã hết hiệu lực (quá 5 phút). Vui lòng yêu cầu gửi lại mã OTP (EX-04)"`).
    - Nếu mã OTP gửi lên không khớp với mã đã sinh $\rightarrow$ Trả về `400 Bad Request` (`"Mã xác nhận OTP không chính xác (EX-04)"`).
  - **Mở khóa tài khoản & Đặt lại mật khẩu (`BR-02`)**:
    - Cập nhật mật khẩu mới cho người dùng.
    - Tự động xóa mốc khóa tạm thời (`locked_until = None`) và reset bộ đếm đăng nhập sai `failed_login_attempts = 0` ngay lập tức, cho phép người dùng đăng nhập lại ngay mà không phải chờ hết 15 phút.
    - Hủy mã OTP khỏi `OTP_STORE` (`otp = None`, `expires_at = None`) để chống sử dụng lại (Replay Attack), nhưng vẫn bảo lưu `daily_count` trong ngày.
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Đặt lại mật khẩu thành công",
  "data": null
}
```
- **Response lỗi (`400 Bad Request` - OTP hết hạn 5 phút)**:
```json
{
  "success": false,
  "message": "Mã xác nhận OTP đã hết hiệu lực (quá 5 phút). Vui lòng yêu cầu gửi lại mã OTP (EX-04)",
  "data": null
}
```
- **Response lỗi (`400 Bad Request` - OTP không chính xác)**:
```json
{
  "success": false,
  "message": "Mã xác nhận OTP không chính xác (EX-04)",
  "data": null
}
```
- **Response lỗi (`400 Bad Request` - OTP không hợp lệ hoặc đã sử dụng)**:
```json
{
  "success": false,
  "message": "Mã xác nhận OTP không hợp lệ hoặc đã hết hiệu lực (EX-04)",
  "data": null
}
```

### 2.8. Hồ Sơ Người Dùng Cá Nhân (`UC04`, `BR-01`, `EX-03`)
- `GET /api/v1/users/profile` (Header: `Bearer <token>`)
- `PUT /api/v1/users/profile` (Header: `Bearer <token>`)
  - **Request Body**: `{"full_name": "...", "phone_number": "0912345678", "student_id": "...", "avatar_url": "..."}`
  - **Quy tắc**: Kiểm tra `phone_number` 10 số và không trùng với tài khoản khác (`EX-03`).

### 2.9. Quản Trị Tài Khoản & Blacklist COD (`UC23`, `BR-22`, `EX-22` - Role: `admin`)
- `GET /api/v1/users/admin/all?role=customer&is_blacklisted=true&search=...`
- `PATCH /api/v1/users/admin/<user_id>/status`:
  - **Request Body**: `{"is_active": false, "role": "staff"}`
  - **Quy tắc (`EX-22`)**: Chặn khóa tài khoản nếu user đang có đơn hàng chưa kết thúc (`CHO_XAC_NHAN`, `DANG_CHUAN_BI`, `DANG_GIAO`, `SAN_SANG_LAY`, `GIAO_THAT_BAI`).
- `PATCH /api/v1/users/admin/<user_id>/blacklist`:
  - **Request Body**: `{"is_blacklisted": true, "blacklist_reason": "Boom hàng đơn NF..."}`

### 2.10. Cấu Hình Tham Số Vận Hành Hệ Thống (`/api/v1/settings`)
- `GET /api/v1/settings` (Public/Authenticated): Lấy toàn bộ tham số (`order_timeout_minutes`, `pickup_hold_minutes`, `system_maintenance_fee`, `delivery_fee`, `max_cod_amount`...).
- `PUT /api/v1/settings/<setting_key>` (Role: `admin`):
  - **Request Body**: `{"setting_value": "5000", "description": "..."}`

---

## 3. Phân Hệ Thành Viên 2: Thực Đơn, Danh Mục & Địa Điểm Nội Khu NEU (`/dishes`, `/locations`)

### 3.1. Xem Danh Mục & Danh Sách Món Ăn (`UC06`, `UC07`, `BR-04`, `BR-12`)
- `GET /api/v1/dishes/categories`: Danh sách các danh mục đang kích hoạt (`com-hop`, `mi-pho`, `combos`, `do-uong`, `an-vat`, `trang-mieng`).
- `GET /api/v1/dishes?category=mi-pho&search=pho&page=1&limit=20`:
  - Chỉ trả về các món có `is_deleted == false` và `is_active == true`.
  - **Response Item**:
```json
{
  "id": "pho-bo-tai-lan",
  "name": "Phở Bò Tái Lăn",
  "short_description": "Phở truyền thống, nước dùng thanh ngọt, thịt bò mềm.",
  "description": "Bát phở truyền thống...",
  "base_price": 45000,
  "system_fee": 5000,
  "price": 50000,
  "rating": 4.8,
  "review_count": 312,
  "image_url": "https://...",
  "is_available": true,
  "is_active": true,
  "category_ids": ["mi-pho"],
  "badges": ["bestSeller", "hot"]
}
```
- `GET /api/v1/dishes/<dish_id>`: Chi tiết món ăn kèm danh sách đánh giá (`reviews`).
- `POST /api/v1/dishes/validate-cart` (`EX-05`):
  - **Request Body**: `{"dish_ids": ["pho-bo-tai-lan", "com-suon-nuong"]}`
  - **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "is_valid": false,
    "unavailable_dishes": [
      {
        "id": "com-suon-nuong",
        "name": "Cơm Sườn Nướng Mật Ong",
        "reason": "Món đã hết hàng trong ngày"
      }
    ]
  }
}
```

### 3.2. Bật / Tắt Nhanh Trạng Thái Còn / Hết Món (`UC16`, `BR-06`)
- **Endpoint**: `PATCH /api/v1/dishes/<dish_id>/availability`
- **Quyền hạn**: Role `staff`, `manager`, `admin`
- **Request Body**: `{"is_available": false}`

### 3.3. Quản Lý Thực Đơn CRUD & Soft Delete (`UC21`, `BR-04`, `BR-12`, `EX-21`)
- **Quyền hạn**: Role `manager`, `admin`
- `POST /api/v1/dishes`:
  - **Request Body**:
```json
{
  "id": "bun-dau-mam-tom",
  "name": "Bún Đậu Mắm Tôm Đặc Biệt",
  "short_description": "Đầy đủ dồi rán, chả cốm, nem chua rán",
  "description": "Suất bún đậu thập cẩm chuẩn vị Hà Nội...",
  "base_price": 40000,
  "image_url": "https://...",
  "category_ids": ["com-hop", "an-vat"],
  "badges": ["hot"],
  "is_available": true
}
```
  - **Quy tắc (`BR-12`)**: Hệ thống tự động lấy `system_fee = 5000` và tính `price = base_price + 5000` (ví dụ `40000 + 5000 = 45000`).
- `PUT /api/v1/dishes/<dish_id>`: Cập nhật thông tin món; nếu sửa `base_price` thì tự động cập nhật lại `price = base_price + system_fee`.
- `DELETE /api/v1/dishes/<dish_id>` (`BR-04`, `EX-21`):
  - Kiểm tra bảng `order_items`: Nếu món đã từng phát sinh đơn hàng $\rightarrow$ Không xóa vật lý khỏi DB mà chuyển `is_deleted = true, is_active = false, is_available = false` và trả thông báo đã ẩn món theo `EX-21`.
- `POST /api/v1/dishes/upload-image` (`multipart/form-data`, field `file`):
  - **Response (`201 Created`)**: `{"success": true, "data": {"filename": "a1b2c3.jpg", "image_url": "/uploads/a1b2c3.jpg"}}`.

### 3.4. Quản Lý Địa Điểm Nội Khu NEU (`UC09`, `UC24`, `BR-09`, `BR-10`, `EX-07`, `EX-23`)
- `GET /api/v1/locations`: Trả về danh sách tòa nhà (`A1`, `A2`, `B`, `C`, `D`, `KTX`, `THU_VIEN`, `NHA_VAN_HOA`) đang mở phục vụ (`is_active == true`). Truyền `?all=true` nếu là Admin muốn xem cả địa điểm tạm ngưng.
- `POST /api/v1/locations` (Role: `admin`) & `PUT /api/v1/locations/<id>` (Role: `admin`):
  - **Request Body**:
```json
{
  "building_code": "A3",
  "building_name": "Tòa nhà Giảng đường A3",
  "default_room_note": "Phòng học tầng 1 - 5",
  "is_active": true,
  "display_order": 9
}
```
- `DELETE /api/v1/locations/<id>` (Role: `admin` - `BR-10`, `EX-23`):
  - Nếu địa điểm đang có đơn hàng chưa kết thúc $\rightarrow$ Chặn xóa cứng (`400 Bad Request`), hoặc tự động chuyển `is_active = false` ("Tạm dừng phục vụ").

---

## 4. Phân Hệ Thành Viên 3: Đặt Hàng COD & State Machine 14 Trạng Thái (`/orders`)

### 4.1. Tạo Đơn Hàng COD Mới (`UC08`, `UC09`, `UC10`)
- **Endpoint**: `POST /api/v1/orders`
- **Quyền hạn**: Role `customer` (`@jwt_required`)
- **Request Body**:
```json
{
  "order_type": "delivery",
  "recipient_name": "Nguyễn Sinh Viên",
  "recipient_phone": "0977112233",
  "campus_location_id": 1,
  "room_detail": "Phòng 502 Tầng 5",
  "delivery_note": "Gọi trước khi lên phòng giúp em",
  "is_preorder": false,
  "scheduled_at": null,
  "payment_method": "cod_cash",
  "items": [
    {
      "dish_id": "pho-bo-tai-lan",
      "quantity": 2,
      "note": "Nhiều hành"
    }
  ]
}
```
- **Các quy tắc kiểm tra bắt buộc khi tạo đơn**:
  1. `BR-22` / `EX-10`: Nếu `user.is_blacklisted == true` $\rightarrow$ Chặn tạo đơn (`403 Forbidden`).
  2. `BR-08` / `EX-09`: Nếu user đang có 01 đơn hàng ở trạng thái chưa kết thúc (`CHO_XAC_NHAN`, `DANG_CHUAN_BI`, `DANG_GIAO`, `SAN_SANG_LAY`, `GIAO_THAT_BAI`) $\rightarrow$ Chặn tạo đơn (`400 Bad Request`).
  3. `BR-06` / `EX-05` & `BR-07` / `EX-06`: Kiểm tra mọi món đều có `is_available == true`, `is_deleted == false`, và `1 <= quantity <= 10`.
  4. `BR-09` / `EX-07` & `BR-13`: Nếu `order_type == "delivery"`, bắt buộc `campus_location_id` tồn tại và `is_active == true`, tự động gán `ship_fee = 5000`. Nếu `order_type == "pickup"`, `campus_location_id` và `room_detail` là `Optional` (`null`), tự động gán `ship_fee = 0` và `delivery_address = "Quầy trả món Canteen A2"`.
  5. `BR-11` / `EX-08`: Nếu `is_preorder == true`, `scheduled_at` phải lớn hơn thời điểm hiện tại ít nhất 30 phút.
  6. `BR-05` & `BR-14` / `EX-11`: Chốt `unit_price = dish.price`, `base_price = dish.base_price` vào `order_items`. Tính `subtotal_amount` và `total_amount = subtotal_amount + ship_fee`. Nếu `total_amount > 500000` $\rightarrow$ Chặn tạo đơn (`400 Bad Request` - `EX-11`).
  7. `BR-18`: Sinh mã đơn `NF...` (ví dụ `NF2610161234`), lưu 4 số cuối `"1234"` vào cột `order_code_suffix`, trạng thái khởi tạo `status = "CHO_XAC_NHAN"`, `payment_status = "chua_thanh_toan"`.

### 4.2. Xem Đơn Hàng (`UC11`)
- `GET /api/v1/orders` (`@jwt_required`): Lịch sử đơn hàng của khách hàng hiện tại.
- `GET /api/v1/orders/<order_id>` (`@jwt_required`): Xem chi tiết đơn hàng (gồm `order_code_suffix` 4 số cuối, trạng thái, danh sách món).
- `GET /api/v1/orders/admin/all?status=CHO_XAC_NHAN&order_type=delivery&page=1&limit=20` (Role: `staff`, `manager`, `admin`): Danh sách đơn hàng cho Canteen và Admin.

### 4.3. Các API Chuyển Trạng Thái Trong State Machine (14 Trạng Thái)

> **Cơ chế xử lý các trạng thái tự động theo thời gian (Lazy Evaluation trong `crud/order.py`):**
> Để không cần cài đặt cronjob phức tạp, Thành viên 3 viết 1 hàm `sync_overdue_orders(db)` gọi tự động đầu các hàm `get_user_orders`, `get_all_orders`, `get_order_by_id`:
> - Các đơn có `status == 'CHO_XAC_NHAN'` và `now() - created_at > 10 minutes` $\rightarrow$ Tự động chuyển sang `TU_DONG_HUY` (`BR-16`, `EX-16`).
> - Các đơn có `status IN ('DA_GIAO', 'DA_BAN_GIAO')` và `auto_complete_at <= now()` $\rightarrow$ Tự động chuyển sang `HOAN_THANH` (`EX-13`).

| Endpoint | Method | Role được phép | Chuyển trạng thái | Quy tắc / Ngoại lệ kiểm tra |
| :--- | :---: | :---: | :--- | :--- |
| `/api/v1/orders/<id>/cancel` | `POST` | `customer` | `CHO_XAC_NHAN` $\rightarrow$ `DA_HUY_KHACH` | `UC12`, `BR-17`, `EX-12`: Chỉ hủy được khi `status == 'CHO_XAC_NHAN'`. Nếu bếp đã chuyển sang `DANG_CHUAN_BI` thì báo lỗi `400`. |
| `/api/v1/orders/<id>/process` | `PATCH` | `staff`, `manager` | `CHO_XAC_NHAN` $\rightarrow$ `DANG_CHUAN_BI` hoặc `TU_CHOI` | `UC17`, `BR-16`, `EX-16`: Body `{"action": "accept"}` (gán `staff_id`) hoặc `{"action": "reject", "reason": "Hết nguyên liệu"}`. Nếu đơn quá 10 phút chưa duyệt thì chuyển sang `TU_DONG_HUY`. |
| `/api/v1/orders/<id>/status` | `PATCH` | `staff`, `manager`, `admin` | `DANG_CHUAN_BI` $\rightarrow$ `DANG_GIAO` / `SAN_SANG_LAY` | `UC18`, `BR-21`: Body `{"status": "DANG_GIAO"}` hoặc `{"status": "SAN_SANG_LAY"}`. Khi chuyển sang `SAN_SANG_LAY`, gán `pickup_deadline = now() + 30 minutes`. |
| `/api/v1/orders/<id>/handover` | `POST` | `staff`, `manager` | `DANG_GIAO` $\rightarrow$ `DA_GIAO`<br/>`SAN_SANG_LAY` $\rightarrow$ `DA_BAN_GIAO`<br/>`GIAO_THAT_BAI` $\rightarrow$ `DA_BAN_GIAO` | `UC19`, `BR-15`, `BR-18`, `EX-17`: Body `{"order_code_suffix": "9921"}`. Bắt buộc khớp 4 số cuối của đơn mới cho bàn giao, đổi `payment_status = "da_thanh_toan"`, `delivered_at = now()`, `auto_complete_at = now() + 30 minutes`. |
| `/api/v1/orders/<id>/delivery-issue` | `POST` | `staff`, `manager` | `DANG_GIAO` $\rightarrow$ `GIAO_THAT_BAI` hoặc `BO_DON_BLACKLIST` | `BR-20`, `BR-22`, `EX-18`, `EX-19`: Body `{"issue_type": "no_answer" \| "refuse_payment" \| "pickup_timeout", "reason": "..."}`. Nếu `no_answer`: chuyển sang `GIAO_THAT_BAI` giữ tại quầy 30p. Nếu `refuse_payment` hoặc `pickup_timeout`: chuyển đơn sang `BO_DON_BLACKLIST` **và tự động khóa `user.is_blacklisted = true`**. |
| `/api/v1/orders/<id>/confirm-receipt` | `POST` | `customer` | `DA_GIAO` / `DA_BAN_GIAO` $\rightarrow$ `HOAN_THANH` | `UC13`, `EX-13`: Khách bấm xác nhận đã nhận hàng, gán `completed_at = now()`. |

---

## 5. Phân Hệ Thành Viên 4: Đánh Giá, Khiếu Nại, Chốt Ca COD & Báo Cáo (`/reviews`, `/complaints`, `/shifts`)

### 5.1. Đánh Giá Món Ăn (`UC14`)
- `GET /api/v1/reviews/dish/<dish_id>` (Public): Danh sách đánh giá của món ăn.
- `POST /api/v1/reviews` (Role: `customer`):
  - **Request Body**:
```json
{
  "order_id": "NF2610148833",
  "dish_id": "combo-com-ga-tra-dao",
  "rating": 5,
  "comment": "Cơm gà nóng hổi, da giòn rụm!"
}
```
  - **Quy tắc**: Đơn hàng phải thuộc về user đang đăng nhập và có trạng thái `DA_GIAO`, `DA_BAN_GIAO` hoặc `HOAN_THANH`. Chặn đánh giá trùng lặp nếu cặp `(order_id, dish_id)` đã được user đánh giá trước đó (`400 Bad Request`). Sau khi lưu review, tính lại `dish.rating` trung bình và tăng `dish.review_count += 1`.

### 5.2. Gửi & Phân Xử Khiếu Nại (`UC15`, `UC25`, `BR-23`, `BR-24`, `EX-14`, `EX-15`)
- `POST /api/v1/complaints` (Role: `customer` - `UC15`):
  - **Request Body**:
```json
{
  "order_id": "NF2610155566",
  "reason": "Giao nhầm món ăn",
  "description": "Em đặt Phở Trộn nhưng nhận được Bún Riêu.",
  "proof_image_url": "https://..."
}
```
  - **Quy tắc**:
    - Đơn hàng phải đã giao (`DA_GIAO` / `DA_BAN_GIAO` / `HOAN_THANH`) và trong vòng **24 giờ** kể từ `delivered_at` (`BR-23`, `EX-14`).
    - Mỗi đơn chỉ được tạo tối đa 01 ticket khiếu nại và bắt buộc có `proof_image_url` (`EX-15`).
    - Khi tạo thành công, đổi `order.status = "KHIEU_NAI"`.
- `GET /api/v1/complaints`: Khách xem khiếu nại của mình; `admin` xem toàn bộ khiếu nại hệ thống.
- `PATCH /api/v1/complaints/<complaint_id>/resolve` (**Độc quyền Role: `admin`** - `UC25`, `BR-24`):
  - **Request Body**:
```json
{
  "status": "CHAP_NHAN",
  "admin_response": "Đã xác minh hình ảnh và nhắc nhở Canteen A2 hoàn lại phần chênh lệch."
}
```
  - **Quy tắc**: Cập nhật `status` (`CHAP_NHAN` hoặc `TU_CHOI`), `admin_response`, `resolved_by = admin.id`, `resolved_at = now()`, và đổi `order.status = "DA_GIAI_QUYET"`.

### 5.3. Chốt Ca & Đối Soát Tiền COD Cuối Ca (`UC20`, `BR-25`, `EX-20`)
- `GET /api/v1/shifts/my-current-shift` (Role: `staff`, `manager`):
  - Tính tổng số đơn nhân viên hiện tại đã bàn giao (`payment_status == 'da_thanh_toan'`) trong ngày hôm nay (`CURRENT_DATE`), tách rõ:
    - `expected_cash`: Tổng `total_amount` của các đơn `payment_method == 'cod_cash'`.
    - `expected_qr`: Tổng `total_amount` của các đơn `payment_method == 'cod_vietqr'`.
- `POST /api/v1/shifts/submit` (Role: `staff`):
  - **Request Body**:
```json
{
  "actual_cash": 270000,
  "actual_qr": 125000,
  "discrepancy_note": "Khớp 100% tiền mặt và sao kê QR"
}
```
  - **Quy tắc (`BR-25`, `EX-20`)**: Tính `discrepancy_amount = (actual_cash + actual_qr) - (expected_cash + expected_qr)`. Nếu `discrepancy_amount != 0`, bắt buộc phải có `discrepancy_note` giải trình và đặt `status = "CAN_GIAI_TRINH"`, ngược lại đặt `status = "CHO_DUYET"`.
- `PATCH /api/v1/shifts/<shift_id>/close` (Role: `manager`, `admin`):
  - **Request Body**: `{"status": "DA_CHOT", "discrepancy_note": "Đã nhận đủ tiền bàn giao ca"}`

### 5.4. Báo Cáo & Thống Kê Doanh Thu (`UC22`, `BR-03`)
- **Endpoint**: `GET /api/v1/shifts/reports/summary?from_date=2026-10-01&to_date=2026-10-16`
- **Quyền hạn**: Role `manager`, `admin`
- **Công thức tính toán doanh thu chuẩn (Tính trên các đơn đã thu tiền `payment_status == 'da_thanh_toan'`):**
  - `gross_revenue` = $\sum \text{orders.total\_amount}$
  - `ship_fee_total` = $\sum \text{orders.ship\_fee}$
  - `canteen_net_revenue` = $\sum (\text{order\_items.base\_price} \times \text{order\_items.quantity})$
  - `system_fee_total` = $\sum ((\text{order\_items.unit\_price} - \text{order\_items.base\_price}) \times \text{order\_items.quantity})$
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "total_orders": 6,
    "completed_orders": 2,
    "cancelled_or_rejected_orders": 0,
    "blacklisted_orders": 1,
    "gross_revenue": 150000,
    "canteen_net_revenue": 130000,
    "system_fee_total": 15000,
    "ship_fee_total": 5000,
    "top_dishes": [
      {
        "dish_id": "combo-com-ga-tra-dao",
        "dish_name": "Combo Bữa Trưa Năng Động (Cơm Gà + Trà Đào)",
        "total_quantity": 1,
        "total_revenue": 65000
      }
    ]
  }
}
```
