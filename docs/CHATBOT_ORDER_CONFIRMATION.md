# Chatbot: đặt COD có xác nhận

`POST /api/v1/chat/message` giữ envelope `success/message/data` và các trường
`message`, `session_id`, `history`. Bổ sung `draft_id` (32 ký tự hex), `revision`
(số nguyên dương) và `decision` (`confirm` hoặc `cancel`, không bắt buộc).

- AI `PREPARE_ORDER` hoặc action `CREATE_ORDER` cũ chỉ cập nhật nháp; không tạo đơn.
  Server kiểm tra qua Orders trong savepoint được rollback, tính tiền bằng giá thật.
  Đủ dữ liệu trả `data.action.type=ORDER_CONFIRMATION`, `draft_id`, `revision`,
  `expires_at`, `summary` và lời nhắc xác nhận do server dựng. Thiếu dữ liệu trả
  `ORDER_COLLECTING` và danh sách phần cần hỏi.
- Dữ liệu nháp: món/số lượng/ghi chú; `order_for_self` (bắt buộc phân biệt đặt hộ),
  người nhận/SĐT; delivery/pickup; mã tòa nhà và phòng khi delivery;
  cash/VietQR lúc nhận; `is_preorder`, `scheduled_at` có múi giờ khi hẹn;
  `delivery_note` và `notes_confirmed`. Không dùng SĐT/địa chỉ mẫu hoặc tự bỏ món lỗi.
- Mặc định đặt cho chủ tài khoản: tự lấy tên và SĐT hợp lệ từ hồ sơ, không hỏi
  “đặt cho mình hay đặt hộ”. Mặc định `cod_cash`, làm ngay và không có ghi chú;
  chỉ hỏi những thông tin thực sự thiếu. Chỉ chuyển VietQR/hẹn giờ/thêm ghi chú
  khi khách chủ động yêu cầu. Các mặc định vẫn xuất hiện trong bản tóm tắt để xác nhận.
- `ORDER_COLLECTING` có thể trả `draft_id`, `revision`, `recipient` ngay khi còn
  thiếu địa chỉ; `ORDER_CONFIRMATION` cũng trả `recipient`. Nút “Sửa thông tin
  đặt hàng” cho phép sửa tên/SĐT bằng `recipient_update: {recipient_name,
  recipient_phone}` kèm đúng draft/session/revision. Sửa người nhận đánh dấu
  đặt hộ, chỉ dùng cho đơn đó, giữ địa chỉ đã chọn, không đổi hồ sơ hoặc thông tin
  mặc định. Bản xác nhận cũ hết hiệu lực, phải xác nhận lại sau cập nhật.
- Nút xác nhận gửi `decision=confirm` với đúng id/revision và session. Tin nhắn
  đồng ý rõ nghĩa như “đồng ý đặt đơn” cũng phải kèm id/revision từ bản tóm tắt
  hiện tại. Lịch sử client và JSON do AI sinh không phải bằng chứng đồng ý.
- Server khóa khách rồi nháp; kiểm tra lại Orders, tạo Order và lưu `order_id`
  cùng giao dịch. Gửi lại cùng xác nhận trả lại đơn cũ, kể cả đơn đã kết thúc.
  Giá/nội dung đổi trả `ORDER_CONFIRMATION` phiên bản mới, chưa tạo Order.
  Lỗi nghiệp vụ trả `ORDER_FAILED` với `error/code`; `data.reply` giải thích.
  Lỗi cấu trúc request vẫn trả HTTP 400/422; chưa đăng nhập xác nhận trả 401.
- Mọi tương tác sửa/hỏi tiếp khi có nháp chờ xác nhận làm xác nhận cũ mất hiệu lực;
  nháp cần được tóm tắt lại. Nói “không đồng ý” hoặc “đồng ý nhưng đổi…” không tạo đơn.
- Nháp hết hạn sau 30 phút không tương tác. `decision=cancel`, “bỏ đơn nháp”,
  hoặc `POST /api/v1/chat/reset` bỏ nháp chưa tạo, không hủy Order thật hay xóa
  thông tin nhận hàng mặc định. Guest được tư vấn, đặt/thêm giỏ yêu cầu đăng nhập.
- Một bộ thông tin nhận mặc định được lưu trong PostgreSQL sau đơn cho chính chủ
  thành công. Đặt hộ không ghi đè và không tự cập nhật SĐT định danh trong Auth.
  Bản nháp và thông tin đã lưu được giới hạn theo tài khoản, không phụ thuộc Redis.

**Nâng cấp database:** áp dụng `database/migrations/001_chat_orders.sql` trước khi
chạy backend mới. Migration chỉ thêm `chat_order_drafts`,
`chat_delivery_preferences` và index; database mới dùng `database/init_db.sql`
đã chứa hai bảng. Không chạy lại script tạo/xóa dữ liệu ứng dụng để nâng cấp.

**Kiểm thử:** `test_chat_order_confirmation.py` cần `TEST_DATABASE_URL` là
PostgreSQL riêng có tên kết thúc `_orders_test`, đã khởi tạo bằng init_db.sql.
Test xóa fixture trong database đó; không dùng database ứng dụng.
`test_chatbot_api.py` kiểm tra routing/provider với dữ liệu giả lập.

## Sửa lỗi giờ hẹn từ Gemini (09/11/2026)

Trường giờ hẹn chuẩn trong action là `scheduled_at`, chuỗi ISO 8601 có múi giờ
(ví dụ `2026-11-09T09:00:00+07:00`). Backend nhận thêm tên `preorder_time` đã
quan sát thấy từ Gemini và chuẩn hóa về `scheduled_at` trước khi lưu nháp.
Không gửi cả hai trường cùng lúc. Các trường lạ khác vẫn bị từ chối; không bỏ
kiểm tra múi giờ, tối thiểu 30 phút, tối đa 7 ngày, giờ phục vụ hoặc nghỉ Chủ nhật.
Đặt ngay trong giờ và đặt hẹn ngoài giờ vẫn phải xem tóm tắt và xác nhận trước khi tạo Order.

Giữ cấu hình Gemini đã hoạt động trên server. Với localhost, Compose hiện có
`environment` ghi đè `env_file`: chỉ đặt khóa trong `backend/.env` có thể chưa đủ.
Dùng `--env-file backend/.env` ở lệnh Compose để cung cấp cả biến nội suy khóa/model.
Không commit khóa API vào Git và không thay chuỗi kết nối database cho bản sửa này.

Sau khi tích hợp bản sửa, chạy tại gốc repo trên từng máy cần cập nhật:

```bash
git pull
docker compose up -d --build --no-deps --force-recreate backend
```

Nếu Gemini chỉ được cấu hình trong `backend/.env` và container đang nhận khóa rỗng,
thay lệnh Docker phía trên bằng:

```bash
docker compose --env-file backend/.env up -d --build --no-deps --force-recreate backend
```

Nếu server còn dùng file `.env` ở gốc để cấu hình database/cổng riêng, giữ file
triển khai đó bằng `--env-file .env --env-file backend/.env` theo đúng thứ tự.

Lệnh này build/tạo lại riêng backend và nhận lại biến môi trường; giữ database,
Redis và ảnh upload. Không cần cài thư viện frontend, migration mới hoặc `down -v`
cho bản sửa này. Server ở địa chỉ IP và localhost là hai môi trường độc lập:
chạy lệnh ở localhost không cập nhật server. Chỉ pull `master` sau khi PR bản sửa
đã được merge; trước đó dùng nhánh `feature/chatbot-ai` khi kiểm thử riêng.
