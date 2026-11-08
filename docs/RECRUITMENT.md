# Quản lý nhân sự và tuyển dụng Canteen A2

## Quyết định08/11/2026
Trang /recruit cho khách chưa đăng nhập nộp hồ sơ thật. Bắt buộc họ tên, email (cho phép email cá nhân), SĐT di động Việt Nam10chữ số, MSV,1trong4vịtrí. Ít nhất4ca duy nhất/tuần, tốiđa12ca sáng07:00–12:00/chiều12:00–19:00 từ thứHai–thứBảy. Cả2ca cùngngày=2buổi;Chủnhật không có. Lịch này chỉ là khả năng làm việc.

Mỗi MSV trim/uppercase chỉ1hồ sơ pending/contacting,không phân biệt vị trí; unique index PostgreSQL chống gửi đồng thời. POST không nhận status/ghi chú nội bộ/user_id. Receipt công khai chỉ id,created_at; không có API công khai đọc hồ sơ. Rate limit5 lần/giờ/IP; thông báo lỗi giữ form,không giả thành công.

Manager mở /quan-ly/nhan-su gồm Nhân viên hiện tại và Hồ sơ ứng tuyển. Chỉ Manager active trong database được thao tác; token mang rolemanager cũ không đủ nếu DB đã đổi role/khóa/xóa. Staff/customer/admin/guest không có quyền. Dự án chỉ CanteenA2, không mở quyền nhiều canteen.

## Tuyển dụng
pending=Chờ xem xét → contacting=Đang xem xét → hired=Chấp nhận hoặc rejected=Từ chối. Không nhảy bước/mở lại terminal; sửa ghi chú cùng trạng thái được phép. Từ chối cần lý do (internal_note),không được xóa lý do khi giữ rejected. Ghi chú chỉManager. Cập nhật khóa dòng và đối chiếu expected_version,409khi dữ liệu thay đổi; nhật ký giữ actor/thờiđiểm/trạngthái/ghi chú.

Sau chấp nhận, nút Tạo hồ sơ nhân viên mở xác nhận thông tin/vịtrí/ngày bắtđầu, MSV khớp ứng viên. source_application_id unique đảm bảo1hồsơ nhân viên/ứng viên kể cả đồng thời. Tạo nhân viên là bước riêng,không tự lấy lịch ứng viên thành lịch phân công. Không tạo tài khoản/đổiUser.role/gửi emailSMS/tínhlương/chấmcông.

## Nhân viên
EmployeeProfile độc lập khỏi User. Các trường: mã,họ tên,email/SĐT/MSV tùy chọn,vịtrí,ngày bắtđầu,lịch tuần,trạngthái,ghi chú.7vịtrí:4tuyển dụng+phụbếp+đầubếp+thungân. Email/MSV không rỗng phải duy nhất trong hồ sơ nhân viên. Mặcđịnh hiểnthị active; lọc on_leave/resigned đểtra cứu. Không xóa cứng.
Manager tạo/xem/sửa hồ sơ/phânca. Mỗi day-shift chỉ1lần,bộlọc tên/email/SĐT,vịtrí,ca,trạngthái; hồsơ ứngtuyển thêm khoảngngàygửi(VN)+phântrang20. Phânca hằngtuần,Mon–Sat,chưa phânca có thểđểtrống; không ápđặt4buổi lên lịch chínhthức. Không thay giờ nhận đơn/đối soát COD.
Chuyển tạmnghỉ/nghỉviệc áp dụngngay và gỡ lịch tuần trong cùng transaction,nhật ký giữ lịch cũ. Không hẹn hiệu lực tươnglai. Hồ sơ hiện chưa liên kết tài khoản; UI ghi rõ,không tạo/yêu cầu/cấp/thu hồi quyềnAdmin. Khi có liên kết trong giaiđoạn sau phải bổ sung bàn giao đơn/COD trước thu hồi quyền; đợt này không có luồng cấp tài khoản.

## API /api/v1/recruitment
- POST /applications public: full_name,email,phone,student_id,position(shipper|packing|customer_support|communications),availability(mon-morning...),intro≤2000.201receipt;400JSON;422validation;409APPLICATION_ALREADY_OPEN.
- GET /applications manager: q,position,shift(morning|afternoon),status,from/to(YYYY-MM-DD Vietnam),page,limit1..100. Envelope items,total,page,limit.
- GET/PATCH /applications/:id manager. PATCH status,internal_note≤2000,expected_version integer≥1.409INVALID_APPLICATION_TRANSITION/APPLICATION_CHANGED;422REJECTION_REASON_REQUIRED.
- POST /applications/:id/employee manager: EmployeeCreate+required start_date+expected_application_version;MSVkhớp.201;409EMPLOYEE_ALREADY_CREATED/APPLICATION_NOT_ACCEPTED/APPLICATION_CHANGED/EMPLOYEE_ALREADY_EXISTS.
- GET/POST /employees manager: list filtersq,position,shift,status; POST EmployeeCreate(full_name,phone,email,student_id,position,employment_status,start_date,weekly_schedule,notes). No user_id/password/role/accountpermission accepted.
- PATCH /employees/:id manager: toàn bộ EmployeeCreate+expected_version;409EMPLOYEE_CHANGED/EMPLOYEE_ALREADY_EXISTS.
- GET /audit/:record_type/:record_id manager:100nhật ký mới nhất(employee|application),khôngpublic.
- Lỗi401chưađăngnhập,403khôngManageractive,404khôngtồn tại. Khôngcache dữ liệu nhân sự/PII.

## Database / rollout
DB cũ áp dụng database/migrations/008_recruitment.sql trong transaction trước khởi động backendmới; không down -v. DBmới init_db.sql gồm schema. Dữliệu mẫu21hồsơ ở database/employee_sample_data.sql,đồng bộblockcuối sample_data.sql:16active(1mỗivịtrítuyển+4phụbếp+4đầubếp+4thungân),5resigned. Tên/MSV mẫu,khôngSĐTthật; không tạoUser. Seed ONCONFLICTid DO NOTHING khôngghiđè sửaManager,khôngtạo lại hồsơ khi restart. Muốn giữ hồ sơ thực thì không chạyseedmẫu.
Migration cộng3bảng, không sửaUsers/Orders. Có thể rollback applicationversion bằng tắt route/frontend trước; giữbảng/dữliệu,khôngdrop hồ sơ đãnhận. Kiểmtra migration trước/sau sốUser/Order khôngđổi. Không triển khai quảnlýbàiviết,dừngtuyển theo từngvịtrí,cấu hìnhlương hayquyềnchứcnăng trongđợt này.

## Kiểm chứng08/11/2026
13 kiểm thử PostgreSQL/API và48 hồi quy frontend qua; TypeScript/build qua. Trình duyệt local đã gửi hồ sơ thật, Manager xem/chấp nhận/tạo nhân viên một lần, phân ca, tạm nghỉ gỡ lịch và xem lịch sử; lỗi gửi giữ dữ liệu, giới thiệu HTML không thực thi, màn hình390px không tràn trang/hộp thoại. Dữ liệu UITEST đã dọn riêng, giữ21hồsơ mẫu. Các tài khoản/đơn cũ không đổi. Chưa tích hợp CMS hoặc cấp/liên kết tài khoản; bundlefrontend có cảnh báo kích thước sẵn có.

Cập nhật nhân sự mẫu08/11/2026: migration009_employee_sample_contacts.sql đổi tên/SĐT giả lập cho16demoactive;8phụbếp/đầubếp Fulltime,cả2caMon–Sat(12buổi). API chuẩn hóa lịch active của2vịtrínày thành12ca; tạmnghỉ/nghỉvẫngỡlịch. Bảnglịchca còn lạihiểnthịngaykhôngcầnmở. Khôngphảidữliệuliênhệthật,khôngtạoUser.

Các bổ sung sau đó:21hồ sơ mẫu đều có tên/SĐT/emailđuôi@neufood.com giả lập (không tạo hộp thư). MSV8chữsố1123/1124/1125 cho các vịtrí phùhợp; đầu bếp/phụbếp không cóMSV.8nhân viên bếp Fulltime cả12ca;8nhân viên hỗtrợ/thu ngân có lịch6buổi khácnhau, đảm bảo mọi caMon–Sat có người vàthu ngân.5đãnghỉkhôngphânca. Migration009 chỉ cậpnhật IDs demo tươngứng.
