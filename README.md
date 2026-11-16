<div align="center">

# 🍱 NEUFood — Campus Food Delivery & Canteen Operations Platform

**Nền tảng đặt đồ ăn nội khu & quản trị vận hành toàn diện cho Canteen A2 — Trường Đại học Kinh tế Quốc dân (NEU)**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-101.96.66.222%3A8041-003f87?style=for-the-badge&logo=googlechrome&logoColor=white)](http://101.96.66.222:8041/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

🌐 **Trải nghiệm trực tiếp (Live Deployment):** **[http://101.96.66.222:8041/](http://101.96.66.222:8041/)**

</div>

---

## 📖 Tổng quan dự án

**NEUFood** là hệ thống web full-stack giải quyết bài toán đặt món, giao đồ ăn nội khu và số hóa quy trình vận hành cho **Canteen A2 — Đại học Kinh tế Quốc dân** (giao tận phòng học, giảng đường, thư viện, ký túc xá hoặc nhận trực tiếp tại quầy).

Thay vì chỉ là một trang bán hàng CRUD cơ bản, NEUFood được thiết kế theo mô hình hệ thống vận hành thực tế với **4 phân quyền độc lập (RBAC)**, **State Machine đơn hàng 14 trạng thái**, **xử lý tranh chấp đồng thời ở tầng Database (`SELECT ... FOR UPDATE`)**, **bảo mật JWT đa tầng (Redis + PostgreSQL)**, **đối soát tiền COD cuối ca**, và **Trợ lý ảo AI (Google Gemini + Smart Local Fallback)** có khả năng tư vấn thực đơn và tạo đơn hàng trực tiếp ngay trong khung chat.

---

## 🌐 Live Demo & Tài khoản trải nghiệm

* **Địa chỉ truy cập:** [http://101.96.66.222:8041/](http://101.96.66.222:8041/)
* **Lưu ý đăng ký mới:** Hệ thống ràng buộc email sinh viên/cán bộ NEU (`@st.neu.edu.vn` hoặc `@neu.edu.vn`) kèm xác thực mã OTP 6 chữ số qua email.

Nếu hệ thống đang sử dụng bộ dữ liệu mẫu từ [`database/sample_data.sql`](database/sample_data.sql), bạn có thể dùng nhanh các tài khoản sau để trải nghiệm từng phân hệ (mật khẩu chung: `password123`):

| Vai trò | Email đăng nhập | Đường dẫn Workspace | Phạm vi trải nghiệm |
| :--- | :--- | :--- | :--- |
| **Sinh viên (`customer`)** | `11240000@st.neu.edu.vn` | `/` | Đặt món, chọn topping, hẹn giờ, theo dõi đơn, đánh giá, AI Chatbot |
| **Nhân viên / Shipper (`staff`)** | `staff01.a2@neufood.vn` | `/nhan-vien` | Chế độ **Trực quầy** & **Shipper**, xử lý đơn, thu COD 4 số cuối, chốt ca |
| **Quản lý Canteen (`manager`)** | `manager.a2@neufood.vn` | `/quan-ly` | Quản lý menu, báo cáo doanh thu, duyệt chốt ca, nhân sự & bài viết CMS |
| **Quản trị viên (`admin`)** | `admin@neufood.vn` | `/admin` | Phân quyền RBAC, blacklist COD, phân xử khiếu nại, cấu hình động hệ thống |

> *Ghi chú: Tài khoản `11240002@st.neu.edu.vn` trong dữ liệu mẫu được cấu hình sẵn ở trạng thái **Blacklist COD** để minh họa cơ chế chặn đặt đơn khi vi phạm chính sách nhận hàng.*

---

## ⚡ Điểm nhấn kỹ thuật (Engineering Highlights)

Dưới đây là các bài toán kỹ thuật cốt lõi được giải quyết trực tiếp trong mã nguồn:

1. **Order State Machine 14 trạng thái & An toàn đồng thời (Concurrency Control)**
   * Mọi thao tác chuyển trạng thái đơn hàng, nhận đơn giao của Shipper (`claim-delivery`), hủy đơn và đối soát ca đều sử dụng **Pessimistic Row-Level Locking (`SELECT ... FOR UPDATE`)** theo thứ tự khóa nhất quán để loại bỏ race condition và deadlock.
   * Tự động đồng bộ quá hạn SLA (`sync_overdue_orders`): tự hủy đơn chờ xác nhận quá hạn (mặc định 10 phút), theo dõi hạn giữ món tại quầy (30 phút), tự hoàn thành đơn đã giao khi không có khiếu nại.
   * Xác thực bàn giao món & thu COD bằng đối chiếu **4 chữ số cuối mã đơn (`order_code_suffix`)** sử dụng so sánh hằng thời gian (`secrets.compare_digest`).

2. **AI Chatbot thực thi hành động có kiểm soát (`Gemini API + Smart Local Fallback`)**
   * Trợ lý ảo sử dụng **Google Gemini REST API** (`gemini-3.5-flash-lite` / `gemini-3.5-flash`) kết hợp **Smart Local Fallback** dựa trên quy tắc nội bộ — đảm bảo hệ thống vẫn phản hồi chính xác về thực đơn, tòa nhà và trạng thái đơn hàng ngay cả khi thiếu API Key hoặc gặp sự cố mạng.
   * Ngữ cảnh hội thoại được lấy trực tiếp từ PostgreSQL (món còn/hết, cấu hình giờ mở cửa, địa điểm giao, 3 đơn gần nhất của user) và lưu lịch sử trên **Redis** (`TTL 1800s`).
   * Hỗ trợ đặt hàng hội thoại bền vững qua bảng `chat_order_drafts` & `chat_delivery_preferences`: AI tạo action `PREPARE_ORDER` / `ADD_TO_CART`, server chạy báo giá trong **Savepoint rollback** để kiểm tra toàn bộ điều kiện trước khi hiển thị thẻ xác nhận cho khách.

3. **Bảo mật xác thực đa tầng & Chống khóa oan mạng dùng chung**
   * **Dual-Token JWT (`PyJWT`)**: Access Token ngắn hạn (15 phút) + Refresh Token (7 ngày). Frontend tích hợp **Axios Interceptor Single-Flight Queue** (`frontend/src/services/api.ts`) giúp tự động refresh token khi nhiều API request đồng thời gặp `401`.
   * **Two-Tier JWT Blacklist (`Redis + PostgreSQL`)**: Kiểm tra thu hồi token khi đăng xuất/đổi mật khẩu với tốc độ `O(1)` trên Redis, tự động backfill và **Graceful Degradation** về PostgreSQL nếu Redis tạm gián đoạn.
   * **Device-Aware Brute-Force Protection (`user_devices`)**: Cấp `device_token` ký **HMAC-SHA256**. Nhập sai mật khẩu $\ge 5$ lần trên thiết bị tin cậy chỉ khóa riêng thiết bị đó 15 phút (không ảnh hưởng thiết bị khác); sai $\ge 5$ lần trên thiết bị lạ khóa các thiết bị chưa xác minh và cung cấp lối thoát mở khóa bằng **OTP qua Email**.
   * **Rate Limit thông minh (`Flask-Limiter`)**: Khóa giới hạn đăng nhập theo cặp `(IP + email)` thay vì chặn IP thô để tránh khóa nhầm sinh viên dùng chung Wi-Fi giảng đường/KTX.

4. **Nghiệp vụ thương mại & Tài chính thực tế**
   * **Cấu trúc giá minh bạch**: $\text{Giá niêm yết} = \text{Giá gốc Canteen} + \text{Phụ phí hệ thống}$ (`5.000đ`), tách bạch rõ ràng trong báo cáo doanh thu.
   * **Tùy chỉnh khẩu phần & Topping (`portion_groups` JSONB)**: Cho phép chọn món chính trong combo và thêm khẩu phần phụ (`+5k`/`+10k`), đồng thời xác minh `expected_unit_price` phía server chống sửa giá.
   * **Ưu đãi đặt số lượng lớn & Cọc mô phỏng 50%**: Freeship từ **5 suất**; giảm giá **6% / 8% / 12%** từ **10 / 20 / 30 suất**; đơn từ **500.000đ** kích hoạt quy trình **xác nhận đặt cọc 50% mô phỏng** được bảo vệ bằng JWT digest (`deposit_quote`) và yêu cầu nhân viên gọi xác nhận trước khi nấu.
   * **Chính sách thời gian Việt Nam (`UTC+7`)**: Đóng cửa Chủ nhật, hỗ trợ **Đặt ngay** trong khung giờ mở cửa (`07:30–18:30`) và **Đặt hẹn giờ (Pre-order)** trước tối thiểu 30 phút trong vòng 7 ngày tới (`07:30–19:00`).

---

## 🎯 Tính năng chi tiết theo Vai trò

### 1. 🧑‍🎓 Khách hàng & Khách vãng lai (`/` · `/menu` · `/gio-hang` · `/don-hang`)
* **Khám phá thực đơn thông minh**: Lọc theo 7 danh mục (Cơm hộp, Mì phở, Combos, Đồ uống, Ăn vặt, Tráng miệng, Món chính), lọc theo khoảng giá, mức đánh giá (`4.5★+`, `4.7★+`), sắp xếp và thanh tìm kiếm tức thì có gợi ý dropdown.
* **Tùy biến món ăn & Combo**: Chọn món thành phần trong combo, thêm phần ăn phụ (`+5k/+10k`), ghi chú riêng cho từng món.
* **Vòng quay may mắn ("Hôm nay ăn gì?")** (`/RANDOM.html` / `/vong-quay`): Giao diện HTML5 Canvas kéo dữ liệu món còn bán theo danh mục để quay ngẫu nhiên và điều hướng thẳng tới trang đặt món.
* **Đặt hàng & Thanh toán COD**:
  * Giao tận phòng tới **8 khu vực nội khu NEU** (A1, A2, B, C, D, KTX, Thư viện Phạm Văn Đồng, Nhà Văn Hóa) với phí ship cấu hình động (mặc định `5.000đ`), hoặc **Nhận tại quầy Canteen A2** (`0đ` ship).
  * Chọn **Tiền mặt** hoặc **VietQR** khi nhận hàng; hỗ trợ **Đặt ngay** hoặc **Đặt hẹn giờ**.
  * Tự động kiểm tra món còn/hết trước khi thanh toán (`validate-cart`).
* **Theo dõi đơn & Hậu mãi**: Cập nhật tiến trình đơn tự động (polling 15s), hiển thị mã **4 số cuối** nhận hàng, hủy đơn khi chờ xác nhận, xác nhận đã nhận hàng, **Đánh giá 1–5 sao** cho từng món trong đơn, và **Gửi khiếu nại kèm ảnh minh chứng** (hỗ trợ bổ sung bằng chứng nếu Admin yêu cầu).
* **Trợ lý AI Chatbot (`ChatbotWidget`)**: Hỏi đáp món ăn theo ngân sách/sở thích, tra cứu đơn hàng cá nhân, thêm món vào giỏ và tạo đơn trực tiếp qua khung chat.
* **Tin tức, Câu chuyện & Tuyển dụng**: Đọc bài viết (`/bai-viet`, `/story`) và nộp hồ sơ ứng tuyển part-time trực tuyến kèm bảng chọn ca sáng/chiều (`/recruit`).

### 2. 🛵 Nhân viên Canteen & Shipper (`/nhan-vien`)
* **Chuyển đổi chế độ Trực quầy / Shipper**: Linh hoạt chuyển đổi giao diện giữa nhân viên trực quầy bếp và nhân viên giao hàng nội khu ngay trên sidebar.
* **Xử lý đơn & Cảnh báo âm thanh**: Tự động phát âm thanh qua **Web Audio API** khi có đơn mới đổ về; tiếp nhận/từ chối đơn, xác nhận gọi điện cho đơn có cọc mô phỏng, chuyển trạng thái chế biến $\rightarrow$ giao/sẵn sàng lấy.
* **Hàng đợi Shipper chuyên biệt**: Nhận đơn giao có khóa chống nhận trùng (`claim-delivery`), xem danh sách đơn đang giữ và lịch sử giao trong ngày.
* **Bàn giao COD & Báo cáo sự cố**: Bắt buộc nhập đúng **4 số cuối mã đơn** khi hoàn tất bàn giao; ghi nhận sự cố (`no_answer`, `pickup_timeout`, `refuse_payment`) và xử lý giữ món tại quầy.
* **Cập nhật hết món tức thì (`/nhan-vien/mon`) & Chốt ca COD (`/nhan-vien/ca`)**: Bật/tắt trạng thái còn món trong 1 chạm; cuối ca nhập tiền mặt thực đếm và sao kê VietQR để hệ thống tự đối chiếu chênh lệch.

### 3. 🧑‍💼 Quản lý Canteen (`/quan-ly`)
* **Dashboard vận hành**: Theo dõi tổng quan doanh thu gốc Canteen, đơn đang chờ xác nhận, món hết hàng và các ca cần đối soát.
* **Quản lý thực đơn (`/quan-ly/mon`)**: Thêm/sửa món ăn, tự động tính giá niêm yết từ giá gốc + phụ phí hệ thống, upload ảnh món ăn, cấu hình `eligible_servings` (số suất tính giảm giá), tạm ngừng bán, xóa mềm bảo toàn lịch sử đơn và khôi phục món.
* **Đối soát ca COD & Báo cáo doanh thu (`/quan-ly/ca`, `/quan-ly/bao-cao`)**: Phê duyệt chốt ca hoặc yêu cầu giải trình khi lệch tiền; thống kê doanh thu theo khoảng ngày (`UTC+7`) tách bạch doanh thu Canteen, phụ phí hệ thống, phí ship, giảm giá, cọc mô phỏng và Top 5 món bán chạy.
* **Quản lý nhân sự & Tuyển dụng (`/quan-ly/nhan-su`)**: Duyệt hồ sơ ứng tuyển (`pending` $\rightarrow$ `contacting` $\rightarrow$ `hired` / `rejected`), chuyển ứng viên thành hồ sơ nhân viên chính thức, phân ca làm việc theo tuần (Thứ 2–Thứ 7) kèm lịch sử Audit Log.
* **CMS Bài viết với TipTap Rich Editor (`/quan-ly/bai-viet`)**: Soạn thảo tin tức, thông báo, câu chuyện và bài tuyển dụng bằng trình soạn thảo **TipTap**, hỗ trợ bản nháp/xuất bản độc lập, upload ảnh, và bật/tắt trạng thái mở tuyển dụng cho từng vị trí.

### 4. 🛡️ Quản trị viên Hệ thống (`/admin`)
* **Quản lý tài khoản & Blacklist COD (`/admin/tai-khoan`)**: Tìm kiếm/lọc người dùng, phân quyền RBAC (`customer`, `staff`, `manager`, `admin`), khóa/mở khóa tài khoản (chặn khóa khi đang có đơn hoạt động), quản lý danh sách đen COD và giải phóng số điện thoại tranh chấp.
* **Trung tâm phân xử khiếu nại (`/admin/khieu-nai`)**: Tiếp nhận ticket kèm ảnh minh chứng từ sinh viên và phân xử **Chấp nhận (`CHAP_NHAN`)**, **Từ chối (`TU_CHOI`)** hoặc **Yêu cầu bổ sung (`YEU_CAU_BO_SUNG`)**.
* **Quản lý địa điểm giao hàng (`/admin/dia-diem`)**: Thêm, sửa, sắp xếp thứ tự hoặc tạm ngưng các tòa nhà giao hàng trong khuôn viên NEU.
* **Cấu hình tham số vận hành động (`/admin/cau-hinh`)**: Chỉnh sửa trực tiếp giờ mở cửa, giờ ngừng nhận đơn đặt ngay, giờ đóng cửa, phí giao hàng, phụ phí hệ thống, số lượng món tối đa/đơn, timeout xác nhận, thời gian giữ món và thời hạn khiếu nại.
* **Giám sát bài viết (`/admin/bai-viet`)**: Kiểm tra lịch sử chỉnh sửa và ẩn/chặn xuất bản các bài viết vi phạm kèm lý do bắt buộc.

---

## 🔄 Vòng đời đơn hàng (14-State Machine)

```mermaid
stateDiagram-v2
    [*] --> CHO_XAC_NHAN: Khách đặt đơn COD

    CHO_XAC_NHAN --> DANG_CHUAN_BI: Canteen tiếp nhận đơn
    CHO_XAC_NHAN --> DA_HUY_KHACH: Khách hủy đơn sớm
    CHO_XAC_NHAN --> TU_CHOI: Canteen từ chối (kèm lý do)
    CHO_XAC_NHAN --> TU_DONG_HUY: Quá hạn xác nhận (SLA)

    DANG_CHUAN_BI --> DANG_GIAO: Đơn Delivery - Bắt đầu giao
    DANG_CHUAN_BI --> SAN_SANG_LAY: Đơn Pick-up - Sẵn sàng tại quầy

    DANG_GIAO --> DA_GIAO: Shipper giao & thu COD (4 số cuối)
    DANG_GIAO --> GIAO_THAT_BAI: Không liên lạc được (giữ tại quầy)
    DANG_GIAO --> BO_DON_BLACKLIST: Từ chối thanh toán COD

    SAN_SANG_LAY --> DA_BAN_GIAO: Khách nhận tại quầy & thu COD
    SAN_SANG_LAY --> BO_DON_BLACKLIST: Quá hạn giữ món / Từ chối thanh toán
    GIAO_THAT_BAI --> DA_BAN_GIAO: Khách nhận bù tại quầy trước hạn
    GIAO_THAT_BAI --> BO_DON_BLACKLIST: Quá hạn giữ món / Từ chối thanh toán

    DA_GIAO --> HOAN_THANH: Khách xác nhận hoặc hết thời gian chờ
    DA_BAN_GIAO --> HOAN_THANH: Khách xác nhận hoặc hết thời gian chờ

    DA_GIAO --> KHIEU_NAI: Khách gửi khiếu nại (trong 24h)
    DA_BAN_GIAO --> KHIEU_NAI: Khách gửi khiếu nại (trong 24h)
    HOAN_THANH --> KHIEU_NAI: Khách gửi khiếu nại (trong 24h)

    KHIEU_NAI --> DA_GIAI_QUYET: Admin chấp nhận / từ chối
```

---

## 🏗️ Kiến trúc hệ thống & Công nghệ sử dụng

```mermaid
flowchart LR
    User["Trình duyệt / Mobile<br/>(React 19 + TypeScript + Vite)"] -->|"REST API /api/v1 + JWT"| API["Flask 3 API Server<br/>(SQLAlchemy 2 + Pydantic v2 + Limiter)"]
    API -->|"ORM & Row Locks"| PG[("PostgreSQL 16<br/>22 Bảng + Triggers + Indexes")]
    API -->|"Cache / Token Blacklist / Chat History / Rate Limit"| RD[("Redis 7")]
    API -->|"AI Tư vấn & Đặt món"| Gemini["Google Gemini API<br/>(+ Smart Local Fallback)"]
    API -->|"OTP Đăng ký / Mở khóa / Đổi mật khẩu"| SMTP["SMTP Email Server"]
```

### Tech Stack chi tiết

| Thành phần | Công nghệ & Phiên bản | Vai trò trong hệ thống |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript 5.7, Vite 8 | SPA đa phân hệ (Customer, Staff/Shipper, Manager, Admin) |
| **UI & Rich Text** | Tailwind CSS 3, CSS Modules, Lucide Icons, TipTap 3 | Giao diện responsive (kèm BottomNav mobile), Dark/Light Theme, CMS Editor |
| **HTTP Client** | Axios 1.7 | Interceptor tự động đính kèm JWT & Single-Flight Refresh Token queue |
| **Backend** | Python 3.11, Flask 3, Gunicorn | RESTful API chuẩn hóa (`api_response`), Application Factory & 12 Blueprints |
| **ORM & Validation** | SQLAlchemy 2.0, Pydantic v2, Pydantic Settings | Quản lý giao dịch DB, row-locking, validate DTO & config `.env` |
| **Bảo mật** | PyJWT, Bcrypt, HMAC-SHA256, Flask-Limiter | Dual-token JWT, HMAC device token, rate limiting theo `(IP + email)` |
| **Database** | PostgreSQL 16 (`postgres:16-alpine`) | 22 bảng, `updated_at` triggers, check constraints, JSONB, partial unique indexes |
| **Cache & Broker** | Redis 7 (`redis:7-alpine`) | Cache menu/địa điểm/cấu hình, Tier-1 JWT Blacklist, lưu lịch sử Chat AI |
| **AI & Messaging** | Google Gemini REST API, `smtplib` (Async Thread) | Chatbot tư vấn & tạo bản nháp đơn hàng; gửi email OTP HTML đa định dạng |
| **Containerization** | Docker, Docker Compose | Đóng gói đồng bộ 4 dịch vụ: `database`, `redis`, `backend`, `frontend` |

### Thiết kế Cơ sở dữ liệu (22 bảng PostgreSQL)

Schema đầy đủ được định nghĩa tại [`database/init_db.sql`](database/init_db.sql):
* **Người dùng & Bảo mật:** `users`, `user_devices`, `revoked_tokens`
* **Thực đơn & Địa điểm:** `categories`, `dishes`, `dish_categories`, `dish_badges`, `campus_locations`
* **Đơn hàng & Hậu mãi:** `orders`, `order_items`, `reviews`, `complaints`
* **Vận hành & Cấu hình:** `staff_shifts`, `system_settings`
* **Trợ lý AI Chatbot:** `chat_order_drafts`, `chat_delivery_preferences`
* **Nhân sự, Tuyển dụng & CMS:** `recruitment_positions`, `recruitment_applications`, `employee_profiles`, `personnel_audit`, `articles`, `article_audit`

---

## 🔌 Tổng quan REST API (`/api/v1`)

| Blueprint | Prefix | Chức năng chính |
| :--- | :--- | :--- |
| `auth_bp` | `/api/v1/auth` | Đăng ký OTP email NEU, đăng nhập, refresh token, logout thu hồi token, đăng nhập OTP khẩn cấp, quên/đổi mật khẩu |
| `user_bp` | `/api/v1/users` | Hồ sơ cá nhân, danh sách user (Admin), phân quyền RBAC, khóa/mở khóa, Blacklist COD, giải phóng SĐT |
| `dish_bp` | `/api/v1/dishes` | Danh mục, danh sách/chi tiết món (cache Redis), kiểm tra giỏ hàng, bật/tắt hết món, CRUD & khôi phục món, upload ảnh |
| `location_bp` | `/api/v1/locations` | Danh sách tòa nhà nội khu NEU và CRUD quản trị địa điểm |
| `order_bp` | `/api/v1/orders` | Chính sách giờ đặt (`/policy`), báo giá (`/quote`), tạo đơn COD, hủy đơn, xác nhận nhận hàng, hàng đợi Shipper, claim đơn, bàn giao & báo sự cố |
| `review_bp` | `/api/v1/reviews` | Xem đánh giá theo món và gửi đánh giá sau khi nhận món |
| `complaint_bp` | `/api/v1/complaints` | Upload ảnh minh chứng, tạo khiếu nại, bổ sung bằng chứng, Admin phân xử |
| `shift_bp` | `/api/v1/shifts` | Tổng hợp ca hiện tại, nộp kiểm đếm chốt ca COD, duyệt ca, báo cáo doanh thu (`UTC+7`) |
| `chat_bp` | `/api/v1/chat` | Nhắn tin với Trợ lý AI (`/message`), xác nhận/sửa bản nháp đơn từ chat, reset phiên chat |
| `recruitment_bp` | `/api/v1/recruitment` | Nộp hồ sơ ứng tuyển part-time, quản lý ứng viên, tạo hồ sơ nhân viên, phân ca & audit log |
| `article_bp` | `/api/v1/articles` | Bài viết công khai, bài viết nổi bật (`story`/`recruitment`), CMS nháp/xuất bản/chặn, đóng mở vị trí tuyển dụng, upload ảnh |
| `setting_bp` | `/api/v1/settings` | Đọc cấu hình vận hành (cache Redis) và cập nhật đơn lẻ/hàng loạt (Admin) |
| *Core* | `/health`, `/uploads/*` | Kiểm tra sức khỏe dịch vụ và phục vụ ảnh upload tĩnh |

---

## 📁 Cấu trúc mã nguồn

```text
NEUFOOD/
├── docker-compose.yml              # Điều phối 4 containers: database, redis, backend, frontend
├── database/
│   ├── init_db.sql                 # DDL PostgreSQL (22 bảng, triggers, check constraints, indexes)
│   ├── sample_data.sql             # Dữ liệu mẫu (65 món, 8 địa điểm NEU, đơn hàng, ca làm, tài khoản)
│   └── erd.html                    # Sơ đồ ERD trực quan
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   ├── run.py
│   ├── app/
│   │   ├── __init__.py             # Flask Application Factory, CORS, Limiter, Error handlers
│   │   ├── core/                   # config.py, security.py, redis_client.py, cache.py, limiter.py, chatbot_engine.py
│   │   ├── db/                     # session.py, models.py, chat_models.py, article_models.py, recruitment_models.py, migrations.py
│   │   ├── schemas/                # Pydantic v2 DTOs cho 12 phân hệ
│   │   ├── crud/                   # Tầng truy cập dữ liệu & nghiệp vụ (order, bulk_pricing, order_policy, portion, chat_order, shift...)
│   │   ├── routes/                 # 12 Flask Blueprints (/api/v1/*)
│   │   └── utils/                  # api_response, upload helpers, async SMTP email sender
│   └── tests/                      # Unit tests, integration tests & API audit suite (PostgreSQL)
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts              # Cấu hình Vite + Reverse proxy /api & /uploads
│   ├── public/                     # Static auth pages (DANGNHAP.html, DANGKY.html), Vòng quay RANDOM.html, assets
│   ├── scripts/                    # Frontend automated tests (*.test.mjs)
│   └── src/
│       ├── routes/                 # React Router v7 & ProtectedRoute phân quyền theo vai trò
│       ├── pages/                  # user/, staff/, manager/, admin/, auth/, not-found/
│       ├── components/             # chatbot/, orders/, articles/, layout/, dishes/, manager/, staff/, admin/, common/
│       ├── contexts/               # AuthContext, CartContext, DishesContext, OrderHistoryContext, MenuSearchContext, ThemeContext
│       ├── services/               # Axios client (single-flight refresh) & 13 API service modules
│       ├── types/                  # TypeScript interfaces
│       └── utils/                  # bulkPricing, portions, orderingTime, chatFormatting, singleFlight, money
└── docs/                           # Tài liệu đặc tả nghiệp vụ, kiến trúc, API documentation
```

---

## 🚀 Hướng dẫn cài đặt & Chạy Local

### Cách 1: Chạy toàn bộ hệ thống bằng Docker Compose (Khuyên dùng)

**Yêu cầu:** Docker & Docker Compose.

```bash
# 1. Clone repository
git clone https://github.com/DuTiHeo/NEUFOOD.git
cd NEUFOOD

# 2. Tạo file cấu hình môi trường từ file mẫu
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# (Tùy chọn) Mở backend/.env để điền GEMINI_API_KEY (cho AI Chatbot)
# và SMTP_USER / SMTP_PASSWORD (cho gửi email OTP thật; nếu bỏ trống hệ thống chạy ở chế độ dev log)

# 3. Khởi chạy toàn bộ 4 services (PostgreSQL 16 + Redis 7 + Flask Backend + Vite Frontend)
docker compose up --build -d
```

Sau khi khởi chạy thành công:
* **Frontend:** `http://localhost:5173`
* **Backend API Health Check:** `http://localhost:5000/health`

*(Database sẽ tự động chạy `database/init_db.sql` và nạp dữ liệu mẫu `database/sample_data.sql` ở lần khởi tạo volume đầu tiên).*

---

### Cách 2: Chạy thủ công (Local Development)

**1. Khởi tạo PostgreSQL & Redis:**
Đảm bảo PostgreSQL 16 và Redis 7 đang chạy cục bộ, sau đó nạp schema & seed data vào database `neufood_db`:
```bash
psql -U neufood_user -d neufood_db -f database/init_db.sql
psql -U neufood_user -d neufood_db -f database/sample_data.sql
```

**2. Chạy Backend (Python 3.11+):**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Trên Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # Cấu hình DATABASE_URL, REDIS_URL, SECRET_KEY...
python run.py                   # Lắng nghe tại http://localhost:5000
```

**3. Chạy Frontend (Node.js 20+):**
```bash
cd frontend
npm install
cp .env.example .env
npm run dev                     # Lắng nghe tại http://localhost:5173
```

---

## 🧪 Kiểm thử tự động (Testing)

Dự án đi kèm bộ test cho cả Backend và Frontend:

### Frontend Tests (`node --test`)
```bash
cd frontend

# Chạy các script kiểm thử theo từng nhóm nghiệp vụ
npm run test:auth
npm run test:manager
npm run test:staff
npm run test:requests

# Hoặc chạy toàn bộ test scripts (bao gồm bulk pricing, extra portions, ordering time, chatbot, random wheel...)
node --test scripts/*.test.mjs

# Kiểm tra build production
npm run build
```

### Backend Tests (`unittest`)
```bash
cd backend

# Chạy các unit/feature tests (dùng SQLite in-memory / mock)
python -m unittest tests/test_device_lockout.py tests/test_chatbot_api.py tests/test_redis_blacklist.py

# Chạy bộ Integration Audit Tests đầy đủ với PostgreSQL
# (Yêu cầu database test có tên kết thúc bằng `_api_test`)
TEST_DATABASE_URL="postgresql://neufood_user:neufood_password@localhost:5432/neufood_api_test" \
  python -m unittest discover -s tests/api_audit
```

---

## 📚 Tài liệu bổ sung

Các tài liệu phân tích thiết kế và đặc tả chi tiết được lưu trong thư mục [`docs/`](docs/):
* [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Kiến trúc 3 lớp và luồng dữ liệu hệ thống
* [`docs/Quy_Trinh_Nghiep_Vu.md`](docs/Quy_Trinh_Nghiep_Vu.md) — Đặc tả Use Cases, Business Rules & Ngoại lệ
* [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md) — Đặc tả chi tiết các API Endpoints
* [`docs/TESTING_AND_DATABASE_GUIDE.md`](docs/TESTING_AND_DATABASE_GUIDE.md) — Hướng dẫn kiểm thử Postman & kết nối Database
