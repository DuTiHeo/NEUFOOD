# Khung thời gian đặt đơn — quyết định 08/11/2026

Tài liệu này ghi nhận quyết định sau cùng của người dùng, thay phần yêu cầu ban đầu cấm tạo đơn hẹn ngoài giờ. Canteen A2, giờ Việt Nam UTC+7, thời gian máy chủ.

- Đặt ngay: chỉ từ07:30:00 đến đúng18:30:00. Sau18:30:00, kể cả18:30:00.000001, không nhận đơn đặt ngay. Làm xong sớm giao sớm, không chờ30 phút.
- Hẹn giờ: được tạo bất kỳ lúc nào, kể cả22:00 để nhận09:00 hôm sau. Giờ nhận phải từ07:30:00 đến đúng19:00:00 và cách lúc tạo ít nhất30 phút (hoặc cấu hình cao hơn). Cho phép hôm nay và7 ngày tiếp theo theo ngày lịch Việt Nam. Ví dụ08/11 được hẹn đến19:00 ngày15/11; không tính bằng168 giờ.
- Tester miễn khung giờ tạo/nhận, vẫn giữ thời gian đặt trước và giới hạn7 ngày, một đơn hoạt động, tối đa10 phần cùng món, tổng COD500k gồm ship/phần thêm, xác thực/Blacklist/món/địa điểm. Không tự nhận đơn/thanh toán/bàn giao.
- Không thêm tác vụ hủy/đóng đơn khi đến18:30 hoặc19:00. Đơn đã nhận vẫn xử lý/đối soát; SLA duyệt10 phút và các quy tắc giữ món tiếp tục áp dụng, kể cả đơn hẹn xa ngày.

## Cấu hình và API

Admin dùng giao diện cấu hình hiện có hoặc API Settings để chỉnh:

| Khóa | Mặc định | Ý nghĩa |
|---|---|---|
| canteen_open_time |07:30|Bắt đầu nhận đặt ngay/phục vụ|
| canteen_order_cutoff_time |18:30|Ngừng tạo đơn đặt ngay|
| canteen_close_time |19:00|Giờ nhận hẹn cuối cùng|
| min_preorder_lead_minutes |30|Tối thiểu30, chỉ áp dụng hẹn giờ|

Bắt buộc mở cửa < ngừng nhận đặt ngay <= kết thúc phục vụ. Không cấu hình ca qua đêm. Giờ HH:MM hiểu là mốc HH:MM:00. Cấu hình mới kiểm tra các yêu cầu mới; không thay giờ hẹn/tiền hay hủy đơn đã có.

`GET /api/v1/orders/policy` yêu cầu customer đăng nhập, trả envelope hiện hành với data:

```json
{"server_now":"2026-11-08T15:00:00+00:00","open_time":"07:30","order_cutoff_time":"18:30","close_time":"19:00","min_lead_minutes":30,"max_days":7,"exempt_hours":false}
```

Không cache response. Checkout dùng đồng hồ đồng bộ máy chủ, không lấy giờ thiết bị làm căn cứ; nhập datetime theo giờ Việt Nam, gửi ISO8601+07:00/UTC. Backend kiểm tra lại sau khi khóa tài khoản, cả preview/xác nhận chatbot đều gọi cùng Orders. Quyền ngoại lệ lấy từ database mỗi lần, không từ JWT/email/body.

POST Orders giữ nguyên contract. Lỗi400: `ORDER_OUTSIDE_HOURS` cho đặt ngay ngoài giờ, `SCHEDULE_OUTSIDE_HOURS` cho giờ hẹn ngoài phục vụ, `SCHEDULE_DATE_RANGE` cho ngoài7 ngày, `EX-08` cho thiếu/chưa đủ thời gian hẹn hoặc gửi giờ hẹn cho đơn đặt ngay. Cấu hình giờ sai trả503 `ORDER_HOURS_CONFIG`. Không tạo đơn, giỏ/nháp được giữ để sửa hoặc chọn hẹn giờ. Các lỗi khác vẫn như trước.

## Nâng cấp và quyền tester

Chạy `database/migrations/003_ordering_hours.sql` trên database đang có. Migration chỉ thêm cột `users.ordering_hours_exempt` mặc định false, thêm khóa cutoff, đổi giá trị mặc định cũ06:30/19:30 sang07:30/19:00 (giữ giờ tùy chỉnh khác). Không xóa người dùng/đơn. Database mới đã có cột/cấu hình trong init/sample. Sau đó khởi động lại backend, xóa riêng cache `neufood:settings:all` và `neufood:chat:knowledge_context`; không flush Redis.

Người có quyền vận hành máy chủ chạy tại thư mục backend:

```sh
python manage_order_tester.py grant --create
python manage_order_tester.py revoke
python manage_order_tester.py grant
```

Mặc định email `tester@neufood.com`. `--create` hỏi mật khẩu qua nhập ẩn và chỉ tạo khi chưa có; không đổi mật khẩu tài khoản đã tồn tại. Dùng mật khẩu kiểm thử đã thống nhất ngoài Git. Có thể chỉ định `--email` cho tài khoản customer đã có. Không có nút Admin mới; đăng ký/cập nhật hồ sơ không nhận cờ quyền. Thu hồi có hiệu lực tại yêu cầu kế tiếp không cần đăng nhập lại. Đổi email không làm mất/tự cấp quyền. Tài khoản mới cần bổ sung số điện thoại hợp lệ khi đặt đơn.

## Kiểm thử

Backend: TEST_DATABASE_URL/DATABASE_URL phải cùng trỏ database riêng hậu tố `_orders_test`; chạy unittest `test_ordering_hours.py`, và hồi quy Orders/Chat/Extra Portions. Fixture hồi quy dùng quyền tester để các kiểm thử không phụ thuộc giờ chạy; suite khung giờ chủ động tắt ngoại lệ và điều khiển đồng hồ để kiểm tra giờ thật. Không chạy truncate trên database ứng dụng.

Frontend: `node --test scripts/ordering-time.test.mjs`, `npx tsc --noEmit`, `npm run build`. Kiểm tra checkout với timezone thiết bị khác Việt Nam, đặt ngay ngoài giờ, chọn hẹn ngày mai và+7/+8 ngày, tester; không tạo đơn thật để thử biên thời gian.
