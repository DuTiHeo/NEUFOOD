# NEUFood REST API Documentation (Chuẩn Nghiệp Vụ v1) 📡

Tài liệu đặc tả chi tiết toàn bộ các giao diện lập trình ứng dụng RESTful API cho hệ thống **NEUFood**, đồng bộ 100% với [`docs/Quy_Trinh_Nghiep_Vu.md`](./Quy_Trinh_Nghiep_Vu.md), [`docs/PHAN_CONG_BACKEND.md`](./PHAN_CONG_BACKEND.md) và [`database/init_db.sql`](../database/init_db.sql).

- **Phiên bản API**: `v1`
- **Tiền tố gốc (Base URL)**: `http://localhost:5000/api/v1`
- **Định dạng dữ liệu**: `application/json`
- **Cơ chế xác thực**: Cặp JSON Web Token (JWT) gồm **Access Token** (thời hạn 15 phút - 900 giây, gửi qua Header: `Authorization: Bearer <access_token>`) và **Refresh Token** (thời hạn 7 ngày, gửi qua body để cấp mới Access Token).
- **Kiến trúc Two-Tier Hybrid Token Blacklist & Revocation**:
  - **Tầng 1 (Redis 7 In-Memory Cache)**: Lưu vết `revoked_token:{jti}` với cơ chế TTL tự hủy bằng thời gian sống còn lại của token (`access`: tối đa 15 phút, `refresh`: tối đa 7 ngày). Tốc độ kiểm tra siêu tốc $O(1)$ (~ 3ms), giảm tải tối đa cho cơ sở dữ liệu.
  - **Tầng 2 (PostgreSQL Persistence)**: Bảng `revoked_tokens` lưu trữ bền vững, đảm bảo toàn vẹn dữ liệu thu hồi kể cả khi Redis khởi động lại.
  - **Cơ chế Cache-Aside with Backfill**: Khi Cache Miss, hệ thống tự động truy vấn PostgreSQL và nạp bù ngược lại Redis kèm TTL tương ứng.
  - **Cơ chế Graceful Fallback**: Nếu Redis gặp sự cố hoặc offline, hệ thống tự động fallback sang PostgreSQL mà không bao giờ gây lỗi HTTP 500 cho API (Fault-tolerant & Graceful Degradation).
- **4 Vai trò (Roles) trong JWT Payload**: `customer`, `staff`, `manager`, `admin`

---

## 1. Định Dạng Phản Hồi Chuẩn (Standard Response Format)

Mọi phản hồi từ API đều sử dụng hàm helper `api_response(data, message, status_code, success, errors)` trong `backend/app/utils/helpers.py`.

> [!IMPORTANT]
> **Cam Kết Đồng Nhất 100% Response Envelope:**
> Toàn bộ các phản hồi API trên toàn hệ thống — bao gồm cả các ngoại lệ xác thực JWT (`401 Unauthorized` do thiếu token, token không hợp lệ hoặc hết hạn từ `@jwt_required`), lỗi phân quyền RBAC (`403 Forbidden` do sai vai trò từ `@role_required` hoặc tài khoản bị vô hiệu hóa), lỗi cấu trúc dữ liệu đầu vào (`422 Unprocessable Entity`), và các ngoại lệ nghiệp vụ (`400 Bad Request`, `404 Not Found`) — đều **BẮT BUỘC tuân thủ 100% cấu trúc Envelope qua `api_response`**.
> Đặc biệt, trong mọi phản hồi thất bại/lỗi (`success: false`), trường `"data"` **luôn luôn hiện diện và mang giá trị `null`** (`"data": null`), bảo đảm phía Frontend Deserialize an toàn và đồng nhất tuyệt đối.

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
  "message": "Nội dung lỗi chi tiết theo kịch bản EX-01 -> EX-23 hoặc lỗi xác thực / phân quyền",
  "data": null,
  "errors": [ ... ]
}
```

**Mẫu phản hồi lỗi xác thực (`401 Unauthorized`):**
```json
{
  "success": false,
  "message": "Yêu cầu đăng nhập để truy cập tài nguyên này",
  "data": null
}
```

**Mẫu phản hồi lỗi phân quyền (`403 Forbidden`):**
```json
{
  "success": false,
  "message": "Bạn không có quyền thực hiện hành động này",
  "data": null
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
  - Cấp cặp JWT Token: Access Token (hiệu lực 15 phút, `expires_in: 900` giây) và Refresh Token (hiệu lực 7 ngày).
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
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 900,
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
      - Cấp cặp JWT Token: Access Token (hiệu lực 15 phút, `expires_in: 900` giây) và Refresh Token (hiệu lực 7 ngày).
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 900,
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

### 2.3. Làm Mới Access Token (Token Refresh)
- **Endpoint**: `POST /api/v1/auth/refresh`
- **Quyền hạn**: Public (Không yêu cầu Bearer token trong Header, truyền refresh token qua Request Body)
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
- **Ràng buộc dữ liệu (`schemas/auth.py`)**:
  - `refresh_token`: Bắt buộc, chuỗi JWT Refresh Token hợp lệ (`min_length=10`).
- **Quy tắc nghiệp vụ & Kịch bản ngoại lệ**:
  - **Mục đích**: Cấp Access Token mới (15 phút) từ Refresh Token hợp lệ (7 ngày) mà không bắt buộc người dùng đăng nhập lại bằng mật khẩu.
  - **Kiểm tra cú pháp JSON**: Request body không phải JSON object hợp lệ $\rightarrow$ Trả về `400 Bad Request` (`"Dữ liệu đầu vào phải là JSON object hợp lệ"`).
  - **Validate Schema**: Thiếu trường `refresh_token` hoặc chuỗi rỗng / < 10 ký tự $\rightarrow$ Trả về `422 Unprocessable Entity` (`"Dữ liệu làm mới token không hợp lệ"`).
  - **Giải mã & Kiểm tra chữ ký/thời hạn Token**: Giải mã token qua `decode_token()`; nếu chữ ký sai hoặc token đã hết hạn $\rightarrow$ Trả về `401 Unauthorized` (`"Token làm mới không hợp lệ hoặc đã hết hạn"`).
  - **Kiểm tra loại Token (Token Type)**: Claim `type` bắt buộc phải là `"refresh"`. Nếu client gửi nhầm Access Token $\rightarrow$ Trả về `401 Unauthorized` (`"Loại token không hợp lệ (yêu cầu refresh token)"`).
  - **Kiểm tra định danh người dùng**: Trích xuất `user_id` từ claim `sub`. Nếu không phải số hợp lệ $\rightarrow$ Trả về `401 Unauthorized` (`"Phiên đăng nhập không hợp lệ hoặc đã hết hạn"`).
  - **Kiểm tra Danh sách đen (Two-Tier Revoked Token Blacklist)**: Trích xuất `jti` từ token; kiểm tra qua cơ chế Two-Tier Blacklist (Redis Cache $O(1)$ và PostgreSQL kèm Cache-Aside Backfill); nếu token đã bị thu hồi (do đăng xuất trước đó) $\rightarrow$ Trả về `401 Unauthorized` (`"Phiên đăng nhập đã bị thu hồi hoặc đăng xuất"`).
  - **Kiểm tra trạng thái người dùng trong DB**:
    - Nếu không tìm thấy người dùng trong CSDL $\rightarrow$ Trả về `404 Not Found` (`"Không tìm thấy người dùng"`).
    - Nếu tài khoản người dùng có `is_active == false` (bị quản trị viên khóa) $\rightarrow$ Trả về `403 Forbidden` (`"Tài khoản này đã bị khóa"`).
  - **Cấp Access Token mới**: Nếu mọi kiểm tra hợp lệ, hệ thống cấp Access Token mới có hiệu lực 15 phút (`expires_in: 900` giây) chứa thông tin người dùng (`sub`, `email`, `role`, `name`) và giữ nguyên Refresh Token gửi lên.
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Làm mới token thành công",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 900,
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
- **Response lỗi (`400 Bad Request` - Body không phải JSON)**:
```json
{
  "success": false,
  "message": "Dữ liệu đầu vào phải là JSON object hợp lệ",
  "data": null
}
```
- **Response lỗi (`401 Unauthorized` - Token hết hạn hoặc không hợp lệ)**:
```json
{
  "success": false,
  "message": "Token làm mới không hợp lệ hoặc đã hết hạn",
  "data": null
}
```
- **Response lỗi (`401 Unauthorized` - Gửi nhầm Access Token)**:
```json
{
  "success": false,
  "message": "Loại token không hợp lệ (yêu cầu refresh token)",
  "data": null
}
```
- **Response lỗi (`401 Unauthorized` - Token đã bị thu hồi / Đăng xuất)**:
```json
{
  "success": false,
  "message": "Phiên đăng nhập đã bị thu hồi hoặc đăng xuất",
  "data": null
}
```
- **Response lỗi (`403 Forbidden` - Tài khoản bị khóa)**:
```json
{
  "success": false,
  "message": "Tài khoản này đã bị khóa",
  "data": null
}
```
- **Response lỗi (`404 Not Found` - Không tìm thấy người dùng)**:
```json
{
  "success": false,
  "message": "Không tìm thấy người dùng",
  "data": null
}
```
- **Response lỗi (`422 Unprocessable Entity` - Thiếu refresh_token)**:
```json
{
  "success": false,
  "message": "Dữ liệu làm mới token không hợp lệ",
  "data": null,
  "errors": [
    {
      "loc": ["refresh_token"],
      "msg": "Field required",
      "type": "missing"
    }
  ]
}
```

### 2.4. Lấy Thông Tin Phiên Hiện Tại (`UC03`, `UC04`)
- **Endpoint**: `GET /api/v1/auth/me`
- **Quyền hạn**: Authenticated (`@jwt_required` - Tất cả các role: `customer`, `staff`, `manager`, `admin`)
- **Headers**: `Authorization: Bearer <access_token>`
- **Quy tắc nghiệp vụ**:
  - Trích xuất định danh người dùng từ claim `sub` trong JWT.
  - Kiểm tra token chưa bị thu hồi qua Two-Tier Blacklist (Redis Cache $O(1)$ / PostgreSQL) (`is_token_revoked`).
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
  - `401 Unauthorized` (Token đã bị thu hồi do đăng xuất): `{"success": false, "message": "Phiên đăng nhập đã bị thu hồi hoặc đăng xuất", "data": null}`
  - `403 Forbidden` (Tài khoản bị vô hiệu hóa): `{"success": false, "message": "Tài khoản này đã bị khóa", "data": null}`
  - `404 Not Found` (Không tìm thấy user): `{"success": false, "message": "Không tìm thấy người dùng", "data": null}`

### 2.5. Đăng Xuất Hệ Thống (`UC03`)
- **Endpoint**: `POST /api/v1/auth/logout`
- **Quyền hạn**: Authenticated (`@jwt_required` - Tất cả các role: `customer`, `staff`, `manager`, `admin`)
- **Headers**:
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json` (khi gửi kèm body)
- **Request Body** (Không bắt buộc - Optional):
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
*(Có thể gửi body rỗng `{}` hoặc không truyền body)*
- **Ràng buộc dữ liệu (`schemas/auth.py`)**:
  - `refresh_token`: Không bắt buộc (Optional), chuỗi JWT Refresh Token cần thu hồi đồng thời.
- **Quy tắc xử lý & Cơ chế thu hồi Token (Two-Tier Dual-Write Blacklist)**:
  - Trích xuất định danh token `jti` (JWT ID) và thời hạn `exp` của Access Token hiện tại từ `g.current_user`.
  - **Hành vi Dual-Write đồng thời vào PostgreSQL & Redis**:
    - **Thu hồi Access Token**: Ghi nhận bản ghi vào bảng `revoked_tokens` trong PostgreSQL (`token_type = "access"`, `reason = "logout"`) và nạp đồng thời vào Redis key `revoked_token:{jti}` với TTL bằng thời gian sống còn lại của token (tối đa 15 phút - 900 giây).
    - **Thu hồi Refresh Token (nếu cung cấp)**: Nếu client truyền kèm `refresh_token` trong body, hệ thống giải mã, trích xuất `jti` và `exp`, sau đó Dual-Write đồng thời vào bảng `revoked_tokens` trong PostgreSQL (`token_type = "refresh"`, `reason = "logout"`) và nạp vào Redis key `revoked_token:{jti}` với TTL tương ứng (thời gian sống còn lại của refresh token, tối đa 7 ngày).
  - **Cơ chế Graceful Fallback**: Nếu Redis gặp sự cố hoặc ngoại tuyến, token vẫn được thu hồi an toàn tuyệt đối trong PostgreSQL (Graceful Degradation) mà không gây lỗi gián đoạn HTTP 500 cho API.
  - Sau khi đăng xuất thành công, mọi request sử dụng lại Access Token hoặc Refresh Token đã bị thu hồi đều bị chặn tức thì qua Redis $O(1)$ và trả về lỗi `401 Unauthorized` (`"Phiên đăng nhập đã bị thu hồi hoặc đăng xuất"`).
  - Phía Client khi nhận phản hồi `200` sẽ xóa toàn bộ cặp Token khỏi `localStorage` / Session Storage.
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Đăng xuất thành công",
  "data": null
}
```
- **Response lỗi (`401 Unauthorized` - Token đã bị thu hồi trước đó)**:
```json
{
  "success": false,
  "message": "Phiên đăng nhập đã bị thu hồi hoặc đăng xuất",
  "data": null
}
```

### 2.6. Đổi Mật Khẩu Tài Khoản (`UC05`, `EX-04`)
- **Endpoint**: `POST /api/v1/auth/change-password`
- **Quyền hạn**: Authenticated (`@jwt_required` - Tất cả các role)
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
- **Quy tắc nghiệp vụ & Cơ chế bảo mật (`UC05`, `EX-04`)**:
  - Kiểm tra `old_password` có khớp với hash mật khẩu hiện tại trong DB hay không. Nếu sai $\rightarrow$ Trả về `400 Bad Request` (`"Mật khẩu hiện tại không chính xác"`).
  - Kiểm tra `new_password` không được trùng với mật khẩu hiện tại (`old_password` hoặc hash DB). Nếu trùng $\rightarrow$ Trả về `400 Bad Request` (`"Mật khẩu mới không được trùng với mật khẩu hiện tại"`).
  - Mật khẩu mới được băm bảo mật bằng thuật toán Bcrypt thông qua hàm `update_user_password(db, user, new_password)`.
  - **Tự động thu hồi Access Token (Two-Tier Dual-Write / EX-04)**: Ngay sau khi đổi mật khẩu thành công, Access Token hiện tại được tự động thu hồi bằng cơ chế Dual-Write:
    - Ghi nhận bản ghi vào bảng `revoked_tokens` trong PostgreSQL (`token_type = "access"`, `reason = "change_password"`).
    - Nạp đồng thời vào Redis key `revoked_token:{jti}` với TTL bằng thời gian sống còn lại của Access Token (tối đa 15 phút - 900 giây).
    - Nếu Redis ngoại tuyến, token vẫn được thu hồi an toàn và bền vững trong PostgreSQL (Graceful Fallback).
    - Mọi request kế tiếp sử dụng token cũ này sẽ bị chặn tức thì qua Redis $O(1)$ và nhận lỗi `401 Unauthorized` (`"Phiên đăng nhập đã bị thu hồi hoặc đăng xuất"`), buộc người dùng phải đăng nhập lại bằng mật khẩu mới hoặc sử dụng Refresh Token để lấy token mới.
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

### 2.7. Quên Mật Khẩu & Gửi Mã OTP (`UC05`, `EX-04`)
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

### 2.8. Đặt Lại Mật Khẩu Bằng Mã OTP (`UC05`, `BR-02`, `EX-04`)
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

### 2.9. Hồ Sơ Người Dùng Cá Nhân (`UC04`, `BR-01`, `EX-01`, `EX-03`)

#### 2.9.1. Xem Hồ Sơ Cá Nhân (`UC04`)
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

#### 2.9.2. Cập Nhật Hồ Sơ Cá Nhân (`UC04`, `BR-01`, `EX-01`, `EX-03`)
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

### 2.10. Quản Trị Tài Khoản & Blacklist COD (`UC23`, `BR-02`, `BR-08`, `BR-22`, `EX-22` - Role: `admin`)

#### 2.10.1. Danh Sách & Lọc Tài Khoản Người Dùng (`UC23`)
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

#### 2.10.2. Khóa / Mở Khóa & Phân Quyền Tài Khoản (`UC23`, `BR-02`, `BR-08`, `EX-22`)
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

#### 2.10.3. Quản Trị Danh Sách Đen COD - Blacklist (`UC23`, `BR-22`)
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

### 2.11. Cấu Hình Tham Số Vận Hành Hệ Thống (`/api/v1/settings` - `UC23`, `BR-07`, `BR-08`, `BR-11`–`BR-15`, `BR-17`, `BR-20`, `BR-23`)

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

#### 2.11.1. Lấy Danh Sách Toàn Bộ Tham Số Hệ Thống (`UC23`)
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

#### 2.11.2. Lấy Chi Tiết Một Tham Số Cấu Hình Theo Khóa (`UC23`)
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

#### 2.11.3. Cập Nhật Một Tham Số Cấu Hình Hệ Thống (`UC23`, `BR-07`, `BR-08`, `BR-12`, `BR-14`, `BR-15`, `BR-17`, `BR-20`, `BR-23`)
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

#### 2.11.4. Cập Nhật Đồng Loạt Tham Số Hệ Thống - Bulk Update (`UC23`, Atomicity Transaction)
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
- **Quyền hạn**: Role `staff`, `manager` (theo [`Quy_Trinh_Nghiep_Vu.md`](./Quy_Trinh_Nghiep_Vu.md) §2.2, quyền bật/tắt món nhanh thuộc về nhân viên quầy và quản lý Canteen; loại bỏ vai trò `admin`).
- **Request Body**: `{"is_available": false}`

### 3.3. Quản Lý Thực Đơn CRUD & Soft Delete (`UC21`, `BR-04`, `BR-12`, `EX-21`)
- **Quyền hạn chung**: Role `manager` (theo [`Quy_Trinh_Nghiep_Vu.md`](./Quy_Trinh_Nghiep_Vu.md) §2.2, toàn bộ nghiệp vụ thêm/sửa/xóa món và upload ảnh thực đơn do Quản lý Canteen phụ trách; loại bỏ vai trò `admin`).
- `POST /api/v1/dishes` (Role: `manager`):
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
- `PUT /api/v1/dishes/<dish_id>` (Role: `manager`): Cập nhật thông tin món; nếu sửa `base_price` thì tự động cập nhật lại `price = base_price + system_fee`.
- `DELETE /api/v1/dishes/<dish_id>` (Role: `manager` - `BR-04`, `EX-21`):
  - Kiểm tra bảng `order_items`: Nếu món đã từng phát sinh đơn hàng $\rightarrow$ Không xóa vật lý khỏi DB mà chuyển `is_deleted = true, is_active = false, is_available = false` và trả thông báo đã ẩn món theo `EX-21`.
- `POST /api/v1/dishes/upload-image` (Role: `manager` - `multipart/form-data`, field `file`):
  - Tải lên ảnh món ăn (chỉ nhận định dạng PNG, JPG, JPEG, WEBP, GIF).
  - **Response (`201 Created`)**: `{"success": true, "message": "Tải ảnh món ăn thành công", "data": {"filename": "a1b2c3.jpg", "image_url": "/uploads/a1b2c3.jpg"}}`.

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
  7. `BR-18`: Sinh mã đơn có định dạng chuẩn: `NF` + `YYMMDD` + 4 chữ số ngẫu nhiên (ví dụ: `NF2610211234`, độ dài cố định đúng 12 ký tự). Hệ thống tự động cắt và lưu 4 chữ số cuối (ví dụ `"1234"`) vào cột `order_code_suffix` để phục vụ đối chiếu mã khi bàn giao nhận món COD (`BR-15`, `BR-18`). Trạng thái khởi tạo: `status = "CHO_XAC_NHAN"`, `payment_status = "chua_thanh_toan"`.

- **Response (`201 Created`)**:
```json
{
  "success": true,
  "message": "Đặt hàng thành công",
  "data": {
    "id": "NF2610211234",
    "order_code_suffix": "1234",
    "user_id": 2,
    "staff_id": null,
    "order_type": "delivery",
    "status": "CHO_XAC_NHAN",
    "recipient_name": "Nguyễn Sinh Viên",
    "recipient_phone": "0977112233",
    "campus_location_id": 1,
    "room_detail": "Phòng 502 Tầng 5",
    "delivery_address": "Tòa Nhà A1 - Phòng 502 Tầng 5",
    "delivery_note": "Gọi trước khi lên phòng giúp em",
    "is_preorder": false,
    "scheduled_at": null,
    "payment_method": "cod_cash",
    "payment_status": "chua_thanh_toan",
    "subtotal_amount": 100000.0,
    "ship_fee": 5000.0,
    "total_amount": 105000.0,
    "eta": null,
    "cancelled_reason": null,
    "delivered_at": null,
    "completed_at": null,
    "pickup_deadline": null,
    "auto_complete_at": null,
    "created_at": "2026-10-21T18:00:00+07:00",
    "items": [
      {
        "id": 101,
        "dish_id": "pho-bo-tai-lan",
        "dish_name": "Phở Bò Tái Lăn",
        "unit_price": 50000.0,
        "base_price": 45000.0,
        "quantity": 2,
        "note": "Nhiều hành",
        "subtotal": 100000.0
      }
    ]
  }
}
```

**Chi tiết xử lý UC08–UC10:**
- Chỉ JWT có role `customer` được tạo đơn; backend kiểm tra lại tài khoản còn tồn tại, đang hoạt động và role trong DB. Blacklist chặn đặt hàng, không thay đổi quyền đăng nhập.
- Request phải là JSON object. Lỗi cấu trúc/kiểu dữ liệu trả `422` theo envelope chuẩn: số lượng phải là số nguyên thực sự (không nhận boolean, số thập phân hoặc chuỗi); số điện thoại di động Việt Nam 10 chữ số. Lỗi nghiệp vụ trả `400`, riêng tài khoản không được phép/blacklist trả `403`. `errors` của lỗi nghiệp vụ chứa `[{"code": "EX-09"}]` hoặc mã tương ứng `EX-05`–`EX-11`.
- Giới hạn số lượng tính gộp **mọi dòng cùng `dish_id`**, kể cả các dòng có ghi chú khác nhau. Món còn phải `is_active == true`; món không tồn tại, bị ẩn/xóa hoặc hết hàng đều bị từ chối.
- Giá, phí và tổng tiền được tính phía server bằng số thập phân chính xác; giá/tổng do client gửi không được dùng để tính tiền. Địa chỉ giao được dựng từ địa điểm NEU hợp lệ và `room_detail`; `delivery_address` tự nhập không thay thế địa điểm trong danh mục. Pickup luôn dùng địa chỉ quầy, lưu `campus_location_id`/`room_detail` là `null`.
- `scheduled_at` cần múi giờ, ví dụ `2026-10-20T12:00:00+07:00`, chỉ gửi khi `is_preorder == true`. Giờ hẹn phải nằm trong giờ mở cửa theo giờ Việt Nam (mặc định từ **06:30**, trước **19:30**).
- Đọc cấu hình `delivery_fee`, `max_cod_amount`, `max_dish_quantity_per_order`, `min_preorder_lead_minutes`, `canteen_open_time`, `canteen_close_time`. Mặc định tương ứng 5.000đ, 500.000đ, 10 phần, 30 phút, 06:30, 19:30. Trần cứng của schema hiện hành vẫn là 500.000đ/10 phần; thời gian hẹn không thấp hơn 30 phút. Tăng hai trần tiền/số lượng cần phối hợp thay đổi schema trước.
- Khóa dòng tài khoản trong cùng giao dịch từ lúc kiểm tra đơn hoạt động đến lúc lưu đơn và chi tiết: hai request tạo đơn đồng thời không vượt giới hạn một đơn. Lỗi ghi bất kỳ chi tiết nào rollback toàn bộ đơn. Mã đơn luôn có định dạng `NF` + `YYMMDD` + 4 chữ số ngẫu nhiên (độ dài đúng 12 ký tự), suffix luôn là chuỗi 4 chữ số, giữ cả số 0 đầu.

Kiểm thử tích hợp: `backend/tests/test_order_creation.py`. Dùng PostgreSQL riêng có tên kết thúc `_orders_test`, khởi tạo bằng `database/init_db.sql`, đặt `TEST_DATABASE_URL` trỏ đến database thử, rồi chạy từ thư mục `backend`: `python -m unittest discover -s tests -p test_order_creation.py -v`. Test xóa dữ liệu trong database thử; không dùng database ứng dụng.

### 4.2. Xem Đơn Hàng (`UC11`)

#### 4.2.1. Lịch Sử Đơn Hàng Của Khách Hàng (`UC11`)
- **Endpoint**: `GET /api/v1/orders`
- **Quyền hạn**: `@jwt_required`
- **Mô tả**: Trả về danh sách toàn bộ các đơn hàng do khách hàng hiện tại khởi tạo, kèm thông tin chi tiết từng món và trạng thái.

#### 4.2.2. Xem Chi Tiết Đơn Hàng & Phòng Chống IDOR (`UC11`, `BR-18`)
- **Endpoint**: `GET /api/v1/orders/<order_id>`
- **Quyền hạn**: `@jwt_required` (Mọi Role: `customer`, `staff`, `manager`, `admin`)
- **Cơ chế phân quyền & Phòng chống tấn công IDOR (Insecure Direct Object References)**:
  - Khách hàng (Role: `customer`) **chỉ được phép xem đơn hàng do chính mình tạo** (`order.user_id == current_user.id`).
  - **Chống dò quét ID (Anti-ID Enumeration)**: Nếu khách hàng cố tình truy cập vào `order_id` thuộc khách hàng khác $\rightarrow$ Hệ thống lập tức trả về `404 Not Found` (`"Không tìm thấy đơn hàng"`), thay vì `403 Forbidden`. Quy tắc này ngăn chặn kẻ xấu dò quét tập hợp ID đơn hàng, đồng thời bảo vệ bí mật 4 chữ số cuối `order_code_suffix` dùng để nhận món COD tại quầy hoặc từ shipper.
  - Các vai trò vận hành (`staff`, `manager`, `admin`): Được phép xem toàn bộ chi tiết mọi đơn hàng trong hệ thống để phục vụ điều phối chế biến, bàn giao và giám sát Canteen.
- **Response (`200 OK`)**: Trả về chi tiết đơn hàng (gồm `order_code_suffix`, trạng thái, danh sách món, thanh toán).
- **Response lỗi (`404 Not Found` - Không tồn tại đơn hoặc xem đơn người khác)**:
```json
{
  "success": false,
  "message": "Không tìm thấy đơn hàng",
  "data": null
}
```

#### 4.2.3. Danh Sách Đơn Hàng Quản Trị & Phân Trang An Toàn (`UC10`, `UC11`, `UC17`)
- **Endpoint**: `GET /api/v1/orders/admin/all`
- **Quyền hạn**: Role `staff`, `manager`, `admin` (`@role_required("staff", "manager", "admin")`)
- **Query Parameters**:
  - `status`: Lọc theo trạng thái đơn hàng (`CHO_XAC_NHAN`, `DANG_CHUAN_BI`, `DANG_GIAO`, ...) (Optional).
  - `order_type`: Lọc theo hình thức nhận món (`delivery` / `pickup`) (Optional).
  - `page`: Số trang, số nguyên $\ge 1$ (mặc định: `1`).
  - `limit`: Số lượng bản ghi trên một trang, số nguyên $\ge 1$ (mặc định: `20`, tự động giới hạn trần tối đa `limit <= 100` để chống cạn kiệt tài nguyên / DoS).
- **Quy tắc phân trang an toàn (Input Sanitization & Safe Pagination)**:
  - Nếu `page` hoặc `limit` truyền vào không phải số nguyên hợp lệ (ví dụ: chuỗi ký tự, chữ cái, boolean) $\rightarrow$ Trả về `400 Bad Request`.
  - Nếu `page < 1` hoặc `limit < 1` (ví dụ: `page=0`, `limit=-5`) $\rightarrow$ Trả về `400 Bad Request`.
  - Thông báo lỗi thống nhất: `"Tham số phân trang page và limit phải lớn hơn hoặc bằng 1"`.
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Thực hiện thành công",
  "data": {
    "items": [ ... ],
    "total": 42,
    "page": 1,
    "limit": 20
  }
}
```
- **Response lỗi (`400 Bad Request` - Tham số phân trang không hợp lệ)**:
```json
{
  "success": false,
  "message": "Tham số phân trang page và limit phải lớn hơn hoặc bằng 1",
  "data": null
}
```

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
- `GET /api/v1/reviews/dish/<dish_id>` (Public): Danh sách đánh giá của món ăn, sắp xếp mới nhất lên đầu.
- `POST /api/v1/reviews` (Role: `customer`):
  - **Headers**: `Authorization: Bearer <access_token>`
  - **Request Body**:
```json
{
  "order_id": "NF2610148833",
  "dish_id": "combo-com-ga-tra-dao",
  "rating": 5,
  "comment": "Cơm gà nóng hổi, da giòn rụm!"
}
```
  - **Ràng buộc Schema (`schemas/review.py` - `ReviewCreateRequest`)**:
    - `order_id`: Chuỗi từ 2 đến 50 ký tự (`min_length=2, max_length=50`).
    - `dish_id`: Chuỗi từ 2 đến 100 ký tự (`min_length=2, max_length=100`).
    - `rating`: Số nguyên nghiêm ngặt từ 1 đến 5 (`strict=True, ge=1, le=5`). Không chấp nhận chuỗi `"5"`, số thập phân `4.5` hay boolean `True`.
    - `comment`: Tùy chọn, tối đa 1000 ký tự (`max_length=1000`).
  - **Quy tắc nghiệp vụ & Xử lý đồng thời (`crud/review.py`)**:
    - Kiểm tra người dùng: Role trong DB phải là `customer` và `is_active == True` (trả về `403 Forbidden` nếu không thỏa mãn).
    - Đơn hàng phải thuộc về user đang đăng nhập (`Order.user_id == user_id`). Nếu không tìm thấy trả về `404 Not Found` (`code: NOT_FOUND`) để bảo mật thông tin đơn của người khác.
    - Trạng thái đơn phải thuộc nhóm cho phép đánh giá: `DA_GIAO`, `DA_BAN_GIAO`, `HOAN_THANH` hoặc `DA_GIAI_QUYET` (sau khi Admin giải quyết xong khiếu nại - `REVIEWABLE_ORDER_STATUSES`). Nếu không thỏa mãn trả về `400 Bad Request` (`code: ORDER_NOT_REVIEWABLE`).
    - Món ăn phải nằm trong danh sách món của đơn hàng (`order_items`). Nếu không có trả về `400 Bad Request` (`code: DISH_NOT_IN_ORDER`).
    - **Khóa dòng món ăn (`with_for_update`)**: Khóa dòng `Dish` tương ứng trong DB trước khi kiểm tra trùng và cập nhật, đảm bảo các request review đồng thời được xếp hàng tuần tự.
    - Chặn trùng lặp: Nếu cặp `(order_id, dish_id)` đã tồn tại trong bảng `reviews` $\rightarrow$ Trả về `400 Bad Request` (`code: REVIEW_DUPLICATE`).
    - **Công thức cập nhật Rating (Quyết định D1)**:
      - Tính trung bình tăng dần để bảo toàn số liệu khởi tạo của `sample_data.sql`:
        - Nếu `dish.review_count == 0`: `dish.rating = Decimal(rating)`
        - Nếu `dish.review_count > 0`: `new_avg = (dish.rating * dish.review_count + rating) / (dish.review_count + 1)`
      - Làm tròn 2 chữ số thập phân theo quy tắc `ROUND_HALF_UP`.
      - Tăng số lượt đánh giá: `dish.review_count += 1`.
  - **Response thành công (`201 Created`)**:
```json
{
  "success": true,
  "message": "Đánh giá món ăn thành công",
  "data": {
    "id": 1,
    "order_id": "NF2610148833",
    "dish_id": "combo-com-ga-tra-dao",
    "user_id": 10,
    "user_name": "Nguyễn Văn A",
    "rating": 5,
    "comment": "Cơm gà nóng hổi, da giòn rụm!",
    "created_at": "2026-10-19T10:00:00+00:00"
  }
}
```
  - **Mã lỗi thường gặp**:
    - `401 Unauthorized`: Chưa gửi kèm Bearer token hoặc token không hợp lệ.
    - `403 Forbidden`: Token không phải role `customer`, hoặc tài khoản bị vô hiệu hóa trong DB.
    - `404 Not Found`: Đơn hàng không tồn tại/không thuộc về bạn, hoặc mã món ăn không tồn tại.
    - `400 Bad Request`: `ORDER_NOT_REVIEWABLE`, `DISH_NOT_IN_ORDER`, hoặc `REVIEW_DUPLICATE`.
    - `422 Unprocessable Entity`: Body thiếu trường bắt buộc hoặc sai định dạng schema.


### 5.2. Gửi & Phân Xử Khiếu Nại (`UC15`, `UC25`, `BR-23`, `BR-24`, `EX-14`, `EX-15`)

#### 5.2.1. Khách Hàng Gửi Ticket Khiếu Nại (`UC15`, `BR-23`, `EX-14`, `EX-15`)
- **Endpoint**: `POST /api/v1/complaints`
- **Quyền hạn**: Độc quyền Khách hàng (`@role_required("customer")`)
- **Headers**:
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`
- **Request Body**:
```json
{
  "order_id": "NF2610155566",
  "reason": "Giao nhầm món ăn",
  "description": "Em đặt Phở Trộn nhưng nhận được Bún Riêu.",
  "proof_image_url": "https://storage.neufood.vn/complaints/proof_123.jpg"
}
```
- **Ràng buộc Schema (`schemas/complaint.py` - `ComplaintCreateRequest`)**:
  - `order_id`: Chuỗi từ 2 đến 50 ký tự (`min_length=2, max_length=50`).
  - `reason`: Chuỗi từ 3 đến 255 ký tự (`min_length=3, max_length=255`).
  - `description`: Chuỗi từ 5 đến 2000 ký tự (`min_length=5, max_length=2000`).
  - `proof_image_url`: Bắt buộc cung cấp ảnh chụp bằng chứng theo định dạng URL hợp lệ (`http://` hoặc `https://`) hoặc đường dẫn upload nội bộ (`/uploads/...`), chuỗi từ 5 đến 1000 ký tự (`pattern=r"^(https?://\S+|/[a-zA-Z0-9_\-\./]+)$"`, vi phạm ném lỗi `422`).
- **Quy tắc nghiệp vụ & Giao dịch (`crud/complaint.py`)**:
  - Kiểm tra tài khoản khách hàng: Role trong DB phải là `customer` và `is_active == True` (`403 Forbidden`).
  - Kiểm tra đơn hàng: Đơn phải thuộc quyền sở hữu của khách hàng (`Order.user_id == user_id`). Nếu không tìm thấy trả về `404 Not Found` (`code: NOT_FOUND`). Khóa dòng đơn (`with_for_update`) trong giao dịch.
  - **Trạng thái đơn hàng (Quyết định D4)**: Đơn hàng bắt buộc phải thuộc nhóm trạng thái đã giao: `DA_GIAO`, `DA_BAN_GIAO` hoặc `HOAN_THANH`. Nếu đơn chưa giao (ví dụ `CHO_XAC_NHAN`, `DANG_CHUAN_BI`) $\rightarrow$ Từ chối và trả về `400 Bad Request` (`code: EX-14`).
  - **Thời hạn khiếu nại (Quyết định D3)**: Đọc tham số `complaint_window_hours` từ bảng `system_settings` (mặc định 24 giờ). Tính khoảng cách từ `order.delivered_at` đến thời điểm hiện tại `now()`. Nếu quá hạn hoặc đơn chưa có `delivered_at` $\rightarrow$ Trả về `400 Bad Request` (`code: EX-14`).
  - **Giới hạn số lượng (Quy tắc EX-15)**: Mỗi đơn hàng chỉ được tạo tối đa **01 ticket khiếu nại duy nhất**. Nếu đã có bản ghi khiếu nại cho đơn hàng này $\rightarrow$ Trả về `400 Bad Request` (`code: EX-15`).
  - Khi tạo ticket thành công: Cập nhật trạng thái đơn hàng sang `order.status = "KHIEU_NAI"`.
- **Response thành công (`201 Created`)**:
```json
{
  "success": true,
  "message": "Gửi khiếu nại thành công",
  "data": {
    "id": 1,
    "order_id": "NF2610155566",
    "user_id": 10,
    "user_name": "Nguyễn Văn A",
    "reason": "Giao nhầm món ăn",
    "description": "Em đặt Phở Trộn nhưng nhận được Bún Riêu.",
    "proof_image_url": "https://storage.neufood.vn/complaints/proof_123.jpg",
    "status": "DANG_XU_LY",
    "admin_response": null,
    "resolved_by": null,
    "resolved_at": null,
    "created_at": "2026-10-19T10:30:00+00:00",
    "updated_at": "2026-10-19T10:30:00+00:00"
  }
}
```

#### 5.2.2. Xem Danh Sách & Chi Tiết Khiếu Nại
- `GET /api/v1/complaints` (`@jwt_required`):
  - Nếu `role == "admin"`: Trả về toàn bộ danh sách khiếu nại trên hệ thống, sắp xếp giảm dần theo thời gian tạo (`created_at.desc()`).
  - Nếu `role != "admin"`: Chỉ trả về danh sách các khiếu nại do chính người dùng hiện tại gửi.
- `GET /api/v1/complaints/<int:complaint_id>` (`@jwt_required`): Xem chi tiết một khiếu nại theo ID (chặn tràn số nguyên bằng giới hạn `max=2147483647`). Khách hàng chỉ xem được của mình (trả về `404 Not Found` nếu xem của người khác hoặc ID không tồn tại để ngăn chặn dò quét ID), Admin xem được tất cả.

#### 5.2.3. Admin Phân Xử Khiếu Nại (`UC25`, `BR-24`, `EX-15`)
- **Endpoint**: `PATCH /api/v1/complaints/<int:complaint_id>/resolve`
- **Quyền hạn**: Độc quyền Quản trị viên (`@role_required("admin")`)
- **Headers**:
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`
- **Request Body**:
```json
{
  "status": "CHAP_NHAN",
  "admin_response": "Đã xác minh hình ảnh và nhắc nhở Canteen A2 hoàn lại phần chênh lệch."
}
```
- **Ràng buộc Schema (`schemas/complaint.py` - `ComplaintResolveRequest`)**:
  - `status`: Chấp nhận 1 trong 3 giá trị: `"CHAP_NHAN"`, `"TU_CHOI"`, `"YEU_CAU_BO_SUNG"` (`Literal["CHAP_NHAN", "TU_CHOI", "YEU_CAU_BO_SUNG"]`).
  - `admin_response`: Chuỗi từ 3 đến 2000 ký tự ghi rõ lý do, kết luận phân xử hoặc hướng dẫn khách hàng bổ sung chứng từ/bằng chứng.
- **Quy tắc nghiệp vụ & Giao dịch (`crud/complaint.py`)**:
  - Kiểm tra tài khoản Admin trong DB đang hoạt động (`is_active == True`).
  - Khóa dòng ticket khiếu nại (`with_for_update`). Nếu không tìm thấy $\rightarrow$ Trả về `404 Not Found`.
  - **Trạng thái cho phép phân xử**: Chỉ cho phép phân xử nếu ticket chưa bị chốt dứt điểm (`complaint.status` không nằm trong `("CHAP_NHAN", "TU_CHOI")`). Nếu khiếu nại đã được phân xử trước đó (`CHAP_NHAN` hoặc `TU_CHOI`) $\rightarrow$ Trả về `400 Bad Request` (`code: COMPLAINT_ALREADY_RESOLVED`). Ticket đang ở trạng thái `DANG_XU_LY` hoặc `YEU_CAU_BO_SUNG` đều được phép phân xử.
  - Khóa dòng đơn hàng `Order` tương ứng (bắt buộc `order.status == "KHIEU_NAI"`, nếu không ném `400 Bad Request` - `code: INVALID_ORDER_STATUS`).
  - **Phân nhánh xử lý theo trạng thái (`EX-15`)**:
    - **Khi chọn `"CHAP_NHAN"` hoặc `"TU_CHOI"`**:
      - Cập nhật trạng thái đơn hàng sang `order.status = "DA_GIAI_QUYET"`.
      - Cập nhật ticket: `complaint.status = status`, `complaint.admin_response = admin_response`, `complaint.resolved_by = admin_id`, `complaint.resolved_at = now()`, `complaint.updated_at = now()`.
    - **Khi chọn `"YEU_CAU_BO_SUNG"` (`EX-15`)**:
      - Đơn hàng vẫn giữ nguyên trạng thái `order.status = "KHIEU_NAI"` (chờ khách hàng bổ sung bằng chứng trong 12 giờ).
      - Cập nhật ticket: `complaint.status = "YEU_CAU_BO_SUNG"`, `complaint.admin_response = admin_response`, `complaint.resolved_by = admin_id`, `complaint.resolved_at = null`, `complaint.updated_at = now()`.
      - Quản trị viên (Admin) được phép tiếp tục xem xét và phân xử ticket này sang `"CHAP_NHAN"` hoặc `"TU_CHOI"` sau khi nhận bổ sung.
- **Response thành công (`200 OK`)**:
  - *Trường hợp chấp nhận hoặc từ chối:*
```json
{
  "success": true,
  "message": "Xử lý khiếu nại thành công",
  "data": {
    "id": 1,
    "order_id": "NF2610155566",
    "user_id": 10,
    "user_name": "Nguyễn Văn A",
    "reason": "Giao nhầm món ăn",
    "description": "Em đặt Phở Trộn nhưng nhận được Bún Riêu.",
    "proof_image_url": "https://storage.neufood.vn/complaints/proof_123.jpg",
    "status": "CHAP_NHAN",
    "admin_response": "Đã xác minh hình ảnh và nhắc nhở Canteen A2 hoàn lại phần chênh lệch.",
    "resolved_by": 5,
    "resolved_at": "2026-10-19T11:00:00+00:00",
    "created_at": "2026-10-19T10:30:00+00:00",
    "updated_at": "2026-10-19T11:00:00+00:00"
  }
}
```
  - *Trường hợp yêu cầu bổ sung bằng chứng (`resolved_at = null`):*
```json
{
  "success": true,
  "message": "Xử lý khiếu nại thành công",
  "data": {
    "id": 1,
    "order_id": "NF2610155566",
    "user_id": 10,
    "user_name": "Nguyễn Văn A",
    "reason": "Giao nhầm món ăn",
    "description": "Em đặt Phở Trộn nhưng nhận được Bún Riêu.",
    "proof_image_url": "https://storage.neufood.vn/complaints/proof_123.jpg",
    "status": "YEU_CAU_BO_SUNG",
    "admin_response": "Vui lòng chụp ảnh hóa đơn đính kèm trên hộp xốp để Canteen đối soát lại.",
    "resolved_by": 5,
    "resolved_at": null,
    "created_at": "2026-10-19T10:30:00+00:00",
    "updated_at": "2026-10-19T11:00:00+00:00"
  }
}
```
- **Mã lỗi thường gặp**:
  - `401 Unauthorized`: Chưa đăng nhập hoặc token hết hạn.
  - `403 Forbidden`: Người gọi không có quyền truy cập / không phải role `admin`.
  - `404 Not Found`: Đơn hàng hoặc khiếu nại không tồn tại.
  - `400 Bad Request`: `EX-14` (quá hạn hoặc đơn chưa giao), `EX-15` (đã có khiếu nại), `COMPLAINT_ALREADY_RESOLVED` (đã giải quyết trước đó với `CHAP_NHAN`/`TU_CHOI`), `INVALID_ORDER_STATUS` (đơn không ở trạng thái khiếu nại).
  - `422 Unprocessable Entity`: Body sai định dạng schema (status không thuộc `CHAP_NHAN`, `TU_CHOI`, `YEU_CAU_BO_SUNG`).


### 5.3. Chốt Ca & Đối Soát Tiền COD Cuối Ca (`UC20`, `BR-25`, `EX-20`)

#### 5.3.1. Xem Thông Số Ca Hiện Tại (`UC20`)
- **Endpoint**: `GET /api/v1/shifts/my-current-shift`
- **Quyền hạn**: Nhân viên, Quản lý Canteen (`@role_required("staff", "manager")`)
- **Headers**: `Authorization: Bearer <access_token>`
- **Quy tắc nghiệp vụ (`crud/shift.py`)**:
  - Tính toán theo thời gian thực các đơn hàng do nhân viên hiện tại (`staff_id`) đã bàn giao COD (`Order.payment_status == 'da_thanh_toan'`) trong ngày hôm nay theo giờ Việt Nam (`Asia/Saigon` - UTC+7):
    - `total_orders_handled`: Tổng số đơn hàng đã bàn giao thành công.
    - `expected_cash`: Tổng số tiền mặt COD dự kiến phải thu ($\sum \text{total\_amount}$ của các đơn có `payment_method == 'cod_cash'`).
    - `expected_qr`: Tổng số tiền VietQR dự kiến phải thu ($\sum \text{total\_amount}$ của các đơn có `payment_method == 'cod_vietqr'`).
  - Nếu nhân viên đã nộp số liệu chốt ca trong ngày hôm nay, trả về kèm các trường kiểm đếm thực tế `actual_cash`, `actual_qr`, độ lệch `discrepancy_amount`, `discrepancy_note`, và `status` hiện tại của ca.
- **Response thành công (`200 OK`)**:
```json
{
  "success": true,
  "message": "Thành công",
  "data": {
    "staff_id": 3,
    "staff_name": "Trần Nhân Viên",
    "shift_date": "2026-10-19",
    "total_orders_handled": 12,
    "expected_cash": 450000.0,
    "expected_qr": 230000.0,
    "actual_cash": 0.0,
    "actual_qr": 0.0,
    "discrepancy_amount": 0.0,
    "discrepancy_note": null,
    "status": null,
    "shift_id": null
  }
}
```

#### 5.3.2. Nhân Viên Nộp Số Liệu Chốt Ca (`UC20`, `BR-25`, `EX-20`)
- **Endpoint**: `POST /api/v1/shifts/submit`
- **Quyền hạn**: Độc quyền Nhân viên (`@role_required("staff")`)
- **Headers**:
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`
- **Request Body**:
```json
{
  "actual_cash": 450000.0,
  "actual_qr": 230000.0,
  "discrepancy_note": "Khớp 100% tiền mặt và sao kê QR"
}
```
- **Ràng buộc Schema (`schemas/shift.py` - `ShiftSubmitRequest`)**:
  - `actual_cash`: Số tiền mặt kiểm đếm thực tế, kiểu số không âm và tối đa 9,999,999,999.99 (`ge=0, le=9999999999.99, allow_inf_nan=False`).
  - `actual_qr`: Số tiền QR sao kê thực tế, kiểu số không âm và tối đa 9,999,999,999.99 (`ge=0, le=9999999999.99, allow_inf_nan=False`).
  - `discrepancy_note`: Ghi chú giải trình (tối đa 1000 ký tự).
- **Quy tắc nghiệp vụ & Xử lý chênh lệch (Quyết định D6, `BR-25`, `EX-20`)**:
  - Mỗi nhân viên chỉ có **tối đa 01 ca làm việc mỗi ngày** (tính theo ngày Việt Nam `Asia/Saigon`).
  - Nếu ca của ngày hôm nay đã ở trạng thái `DA_CHOT` $\rightarrow$ Từ chối thao tác và trả về `400 Bad Request` (`code: SHIFT_ALREADY_CLOSED`, `"Ca làm việc hôm nay đã được chốt đóng, không thể nộp lại"`).
  - Nếu đã có bản ghi ca hôm nay nhưng chưa đóng (`CHO_DUYET` hoặc `CAN_GIAI_TRINH`) $\rightarrow$ Cho phép cập nhật lại số liệu.
  - **Công thức tính độ lệch tiền COD**:
    $$\text{discrepancy\_amount} = (\text{actual\_cash} + \text{actual\_qr}) - (\text{expected\_cash} + \text{expected\_qr})$$
  - **Quy tắc giải trình (`EX-20`)**:
    - Nếu $\text{discrepancy\_amount} \neq 0$ (thừa hoặc thiếu tiền COD so với hệ thống): **Bắt buộc phải có `discrepancy_note` không để trống**. Nếu không có giải trình $\rightarrow$ Báo lỗi `400 Bad Request` (`code: EX-20`, `"Lệch tiền COD bắt buộc phải có giải trình (EX-20)"`). Ca được gán trạng thái `status = "CAN_GIAI_TRINH"`.
    - Nếu $\text{discrepancy\_amount} == 0$ (khớp hoàn toàn): Ca được gán trạng thái `status = "CHO_DUYET"`.
- **Response thành công**: Trả về `201 Created` nếu nộp chốt ca lần đầu tạo mới bản ghi `StaffShift`; trả về `200 OK` nếu nộp lại cập nhật số liệu ca hiện tại.
```json
{
  "success": true,
  "message": "Nộp số liệu chốt ca thành công",
  "data": {
    "id": 1,
    "staff_id": 3,
    "staff_name": "Trần Nhân Viên",
    "shift_date": "2026-10-19",
    "total_orders_handled": 12,
    "expected_cash": 450000.0,
    "expected_qr": 230000.0,
    "actual_cash": 450000.0,
    "actual_qr": 230000.0,
    "discrepancy_amount": 0.0,
    "discrepancy_note": "Khớp 100% tiền mặt và sao kê QR",
    "status": "CHO_DUYET",
    "closed_by": null,
    "closed_at": null,
    "created_at": "2026-10-19T14:30:00+00:00",
    "updated_at": "2026-10-19T14:30:00+00:00"
  }
}
```

#### 5.3.3. Quản Lý / Admin Duyệt Chốt Ca (`UC20`, `BR-25`)
- **Endpoint**: `PATCH /api/v1/shifts/<int:shift_id>/close`
- **Quyền hạn**: Quản lý Canteen hoặc Admin (`@role_required("manager", "admin")`)
- **Headers**:
  - `Authorization: Bearer <access_token>`
  - `Content-Type: application/json`
- **Request Body**:
```json
{
  "status": "DA_CHOT",
  "discrepancy_note": "Đã kiểm đếm đủ tiền bàn giao ca"
}
```
- **Ràng buộc Schema (`schemas/shift.py` - `ShiftCloseRequest`)**:
  - `status`: Bắt buộc là `"DA_CHOT"` hoặc `"CAN_GIAI_TRINH"` (Regex `^(DA_CHOT|CAN_GIAI_TRINH)$`).
  - `discrepancy_note`: Ghi chú xác nhận / yêu cầu bổ sung của Quản lý.
- **Quy tắc nghiệp vụ (Quyết định D7)**:
  - Khóa dòng `StaffShift` trong DB bằng `with_for_update()`. Nếu không tìm thấy $\rightarrow$ `404 Not Found`.
  - Nếu ca đã ở trạng thái `DA_CHOT` $\rightarrow$ Từ chối chốt lại và trả về `400 Bad Request` (`code: SHIFT_ALREADY_CLOSED`).
  - Khi duyệt `DA_CHOT`: Nếu ca có chênh lệch tiền ($\text{discrepancy\_amount} \neq 0$), bắt buộc ca phải có giải trình từ nhân viên hoặc ghi chú xác nhận từ Quản lý.
  - Cập nhật: `shift.status = status`, `shift.closed_by = closer_id`, `shift.closed_at = now()`, `shift.updated_at = now()`.
- **Response thành công (`200 OK`)**:
```json
{
  "success": true,
  "message": "Duyệt chốt ca thành công",
  "data": {
    "id": 1,
    "staff_id": 3,
    "staff_name": "Trần Nhân Viên",
    "shift_date": "2026-10-19",
    "total_orders_handled": 12,
    "expected_cash": 450000.0,
    "expected_qr": 230000.0,
    "actual_cash": 450000.0,
    "actual_qr": 230000.0,
    "discrepancy_amount": 0.0,
    "discrepancy_note": "Đã kiểm đếm đủ tiền bàn giao ca",
    "status": "DA_CHOT",
    "closed_by": 4,
    "closed_at": "2026-10-19T15:00:00+00:00",
    "created_at": "2026-10-19T14:30:00+00:00",
    "updated_at": "2026-10-19T15:00:00+00:00"
  }
}
```

#### 5.3.4. Xem Danh Sách Ca Làm Việc
- `GET /api/v1/shifts` (`@role_required("staff", "manager", "admin")`):
  - Nhân viên chỉ xem danh sách các ca của chính mình.
  - Quản lý và Admin xem được danh sách ca của toàn bộ nhân viên, sắp xếp giảm dần theo ngày ca và ID.
- `GET /api/v1/shifts/<int:shift_id>` (`@role_required("staff", "manager", "admin")`): Xem chi tiết một ca theo ID (chặn tràn số nguyên bằng giới hạn `max=2147483647`). Nhân viên chỉ xem được ca của mình (trả về `404 Not Found` nếu xem của người khác hoặc ID không tồn tại để ngăn chặn dò quét ID).


### 5.4. Báo Cáo & Thống Kê Doanh Thu Canteen (`UC22`, `BR-03`, Quyết định D8)
- **Endpoint**: `GET /api/v1/shifts/reports/summary`
- **Quyền hạn**: Quản lý Canteen hoặc Quản trị viên (`@role_required("manager", "admin")`)
- **Headers**: `Authorization: Bearer <access_token>`
- **Query Parameters**:
  - `from_date` (Tùy chọn, kiểu chuỗi `YYYY-MM-DD`): Ngày bắt đầu lọc theo giờ Việt Nam. Mặc định là ngày hôm nay (`CURRENT_DATE` theo `Asia/Saigon`).
  - `to_date` (Tùy chọn, kiểu chuỗi `YYYY-MM-DD`): Ngày kết thúc lọc theo giờ Việt Nam. Mặc định là ngày hôm nay.
- **Quy tắc nghiệp vụ & Kiểm tra tham số (Quyết định D8, F7, F8)**:
  - **Tự động quét đơn quá hạn SLA (F7)**: Hệ thống tự động kích hoạt hàm `sync_overdue_orders(db)` ngay khi gọi báo cáo để quét và chuyển các đơn quá hạn SLA (đơn quá 10 phút Canteen chưa nhận sang `TU_DONG_HUY`, đơn đã giao quá hạn sang `HOAN_THANH`) trước khi thực hiện tổng hợp số liệu.
  - Định dạng ngày bắt buộc phải theo chuẩn nghiêm ngặt `YYYY-MM-DD` (năm từ 2000 đến 2100). Nếu sai định dạng hoặc số năm nằm ngoài khoảng $\rightarrow$ Trả về `422 Unprocessable Entity` (`code: INVALID_DATE_FORMAT`).
  - Nếu `from_date > to_date` $\rightarrow$ Trả về `400 Bad Request` (`code: INVALID_DATE_RANGE`, `"from_date không được lớn hơn to_date"`).
  - Khoảng cách giữa `from_date` và `to_date` không được vượt quá 366 ngày $\rightarrow$ Nếu vượt quá trả về `400 Bad Request` (`code: DATE_RANGE_TOO_LONG`, `"Khoảng thời gian báo cáo không được vượt quá 366 ngày"`).
  - **Quy tắc lọc khoảng thời gian theo giờ Việt Nam (UTC+7) (F8)**:
    - Khoảng thời gian lọc được tính theo khoảng nửa mở `[start_utc, end_utc)` từ `from_date 00:00:00` đến `(to_date + 1 ngày) 00:00:00` theo giờ Việt Nam (`Asia/Saigon` - UTC+7).
    - **Đơn đã thanh toán (`payment_status == 'da_thanh_toan'`)**: Lọc theo thời điểm bàn giao thực tế `orders.delivered_at` (`delivered_at >= start_utc` và `delivered_at < end_utc`) để khớp 100% với số liệu đối soát ca trực nhân viên (`calculate_staff_shift_orders`).
    - **Đơn chưa thanh toán / bị hủy / từ chối / boom (`payment_status != 'da_thanh_toan'`)**: Lọc theo thời điểm tạo đơn `orders.created_at` (`created_at >= start_utc` và `created_at < end_utc`).
  - **4 Bộ đếm trạng thái đơn hàng**:
    1. `total_orders`: Tổng tất cả đơn hàng phát sinh trong khoảng thời gian (`len(paid_orders + unpaid_orders)`).
    2. `completed_orders`: Tổng các đơn hàng đã thanh toán (`payment_status == 'da_thanh_toan'`) và có trạng thái kết thúc giao nhận: `('DA_GIAO', 'DA_BAN_GIAO', 'HOAN_THANH', 'KHIEU_NAI', 'DA_GIAI_QUYET')`.
    3. `cancelled_or_rejected_orders`: Tổng các đơn hàng chưa thanh toán bị hủy hoặc từ chối: `('DA_HUY_KHACH', 'TU_CHOI', 'TU_DONG_HUY')`.
    4. `blacklisted_orders`: Tổng các đơn hàng chưa thanh toán bị đánh dấu boom hàng: `('BO_DON_BLACKLIST')`.
  - **Công thức tính toán doanh thu chuẩn (CHỈ tính trên các đơn đã thu tiền `payment_status == 'da_thanh_toan'`)**:
    - `gross_revenue` (Tổng doanh thu gộp): $\sum \text{orders.total\_amount}$
    - `ship_fee_total` (Tổng phí ship): $\sum \text{orders.ship\_fee}$
    - `canteen_net_revenue` (Doanh thu thực nhận của Canteen A2): $\sum (\text{order\_items.base\_price} \times \text{order\_items.quantity})$
    - `system_fee_total` (Tổng phụ phí nền tảng hệ thống NEUFOOD): $\sum ((\text{order\_items.unit\_price} - \text{order\_items.base\_price}) \times \text{order\_items.quantity})$
    - Đảm bảo công thức cân đối tài chính:
      $$\text{gross\_revenue} = \text{canteen\_net\_revenue} + \text{system\_fee\_total} + \text{ship\_fee\_total}$$
  - **Top 5 món bán chạy nhất (`top_dishes`)**:
    - Tính trên các dòng `order_items` của những đơn hàng đã thanh toán trong kỳ.
    - Sắp xếp ưu tiên: `total_quantity` giảm dần, nếu bằng nhau sắp xếp theo `total_revenue` giảm dần, nếu vẫn bằng sắp xếp theo `dish_id` giảm dần làm tie-breaker. Lấy tối đa 5 món dẫn đầu.
- **Response thành công (`200 OK`)**:
```json
{
  "success": true,
  "message": "Lấy báo cáo doanh thu thành công",
  "data": {
    "from_date": "2026-10-01",
    "to_date": "2026-10-19",
    "total_orders": 6,
    "completed_orders": 4,
    "cancelled_or_rejected_orders": 1,
    "blacklisted_orders": 1,
    "gross_revenue": 210000.0,
    "canteen_net_revenue": 170000.0,
    "system_fee_total": 25000.0,
    "ship_fee_total": 15000.0,
    "top_dishes": [
      {
        "dish_id": "bun-bo-hue",
        "dish_name": "Bún bò Huế",
        "total_quantity": 4,
        "total_revenue": 160000.0
      },
      {
        "dish_id": "com-tam",
        "dish_name": "Cơm tấm sườn",
        "total_quantity": 1,
        "total_revenue": 35000.0
      }
    ]
  }
}
```
- **Mã lỗi thường gặp**:
  - `401 Unauthorized`: Chưa đăng nhập hoặc token không hợp lệ.
  - `403 Forbidden`: Người dùng không có vai trò `manager` hoặc `admin`.
  - `400 Bad Request`: `INVALID_DATE_RANGE` (`from_date` lớn hơn `to_date`).
  - `422 Unprocessable Entity`: Định dạng tham số ngày sai chuẩn `YYYY-MM-DD`.

