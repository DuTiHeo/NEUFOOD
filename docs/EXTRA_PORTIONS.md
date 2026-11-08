# Phần ăn thêm

Khách chọn phần thêm tại `/mon/:dishId`. Trang giỏ hàng/thanh toán chỉ hiển thị cấu hình đã chọn. Mỗi loại tối đa một lần trên mỗi suất; cấu hình hoặc ghi chú khác nhau tạo dòng giỏ hàng riêng. Giá chỉ 5.000đ hoặc 10.000đ; định lượng thức ăn do căn tin quyết định. Đồ uống thêm 500ml giá 10.000đ; trân châu, miếng đào, xí muội giá 5.000đ. Pepsi/Coca-Cola không có phần thêm.

## Dữ liệu và API

`GET /api/v1/dishes` và chi tiết món trả `portion_groups`: danh sách `{id,label,choices:[{id,name,is_available,addons:[{id,name,price,is_available}]}]}`. Mỗi group là một suất/thành phần bên trong món. Chỉ dùng cấu hình gắn trực tiếp vào món, không suy ra từ danh mục. Cấu hình khởi tạo cho 65 món nằm trong `database/extra_portions.sql` (63 món có lựa chọn).

Mỗi item gửi Orders có thêm:

```json
{
  "dish_id": "banh-mi",
  "quantity": 1,
  "note": "Không ớt",
  "expected_unit_price": 30000,
  "portions": [{"slot_id":"main","choice_id":"banh-mi","addon_ids":["banh-mi-3"]}]
}
```

`expected_unit_price` là giá một món đã cộng tất cả phần thêm, không nhân số lượng. Checkout mới luôn gửi giá này kể cả không thêm. Giá khác hiện tại trả `PRICE_CHANGED` (409), khách cần kiểm tra lại; lựa chọn trùng, sai suất, sai món chính, hết hàng hoặc giá ngoài hai mức bị từ chối. Request cũ không có phần thêm vẫn tương thích. Không cho đặt phần thêm tính tiền qua chatbot trong phiên bản này; chatbot hướng khách tới chi tiết món.

Orders lưu `portions` snapshot gồm `slot_id`, `slot_name`, `choice_id`, `choice_name`, `addons:[{id,name,price}]`. Lịch sử/bếp dùng snapshot, không tra lại cấu hình hiện tại. Các lựa chọn món chính được lưu kể cả không thêm gì.

## Combo và tiền

Combo tính phần thêm theo từng suất bên trong. Combo 3 Người chọn cơm ở cả ba suất cộng 15.000đ; mua hai combo cùng cấu hình nhân đúng hai lần. Cấu hình riêng cho mỗi combo phải thêm thành hai dòng. Combo 2 Người có hai suất chính, mỗi suất độc lập chọn cơm tấm hoặc bún chả (mặc định cơm tấm, giao diện hiển thị rõ). Các phần ăn/uống chung có group riêng, đồ uống lon không có addon. Bản khởi tạo dùng các thành phần trong mô tả combo hiện tại; không thêm giao diện quản lý cấu hình.

Giới hạn 10 áp dụng tổng số món cùng `dish_id` trên mọi dòng. Trần COD 500.000đ bao gồm phần thêm và phí giao. Toàn bộ tiền thêm thuộc căn tin: tăng cả `unit_price` và `base_price` bằng tiền thêm, giữ nguyên phí hệ thống của món gốc. Ví dụ bánh mì 25k + pate 5k và bánh mì thường 25k, giao 5k: tổng 60k, căn tin 45k, phí hệ thống 10k, ship 5k.

## Nâng cấp và kiểm thử

Database đang có dữ liệu: chạy `database/migrations/002_extra_portions.sql` bằng psql. Migration chỉ thêm cột và nạp cấu hình cho món chưa có cấu hình; không xóa đơn/người dùng. Khởi tạo mới qua compose chạy init và sample; sample đã chứa cấu hình phần thêm. Sau migration xóa riêng cache `neufood:dishes:*` hoặc đợi TTL 300 giây; không flush Redis/session. Giữ backend mới trước khi dùng frontend mới. Không rollback bằng cách xóa snapshot khi đã có đơn.

Kiểm thử tích hợp: đặt `TEST_DATABASE_URL` tới database PostgreSQL riêng có hậu tố `_orders_test`, chạy `python -m unittest discover -s tests -p test_extra_portions.py -v` tại `backend`. Suite tự thay dữ liệu chỉ trong database kiểm thử và từ chối database không đúng hậu tố. Bao phủ dữ liệu 65 món, tiền/báo cáo, snapshot, combo, lựa chọn không hợp lệ, giá thay đổi, giới hạn COD/số lượng, caller cũ và đặt đồng thời.

Frontend: tại `frontend`, chạy `node --test scripts/extra-portions.test.mjs`, `npx tsc --noEmit` và `npm run build`. Kiểm tra giỏ tách/gộp cấu hình, chuyển giỏ cũ, đổi giá và combo. Khách cần quay lại chi tiết món để chọn cấu hình khác; checkout chỉ hiển thị. Không cho thêm món khi thực đơn hoặc cấu hình lựa chọn chưa tải xong.

