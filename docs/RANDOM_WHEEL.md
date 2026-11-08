# Vòng quay món ăn

Trang `/RANDOM.html` dùng API công khai hiện có, cùng nguồn dữ liệu với menu:
`GET /api/v1/dishes/categories` và `GET /api/v1/dishes?page=1&limit=100`.
Tải tiếp các trang nếu thực đơn nhiều hơn 100 món. Chỉ quay món còn phục vụ,
đang kinh doanh và chưa bị xóa; không còn danh sách tên/ảnh cố định riêng.

Nút **Đặt món này ngay** mở `/mon/<id>` của chính món vừa quay, bao gồm combo.
Khách chọn phần thêm và thêm vào giỏ tại trang chi tiết như luồng thông thường.
Vòng quay không sửa giỏ hàng hoặc tách combo thành các món con.

Tên, ảnh và nhóm món lấy từ API; ảnh lỗi dùng `/dish-placeholder.svg`.
Trong lúc tải, khi thực đơn trống hoặc API lỗi, nút quay bị khóa và có thông báo.
Tải lại trang để lấy thực đơn hoặc thử lại khi kết nối phục hồi.

Không cần migration, thay cấu hình `.env` hoặc xóa database cho thay đổi này.
Các cập nhật món ăn được thực hiện qua chức năng quản lý món hiện có.

Kiểm tra: từ thư mục `frontend`, chạy `node --test scripts/random-menu.test.mjs`
và `npm run build`. Kiểm tra trình duyệt: quay một món và một combo, bấm nút
đặt món, đối chiếu URL chi tiết và bảo đảm giỏ hàng chưa tự tăng số lượng.
