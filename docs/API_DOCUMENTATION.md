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

### 2.8. Hồ Sơ Người Dùng Cá Nhân (`UC04`, `BR-01`, `EX-01`, `EX-03`)

#### 2.8.1. Xem Hồ Sơ Cá Nhân (`UC04`)
- **Endpoint**: `GET /api/v1/users/profile`
- **Quyền hạn**: Authenticated (`@jwt_required` - Tất cả các role: `customer`, `staff`, `manager`, `admin`)
- **Headers**: `Authorization: Bearer <access_token>`
- **Quy tắc nghiệp vụ**:
  - Trích xuất định danh người dùng `user_id` từ claim `sub` trong JWT.
  - Kiểm tra người dùng tồn tại trong cơ sở dữ liệu (`404 Not Found` nếu không tìm thấy) và tài khoản đang hoạt động (`is_active == true`, trả về `403 Forbidden` nếu đã bị khóa).
  - Trả về đầy đủ 12 trường thông tin hồ sơ cá nhân chuẩn hóa qua `_serialize_user(user)`.
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Thành công",
  "data": {
    "id": 2,
    "email": "sinhvien@neu.edu.vn",
    "full_name": "Trần Thị Sinh Viên",
    "phone_number": "0912345678",
    "student_id": "11210102",
    "role": "customer",
    "avatar_url": null,
    "is_active": true,
    "is_blacklisted": false,
    "blacklist_reason": null,
    "blacklisted_at": null,
    "created_at": "2026-10-18T02:00:00+00:00"
  }
}
```
- **Response lỗi mẫu**:
  - `401 Unauthorized` (Thiếu hoặc Token không hợp lệ): `{"success": false, "message": "Thiếu token xác thực trong header Authorization", "data": null}`
  - `403 Forbidden` (Tài khoản đang bị khóa `is_active == false`): `{"success": false, "message": "Tài khoản này đã bị khóa", "data": null}`
  - `404 Not Found` (Không tìm thấy người dùng): `{"success": false, "message": "Không tìm thấy người dùng", "data": null}`

#### 2.8.2. Cập Nhật Hồ Sơ Cá Nhân (`UC04`, `BR-01`, `EX-01`, `EX-03`)
- **Endpoint**: `PUT /api/v1/users/profile`
- **Quyền hạn**: Authenticated (`@jwt_required` - Tất cả các role: `customer`, `staff`, `manager`, `admin`)
- **Headers**:
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`
- **Request Body**:
```json
{
  "full_name": "Trần Thị Sinh Viên NEU",
  "phone_number": "0912345678",
  "student_id": "11210102",
  "avatar_url": "https://images.unsplash.com/photo-avatar"
}
```
- **Ràng buộc dữ liệu (`schemas/user.py` - `UserUpdateRequest`)**:
  - `full_name`: Không bắt buộc (`Optional`), độ dài từ 2 đến 150 ký tự (`min_length=2, max_length=150`), tự động cắt khoảng trắng hai đầu (`.strip()`). Không được gửi tường minh `null`.
  - `phone_number`: Không bắt buộc (`Optional`), tự động `.strip()`, phải khớp định dạng số di động Việt Nam gồm đúng 10 chữ số và bắt đầu bằng số `0` (`^0\d{9}$`) theo `BR-01`, `EX-03`. Không được gửi tường minh `null`.
  - `student_id`: Không bắt buộc (`Optional`), tối đa 30 ký tự (`max_length=30`), tự động `.strip()`; nếu truyền chuỗi rỗng `""` hoặc `null` thì hệ thống chuẩn hóa về `None` (cho phép xóa mã sinh viên).
  - `avatar_url`: Không bắt buộc (`Optional`), tối đa 2000 ký tự (`max_length=2000`), tự động `.strip()`; nếu truyền chuỗi rỗng `""` hoặc `null` thì hệ thống chuẩn hóa về `None`.
- **Quy tắc nghiệp vụ & Kịch bản ngoại lệ (`UC04`, `BR-01`, `EX-01`, `EX-03`)**:
  - Payload gửi lên không phải JSON object hợp lệ $\rightarrow$ Trả về `400 Bad Request` (`"Dữ liệu đầu vào phải là JSON object hợp lệ"`).
  - `BR-01` & `EX-03`: Nếu `phone_number` sai định dạng `^0\d{9}$`, truyền chuỗi rỗng `""` hoặc gửi tường minh `{"phone_number": null}` $\rightarrow$ Trả về `422 Unprocessable Entity` (`"Số điện thoại không hợp lệ, phải gồm đúng 10 chữ số và bắt đầu bằng số 0 (BR-01, EX-03)"`).
  - Nếu gửi tường minh `{"full_name": null}` $\rightarrow$ Trả về `422 Unprocessable Entity` (`"Họ và tên không được để trống"`).
  - `EX-03`: Nếu `phone_number` mới đã được sử dụng bởi một tài khoản khác (`existing_user.id != current_user.id`) $\rightarrow$ Chặn lưu và trả về `400 Bad Request` (`"Số điện thoại đã được sử dụng bởi tài khoản khác (EX-03)"`). Nếu gửi lại chính số điện thoại hiện tại của bản thân thì vẫn hợp lệ (`200 OK`).
  - `BR-01` & `EX-01`: Nếu `student_id` mới (khác `None`) đã tồn tại ở một tài khoản khác (`existing_user.id != current_user.id`) $\rightarrow$ Chặn lưu và trả về `400 Bad Request` (`"Mã sinh viên đã tồn tại trên hệ thống (EX-01)"`).
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Cập nhật hồ sơ thành công",
  "data": {
    "id": 2,
    "email": "sinhvien@neu.edu.vn",
    "full_name": "Trần Thị Sinh Viên NEU",
    "phone_number": "0912345678",
    "student_id": "11210102",
    "role": "customer",
    "avatar_url": "https://images.unsplash.com/photo-avatar",
    "is_active": true,
    "is_blacklisted": false,
    "blacklist_reason": null,
    "blacklisted_at": null,
    "created_at": "2026-10-18T02:00:00+00:00"
  }
}
```
- **Response lỗi (`400 Bad Request` - Trùng SĐT với tài khoản khác `EX-03`)**:
```json
{
  "success": false,
  "message": "Số điện thoại đã được sử dụng bởi tài khoản khác (EX-03)",
  "data": null
}
```
- **Response lỗi (`400 Bad Request` - Trùng Mã sinh viên với tài khoản khác `EX-01`)**:
```json
{
  "success": false,
  "message": "Mã sinh viên đã tồn tại trên hệ thống (EX-01)",
  "data": null
}
```
- **Response lỗi (`422 Unprocessable Entity` - Sai định dạng SĐT `BR-01`, `EX-03`)**:
```json
{
  "success": false,
  "message": "Số điện thoại không hợp lệ, phải gồm đúng 10 chữ số và bắt đầu bằng số 0 (BR-01, EX-03)",
  "data": null,
  "errors": [
    {
      "loc": ["phone_number"],
      "msg": "String should match pattern '^0\\d{9}$'",
      "type": "string_pattern_mismatch",
      "input": "0912345"
    }
  ]
}
```

### 2.9. Quản Trị Tài Khoản & Blacklist COD (`UC23`, `BR-02`, `BR-08`, `BR-22`, `EX-22` - Role: `admin`)

#### 2.9.1. Danh Sách & Lọc Tài Khoản Người Dùng (`UC23`)
- **Endpoint**: `GET /api/v1/users/admin/all`
- **Quyền hạn**: Độc quyền Quản trị viên (`@role_required("admin")`)
- **Headers**: `Authorization: Bearer <access_token>`
- **Query Parameters (Không bắt buộc)**:
  - `role`: Lọc theo vai trò hệ thống (`customer`, `staff`, `manager`, `admin` - tự động chuẩn hóa chữ thường).
  - `is_blacklisted`: Lọc theo trạng thái danh sách đen COD (`true`, `false`, `1`, `0`).
  - `is_active`: Lọc theo trạng thái hoạt động của tài khoản (`true`, `false`, `1`, `0`).
  - `search`: Từ khóa tìm kiếm không phân biệt hoa thường (`ILIKE`) đồng thời trên 4 trường: `full_name`, `email`, `phone_number`, `student_id`.
- **Quy tắc nghiệp vụ & Kiểm tra tham số (`UC23`)**:
  - Nếu `role` được truyền nhưng không thuộc `("customer", "staff", "manager", "admin")` $\rightarrow$ Trả về `400 Bad Request` (`"Vai trò lọc không hợp lệ, chỉ chấp nhận: customer, staff, manager, admin"`).
  - Nếu `is_blacklisted` được truyền nhưng khác `("true", "false", "1", "0")` $\rightarrow$ Trả về `400 Bad Request` (`"Tham số is_blacklisted không hợp lệ, chỉ chấp nhận true hoặc false"`).
  - Nếu `is_active` được truyền nhưng khác `("true", "false", "1", "0")` $\rightarrow$ Trả về `400 Bad Request` (`"Tham số is_active không hợp lệ, chỉ chấp nhận true hoặc false"`).
  - Kiểm tra tài khoản Admin đang thực hiện tồn tại (`404 Not Found`) và đang kích hoạt (`is_active == true`, trả về `403 Forbidden` nếu bị khóa).
  - Danh sách kết quả được sắp xếp tăng dần theo `id` (`User.id.asc()`).
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Lấy danh sách người dùng thành công",
  "data": [
    {
      "id": 1,
      "email": "admin@neufood.vn",
      "full_name": "Nguyễn Quản Trị (Admin)",
      "phone_number": "0988888888",
      "student_id": "ADMIN01",
      "role": "admin",
      "avatar_url": null,
      "is_active": true,
      "is_blacklisted": false,
      "blacklist_reason": null,
      "blacklisted_at": null,
      "created_at": "2026-10-18T01:00:00+00:00"
    },
    {
      "id": 5,
      "email": "boomhang@neu.edu.vn",
      "full_name": "Lê Văn Bùng Đơn (Đã khóa COD)",
      "phone_number": "0900000000",
      "student_id": "11209999",
      "role": "customer",
      "avatar_url": null,
      "is_active": true,
      "is_blacklisted": true,
      "blacklist_reason": "Boom hàng đơn NF2610142299 tại Giảng đường B (từ chối nhận và không thanh toán COD)",
      "blacklisted_at": "2026-10-18T01:30:00+00:00",
      "created_at": "2026-10-18T01:00:00+00:00"
    }
  ]
}
```
- **Response lỗi mẫu**:
  - `400 Bad Request` (Sai tham số lọc): `{"success": false, "message": "Vai trò lọc không hợp lệ, chỉ chấp nhận: customer, staff, manager, admin", "data": null}`
  - `403 Forbidden` (Không phải role `admin`): `{"success": false, "message": "Truy cập bị từ chối. Yêu cầu một trong các quyền: admin", "data": null}`

#### 2.9.2. Khóa / Mở Khóa & Phân Quyền Tài Khoản (`UC23`, `BR-02`, `BR-08`, `EX-22`)
- **Endpoint**: `PATCH /api/v1/users/admin/<int:user_id>/status`
- **Quyền hạn**: Độc quyền Quản trị viên (`@role_required("admin")`)
- **Headers**:
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`
- **Request Body**:
```json
{
  "is_active": false,
  "role": "staff"
}
```
- **Ràng buộc dữ liệu (`schemas/user.py` - `AdminUserStatusUpdateRequest`)**:
  - `is_active`: Không bắt buộc (`Optional[bool]`).
  - `role`: Không bắt buộc (`Optional[Literal["customer", "staff", "manager", "admin"]]`).
  - `@model_validator`: Bắt buộc phải cung cấp ít nhất một trong hai trường `is_active` hoặc `role`. Nếu gửi `{}` (cả hai trường đều `None`) hoặc truyền `role` ngoài 4 vai trò hợp lệ $\rightarrow$ Trả về `422 Unprocessable Entity` (`"Dữ liệu cập nhật trạng thái không hợp lệ"`).
- **Quy tắc nghiệp vụ & Kịch bản ngoại lệ (`UC23`, `BR-02`, `BR-08`, `EX-22`)**:
  - Kiểm tra tài khoản mục tiêu `user_id` tồn tại trong DB; nếu không tồn tại $\rightarrow$ Trả về `404 Not Found` (`"Không tìm thấy người dùng"`).
  - **Cơ chế tự bảo vệ tài khoản Admin**:
    - Nếu `target_user.id == admin_id` và `is_active == false` $\rightarrow$ Chặn thao tác và trả về `400 Bad Request` (`"Quản trị viên không thể tự khóa tài khoản của chính mình"`).
    - Nếu `target_user.id == admin_id` và `role` khác vai trò hiện tại $\rightarrow$ Chặn thao tác và trả về `400 Bad Request` (`"Quản trị viên không thể tự thay đổi vai trò của chính mình"`).
  - **`EX-22` & `BR-08` (Chặn khóa tài khoản đang có đơn hàng chưa hoàn tất)**:
    - Khi Admin thực hiện khóa tài khoản (`is_active == false`), hệ thống kiểm tra qua `has_active_orders(db, target_user.id)` xem người dùng mục tiêu (với vai trò khách đặt hàng `Order.user_id == user_id` hoặc nhân viên phụ trách đơn `Order.staff_id == user_id`) có đơn hàng nào đang nằm trong 5 trạng thái chưa kết thúc (`CHO_XAC_NHAN`, `DANG_CHUAN_BI`, `DANG_GIAO`, `SAN_SANG_LAY`, `GIAO_THAT_BAI`) hay không.
    - Nếu đang có đơn hàng chưa hoàn tất $\rightarrow$ Chặn khóa tài khoản và trả về `400 Bad Request` (`"Không thể khóa tài khoản đang có đơn hàng chưa hoàn tất. Vui lòng hoàn tất hoặc hủy các đơn hàng trước (EX-22)"`).
  - **`BR-02` (Mở khóa tài khoản)**:
    - Khi Admin mở khóa tài khoản (`is_active == true`), hệ thống đồng thời tự động reset `failed_login_attempts = 0` và xóa mốc khóa tạm thời `locked_until = None`.
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Cập nhật trạng thái tài khoản thành công",
  "data": {
    "id": 2,
    "email": "sinhvien@neu.edu.vn",
    "full_name": "Trần Thị Sinh Viên",
    "phone_number": "0912345678",
    "student_id": "11210102",
    "role": "staff",
    "avatar_url": null,
    "is_active": false,
    "is_blacklisted": false,
    "blacklist_reason": null,
    "blacklisted_at": null,
    "created_at": "2026-10-18T02:00:00+00:00"
  }
}
```
- **Response lỗi (`400 Bad Request` - Chặn khóa tài khoản đang có đơn hàng dở `EX-22`)**:
```json
{
  "success": false,
  "message": "Không thể khóa tài khoản đang có đơn hàng chưa hoàn tất. Vui lòng hoàn tất hoặc hủy các đơn hàng trước (EX-22)",
  "data": null
}
```
- **Response lỗi (`400 Bad Request` - Admin tự khóa hoặc tự đổi vai trò chính mình)**:
```json
{
  "success": false,
  "message": "Quản trị viên không thể tự khóa tài khoản của chính mình",
  "data": null
}
```
- **Response lỗi (`422 Unprocessable Entity` - Body rỗng hoặc sai vai trò)**:
```json
{
  "success": false,
  "message": "Dữ liệu cập nhật trạng thái không hợp lệ",
  "data": null,
  "errors": [
    {
      "loc": [],
      "msg": "Value error, Phải cung cấp ít nhất một trong hai trường: is_active hoặc role",
      "type": "value_error",
      "input": {}
    }
  ]
}
```

#### 2.9.3. Quản Trị Danh Sách Đen COD - Blacklist (`UC23`, `BR-22`)
- **Endpoint**: `PATCH /api/v1/users/admin/<int:user_id>/blacklist`
- **Quyền hạn**: Độc quyền Quản trị viên (`@role_required("admin")`)
- **Headers**:
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`
- **Request Body**:
```json
{
  "is_blacklisted": true,
  "blacklist_reason": "Boom hàng đơn NF2610142299 tại Giảng đường B"
}
```
- **Ràng buộc dữ liệu (`schemas/user.py` - `AdminUserBlacklistUpdateRequest`)**:
  - `is_blacklisted`: Bắt buộc (`bool`).
  - `blacklist_reason`: Không bắt buộc (`Optional[str]`), tối đa 500 ký tự (`max_length=500`), tự động cắt khoảng trắng hai đầu (`.strip()`); nếu là chuỗi rỗng `""` thì chuyển thành `None`.
- **Quy tắc nghiệp vụ & Kịch bản ngoại lệ (`UC23`, `BR-22`)**:
  - Kiểm tra tài khoản mục tiêu `user_id` tồn tại trong DB; nếu không tồn tại $\rightarrow$ Trả về `404 Not Found` (`"Không tìm thấy người dùng"`).
  - **Cơ chế tự bảo vệ tài khoản Admin**: Nếu `target_user.id == admin_id` và `is_blacklisted == true` $\rightarrow$ Chặn thao tác và trả về `400 Bad Request` (`"Quản trị viên không thể tự đưa tài khoản của chính mình vào danh sách đen"`).
  - **Đưa tài khoản vào Blacklist COD (`is_blacklisted == true` - `BR-22`)**:
    - Thiết lập `is_blacklisted = true`.
    - Ghi nhận `blacklist_reason` theo nội dung Admin truyền lên; nếu bỏ trống hoặc `null` thì tự động gán lý do mặc định `"Vi phạm chính sách nhận hàng/thanh toán COD (BR-22)"`.
    - Ghi nhận thời điểm đưa vào danh sách đen `blacklisted_at = now() (UTC)`.
    - Phản hồi `200 OK` với thông điệp `"Đã đưa tài khoản vào danh sách đen COD (BR-22)"`.
  - **Gỡ tài khoản khỏi Blacklist COD (`is_blacklisted == false` - `BR-22`)**:
    - Thiết lập `is_blacklisted = false`, đồng thời xóa sạch `blacklist_reason = null` và `blacklisted_at = null`.
    - Phản hồi `200 OK` với thông điệp `"Đã gỡ tài khoản khỏi danh sách đen COD"`.
- **Response (`200 OK` - Đưa vào Blacklist COD)**:
```json
{
  "success": true,
  "message": "Đã đưa tài khoản vào danh sách đen COD (BR-22)",
  "data": {
    "id": 2,
    "email": "sinhvien@neu.edu.vn",
    "full_name": "Trần Thị Sinh Viên",
    "phone_number": "0912345678",
    "student_id": "11210102",
    "role": "customer",
    "avatar_url": null,
    "is_active": true,
    "is_blacklisted": true,
    "blacklist_reason": "Boom hàng đơn NF2610142299 tại Giảng đường B",
    "blacklisted_at": "2026-10-18T03:15:00+00:00",
    "created_at": "2026-10-18T02:00:00+00:00"
  }
}
```
- **Response (`200 OK` - Gỡ khỏi Blacklist COD)**:
```json
{
  "success": true,
  "message": "Đã gỡ tài khoản khỏi danh sách đen COD",
  "data": {
    "id": 2,
    "email": "sinhvien@neu.edu.vn",
    "full_name": "Trần Thị Sinh Viên",
    "phone_number": "0912345678",
    "student_id": "11210102",
    "role": "customer",
    "avatar_url": null,
    "is_active": true,
    "is_blacklisted": false,
    "blacklist_reason": null,
    "blacklisted_at": null,
    "created_at": "2026-10-18T02:00:00+00:00"
  }
}
```
- **Response lỗi (`400 Bad Request` - Admin tự đưa chính mình vào Blacklist)**:
```json
{
  "success": false,
  "message": "Quản trị viên không thể tự đưa tài khoản của chính mình vào danh sách đen",
  "data": null
}
```

### 2.10. Cấu Hình Tham Số Vận Hành Hệ Thống (`/api/v1/settings` - `UC23`, `BR-07`, `BR-08`, `BR-11`–`BR-15`, `BR-17`, `BR-20`, `BR-23`)

Phân hệ cấu hình tham số vận hành hệ thống lưu trữ tập trung các ngưỡng thời gian, mức phí, hạn mức và quy tắc hoạt động của toàn bộ nền tảng NEUFood trong bảng `system_settings` (`UC23`). Các tham số này chi phối trực tiếp logic tính toán của các phân hệ khác (Menu, Đơn hàng, Khiếu nại, Ca trực).

#### Bảng Tra Cứu 11 Tham Số Hệ Thống Mặc Định
| Khóa cấu hình (`setting_key`) | Giá trị mặc định (`setting_value`) | Kiểu dữ liệu / Đơn vị | Quy tắc nghiệp vụ liên kết | Mô tả chi tiết chức năng |
| :--- | :--- | :--- | :--- | :--- |
| `order_timeout_minutes` | `"10"` | Số nguyên dương (`phút`) | `BR-15`, `EX-12` | Thời gian tối đa để Canteen tiếp nhận hoặc từ chối đơn hàng trước khi hệ thống tự động hủy đơn (`TU_DONG_HUY`). |
| `pickup_hold_minutes` | `"30"` | Số nguyên dương (`phút`) | `BR-20`, `EX-18` | Thời gian lưu giữ món tại quầy Canteen A2 cho đơn Pick-up trước khi chuyển trạng thái hủy/thất bại (`GIAO_THAT_BAI`). |
| `auto_complete_minutes` | `"30"` | Số nguyên dương (`phút`) | `BR-17` | Thời gian tự động chuyển đơn từ `DA_GIAO` / `DA_BAN_GIAO` sang `HOAN_THANH` nếu khách hàng không gửi khiếu nại. |
| `complaint_window_hours` | `"24"` | Số nguyên dương (`giờ`) | `BR-23`, `EX-14` | Thời gian tối đa cho phép khách hàng tạo ticket khiếu nại sau khi đơn hàng được giao thành công. |
| `system_maintenance_fee` | `"5000"` | Số nguyên không âm (`VNĐ`) | `BR-12` | Phụ phí bảo trì hệ thống trực tuyến cộng dồn vào giá gốc Canteen A2 (`base_price`) để hình thành giá niêm yết (`price`). |
| `delivery_fee` | `"5000"` | Số nguyên không âm (`VNĐ`) | `BR-13` | Phí vận chuyển cố định áp dụng cho tất cả đơn hàng giao tận nơi (`delivery`) đến các phòng/tòa nhà nội khu NEU. |
| `max_cod_amount` | `"500000"` | Số nguyên không âm (`VNĐ`) | `BR-14`, `EX-08` | Hạn mức giá trị tối đa cho phép thanh toán khi nhận hàng (COD). Đơn vượt quá hạn mức này sẽ bị chặn đặt. |
| `max_dish_quantity_per_order` | `"10"` | Số nguyên dương (`phần`) | `BR-07`, `EX-06` | Số lượng tối đa của một món ăn cụ thể mà khách hàng được phép thêm vào một đơn hàng. |
| `min_preorder_lead_minutes` | `"30"` | Số nguyên dương (`phút`) | `BR-11`, `EX-11` | Khoảng thời gian đặt trước tối thiểu đối với các đơn hẹn giờ nhận món trong ngày (`is_preorder = true`). |
| `canteen_open_time` | `"06:30"` | Chuỗi giờ (`HH:MM`) | `BR-08`, `EX-10` | Giờ mở cửa phục vụ hàng ngày của Canteen A2 (`00:00` - `23:59`). Bắt buộc phải trước giờ đóng cửa `canteen_close_time`. |
| `canteen_close_time` | `"19:30"` | Chuỗi giờ (`HH:MM`) | `BR-08`, `EX-10` | Giờ đóng cửa ngừng nhận đơn của Canteen A2 (`00:00` - `23:59`). Bắt buộc phải sau giờ mở cửa `canteen_open_time`. |

---

#### 2.10.1. Lấy Danh Sách Toàn Bộ Tham Số Hệ Thống (`UC23`)
- **Endpoint**: `GET /api/v1/settings`
- **Quyền hạn**: Public / Authenticated (Khách vãng lai, Sinh viên, Nhân viên, Quản lý và Quản trị viên đều có thể gọi để lấy thông số hiển thị giao diện và tính toán phía client).
- **Headers**: Không bắt buộc (Nếu có: `Authorization: Bearer <access_token>`).
- **Query Parameters**: Không có.
- **Quy tắc nghiệp vụ**:
  - Truy vấn toàn bộ danh sách bản ghi từ bảng `system_settings`, tự động sắp xếp theo thứ tự bảng chữ cái của `setting_key` (`SystemSetting.setting_key.asc()`).
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Lấy danh sách tham số cấu hình thành công",
  "data": [
    {
      "setting_key": "auto_complete_minutes",
      "setting_value": "30",
      "description": "Thời gian tự động hoàn thành đơn hàng kể từ lúc giao nếu không khiếu nại (phút)",
      "updated_at": "2026-10-18T00:00:00+00:00"
    },
    {
      "setting_key": "canteen_close_time",
      "setting_value": "19:30",
      "description": "Giờ đóng cửa ngừng nhận đơn của Canteen A2",
      "updated_at": "2026-10-18T00:00:00+00:00"
    },
    {
      "setting_key": "canteen_open_time",
      "setting_value": "06:30",
      "description": "Giờ mở cửa phục vụ hàng ngày của Canteen A2",
      "updated_at": "2026-10-18T00:00:00+00:00"
    },
    {
      "setting_key": "complaint_window_hours",
      "setting_value": "24",
      "description": "Thời gian tối đa cho phép khách hàng gửi ticket khiếu nại sau khi nhận hàng (giờ)",
      "updated_at": "2026-10-18T00:00:00+00:00"
    },
    {
      "setting_key": "delivery_fee",
      "setting_value": "5000",
      "description": "Phí vận chuyển cố định cho đơn giao tận nơi nội khu NEU (VNĐ)",
      "updated_at": "2026-10-18T00:00:00+00:00"
    },
    {
      "setting_key": "max_cod_amount",
      "setting_value": "500000",
      "description": "Hạn mức giá trị tối đa cho một đơn hàng thanh toán COD (VNĐ)",
      "updated_at": "2026-10-18T00:00:00+00:00"
    },
    {
      "setting_key": "max_dish_quantity_per_order",
      "setting_value": "10",
      "description": "Số lượng tối đa của một món ăn trong một đơn hàng (phần)",
      "updated_at": "2026-10-18T00:00:00+00:00"
    },
    {
      "setting_key": "min_preorder_lead_minutes",
      "setting_value": "30",
      "description": "Thời gian đặt trước tối thiểu cho đơn hẹn giờ (phút)",
      "updated_at": "2026-10-18T00:00:00+00:00"
    },
    {
      "setting_key": "order_timeout_minutes",
      "setting_value": "10",
      "description": "Thời gian tối đa để Canteen tiếp nhận hoặc từ chối đơn hàng (phút)",
      "updated_at": "2026-10-18T00:00:00+00:00"
    },
    {
      "setting_key": "pickup_hold_minutes",
      "setting_value": "30",
      "description": "Thời gian lưu giữ món tại quầy Canteen A2 trước khi hủy đơn bỏ rơi (phút)",
      "updated_at": "2026-10-18T00:00:00+00:00"
    },
    {
      "setting_key": "system_maintenance_fee",
      "setting_value": "5000",
      "description": "Phụ phí bảo trì hệ thống trực tuyến cộng vào giá niêm yết mỗi món (VNĐ)",
      "updated_at": "2026-10-18T00:00:00+00:00"
    }
  ]
}
```

---

#### 2.10.2. Lấy Chi Tiết Một Tham Số Cấu Hình Theo Khóa (`UC23`)
- **Endpoint**: `GET /api/v1/settings/<setting_key>`
- **Quyền hạn**: Public / Authenticated (Không yêu cầu đăng nhập).
- **Headers**: Không bắt buộc (Nếu có: `Authorization: Bearer <access_token>`).
- **Path Parameters**:
  - `setting_key`: Khóa định danh của tham số cấu hình (ví dụ: `delivery_fee`, `order_timeout_minutes`, `canteen_open_time`).
- **Quy tắc nghiệp vụ & Kịch bản ngoại lệ**:
  - Kiểm tra sự tồn tại của bản ghi theo `setting_key` trong bảng `system_settings`.
  - Nếu không tìm thấy khóa $\rightarrow$ Trả về `404 Not Found` (`"Không tìm thấy cấu hình với khóa '<setting_key>'"`).
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Lấy thông tin cấu hình thành công",
  "data": {
    "setting_key": "delivery_fee",
    "setting_value": "5000",
    "description": "Phí vận chuyển cố định cho đơn giao tận nơi nội khu NEU (VNĐ)",
    "updated_at": "2026-10-18T00:00:00+00:00"
  }
}
```
- **Response lỗi (`404 Not Found` - Không tìm thấy khóa cấu hình)**:
```json
{
  "success": false,
  "message": "Không tìm thấy cấu hình với khóa 'unknown_key'",
  "data": null
}
```

---

#### 2.10.3. Cập Nhật Một Tham Số Cấu Hình Hệ Thống (`UC23`, `BR-07`, `BR-08`, `BR-12`, `BR-14`, `BR-15`, `BR-17`, `BR-20`, `BR-23`)
- **Endpoint**: `PUT /api/v1/settings/<setting_key>`
- **Quyền hạn**: Độc quyền Quản trị viên (`@role_required("admin")`)
- **Headers**:
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`
- **Path Parameters**:
  - `setting_key`: Khóa định danh của tham số cần cập nhật.
- **Request Body**:
```json
{
  "setting_value": "15",
  "description": "Thời gian tối đa để Canteen tiếp nhận hoặc từ chối đơn hàng (phút)"
}
```
- **Ràng buộc dữ liệu (`schemas/setting.py` - `SystemSettingUpdateRequest`)**:
  - `setting_value`: Bắt buộc (`str`, độ dài từ 1 đến 255 ký tự sau khi `.strip()`), không được để trống hoặc chỉ chứa khoảng trắng.
  - `description`: Không bắt buộc (`Optional[str]`, tối đa 500 ký tự sau khi `.strip()`).
- **Quy tắc nghiệp vụ & Điều kiện biên kiểm tra (`UC23`)**:
  - **Xác thực & Phân quyền**: Yêu cầu Bearer Token hợp lệ của tài khoản có vai trò `admin`.
    - Thiếu hoặc sai token $\rightarrow$ `401 Unauthorized` (`"Token không hợp lệ hoặc đã hết hạn"`).
    - Vai trò không phải `admin` $\rightarrow$ `403 Forbidden` (`"Truy cập bị từ chối. Yêu cầu một trong các quyền: admin"`).
    - Tài khoản Admin đang bị khóa (`is_active == false`) $\rightarrow$ `403 Forbidden` (`"Tài khoản này đã bị khóa"`).
  - **Định dạng dữ liệu đầu vào**: Nếu body rỗng hoặc không phải JSON object hợp lệ $\rightarrow$ `400 Bad Request` (`"Dữ liệu đầu vào phải là JSON object hợp lệ"`).
  - **Quy tắc giá trị theo từng nhóm tham số**:
    - **Nhóm thời gian số nguyên dương (`> 0`)** (`order_timeout_minutes`, `pickup_hold_minutes`, `auto_complete_minutes`, `complaint_window_hours`, `max_dish_quantity_per_order`, `min_preorder_lead_minutes`): Giá trị bắt buộc là số nguyên $> 0$. Nếu là số âm, bằng 0 hoặc không thể parse thành số $\rightarrow$ Trả về `422 Unprocessable Entity` (ví dụ: `"Thời gian order_timeout_minutes phải là số nguyên dương lớn hơn 0"`).
    - **Nhóm tiền tệ không âm (`>= 0`)** (`system_maintenance_fee`, `delivery_fee`, `max_cod_amount`): Giá trị bắt buộc là số nguyên $\ge 0$. Nếu là số âm hoặc không parse được số $\rightarrow$ Trả về `422 Unprocessable Entity` (ví dụ: `"Phí vận chuyển phải là số nguyên không âm (>= 0)"`, `"Hạn mức COD phải là số nguyên không âm (>= 0)"`).
    - **Nhóm giờ mở/đóng cửa Canteen (`HH:MM`)** (`canteen_open_time`, `canteen_close_time`): Định dạng bắt buộc khớp regex `^([01]\d|2[0-3]):[0-5]\d$` (từ `00:00` đến `23:59`). Nếu sai định dạng $\rightarrow$ Trả về `422 Unprocessable Entity` (`"Định dạng giờ mở/đóng cửa không hợp lệ, phải là HH:MM (00:00 - 23:59)"`).
    - **Logic tương quan giờ mở/đóng cửa Canteen (`BR-08`)**:
      - Khi cập nhật `canteen_open_time`, hệ thống tự động đối chiếu với `canteen_close_time` hiện tại trong cơ sở dữ liệu. Nếu `open_time >= close_time` $\rightarrow$ Chặn thao tác và trả về `422 Unprocessable Entity` (`"Giờ mở cửa Canteen phải trước giờ đóng cửa"`).
      - Khi cập nhật `canteen_close_time`, hệ thống tự động đối chiếu với `canteen_open_time` hiện tại trong cơ sở dữ liệu. Nếu `close_time <= open_time` $\rightarrow$ Chặn thao tác và trả về `422 Unprocessable Entity` (`"Giờ mở cửa Canteen phải trước giờ đóng cửa"`).
  - **Cơ chế Upsert**: Nếu tham số đã tồn tại, hệ thống cập nhật giá trị mới, mô tả mới và cập nhật mốc thời gian `updated_at`. Nếu tham số chưa tồn tại, hệ thống tự động thêm mới bản ghi.
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Cập nhật tham số hệ thống thành công",
  "data": {
    "setting_key": "order_timeout_minutes",
    "setting_value": "15",
    "description": "Thời gian tối đa để Canteen tiếp nhận hoặc từ chối đơn hàng (phút)",
    "updated_at": "2026-10-18T12:00:00+00:00"
  }
}
```
- **Response lỗi mẫu**:
  - `400 Bad Request` (Dữ liệu không phải JSON): `{"success": false, "message": "Dữ liệu đầu vào phải là JSON object hợp lệ", "data": null}`
  - `401 Unauthorized` (Token không hợp lệ): `{"success": false, "message": "Token không hợp lệ hoặc đã hết hạn", "data": null}`
  - `403 Forbidden` (Không đủ quyền Admin): `{"success": false, "message": "Truy cập bị từ chối. Yêu cầu một trong các quyền: admin", "data": null}`
  - `422 Unprocessable Entity` (Giá trị không hợp lệ): `{"success": false, "message": "Thời gian order_timeout_minutes phải là số nguyên dương lớn hơn 0", "data": null}`
  - `422 Unprocessable Entity` (Giờ mở cửa không trước giờ đóng cửa `BR-08`): `{"success": false, "message": "Giờ mở cửa Canteen phải trước giờ đóng cửa", "data": null}`

---

#### 2.10.4. Cập Nhật Đồng Loạt Tham Số Hệ Thống - Bulk Update (`UC23`, Atomicity Transaction)
- **Endpoint**: `PUT /api/v1/settings/bulk`
- **Quyền hạn**: Độc quyền Quản trị viên (`@role_required("admin")`)
- **Headers**:
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`
- **Request Body**:
```json
{
  "settings": [
    {
      "setting_key": "canteen_open_time",
      "setting_value": "06:00",
      "description": "Giờ mở cửa phục vụ hàng ngày của Canteen A2"
    },
    {
      "setting_key": "canteen_close_time",
      "setting_value": "20:00",
      "description": "Giờ đóng cửa ngừng nhận đơn của Canteen A2"
    },
    {
      "setting_key": "delivery_fee",
      "setting_value": "7000",
      "description": "Phí vận chuyển cố định cho đơn giao tận nơi nội khu NEU (VNĐ)"
    },
    {
      "setting_key": "max_cod_amount",
      "setting_value": "1000000",
      "description": "Hạn mức giá trị tối đa cho một đơn hàng thanh toán COD (VNĐ)"
    }
  ]
}
```
- **Ràng buộc dữ liệu (`schemas/setting.py` - `SystemSettingBulkUpdateRequest`)**:
  - `settings`: Danh sách bản ghi cấu hình bắt buộc (`List[SystemSettingBulkItem]`, tối thiểu 1 phần tử).
  - Từng phần tử trong mảng:
    - `setting_key`: Bắt buộc (`str`, 1 đến 50 ký tự), không được để trống hoặc chỉ có khoảng trắng.
    - `setting_value`: Bắt buộc (`str`, 1 đến 255 ký tự), không được để trống hoặc chỉ có khoảng trắng.
    - `description`: Không bắt buộc (`Optional[str]`, tối đa 500 ký tự).
- **Quy tắc nghiệp vụ & Tính nguyên tử (Transaction Atomicity)**:
  - **Kiểm tra hợp lệ trước giao dịch (All-or-Nothing)**: Toàn bộ danh sách cài đặt trong request được kiểm tra tính hợp lệ trước khi bắt đầu ghi dữ liệu. Nếu có bất kỳ tham số nào có giá trị không hợp lệ (sai số nguyên dương, số âm, sai định dạng giờ hoặc vi phạm logic thời gian Canteen) $\rightarrow$ Hệ thống lập tức trả về `422 Unprocessable Entity` và **không có bất kỳ tham số nào được cập nhật vào cơ sở dữ liệu**.
  - **Kiểm tra tương quan thời gian mở/đóng Canteen đồng thời (`BR-08`)**:
    - Nếu request chứa cả `canteen_open_time` và `canteen_close_time`, hệ thống đối chiếu trực tiếp 2 giá trị mới trong request để bảo đảm `open_time < close_time`.
    - Nếu request chỉ chứa 1 trong 2 tham số trên, hệ thống đối chiếu giá trị mới với tham số còn lại đang lưu trong cơ sở dữ liệu.
    - Nếu `open_time >= close_time` $\rightarrow$ Trả về `422 Unprocessable Entity` (`"Giờ mở cửa Canteen phải trước giờ đóng cửa"`).
  - Toàn bộ danh sách được ghi nhận và `commit()` trong cùng một giao dịch database duy nhất qua `bulk_upsert_settings`.
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Cập nhật danh sách cấu hình hệ thống thành công",
  "data": [
    {
      "setting_key": "canteen_open_time",
      "setting_value": "06:00",
      "description": "Giờ mở cửa phục vụ hàng ngày của Canteen A2",
      "updated_at": "2026-10-18T12:05:00+00:00"
    },
    {
      "setting_key": "canteen_close_time",
      "setting_value": "20:00",
      "description": "Giờ đóng cửa ngừng nhận đơn của Canteen A2",
      "updated_at": "2026-10-18T12:05:00+00:00"
    },
    {
      "setting_key": "delivery_fee",
      "setting_value": "7000",
      "description": "Phí vận chuyển cố định cho đơn giao tận nơi nội khu NEU (VNĐ)",
      "updated_at": "2026-10-18T12:05:00+00:00"
    },
    {
      "setting_key": "max_cod_amount",
      "setting_value": "1000000",
      "description": "Hạn mức giá trị tối đa cho một đơn hàng thanh toán COD (VNĐ)",
      "updated_at": "2026-10-18T12:05:00+00:00"
    }
  ]
}
```
- **Response lỗi mẫu**:
  - `400 Bad Request` (Dữ liệu đầu vào không phải JSON): `{"success": false, "message": "Dữ liệu đầu vào phải là JSON object hợp lệ", "data": null}`
  - `401 Unauthorized` (Thiếu hoặc sai JWT token): `{"success": false, "message": "Token không hợp lệ hoặc đã hết hạn", "data": null}`
  - `403 Forbidden` (Không đủ quyền Admin): `{"success": false, "message": "Truy cập bị từ chối. Yêu cầu một trong các quyền: admin", "data": null}`
  - `422 Unprocessable Entity` (Mảng `settings` rỗng hoặc sai cấu trúc): `{"success": false, "message": "Dữ liệu cấu hình không hợp lệ", "data": null, "errors": [...]}`
  - `422 Unprocessable Entity` (Tham số chứa giá trị âm hoặc sai nghiệp vụ): `{"success": false, "message": "Phí giao hàng phải là số nguyên không âm (>= 0)", "data": null}`
  - `422 Unprocessable Entity` (Giờ mở cửa không trước giờ đóng cửa `BR-08`): `{"success": false, "message": "Giờ mở cửa Canteen phải trước giờ đóng cửa", "data": null}`

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

**Chi tiết xử lý UC08–UC10:**
- Chỉ JWT có role `customer` được tạo đơn; backend kiểm tra lại tài khoản còn tồn tại, đang hoạt động và role trong DB. Blacklist chặn đặt hàng, không thay đổi quyền đăng nhập.
- Request phải là JSON object. Lỗi cấu trúc/kiểu dữ liệu trả `422` theo envelope chuẩn: số lượng phải là số nguyên thực sự (không nhận boolean, số thập phân hoặc chuỗi); số điện thoại di động Việt Nam 10 chữ số. Lỗi nghiệp vụ trả `400`, riêng tài khoản không được phép/blacklist trả `403`. `errors` của lỗi nghiệp vụ chứa `[{"code": "EX-09"}]` hoặc mã tương ứng `EX-05`–`EX-11`.
- Giới hạn số lượng tính gộp **mọi dòng cùng `dish_id`**, kể cả các dòng có ghi chú khác nhau. Món còn phải `is_active == true`; món không tồn tại, bị ẩn/xóa hoặc hết hàng đều bị từ chối.
- Giá, phí và tổng tiền được tính phía server bằng số thập phân chính xác; giá/tổng do client gửi không được dùng để tính tiền. Địa chỉ giao được dựng từ địa điểm NEU hợp lệ và `room_detail`; `delivery_address` tự nhập không thay thế địa điểm trong danh mục. Pickup luôn dùng địa chỉ quầy, lưu `campus_location_id`/`room_detail` là `null`.
- `scheduled_at` cần múi giờ, ví dụ `2026-10-20T12:00:00+07:00`, chỉ gửi khi `is_preorder == true`. Giờ hẹn phải nằm trong giờ mở cửa theo giờ Việt Nam (mặc định từ **06:30**, trước **19:30**).
- Đọc cấu hình `delivery_fee`, `max_cod_amount`, `max_dish_quantity_per_order`, `min_preorder_lead_minutes`, `canteen_open_time`, `canteen_close_time`. Mặc định tương ứng 5.000đ, 500.000đ, 10 phần, 30 phút, 06:30, 19:30. Trần cứng của schema hiện hành vẫn là 500.000đ/10 phần; thời gian hẹn không thấp hơn 30 phút. Tăng hai trần tiền/số lượng cần phối hợp thay đổi schema trước.
- Khóa dòng tài khoản trong cùng giao dịch từ lúc kiểm tra đơn hoạt động đến lúc lưu đơn và chi tiết: hai request tạo đơn đồng thời không vượt giới hạn một đơn. Lỗi ghi bất kỳ chi tiết nào rollback toàn bộ đơn. Mã đơn có tiền tố `NF`, suffix luôn là chuỗi 4 chữ số, giữ cả số 0 đầu.

Kiểm thử tích hợp: `backend/tests/test_order_creation.py`. Dùng PostgreSQL riêng có tên kết thúc `_orders_test`, khởi tạo bằng `database/init_db.sql`, đặt `TEST_DATABASE_URL` trỏ đến database thử, rồi chạy từ thư mục `backend`: `python -m unittest discover -s tests -p test_order_creation.py -v`. Test xóa dữ liệu trong database thử; không dùng database ứng dụng.

### 4.2. Xem Đơn Hàng (`UC11`)
- `GET /api/v1/orders` (`@jwt_required`): Lịch sử đơn hàng của khách hàng hiện tại.
- `GET /api/v1/orders/<order_id>` (`@jwt_required`): Xem chi tiết đơn hàng (gồm `order_code_suffix` 4 số cuối, trạng thái, danh sách món).
- `GET /api/v1/orders/admin/all?status=CHO_XAC_NHAN&order_type=delivery&page=1&limit=20` (Role: `staff`, `manager`, `admin`): Danh sách đơn hàng cho Canteen và Admin.

### 4.3. Các API Chuyển Trạng Thái Trong State Machine (14 Trạng Thái)

> **Cơ chế xử lý các trạng thái tự động theo thời gian (Lazy Evaluation trong `crud/order.py`):**
> Để không cần cài đặt cronjob phức tạp, Thành viên 3 viết 1 hàm `sync_overdue_orders(db)` gọi tự động đầu các hàm `get_user_orders`, `get_all_orders`, `get_order_by_id`:
> - Các đơn có `status == 'CHO_XAC_NHAN'` và `now() - created_at > 10 minutes` $\rightarrow$ Tự động chuyển sang `TU_DONG_HUY` (`BR-16`, `EX-16`).
> - Các đơn có `status IN ('DA_GIAO', 'DA_BAN_GIAO')` và `auto_complete_at <= now()` $\rightarrow$ Tự động chuyển sang `HOAN_THANH` (`EX-13`).

Đã hiện thực cả hai nhánh: UC17–UC18 đồng bộ đơn chờ quá hạn, UC13 tự hoàn tất đơn đã giao/bàn giao và không có khiếu nại. Đồng bộ diễn ra lúc đọc danh sách/chi tiết, tạo đơn, hủy, duyệt hoặc cập nhật tiến độ; chưa có tác vụ nền chạy khi không có truy cập.

| Endpoint | Method | Role được phép | Chuyển trạng thái | Quy tắc / Ngoại lệ kiểm tra |
| :--- | :---: | :---: | :--- | :--- |
| `/api/v1/orders/<id>/cancel` | `POST` | `customer` | `CHO_XAC_NHAN` $\rightarrow$ `DA_HUY_KHACH` | `UC12`, `BR-17`, `EX-12`: Chỉ hủy được khi `status == 'CHO_XAC_NHAN'`. Nếu bếp đã chuyển sang `DANG_CHUAN_BI` thì báo lỗi `400`. |
| `/api/v1/orders/<id>/process` | `PATCH` | `staff`, `manager` | `CHO_XAC_NHAN` $\rightarrow$ `DANG_CHUAN_BI` hoặc `TU_CHOI` | `UC17`, `BR-16`, `EX-16`: Body `{"action": "accept"}` (gán `staff_id`) hoặc `{"action": "reject", "reason": "Hết nguyên liệu"}`. Nếu đơn quá 10 phút chưa duyệt thì chuyển sang `TU_DONG_HUY`. |
| `/api/v1/orders/<id>/status` | `PATCH` | `staff`, `manager` | `CHO_XAC_NHAN` $\rightarrow$ `DANG_CHUAN_BI` / `TU_CHOI`; `DANG_CHUAN_BI` $\rightarrow$ `DANG_GIAO` / `SAN_SANG_LAY` | `UC17`, `UC18`, `BR-16`, `BR-21`: Body có `status`; từ chối cần `cancelled_reason`. Chỉ đơn delivery được chuyển sang `DANG_GIAO`, pickup sang `SAN_SANG_LAY` và gán `pickup_deadline = now() + 30 minutes` mặc định. |
| `/api/v1/orders/<id>/handover` | `POST` | `staff`, `manager` | `DANG_GIAO` $\rightarrow$ `DA_GIAO`<br/>`SAN_SANG_LAY` $\rightarrow$ `DA_BAN_GIAO`<br/>`GIAO_THAT_BAI` $\rightarrow$ `DA_BAN_GIAO` | `UC19`, `BR-15`, `BR-18`, `EX-17`: Body `{"order_code_suffix": "9921"}`. Bắt buộc khớp 4 số cuối của đơn mới cho bàn giao, đổi `payment_status = "da_thanh_toan"`, `delivered_at = now()`, `auto_complete_at = now() + 30 minutes`. |
| `/api/v1/orders/<id>/delivery-issue` | `POST` | `staff`, `manager` | Đơn đang giao / sẵn sàng lấy / giao thất bại $\rightarrow$ `GIAO_THAT_BAI` hoặc `BO_DON_BLACKLIST` theo từng sự cố | `BR-20`, `BR-22`, `EX-18`, `EX-19`: Body `{"issue_type": "no_answer" \| "refuse_payment" \| "pickup_timeout", "reason": "..."}`. `no_answer` chỉ áp dụng đơn đang giao tận nơi; `pickup_timeout` chỉ khi quá hạn giữ tại quầy. Bỏ đơn cập nhật đơn và `user.is_blacklisted = true` trong cùng giao dịch. |
| `/api/v1/orders/<id>/confirm-receipt` | `POST` | `customer` | `DA_GIAO` / `DA_BAN_GIAO` $\rightarrow$ `HOAN_THANH` | `UC13`, `EX-13`: Khách bấm xác nhận đã nhận hàng, gán `completed_at = now()`. |

---

### 4.4. Khách Hủy Đơn (`UC12`, `BR-17`, `EX-12`)

- **Endpoint:** `POST /api/v1/orders/<id>/cancel`, JWT role `customer`; không yêu cầu request body, không cần schema đầu vào mới.
- **Điều kiện:** tài khoản còn hoạt động, role trong DB vẫn là `customer`, đơn thuộc khách đang đăng nhập và trạng thái hiện tại là `CHO_XAC_NHAN`. Blacklist COD không tước quyền hủy đơn đã có.
- **Thành công (`200`):** đổi trạng thái thành `DA_HUY_KHACH`, trả envelope chuẩn với `data` là chi tiết đơn và `message: "Hủy đơn hàng thành công"`. Giữ nguyên món, giá và trạng thái thanh toán. Khách có thể tạo đơn mới sau khi hủy.
- **Lỗi:** chưa đăng nhập `401`; không có quyền/tài khoản bị vô hiệu hóa `403`; đơn không tồn tại hoặc thuộc người khác `404` (không trả dữ liệu đơn); trạng thái khác `CHO_XAC_NHAN` trả `400` với `errors: [{"code": "EX-12"}]`. Riêng `DANG_CHUAN_BI` trả thông báo "Bếp đã bắt đầu nấu đơn hàng của bạn, không thể hủy đơn vào lúc này". Hủy lại đơn đã hủy cũng trả `400 EX-12`.
- **Đồng thời:** khóa dòng đơn trong giao dịch và đọc lại trạng thái sau khi lấy khóa. Cập nhật qua `/status` không được ghi đè đơn đã hủy hoặc dùng trạng thái `DA_HUY_KHACH` để hủy thay khách. Nếu hủy và tiếp nhận đồng thời, chỉ một thao tác thành công.
- **Quá hạn:** UC17–UC18 bổ sung đồng bộ tự hủy theo BR-16. Nếu đơn chờ đã quá hạn lúc khách bấm hủy, lưu `TU_DONG_HUY` và trả `400 EX-12`; không ghi thành `DA_HUY_KHACH`. Test UC12 nằm cùng bộ `backend/tests/test_order_creation.py` với UC08–UC10; dùng database thử PostgreSQL riêng theo hướng dẫn ở mục 4.1.

### 4.5. Duyệt Đơn Và Nấu Xong (`UC17`, `UC18`, `BR-16`, `BR-21`)

Hai endpoint dùng chung logic CRUD và khóa dòng đơn; cả JWT và tài khoản DB phải là Staff/Manager còn hoạt động. Admin có quyền xem giám sát, không vận hành đơn theo ma trận nghiệp vụ (sửa quyền `/status` trong baseline cũ).

| Thao tác | Request | Trạng thái nguồn → đích |
| --- | --- | --- |
| Tiếp nhận | `PATCH /orders/<id>/process` với `{"action":"accept"}` hoặc `/status` với `{"status":"DANG_CHUAN_BI"}` | `CHO_XAC_NHAN` → `DANG_CHUAN_BI`; gán `staff_id` người xử lý |
| Từ chối | `/process` với `{"action":"reject","reason":"Hết nguyên liệu"}` hoặc `/status` với `{"status":"TU_CHOI","cancelled_reason":"Hết nguyên liệu"}` | `CHO_XAC_NHAN` → `TU_CHOI`; bắt buộc lý do không trắng, lưu lý do và `staff_id` |
| Nấu xong, giao tận nơi | `/status` với `{"status":"DANG_GIAO"}` | `DANG_CHUAN_BI` → `DANG_GIAO`, chỉ `delivery` |
| Nấu xong, nhận tại quầy | `/status` với `{"status":"SAN_SANG_LAY"}` | `DANG_CHUAN_BI` → `SAN_SANG_LAY`, chỉ `pickup`; gán hạn nhận |

Các URL trong bảng có tiền tố `/api/v1`, các thao tác đều dùng `PATCH`. Thành công `200` trả envelope chuẩn, `data` là chi tiết đơn gồm `staff_id`, `cancelled_reason` và `pickup_deadline` (ISO 8601 có múi giờ hoặc `null`). Không thay đổi giá/món, không đánh dấu đã thanh toán trong UC17–UC18.

- Mặc định đúng 10 phút vẫn được duyệt; **quá** 10 phút tính từ `created_at` chuyển `TU_DONG_HUY` và trả `400` với `errors: [{"code":"EX-16"}]`. Trạng thái tự hủy vẫn được commit dù request duyệt bị từ chối. Đơn hẹn giờ cũng áp dụng mốc từ lúc tạo, không chờ tới `scheduled_at`.
- Đọc `order_timeout_minutes` (mặc định 10) và `pickup_hold_minutes` (mặc định 30) từ cấu hình hiện có. Hạn nhận tại quầy tính từ lần đầu chuyển sang `SAN_SANG_LAY`; gọi lặp bị chặn, không gia hạn deadline. Dữ liệu thời gian dùng UTC có múi giờ.
- Sai bước hoặc sai loại đơn trả `400 INVALID_TRANSITION`; đơn khách đã hủy trả `400 EX-12`; schema/body sai hoặc thiếu lý do từ chối trả `422`; thiếu JWT `401`, sai quyền/tài khoản bị khóa `403`, đơn không tồn tại `404`. `/status` không cho nhảy sang trạng thái giao thành công, thanh toán, hoàn tất, khiếu nại hoặc blacklist; các bước này cần endpoint nghiệp vụ riêng.
- Chỉ một yêu cầu thắng khi hai người cùng duyệt, hoặc khi khách hủy và Canteen duyệt đồng thời. Staff/Manager khác có thể cập nhật tiến độ trong cùng Canteen A2; giữ `staff_id` đã ghi lúc duyệt.
- Phạm vi tự động của UC17–UC18 là đồng bộ trạng thái khi truy cập. Chưa có lịch chạy nền, thông báo chủ động hay log phạt hiệu suất theo toàn bộ kịch bản EX-16; bàn giao/thu COD được bổ sung ở mục 4.6, tự hoàn tất sau giao thuộc UC13.

### 4.6. Bàn Giao COD Và Xử Lý Bỏ Đơn (`UC19`, `BR-18`, `BR-20`, `BR-22`)

Cả hai endpoint yêu cầu JWT Staff/Manager, kiểm tra lại role và tài khoản đang hoạt động trong DB. Khóa khách rồi khóa đơn theo cùng thứ tự với tạo/hủy đơn; cập nhật đơn, thanh toán và blacklist trong giao dịch do `get_db()` quản lý.

**Bàn giao:** `POST /api/v1/orders/<id>/handover`, body `{"order_code_suffix":"0007"}`. Mã phải là chuỗi đúng 4 chữ số ASCII; số `7` hoặc chuỗi `"7"` không thay thế `"0007"`. Không yêu cầu trường thanh toán mới; nhân viên chỉ xác nhận sau khi đã thu đủ COD theo phương thức đã lưu trong đơn.

- `DANG_GIAO` của đơn delivery → `DA_GIAO`; `SAN_SANG_LAY` của pickup hoặc `GIAO_THAT_BAI` của delivery → `DA_BAN_GIAO`.
- Chỉ nhận đơn chưa thanh toán. Sai mã trả `400 EX-17`, không thay đổi trạng thái, tiền hoặc thời điểm giao. Đúng mã mới ghi `payment_status = "da_thanh_toan"`, `delivered_at = now`, `auto_complete_at = now + auto_complete_minutes` (mặc định 30 phút).
- `staff_id` tại bàn giao là người thực tế nhận COD để phục vụ đối soát; có thể khác người duyệt đơn. Giữ nguyên món, giá, tổng và phương thức `cod_cash`/`cod_vietqr` đã lưu.
- Nếu nhận tại quầy, bắt buộc có `pickup_deadline`. Đúng mốc hạn vẫn được nhận; quá hạn thì đóng `BO_DON_BLACKLIST`, blacklist khách và trả `400 EX-18`, không ghi đã thanh toán. Việc đóng đơn/blacklist vẫn được commit dù bàn giao bị từ chối.

**Sự cố:** `POST /api/v1/orders/<id>/delivery-issue`, body gồm `issue_type` và `reason` là chuỗi không trắng:

| `issue_type` | Điều kiện | Kết quả |
| --- | --- | --- |
| `no_answer` | Đơn delivery đang `DANG_GIAO`, chưa thu tiền; nhân viên xác nhận đã gọi/chờ 5–10 phút theo BR-20 | `GIAO_THAT_BAI`, lưu lý do, hạn giữ tại quầy `now + pickup_hold_minutes` (mặc định 30 phút). Chưa blacklist. Gọi lặp không được gia hạn. |
| `pickup_timeout` | `SAN_SANG_LAY`/`GIAO_THAT_BAI`, có deadline và `now > pickup_deadline` | `BO_DON_BLACKLIST` và blacklist khách. Trước/đúng hạn hoặc đang giao ngoài quầy trả `400 EX-18`. |
| `refuse_payment` | Đơn đang `DANG_GIAO`, `SAN_SANG_LAY` hoặc `GIAO_THAT_BAI`, chưa thu tiền | Đóng `BO_DON_BLACKLIST` và blacklist ngay lần đầu, bao gồm khách không đủ tiền COD. Không ghi giao thành công. |

Khi blacklist: đặt `user.is_blacklisted = true`, ghi `blacklist_reason` và `blacklisted_at`, lưu lý do trên đơn. Không đổi `user.is_active` hay khóa đăng nhập. Khi khách đến lấy đơn từng giao thất bại trong hạn, vẫn phải đối chiếu mã và trả đủ cả phí ship ban đầu.

Thành công `200` trả chi tiết đơn trong envelope chuẩn, gồm `delivered_at`, `auto_complete_at`, `pickup_deadline`. Thiếu JWT `401`; sai quyền/tài khoản bị khóa `403`; không có đơn `404`; body sai, mã sai định dạng hoặc thiếu lý do `422`; bước không hợp lệ/đơn đã thu tiền trả `400 INVALID_TRANSITION`. Yêu cầu lặp hoặc đồng thời không được ghi nhận thanh toán hai lần, hay vừa ghi đã thu tiền vừa blacklist vì từ chối thanh toán. Lỗi database rollback cả đơn và user.

Hiện xử lý quá hạn giữ món qua `pickup_timeout` hoặc khi thử bàn giao quá hạn; chưa có tác vụ nền tự quét để blacklist. Việc đã gọi/chờ 5–10 phút là xác nhận nghiệp vụ của nhân viên, chưa có dữ liệu theo dõi cuộc gọi/đến nơi để tự xác minh. UC19 ghi mốc `auto_complete_at`; UC13 dùng mốc này để tự hoàn tất như mục 4.7. Test nằm trong `backend/tests/test_order_creation.py`, chạy trên PostgreSQL thử riêng theo mục 4.1.

### 4.7. Khách Xác Nhận Nhận Hàng Và Tự Hoàn Tất (`UC13`, `EX-13`)

- **Endpoint:** `POST /api/v1/orders/<id>/confirm-receipt`, JWT role `customer`; không cần request body hay schema đầu vào mới. Kiểm tra lại tài khoản hoạt động và role trong DB. Blacklist COD không chặn xác nhận nhận hàng cho đơn đã có.
- **Điều kiện:** đơn thuộc khách đang đăng nhập, trạng thái `DA_GIAO` hoặc `DA_BAN_GIAO`, đã thu COD (`payment_status = "da_thanh_toan"`), có `delivered_at` và không có bản ghi khiếu nại. Khóa dòng khách rồi dòng đơn trong giao dịch; kiểm tra lại trạng thái sau khóa.
- **Thành công `200`:** chuyển `HOAN_THANH`, ghi `completed_at = now()` có múi giờ UTC, trả chi tiết đơn với `message: "Xác nhận nhận hàng thành công"`. Giữ nguyên giá/món, thanh toán, nhân viên thu COD, `delivered_at` và `auto_complete_at`.
- **Gửi lại:** nếu đơn đã `HOAN_THANH` và vẫn thỏa điều kiện thanh toán/không khiếu nại, trả `200` với dữ liệu hiện tại, không đổi `completed_at`. Hai xác nhận đồng thời giữ một thời điểm hoàn tất duy nhất.
- **Lỗi:** chưa đăng nhập `401`; sai quyền/tài khoản bị khóa `403`; không tìm thấy hoặc đơn của người khác `404` và không trả dữ liệu; trạng thái/điều kiện không hợp lệ trả `400`, `errors: [{"code":"EX-13"}]`. Không dùng xác nhận nhận hàng để bỏ qua bàn giao/thu COD hoặc đóng khiếu nại.
- **Tự hoàn tất:** `sync_overdue_orders()` xử lý đơn `DA_GIAO`/`DA_BAN_GIAO` đã thanh toán, có `delivered_at` và `auto_complete_at <= now()`. Thời hạn được chốt lúc bàn giao theo `auto_complete_minutes` (mặc định 30 phút); thay đổi cấu hình sau đó không sửa mốc đã lưu của đơn cũ. Đúng mốc hạn được xử lý, trước hạn không hoàn tất.
- **Khiếu nại:** kiểm tra cả trạng thái và bảng `complaints`; không ghi đè `KHIEU_NAI`/`DA_GIAI_QUYET` hoặc đơn có bản ghi khiếu nại dù trạng thái chưa đồng bộ. Khóa dòng đơn khi xử lý và bỏ qua dòng đang bị giao dịch khác khóa. Bên xử lý khiếu nại cần dùng cùng khóa đơn khi chuyển trạng thái; UC13 không sửa phân hệ khiếu nại của Thành viên 4. Giữ `delivered_at` để phân hệ đó vẫn tính được thời hạn khiếu nại 24 giờ từ lúc giao, kể cả đơn đã hoàn tất.
- **Phạm vi tự động:** đồng bộ khi có truy cập, không phải tác vụ nền. `completed_at` tự động là thời điểm hệ thống thực sự xử lý; không bị ghi lại ở những lần đọc/xác nhận sau. Kiểm thử tích hợp cùng bộ `backend/tests/test_order_creation.py` theo mục 4.1, gồm cả rollback nếu database ghi lỗi.

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
