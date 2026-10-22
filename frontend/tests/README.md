# Kiểm thử frontend Orders

Chạy kiểm thử quy tắc thao tác và thời gian (dùng TypeScript đã có trong devDependencies):

```sh
cd frontend
node --test tests/orders.test.mjs
npm run build
```

Hoặc khi đang dùng Docker:

```sh
docker exec neufood_frontend node --test tests/orders.test.mjs
docker exec neufood_frontend npm run build
```

## Kiểm thử giao diện ngày 19/10/2026

Chạy trên frontend tạm cổng 5174, backend tạm cổng 5002 và database riêng
`neufood_postman_member3_orders_test`. Không tạo đơn thử trong database ứng dụng.

| Ca kiểm thử thủ công | Kết quả |
| --- | --- |
| Khách đăng nhập, thực đơn và chi tiết món lấy từ API | Thành công |
| Tạo delivery một phần 35.000đ | Tổng 40.000đ, phí giao 5.000đ, giỏ chỉ xóa sau khi API tạo thành công |
| Khách hủy đơn chờ xác nhận | Chuyển `DA_HUY_KHACH`, nút hủy biến mất |
| Tạo pickup một phần 35.000đ | Phí giao 0đ, tổng 35.000đ |
| Staff đăng nhập, duyệt và nấu xong pickup | `CHO_XAC_NHAN` → `DANG_CHUAN_BI` → `SAN_SANG_LAY`, có hạn lấy món |
| Bàn giao mã sai `0000` | Hiện lỗi từ backend, đơn vẫn sẵn sàng lấy và chưa thanh toán |
| Bàn giao đúng 4 số cuối | `DA_BAN_GIAO`, `da_thanh_toan`, có giờ bàn giao và hạn tự hoàn tất |
| Khách xác nhận đã nhận | `HOAN_THANH`, có giờ hoàn thành |
| Tăng số lượng ở chi tiết món | Chặn tăng tiếp ở 10 phần |
| Checkout 10 phần × 60.000đ + phí giao | Báo vượt hạn mức COD, không xóa giỏ |
| Khách Blacklist đăng nhập và mở checkout | Hiện cảnh báo khóa COD, nút xác nhận đặt hàng bị vô hiệu hóa |

Đơn delivery hủy: `NF17923696088831499370767`.
Đơn pickup hoàn thành: `NF17923696828909600913779`.

Kiểm thử tự động `orders.test.mjs` kiểm tra toàn bộ trạng thái/hình thức nhận món,
chỉ cho bàn giao đơn chưa thanh toán, điều kiện báo không nghe máy, biên đúng hạn/quá hạn giữ món,
thông báo lỗi backend và hiển thị giờ Việt Nam.

Chưa chạy toàn bộ nhánh sự cố/giờ hẹn/mất mạng bằng trình duyệt. Kiểm tra TypeScript toàn dự án
chưa qua vì các lỗi sẵn có ở các màn hình khác; các file Orders vừa sửa không có chẩn đoán TypeScript.

## Giới hạn backend cần xử lý riêng

`GET /api/v1/orders/<id>` hiện chỉ yêu cầu JWT, chưa kiểm tra quyền sở hữu trong route.
Frontend từ chối hiển thị đơn khác chủ nhưng không thay thế kiểm soát quyền ở server.
Không thay đổi backend trong đợt cập nhật frontend này.
