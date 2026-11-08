# Bàn giao cập nhật database NEUFood

Bộ này đi cùng code có đủ tính năng khẩu phần ăn, khung giờ, giảm giá/đặt cọc,
tuyển dụng/nhân sự và bài viết. Các PR #25, #26, #22, #24, #23 phải được tích hợp
hoặc dùng đúng nhánh có đủ code. Chỉ pull `master` khi chưa merge PR sẽ chưa có đủ file.
Hướng dẫn này không tự chạy migration lúc khởi động ứng dụng.

## Chọn đúng trường hợp

- **Database mới:** dùng `init_db.sql` và `sample_data.sql` của cùng phiên bản code.
  Docker Compose nạp hai file này khi volume PostgreSQL được khởi tạo lần đầu.
  Không chạy thêm toàn bộ migration sau seed mới.
- **Database đã có:** sao lưu, kiểm tra schema tương ứng `master`, dừng backend,
  chạy các migration còn thiếu theo bảng dưới, kiểm tra rồi khởi động lại.
  Đây không phải bộ nâng cấp một database tùy ý: các bảng nền như `users`,
  `dishes`, `orders`, `order_items`, `system_settings` phải có sẵn và khớp code nền.
- **Muốn giống toàn bộ dữ liệu máy người bàn giao:** cần bản sao lưu database và
  tệp ảnh uploads riêng. Migration không sao chép đơn hàng, người dùng hay những
  chỉnh sửa thủ công qua giao diện. Không đưa backup chứa dữ liệu cá nhân vào Git.

Không dùng `docker compose down -v` để cập nhật: lệnh này xóa cả volume dữ liệu.
`docker compose up -d` trên volume cũ không tự chạy lại các file SQL khởi tạo.

## Thứ tự và tác động của từng file

| Thứ tự | File | Nội dung / lưu ý |
| --- | --- | --- |
| 1 | `001_chat_orders.sql` | Bảng đơn nháp chatbot và thông tin nhận hàng đã lưu. |
| 2 | `20261107_add_shipper_id_to_orders.sql` | Cột shipper phụ trách đơn và chỉ mục; dùng tên file đầy đủ này. |
| 3 | `002_extra_portions.sql` | Cấu hình phần thêm, snapshot đơn; chỉ nạp cấu hình khi đang trống. |
| 4 | `003_ordering_hours.sql` | Quyền tester và cấu hình giờ; chuẩn hóa một số mốc mặc định cũ, thời gian hẹn tối thiểu 30 phút. |
| 5 | `004_bulk_discounts.sql` | Snapshot giảm giá/cọc, bỏ trần 500.000đ; đặt lại số suất của danh mục chuẩn. Phải chạy trước 006. |
| 6 | `005_dish_images.sql` | Cập nhật 15 URL ảnh và tên Bún Bò Huế. Yêu cầu đủ 15 mã món; thiếu sẽ dừng và rollback file này. Ghi đè URL hiện tại của các món đó. |
| 7 | `006_food_drink_servings.sql` | Bổ sung tính suất cho món ăn vặt/đồ uống trước đây bằng 0; giữ số suất combo. |
| 8 | `007_order_quantity_50.sql` | Nâng ràng buộc và cấu hình giới hạn mỗi món lên 50; chạy lại sẽ đặt cấu hình về 50. |
| 9 | `008_recruitment.sql` | Bảng ứng tuyển, nhân viên, lịch tuần và nhật ký; chưa tạo tài khoản nhân viên. |
| 10 | `009_employee_sample_contacts.sql` | Cập nhật tên, SĐT, email, MSV và lịch cho các mã `demo-employee-*` có sẵn; không tạo hồ sơ mới. Có thể ghi đè chỉnh sửa trên hồ sơ mẫu. |
| 11 | `010_articles.sql` | Bảng bài viết, bản nháp/xuất bản, nhật ký và mở/đóng vị trí tuyển; có sẵn 4 bài mẫu, không thay nội dung bài đã tồn tại. |
| 12 | `011_story_hyphens.sql` | Đổi en/em dash thành `-` trong bài câu chuyện; giữ trạng thái xuất bản và lưu nhật ký. |

Repo chưa có bảng theo dõi migration đã chạy. Ghi lại tên file, thời điểm và kết
quả mỗi lần chạy. `IF NOT EXISTS` không có nghĩa là chạy lại không đổi dữ liệu:
004, 005, 007 và 009 có thao tác cập nhật cấu hình/dữ liệu hiện tại.
Không cần nạp lại `extra_portions.sql`, `employee_sample_data.sql` hay toàn bộ
`sample_data.sql` để thay thế việc chạy migration.

## Thao tác trên Windows với Docker Compose

Chạy PowerShell tại gốc repo. Ví dụ dưới dùng container `neufood_database`,
user `neufood_user`, database `neufood_db`; thay theo cấu hình thực tế.
Không đưa mật khẩu vào file hướng dẫn hoặc lịch sử lệnh.

### 1. Sao lưu và đưa bộ file vào container

```powershell
docker exec neufood_database pg_dump -U neufood_user -d neufood_db -Fc -f /tmp/neufood-before-upgrade.dump
if ($LASTEXITCODE -ne 0) { throw 'Sao lưu thất bại; dừng cập nhật.' }
docker cp neufood_database:/tmp/neufood-before-upgrade.dump ../neufood-before-upgrade.dump
if ($LASTEXITCODE -ne 0) { throw 'Chưa lấy được backup ra máy; dừng cập nhật.' }
docker compose stop backend
docker exec neufood_database mkdir -p /tmp/neufood-upgrade
if ($LASTEXITCODE -ne 0) { throw 'Chưa tạo được thư mục SQL trong container.' }
docker cp ./database/. neufood_database:/tmp/neufood-upgrade
if ($LASTEXITCODE -ne 0) { throw 'Chép bộ SQL thất bại; chưa chạy migration.' }
```

Kiểm tra file backup đã có trên máy và giữ ngoài Git. Nên thử khôi phục vào một
database riêng trước khi cập nhật dữ liệu quan trọng. Không chạy nếu bước chép
bộ SQL thất bại.

### 2. Chạy các migration còn thiếu

Nếu database mới chỉ ở schema nền, chưa chạy các migration tính năng phía trên,
có thể dùng file tổng hợp (đây là file dành cho **psql**, không phải trình SQL
editor thông thường):

```powershell
docker exec neufood_database psql -X -U neufood_user -d neufood_db -v ON_ERROR_STOP=1 -f /tmp/neufood-upgrade/upgrade_existing.psql
if ($LASTEXITCODE -ne 0) { throw 'Migration lỗi; chưa khởi động backend. Kiểm tra lỗi và các file đã commit.' }
```

Nếu database đã chạy một phần, **không chạy lại toàn bộ**. Chọn từng file còn
thiếu theo thứ tự bảng. Ví dụ khi đã hoàn thành 001–007 và cột shipper:

```powershell
docker exec neufood_database psql -X -U neufood_user -d neufood_db -v ON_ERROR_STOP=1 -f /tmp/neufood-upgrade/migrations/008_recruitment.sql
if ($LASTEXITCODE -ne 0) { throw 'Migration 008 thất bại.' }
```

Sau đó chạy 009, 010, 011 bằng cùng mẫu lệnh, kiểm tra mã thoát sau mỗi file.
Không tự suy đoán đã chạy chỉ vì thấy một cột hoặc một bảng tồn tại; cần đối chiếu
cả cấu trúc, ràng buộc và cập nhật dữ liệu của file với bản ghi triển khai.

Các file có transaction riêng. Khi lỗi, `ON_ERROR_STOP` dừng các file tiếp theo;
những file đã COMMIT trước đó **không tự rollback**. Sửa nguyên nhân trước khi
tiếp tục, không xóa database và không chạy lại toàn bộ một cách máy móc.

### 3. Hồ sơ nhân viên mẫu (tùy chọn)

Migration 008 tạo bảng, 009 chỉ sửa hồ sơ mẫu đã có. Nếu cần đủ **16 đang làm,
5 đã nghỉ** như bản demo và database chưa có các hồ sơ đó, chạy seed sau 008:

```powershell
docker exec neufood_database psql -X -U neufood_user -d neufood_db -v ON_ERROR_STOP=1 -f /tmp/neufood-upgrade/employee_sample_data.sql
if ($LASTEXITCODE -ne 0) { throw 'Nạp hồ sơ mẫu thất bại.' }
```

Seed hiện tại đã có thông tin liên hệ và lịch mới; không tạo tài khoản đăng nhập.
Không tự nạp hồ sơ giả vào dữ liệu nhân sự thực tế. Các ảnh tải từ máy lên vẫn
cần bàn giao volume `backend_uploads`; URL ảnh trong database không chứa tệp ảnh.

### 4. Kiểm tra và khởi động lại

```powershell
docker exec neufood_database psql -X -U neufood_user -d neufood_db -v ON_ERROR_STOP=1 -c "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('max_dish_quantity_per_order','canteen_open_time','canteen_order_cutoff_time','canteen_close_time');"
docker exec neufood_database psql -X -U neufood_user -d neufood_db -v ON_ERROR_STOP=1 -c "SELECT to_regclass('public.chat_order_drafts'), to_regclass('public.recruitment_applications'), to_regclass('public.employee_profiles'), to_regclass('public.articles');"
```

Đối chiếu số người dùng/đơn hàng trước và sau; kiểm tra số suất món/đồ uống/combo,
giới hạn 50, ảnh món và 4 bài mẫu. Nếu có tùy chỉnh giờ hoặc giới hạn thấp hơn 50,
đối chiếu lại cấu hình mong muốn sau migration. Backend chỉ khởi động lại khi
schema đã khớp code. Xóa các cache liên quan thực đơn, cấu hình và kiến thức
chatbot theo hướng dẫn `docs/BULK_DISCOUNTS.md`; không flush toàn bộ Redis vì còn
dữ liệu phiên và thu hồi token. Sau đó:

```powershell
docker compose up -d --build backend frontend
```

Thử đăng nhập, xem menu/phần thêm, báo giá đơn 5/10/20/30 suất, giới hạn 50,
lịch hẹn Chủ nhật, gửi hồ sơ và truy cập quản lý bài viết. Báo lỗi kèm tên migration
và thông báo lỗi, không gửi `.env` hoặc backup lên kênh công khai.

Nếu cần khôi phục, ưu tiên restore backup bằng `pg_restore` vào database mới,
kiểm tra dữ liệu rồi mới đổi cấu hình kết nối và dùng phiên bản code phù hợp.
Không có down migration tự động cho bộ này.

Tham khảo: [psql PostgreSQL 16](https://www.postgresql.org/docs/16/app-psql.html),
[sao lưu SQL/custom format](https://www.postgresql.org/docs/16/backup-dump.html).
