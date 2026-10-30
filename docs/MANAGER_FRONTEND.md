# Giao diện quản lý Canteen A2

Nguồn nghiệp vụ: toàn bộ 6 chương `Quy_Trinh_Nghiep_Vu.md`, đối chiếu các mục 3, 4, 5.1, 5.3, 5.4 của `API_DOCUMENTATION.md` và API thực tế.

## Phạm vi và quyền

Một trang đăng nhập chung `/DANGNHAP.html`. Tài khoản `manager` đến `/quan-ly`; các tuyến con được bảo vệ đúng vai trò. Khu vực quản lý chỉ có tổng quan, đơn hàng, thực đơn, báo cáo, đối soát ca và đánh giá món.

Không mở quản trị người dùng, blacklist thủ công, danh mục địa điểm, cấu hình hệ thống hay phân xử khiếu nại cho quản lý. Sự cố bỏ đơn sử dụng API nghiệp vụ của đơn hàng, không gọi API quản trị blacklist.

## Đối chiếu chức năng

| Trang | Nghiệp vụ | Cách thực hiện |
| --- | --- | --- |
| `/quan-ly` | §2.3.4, UC22, BR-25 | Doanh thu gốc và tổng COD theo hôm nay/7/30 ngày; đơn đang phục vụ, thực đơn, ca chưa chốt; không dùng số giả khi lỗi API. |
| `/quan-ly/don` | UC11, UC17–19; BR-15–22 | Lọc, tìm kiếm, lịch sử; tự cập nhật 5 phút khi tab đang mở; tiếp nhận/từ chối có lý do; hoàn tất chế biến theo loại đơn. |
| Bàn giao và sự cố | BR-18, BR-20–22; EX-17–19 | Nhập chuỗi 4 số do khách đọc, xác nhận đã thu đủ COD; backend kiểm mã và ghi nhận tiền. Không liên lạc được phải xác nhận đã chờ 5–10 phút. Mang về quầy vẫn thu đủ phí ship. Quá hạn giữ món chặn bàn giao. |
| Đơn hẹn giờ | §3.3, BR-11, BR-16 | Thời hạn xác nhận tính từ lúc tạo, không tính từ lịch hẹn; hiển thị giờ hẹn và nhắc chuẩn bị trước 20 phút. |
| `/quan-ly/mon` và thêm/sửa | UC16, UC21; BR-04–06, BR-12 | Theo phạm vi hiện tại người dùng yêu cầu: thêm/sửa nhiều danh mục, hình ảnh, mô tả, giá gốc; tải ảnh hoặc dùng URL; chỉ cập nhật Còn món/Hết món, không triển khai ẩn/hiện hoặc xóa món. |
| `/quan-ly/bao-cao` | UC22, BR-25 | Hôm nay/7/30/90 ngày hoặc khoảng ngày tối đa 366 ngày; doanh thu do backend tính theo thời điểm bàn giao và giờ Việt Nam, tách giá gốc/phụ phí/ship. |
| `/quan-ly/ca` | UC20, BR-25, EX-20 | So sánh tiền mặt và QR riêng, không che chênh lệch từng kênh khi tổng bằng 0. Yêu cầu giải trình; kiểm tra trước khi duyệt; ca đã chốt không chốt lại. |
| `/quan-ly/danh-gia` | §2.3.4, UC14 | Xem số sao và bình luận theo món trên thực đơn; quản lý không phân xử khiếu nại. |

Theo đặc tả API §5.3.2, nộp số liệu ca (`POST /shifts/submit`) dành riêng cho `staff`; quản lý thực hiện duyệt ca, không hiển thị nút nộp ca nhân viên.

## Tích hợp bổ sung

Frontend dùng các API đã có: `GET /api/v1/dishes` để tải danh sách món (có phân trang) và `PATCH /api/v1/dishes/<id>/availability` để cập nhật Còn món/Hết món. Theo yêu cầu cập nhật, phần backend bổ sung đã được hoàn tác; không thêm endpoint mới. Cơ sở dữ liệu hiện tại có một đơn vị phục vụ Canteen A2.

Proxy `/uploads` chuyển đến backend để ảnh tải lên hiển thị được qua frontend Docker. Không đổi công thức giá hay chỉnh sửa giá chốt trong đơn.

Các mốc tự chuyển trạng thái và chế tài blacklist được backend quyết định; frontend chỉ cảnh báo/chặn thao tác không phù hợp. API hiện đồng bộ quá hạn khi có truy cập, không có tác vụ nền/thông báo chủ động khi trình duyệt đóng.

## Kiểm tra

- Frontend: `npm run build`, `npx tsc --noEmit`, `npm run test:auth`, `npm run test:manager`.
- Kiểm tra trình duyệt: đăng nhập chung, menu đúng quyền, tổng quan, lọc/lịch sử đơn, biểu mẫu bàn giao, thực đơn, nhiều danh mục và trạng thái còn/hết món, khoảng báo cáo, đối soát ca, đánh giá; desktop và mobile.

Khi API trả 429, tự cập nhật tạm dừng cho đến khi người dùng thử Làm mới thành công. Các lượt đọc danh sách đang chạy đồng thời được gộp để tránh gọi trùng; dữ liệu bảo vệ được tách theo phiên đăng nhập. Các provider giỏ hàng/thực đơn/lịch sử khách hàng chỉ chạy trong khu vực khách hàng, không gọi thừa từ trang nhân viên/quản lý/admin. Backend giữ nguyên.
