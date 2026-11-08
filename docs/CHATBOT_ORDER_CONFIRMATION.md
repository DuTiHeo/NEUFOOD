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
