# Ưu đãi số lượng và cọc mô phỏng

Quyết định08/11/2026 thay quy định cũ trần COD500.000đ/cấm giảm giá trong tài liệu trước đây. Không tích hợp ngân hàng, không chuyển/hoàn tiền thật. Giữ giờ/ngày nghỉ, quyền, Blacklist, một đơn hoạt động và tối đa10 phần cùng món.

## Suất và tiền

Dish.eligible_servings là số suất chính trên mỗi món/combo. Ánh xạ65 món ở database/bulk_servings.sql, nạp cho DB mới trong sample_data; không suy runtime theo tên/category. Món chính trong danh sách=1; đồ uống/ăn vặt/phần thêm=0. Combo2 Người=2, Combo3 Người=3, Combo4–5 Người=4 (hai bún đậu+hai bánh mì), Combo cơm gà/trà đào=1, Combo ăn nhẹ tối=5 (năm bánh mì, bánh bao/bánh tráng là ăn vặt). Nhân đúng số combo mua. Manager chỉnh số suất ở form/API món; Staff không được sửa. Đơn cũ dùng snapshot, không đếm lại.

| Suất đủ điều kiện | Giảm tiền hàng | Ship delivery |
|---|---|---|
|0–4|0%|Cấu hình, mặc định5.000đ|
|5–9|0%|0đ|
|10–19|6%|0đ|
|20–29|8%|0đ|
|30 trở lên|12%|0đ|

Một mức cao nhất trên toàn bộ tiền hàng gồm đồ uống/phần thêm, không gồm ship. Pickup luôn0đ ship. Giảm làm tròn HALF_UP đến đồng:6.001,5đ→6.002đ. Tổng=tiền hàng−giảm+ship thực thu. Giảm do căn tin chịu; giữ unit_price/base_price/item subtotal gốc để bảo toàn phí hệ thống. Doanh thu căn tin=tổng base_price×qty−discount_amount; phí hệ thống=(unit_price−base_price)×qty. Top món là doanh thu niêm yết trước giảm.

Tổng sau ưu đãi/ship từ500.000đ (gồm đúng ngưỡng) cần cọc50% mô phỏng làm tròn lên tới đồng; COD=tổng−cọc. Ví dụ10 suất/600k: giảm36k, freeship, tổng564k, cọc282k, COD282k. Tổng500.001đ: cọc250.001đ, COD250.000đ. Bỏ cap qua max_cod_amount; khóa cũ bị xóa và không được cập nhật lại. Vẫn kiểm tra giới hạn kỹ thuật NUMERIC(12,2) để tránh tràn cột.

## API quote và tạo đơn

POST /api/v1/orders/quote yêu cầu customer đăng nhập, cùng body Orders. Validate toàn bộ bằng savepoint rồi rollback: chưa có đơn thật/SLA/tiền thu. Trả envelope preview với bulk_pricing và deposit_token nếu cần cọc; ID preview không phải đơn thật.

Snapshot bulk_pricing: eligible_servings, discount_rate, discount_amount, shipping_fee, total_amount, deposit_amount, cod_due, deposit_status. Tiền trong JSON là chuỗi decimal; trường tiền cũ vẫn là number. cod_due cấp order là tiền COD phải thu khi bàn giao; đơn cũ không snapshot dùng total_amount.

POST Orders gửi expected_pricing nguyên snapshot quote. Đơn lớn cần deposit_token sau khi khách xác nhận mô phỏng. JWT15 phút purpose=deposit_quote ràng buộc user/nội dung đã giải quyết/giá/ưu đãi; không dùng làm access token. Đổi món, số lượng, ghi chú, người nhận, địa điểm, lịch hẹn, phương thức COD hay giá cần quote mới. Unique deposit_reference và khóa customer chống gửi đồng thời/replay, kể cả sau khi đơn kết thúc. Request cũ dưới ngưỡng vẫn tương thích và tính ưu đãi ở server. Chỉ POST thành công mới tạo CHO_XAC_NHAN và bắt đầu10 phút duyệt.

Lỗi409: PRICE_CHANGED khi giá/expected_pricing đổi; DEPOSIT_CONFIRMATION_REQUIRED khi thiếu/sai/hết hạn/wrong-user token hoặc nội dung đổi; DEPOSIT_ALREADY_USED khi token đã dùng. Giỏ giữ nguyên khi lỗi. Không nhận tổng tiền hoặc trạng thái thanh toán do client tự đặt.

Chatbot cùng báo giá. Đơn cần cọc trả ORDER_CHECKOUT_REQUIRED và chuyển checkout bằng nút; nếu có giỏ cũ hỏi trước khi thay. Mang món/ghi chú/thông tin nhận trong session theo owner, dùng một lần; checkout vẫn quote mới và yêu cầu xác nhận cọc. Giá đổi từ dưới lên trên ngưỡng khi xác nhận chat cũng bị backend chặn, không bỏ qua cọc.

## UI, bàn giao và kế toán

Chi tiết món có chữ nhỏ in nghiêng đúng nội dung ưu đãi. Giỏ/menu sidebar báo số suất, giảm, phí và tổng dự kiến giao; checkout tính lại theo delivery/pickup. Cọc có thông báo in nghiêng nguyên văn đã chốt. Nút Đặt cọc mở native dialog có focus/ESC, QR SVG watermark MÔ PHỎNG không chứa payload chuyển khoản. MB Bank/0866451723 là thông tin giả lập. Đóng dialog không tạo đơn; chỉ xác nhận mô phỏng mới gửi. Input đổi bỏ xác nhận cũ. 50% còn lại hiển thị số tiền COD sau làm tròn.

Staff/Manager phải gọi khách, gửi phone_confirmed:true khi accept/process hoặc status DANG_CHUAN_BI cho đơn có cọc; thiếu trả400 PHONE_CONFIRMATION_REQUIRED. Chưa thu đủ tiền/tiếp nhận tự động sau cọc. Bàn giao mã4 số, thu cod_due thay vì toàn đơn. Hủy lúc chờ/từ chối/quá10 phút/bỏ đơn làm deposit_status hiển thị cancelled từ trạng thái đơn; không có hoàn tiền thật.

Đối soát ca chỉ cộng cod_due vào expected_cash/expected_qr. Báo cáo: gross_revenue=giá trị đơn đã bàn giao sau ưu đãi (gồm phần cọc mô phỏng); discount_total=tiền giảm; simulated_deposit_total không phải tiền thực thu; actual_cod_collected=COD thực thu. Cơ cấu căn tin/phí/ship là phân bổ giá trị đơn; UI tách riêng số thu thật và cọc mô phỏng. Đơn cũ không snapshot không đổi giá/trạng thái, tính như trước.

## Nâng cấp và kiểm thử

DB hiện có: chạy database/migrations/004_bulk_discounts.sql trước backend mới. Thêm cột snapshot/reference/count, bỏ CHECK500k (giữ không âm), bỏ cấu hình cũ, nạp65 ánh xạ; không xóa đơn/người dùng. Chạy seed/migration trước khi tùy chỉnh số suất; chạy lại seed áp lại danh sách chuẩn. DB mới init+sample đã đủ. Xóa riêng cache neufood:dishes:*, neufood:settings:all, neufood:chat:knowledge_context; không flush Redis/down -v.

Backend test_bulk_discounts.py và hồi quy với TEST_DATABASE_URL/DATABASE_URL riêng hậu tố _orders_test, không truncate DB ứng dụng. Frontend node --test scripts/bulk-pricing.test.mjs, TypeScript/build; browser dùng quote thật nhưng chặn POST tạo đơn. Không thử QR trong ứng dụng ngân hàng.
