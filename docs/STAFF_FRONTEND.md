# Giao diện nhân viên Canteen A2

Phạm vi theo §2.3.3, quy trình đơn hẹn trước §3.3, UC16–20, BR-06, BR-15–22, BR-25 và EX-16–20 trong `Quy_Trinh_Nghiep_Vu.md`. Theo yêu cầu hiện tại, chỉ dùng Còn món/Hết món; không làm ẩn/hiện món và không sửa backend.

| Đường dẫn | Chức năng |
| --- | --- |
| `/nhan-vien` | Tổng quan hàng đợi, COD tiền mặt/QR theo tài khoản trong ngày Việt Nam, trạng thái nộp ca, tình trạng thực đơn; tự cập nhật 5 phút khi tab đang mở. |
| `/nhan-vien/don` | Luồng vận hành dùng chung với quản lý, lọc trạng thái/hình thức, tìm đơn và lịch sử, tự cập nhật 5 phút khi tab đang mở. |
| `/nhan-vien/mon` | Tìm/lọc món, xem giá niêm yết và đổi Còn món/Hết món. Không thêm/sửa giá/xóa/ẩn món. |
| `/nhan-vien/ca` | Đối chiếu tiền mặt và sao kê QR, giải trình, xem lại trước khi nộp số liệu, lịch sử ca của tài khoản. |

## Các điều kiện nghiệp vụ

- Đơn hẹn trước vẫn phải tiếp nhận trong thời hạn tính từ lúc đặt; hiển thị giờ hẹn và mốc chuẩn bị trước 20 phút.
- Từ chối đơn phải có lý do; hoàn tất chế biến chuyển sang Đang giao hoặc Sẵn sàng lấy tùy hình thức.
- Bàn giao cần đúng chuỗi 4 chữ số khách cung cấp và xác nhận đã thu đủ COD theo phương thức của đơn. Backend xác minh mã và ghi nhận thanh toán.
- Không liên lạc được cần xác nhận đã gọi/chờ 5–10 phút; món được mang về quầy giữ theo hạn backend. Đơn mang về vẫn giữ cả phí giao hàng. Quá hạn không cho bàn giao.
- Có tùy chọn bật âm báo đơn mới trên trang xử lý đơn. Âm báo cần người dùng bật và trang đang mở; không có thông báo nền khi đóng trình duyệt.
- Ca tính theo tài khoản thực tế bàn giao đơn và ngày Việt Nam, gồm cả tiền món, phụ phí và phí giao hàng.
- Nếu dùng chung tài khoản, số liệu là của cả tài khoản trong ngày, không phân biệt từng người dùng tài khoản.
- Không nộp ca khi chưa tải được số liệu, ngày ca đã thay đổi hoặc ca đã được quản lý chốt. Ca chờ duyệt/cần giải trình được nộp cập nhật.
- Nhập số tiền không âm, tối đa 9.999.999.999,99đ mỗi kênh và tối đa 2 chữ số thập phân; ghi chú tối đa 1.000 ký tự.
- Đối chiếu tiền mặt và QR riêng, yêu cầu giải trình cả khi hai khoản lệch bù trừ làm tổng bằng 0.
- Trước khi xem lại và trước khi gửi, tải lại số liệu ca. Nếu phát sinh bàn giao làm thay đổi số liệu, yêu cầu kiểm tra/xác nhận lại; đổi ngày ca thì dừng gửi và nạp lại ngày mới.
- Nhân viên nộp số liệu, quản lý duyệt chốt ca; không có nút duyệt, phân quyền, cấu hình hay báo cáo doanh thu hệ thống trong khu vực nhân viên.

## API và kiểm tra

Dùng API sẵn có: `GET /orders/admin/all`, `/shifts/my-current-shift`, `/shifts`, `/dishes`, `/dishes/categories`; `PATCH /dishes/<id>/availability`; các API `/orders/<id>/process`, `/status`, `/handover`, `/delivery-issue`; `POST /shifts/submit`.

Đăng nhập qua `/DANGNHAP.html`; vai trò `staff` chuyển đến `/nhan-vien`. Đường dẫn alias `/nhanvien` chuyển về `/nhan-vien`. Các URL của quản lý, admin hoặc khách hàng chuyển về khu vực nhân viên khi tài khoản đang đăng nhập là staff. Không có Xem cửa hàng.

Kiểm tra: `npm run build`, `npx tsc --noEmit`, `npm run test:staff`, `npm run test:manager`, `npm run test:auth`. Kiểm tra API hiện có bằng tài khoản mẫu nhân viên, xác minh lịch sử chỉ chứa ca của tài khoản và API quản trị/báo cáo quản lý trả 403; gửi số tiền âm bị từ chối 422. Không nộp số liệu ca thật trong quá trình kiểm tra.

Khi API trả 429, tự cập nhật tạm dừng cho đến khi người dùng thử Làm mới thành công. Các lượt đọc danh sách đang chạy đồng thời được gộp để tránh gọi trùng; dữ liệu bảo vệ được tách theo phiên đăng nhập. Các provider giỏ hàng/thực đơn/lịch sử khách hàng chỉ chạy trong khu vực khách hàng, không gọi thừa từ trang nhân viên/quản lý/admin. Backend giữ nguyên.
