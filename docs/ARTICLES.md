# Tin tức - sự kiện và quản lý bài viết

## Phạm vi đã chốt ngày 08/11/2026

Trang `/bai-viet` có tên **Tin tức - sự kiện**, nằm trên navigation desktop và thanh điều hướng mobile. Trang tổng hợp bốn loại: tuyển dụng, câu chuyện NEUFood, thông báo Canteen, tin tức và hoạt động. Chọn bài tuyển dụng chính sẽ đến `/recruit`; bài câu chuyện chính đến `/story`; bài khác dùng `/bai-viet/:id`. Các đường dẫn cũ được giữ nguyên.

Manager có mục **Quản lý bài viết** ở `/quan-ly/bai-viet`. Manager tạo bài, lưu bản chỉnh sửa, xem trước, xuất bản cập nhật, ẩn và đăng lại. Admin có `/admin/bai-viet` để xem/ẩn bài vi phạm, phải ghi lý do; không được soạn hoặc xuất bản thay Manager. Lệnh chặn Admin chỉ Admin được gỡ; gỡ chặn không tự xuất bản.

Dữ liệu thuộc Canteen A2 duy nhất theo kiến trúc hiện tại. Mọi thao tác quản trị kiểm tra tài khoản đang hoạt động và vai trò hiện tại trong DB, không chỉ tin vai trò trên JWT cũ. Khách/customer/staff không truy cập bản nháp hoặc nhật ký.

## Nháp, công khai và xuất bản

`articles.draft` giữ bản chỉnh sửa; `articles.published` giữ snapshot công khai. Lưu nháp của bài đang xuất bản không đổi nội dung khách đang đọc. Chỉ nút Xuất bản/Xuất bản cập nhật mới thay snapshot. Bài nháp được phép chưa đủ nội dung; xuất bản cần tiêu đề và nội dung có chữ.

Trạng thái gồm draft, published, hidden. Bài ẩn/nháp trả404 qua API công khai, không xuất hiện ở danh sách. Sửa tiêu đề không đổi ID/đường dẫn. Không có xóa cứng, hẹn lịch xuất bản hay thông báo tự động trong đợt này.

Mỗi loại recruitment/story chỉ có một bài published. Xuất bản bài chính mới ẩn bài trước trong cùng transaction. Khóa advisory theo loại cộng unique index PostgreSQL ngăn hai bài chính hoạt động cùng lúc. Dữ liệu cũ không bị xóa. Cập nhật dùng khóa dòng và expected_version;409 nếu một người khác đã thay đổi. Nhật ký lưu người thực hiện, thời gian, nội dung trước/sau, xuất bản, ẩn, thay bài chính và thay trạng thái nhận hồ sơ.

## Soạn thảo và nội dung an toàn

Trình soạn thảo Tiptap3 hỗ trợ đoạn văn, H2/H3, in đậm/in nghiêng, danh sách, trích dẫn, ảnh và liên kết. Tiêu đề bài là H1 riêng. Lưu tài liệu JSON, không lưu/chạy HTML tùy ý. Backend giới hạn loại node/mark/attribute, độ sâu12, số node2000 và tổng tài liệu150.000 ký tự. Không nhận script, sự kiện HTML, liên kết javascript/data hoặc thông tin tài khoản trong URL. React render nội dung thành node/text, không dùng dangerouslySetInnerHTML; bản xem trước cũng kiểm tra URL và escape chữ.

Ảnh đại diện hoặc ảnh trong bài dùng URLHTTP/HTTPS hay `/uploads/...`. Upload chỉ Manager, tối đa5MB, kiểm tra đuôi và magic bytes PNG/JPG/GIF/WEBP, không nhận SVG/HTML giả ảnh. File ảnh nằm trong volume uploads hiện có. Liên kết ra ngoài dùng noopener/noreferrer. Không tải URL ảnh từ máy chủ, nên không tạo luồng fetch nội bộ theo URL do người viết cung cấp.

## Tuyển dụng và đóng vị trí

Bài tuyển dụng xuất bản phải có đủ mô tả bốn vị trí shipper/packing/customer_support/communications. Tên vị trí, lương25.000đ/giờ, sáng07:00–12:00/chiều12:00–19:00 và tối thiểu4 buổi/tuần được giữ theo quyết định đã chốt, không sửa qua editor.

Bảng `recruitment_positions` giữ trạng thái mở/đóng riêng. Ẩn bài không tự đóng tuyển dụng hoặc xóa hồ sơ. Manager chọn Dừng/Mở nhận hồ sơ trong Quản lý bài viết. Trạng thái có hiệu lực ngay, ghi nhật ký và bảo vệ bằng phiên bản.

Public form tải bài chính và trạng thái vị trí. Vị trí đóng vẫn có thẻ Đã ngừng nhận hồ sơ, không cho chọn mới. Nếu Manager đóng vị trí khi ứng viên đang điền, POST kiểm tra lại row vị trí bằng khóa đọc trong transaction và trả409 POSITION_CLOSED, không tạo hồ sơ; UI giữ thông tin và tải lại cấu hình. Đóng vị trí dùng khóa ghi, tuần tự với các POST đồng thời. Hồ sơ đã lưu được giữ nguyên. API công khai vẫn giữ min4 ca và chặn trùng MSV như quy định tuyển dụng.

## API `/api/v1/articles`

- GET `?kind=&page=1&limit=12`: chỉ snapshot published, items/total/page/limit.
- GET `/:id`: snapshot public,404 nếu draft/hidden/blocked.
- GET `/featured/story|recruitment`: bài chính hoặc null.
- GET `/recruitment-settings`:4 vị trí, cờ is_open, version, lương/ca/min4 cố định.
- GET/POST `/manage`: Manager list/create; Admin chỉ GET. POST gồm kind và content.
- GET/PUT `/manage/:id`: Manager đọc/lưu nháp; Admin chỉ GET. PUT gồm expected_version và content.
- POST `/manage/:id/publish|hide|release`: expected_version, reason tùy thao tác; release chỉ Admin, Admin hide bắt buộc reason.403 khi Manager cố vượt chặn Admin.
- GET `/manage/:id/history`: Manager/Admin,100 nhật ký gần nhất.
- PATCH `/positions/:position`: Manager, expected_version và is_open boolean.
- POST `/images`: Manager, multipart field file.

Content gồm title≤200, summary≤600, cover_url, bodyJSON và recruitment_roles. Loại bài giữ nguyên sau tạo. JSON/field không hợp lệ422, pagination/kind sai400, thiếu quyền401/403, không tồn tại404, phiên bản thay đổi409. Không cache bản nháp hoặc dữ liệu quản trị.

## Seed, dữ liệu và rollout

Áp dụng `010_articles.sql` trước backend mới. Migration cộng ba bảng articles/article_audit/recruitment_positions, giữ nguyên Users/Orders/employee_profiles/recruitment_applications. Seed idempotent có bốn bài:

1. Câu chuyện của chúng tôi, chuyển từ nội dung `/story` hiện có.
2. Tuyển dụng nhân sự, giữ tiêu đề/nội dung và bốn vị trí đã chốt.
3. Hướng dẫn cách đặt hàng tại hệ thống NEUFood.
4. NEUFOOD gửi lời chúc mừng kỷ niệm70 năm thành lập NEU.

Hai bài mới không dùng dấu –/— theo yêu cầu; có thể dùng dấu `-` thường. Bài hướng dẫn nói rõ bước cọc hiện là mô phỏng, không chuyển tiền thật theo QR mô phỏng. Bài chúc mừng không tự thêm lịch tổ chức/sự kiện hay tuyên bố tài trợ chưa được cung cấp.

`article_sample_data.sql` và block tương ứng trong sample_data đồng bộ. ON CONFLICT DO NOTHING giữ nội dung Manager đã sửa khi seed chạy lại. DB mới dùng init+sample; DB cũ chạy migration một lần. Nếu cần quay lại code cũ, tắt UI/API mới trước, giữ các bảng và nội dung đã nhận; không dùng down -v hoặc drop dữ liệu.

Frontend cần cài package-lock mới cả môi trường host và container có node_modules volume. Chỉ restart frontend sau khi đồng bộ thư viện; không reset database. Hai dependency gián tiếp follow-redirects và postcss-selector-parser được cập nhật bản vá tương thích; npm audit sau cập nhật không còn cảnh báo.

## Kiểm chứng triển khai
11 kiểm thử PostgreSQL bài viết qua: quyền hiện tại/nháp/snapshot/ẩn/lịch sử/phiên bản/đồngthời/bốn vịtrí/đóngtuyển/unsafeURL/cấu trúcJSON/ảnhgiả. 14hồi quy nhân sự và3kiểm thửrender được chạy cùngfrontend regression. Trìnhduyệtlocal đãsoạn bàiUITESTthật,địnhdạngbold/italic/link/image,xemtrước,lưunháp404public,xuấtbản,giữpubliccũkhisửa,xuấtbảncậpnhật,ẩn404;đóng/mởvịtrítácđộngform;4bài seedgiữnguyênđườngdẫnstory/recruit. View390pxnews khôngtràn,cóđiềuhướngmobile. CácbàiUITEST được ghiriêngIDđểdọn,khôngxóanội dungthật.
