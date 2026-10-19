# Kết quả Postman — Thành viên 3

Ngày kiểm thử: 2026-10-19 (Asia/Saigon).

Đã đọc từ Phần 2, áp dụng đúng ba nhóm kịch bản Thành viên 3 ở mục 2.4 của `docs/TESTING_AND_DATABASE_GUIDE.md`. Đăng nhập chỉ để thiết lập JWT, không chạy các ca kiểm thử của thành viên khác.

## Kết quả quan sát trực tiếp trong Postman Desktop

- Collection: **NEUFood - Thành viên 3 - Kiểm thử theo Phần 2**.
- Environment: **NEUFood Local - Member 3 isolated**.
- Collection Runner: 1 iteration, 10 request, **32 passed / 0 failed / 0 skipped / 0 errors**.
- Thời gian chạy hiển thị: **5s 235ms**, trung bình **317ms/request**. Đây là một lần chạy chức năng, không phải benchmark tải.

| Kịch bản | Kết quả thực tế | Đánh giá |
| --- | --- | --- |
| Khách blacklist tạo COD | `403`, mã `EX-10`, không tạo đơn | Đạt |
| Đặt 12 phần/món | `422`, lỗi tại `quantity` | Đạt |
| COD 545.000đ (9 phần × 60.000đ + 5.000đ ship) | `400 EX-11`, không bị chặn nhầm bởi đơn hoạt động | Đạt |
| Bàn giao `NF2610159921` với mã sai `0000` | `400 EX-17`; đọc lại vẫn `DANG_GIAO`, `chua_thanh_toan`, chưa có `delivered_at` | Đạt |
| Bàn giao với mã đúng `9921` | `200`, `DA_GIAO`, `da_thanh_toan`, giữ tổng 75.000đ | Đạt |
| Đọc lại sau bàn giao | Trạng thái và thanh toán đã được lưu đúng | Đạt |

## Đối chiếu PostgreSQL và môi trường

API thử riêng: `http://localhost:5001/api/v1`, container `neufood_postman_member3`, database `neufood_postman_member3_orders_test`. Backend cổng 5000 và database ứng dụng không được dùng để thực hiện các request thử.

Fixture riêng gồm 4 tài khoản giả dùng email/mật khẩu mẫu trong tài liệu, 2 món, 1 địa điểm và 1 đơn đang giao. Dùng khách `thanhhuong@neu.edu.vn` không có đơn hoạt động để kiểm thử hạn mức, tránh `EX-09` che mất `EX-11`. Đơn bàn giao thuộc khách `sinhvien@neu.edu.vn`. Không cần sửa hay reset các tài khoản/đơn mẫu trong database ứng dụng.

Đọc database sau lần chạy xác nhận:

- Chỉ có **1 đơn fixture ban đầu**, các request tạo đơn bị chặn không sinh thêm đơn.
- `NF2610159921`: suffix `9921`, `DA_GIAO`, `da_thanh_toan`, tổng `75000.00`, `staff_id = 3`.
- Có `delivered_at` và `auto_complete_at`; tài khoản fixture blacklist vẫn giữ blacklist.

## Các file đã lưu

- [Collection](member-3.postman_collection.json): 10 request với test script tự kiểm tra response và tự lưu JWT sau đăng nhập.
- [Environment](member-3.postman_environment.json): cổng 5001; giá trị token xuất ra để trống, không lưu JWT chạy thực tế vào repo.

Collection/environment đã nhập vào Postman; màn hình Run results được giữ để xem lại. Môi trường thử riêng còn chạy. Không bấm Rerun trên nguyên dữ liệu sau bàn giao thành công: cần khôi phục **fixture trong database thử riêng** về `DANG_GIAO`/chưa thanh toán và xóa các mốc giao/hoàn tất trước, vì các bước kiểm tra mã sai đòi hỏi trạng thái ban đầu. Không reset database ứng dụng.

Phạm vi lần này chỉ là các kịch bản Thành viên 3 được liệt kê trong hướng dẫn, chưa chạy toàn bộ 14 trạng thái hoặc mọi UC của Thành viên 3 qua Postman. Không sửa code ứng dụng, chưa commit/push các file kiểm thử.
