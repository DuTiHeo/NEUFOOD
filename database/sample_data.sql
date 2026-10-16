-- ==============================================================================
-- NEUFood Database Seed Data - Dữ Liệu Mẫu Chuẩn Nghiệp Vụ
-- Phù hợp 100% với tài liệu: docs/Quy_Trinh_Nghiep_Vu.md
-- Mật khẩu mặc định cho tất cả tài khoản mẫu: password123
-- Bcrypt hash: $2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW
-- ==============================================================================

-- 1. USERS (4 VAI TRÒ ĐĂNG NHẬP THEO CHƯƠNG 2)
INSERT INTO users (id, email, password_hash, full_name, phone_number, student_id, role, avatar_url, is_active, is_blacklisted, blacklist_reason, blacklisted_at)
VALUES
-- Quản trị viên hệ thống (Admin)
(1, 'admin@neufood.vn', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Nguyễn Quản Trị (Admin)', '0988888888', 'ADMIN01', 'admin', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', TRUE, FALSE, NULL, NULL),

-- Quản lý Canteen A2 (Manager)
(2, 'manager.a2@neufood.vn', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Hoàng Văn Quản Lý (Canteen A2)', '0912345679', 'MGR01', 'manager', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', TRUE, FALSE, NULL, NULL),

-- Nhân viên Canteen A2 / Shipper nội bộ (Staff)
(3, 'shipper01@neufood.vn', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Trần Văn Nhân Viên (Bếp & Shipper)', '0987654321', 'STAFF01', 'staff', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80', TRUE, FALSE, NULL, NULL),

-- Khách hàng sinh viên NEU (Customer 1 - Bình thường)
(4, 'sinhvien@neu.edu.vn', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Nguyễn Sinh Viên', '0977112233', '11215432', 'customer', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80', TRUE, FALSE, NULL, NULL),

-- Khách hàng sinh viên NEU (Customer 2 - Đã có đơn khiếu nại)
(5, 'thanhhuong@neu.edu.vn', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Lê Thị Thanh Hương', '0912345678', '11200001', 'customer', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80', TRUE, FALSE, NULL, NULL),

-- Khách hàng vi phạm Blacklist COD (Customer 3 - BR-22, EX-10)
(6, 'boomhang@neu.edu.vn', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Vũ Boom Hàng', '0901234567', '11199999', 'customer', 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80', TRUE, TRUE, 'Không nghe máy nhận hàng khi shipper giao tới và không ra quầy Canteen A2 lấy sau 30 phút lưu giữ (BR-22)', NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- 2. CAMPUS_LOCATIONS (DANH MỤC ĐỊA ĐIỂM NỘI KHU NEU - BR-09, UC24)
INSERT INTO campus_locations (id, building_code, building_name, default_room_note, is_active, display_order)
VALUES
(1, 'A1', 'Tòa nhà Thế Kỷ A1', 'Phòng học & Văn phòng từ tầng 2 đến tầng 10', TRUE, 1),
(2, 'A2', 'Khu Canteen & Giảng đường A2', 'Quầy trả món Canteen A2 Tầng 1 hoặc phòng học tầng trên', TRUE, 2),
(3, 'B', 'Giảng đường B', 'Các phòng học khu nhà B', TRUE, 3),
(4, 'C', 'Giảng đường C', 'Các phòng học khu nhà C', TRUE, 4),
(5, 'D', 'Giảng đường D', 'Các phòng học khu nhà D', TRUE, 5),
(6, 'KTX', 'Ký túc xá Sinh viên NEU', 'Sảnh các tòa KTX hoặc phòng ở cụ thể', TRUE, 6),
(7, 'THU_VIEN', 'Thư viện Phạm Văn Đồng', 'Bàn trực sảnh tầng 1 hoặc phòng tự học', TRUE, 7),
(8, 'NHA_VAN_HOA', 'Nhà Văn Hóa NEU', 'Hội trường lớn và khu câu lạc bộ', TRUE, 8)
ON CONFLICT (id) DO NOTHING;

SELECT setval('campus_locations_id_seq', (SELECT MAX(id) FROM campus_locations));

-- 3. CATEGORIES (DANH MỤC MÓN ĂN)
INSERT INTO categories (id, name, description, display_order, is_active)
VALUES
('com-hop', 'Cơm Hộp', 'Các món cơm văn phòng, sinh viên nóng hổi đủ dinh dưỡng', 1, TRUE),
('mi-pho', 'Mì Phở', 'Bún, phở, mì xào, miến nước thanh ngọt đậm đà', 2, TRUE),
('combos', 'Combos Tiết Kiệm', 'Combo đồ ăn kèm nước siêu hời cho sinh viên', 3, TRUE),
('do-uong', 'Đồ Uống', 'Trà sữa, trà trái cây tươi, cà phê năng động', 4, TRUE),
('an-vat', 'Ăn Vặt', 'Nem chua rán, khoai tây lắc, xúc xích giòn rụm', 5, TRUE),
('trang-mieng', 'Tráng Miệng', 'Chè, sữa chua, caramen mát lạnh sau bữa ăn', 6, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 4. DISHES (THỰC ĐƠN CANTEEN A2 - CƠ CHẾ GIÁ GỐC A + 5.000Đ PHỤ PHÍ THEO BR-12)
INSERT INTO dishes (id, name, short_description, description, base_price, system_fee, price, rating, review_count, image_url, is_available, is_active, is_deleted)
VALUES
-- Món 1: Phở bò tái lăn (Còn món)
('pho-bo-tai-lan', 'Phở Bò Tái Lăn', 'Phở truyền thống, nước dùng thanh ngọt, thịt bò mềm.', 'Bát phở truyền thống với nước dùng được ninh từ xương bò nhiều giờ, kết hợp cùng bánh phở dai mềm và thịt bò tươi ngon xào tái lăn thơm nức.', 45000, 5000, 50000, 4.8, 312, 'https://live2makan.com/wp-content/uploads/2022/08/l2m-vn-2207-pho10-05.jpg', TRUE, TRUE, FALSE),

-- Món 2: Phở trộn chua ngọt (Còn món)
('pho-tron-chua-ngot', 'Phở Trộn Chua Ngọt', 'Phở trộn đậm đà cùng sốt me chua ngọt.', 'Bánh phở mềm dai trộn cùng thịt bò mềm, rau sống tươi mát, lạc rang giòn bùi và nước sốt me chua ngọt đặc trưng của Canteen A2.', 40000, 5000, 45000, 4.6, 154, 'https://cdn.tgdd.vn/2021/08/CookRecipe/Avatar/pho-ga-tron-sa-te-thumbnail.jpg', TRUE, TRUE, FALSE),

-- Món 3: Bún bò xứ Huế (Còn món)
('bun-bo-hue', 'Bún Bò Xứ Huế', 'Bún bò chuẩn vị Huế, cay nồng, đậm đà.', 'Nước dùng thơm lừng mùi mắm ruốc và sả, full topping với thịt bò bắp, giò heo giòn sần sật, chả cua và tiết luộc nóng hổi.', 50000, 5000, 55000, 4.9, 420, 'https://cdn.tgdd.vn/Files/2017/03/24/964495/cach-nau-bun-bo-hue-gio-heo-ngon-cong-thuc-chuan-vi-202208251617593627.jpg', TRUE, TRUE, FALSE),

-- Món 4: Bún riêu cua đồng (Còn món)
('bun-rieu-cua-dong', 'Bún Riêu Cua Đồng', 'Bún riêu cua đồng thanh mát ngọt vị.', 'Bún riêu cua đồng với nước dùng chua thanh từ cà chua và giấm bỗng, gạch cua xào béo ngậy, đậu hũ chiên vàng và chả lá lốt.', 35000, 5000, 40000, 4.5, 180, 'https://i.ytimg.com/vi/C1P1Cw9J1-I/maxresdefault.jpg', TRUE, TRUE, FALSE),

-- Món 5: Cơm gà xối mỡ (Còn món - Best Seller)
('com-ga-xoi-mo', 'Cơm Gà Xối Mỡ Da Giòn', 'Đùi gà chiên da giòn rụm, cơm rang thơm béo.', 'Cơm rang hạt tơi màu đỏ hạt điều, ăn cùng đùi gà góc tư chiên xối mỡ giòn tan rụm và dưa chuột, đồ chua kèm nước mắm tỏi ớt.', 40000, 5000, 45000, 4.9, 530, 'https://lh3.googleusercontent.com/aida-public/AB6AXuAuUajAh5kGPqEjmbjGpLfpO4q6rXXpfhC_5in50xJi5EovQBZeLP0xvxJjmuvlMbcHFiq9EJucHKhw6D9Jb8Wo2TY4g8aIVwf849W2uGBIg3QaVES6cUgeXMwBcVUzIhkGsqutAPSD9NceZx-EV_7PlDFexQC5REP-1-I294Hr5MkPknCnv4NYnWuIcMZuj9WF4KiJ5paVqnR647hSEKDvyHa9sQgSagCNGK7PqAKOok5pVQuQTpYUvmMqgtrzsZ7vhadfOEMo6bs', TRUE, TRUE, FALSE),

-- Món 6: Cơm sườn nướng mật ong (Hết món hôm nay để test BR-06, EX-05)
('com-suon-nuong', 'Cơm Sườn Nướng Mật Ong', 'Miếng sườn cốt lết dày dặn ướp sốt mật ong thơm lừng.', 'Cơm tấm dẻo thơm ăn kèm sườn cốt lết nướng than hoa vàng óng, mỡ hành béo ngậy và trứng ốp la lòng đào.', 40000, 5000, 45000, 4.7, 210, 'https://lh3.googleusercontent.com/aida-public/AB6AXuAuUajAh5kGPqEjmbjGpLfpO4q6rXXpfhC_5in50xJi5EovQBZeLP0xvxJjmuvlMbcHFiq9EJucHKhw6D9Jb8Wo2TY4g8aIVwf849W2uGBIg3QaVES6cUgeXMwBcVUzIhkGsqutAPSD9NceZx-EV_7PlDFexQC5REP-1-I294Hr5MkPknCnv4NYnWuIcMZuj9WF4KiJ5paVqnR647hSEKDvyHa9sQgSagCNGK7PqAKOok5pVQuQTpYUvmMqgtrzsZ7vhadfOEMo6bs', FALSE, TRUE, FALSE),

-- Món 7: Trà sữa trân châu đường đen (Còn món)
('tra-sua-tran-chau', 'Trà Sữa Trân Châu Đường Đen', 'Vị trà ô long sữa thơm béo, trân châu mềm dẻo.', 'Trà ô long thượng hạng hòa quyện sữa tươi béo ngậy cùng trân châu đen nấu đường nâu mật mía mềm dẻo thơm phức.', 30000, 5000, 35000, 4.7, 240, 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIWzJ_Ba0WJpoHg1KAgyeZmrANZK8iiu0nFC7uWPRU45CvBNpFv6Xg3w4P8Ix8THOFrPUtjDP89zyNQUT2mGgVEMeW2V75rLmAh141lZNJTKz4GvqJgc79HL12hC8zhjT5bIBW-FIBbeQusQQeuxklKeDsHL1Zas1WKdsa7tLIvpcRIO-X59VW7kzzGvoZFMzrX_P8w76Z0jdHBMUmcVXTTyvC7K3P7GTsJq2sR2W9mBTIhRXTkXCIJqsHjCkJNzFw5VFzf5My88w', TRUE, TRUE, FALSE),

-- Món 8: Trà đào cam sả (Còn món)
('tra-dao-cam-sa', 'Trà Đào Cam Sả Tươi Mát', 'Thanh lọc cơ thể, hương sả thơm lừng miếng đào giòn ngọt.', 'Trà đen hảo hạng kết hợp nước cốt cam tươi nguyên chất, sả đập dập thơm dịu và những lát đào ngâm giòn tan.', 25000, 5000, 30000, 4.8, 195, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=400&q=80', TRUE, TRUE, FALSE),

-- Món 9: Nem chua rán giòn rụm (Ăn vặt)
('nem-chua-ran', 'Nem Chua Rán Giòn Rụm (10 chiếc)', 'Nem chua lăn bột chiên xù vàng rụm chấm tương ớt cay nồng.', 'Món ăn vặt quốc dân của sinh viên NEU, nem ngọt đậm đà, vỏ ngoài giòn rụm, bên trong dẻo mềm béo ngậy.', 30000, 5000, 35000, 4.9, 610, 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=400&q=80', TRUE, TRUE, FALSE),

-- Món 10: Combo Cơm Gà + Trà Đào (Combo)
('combo-com-ga-tra-dao', 'Combo Bữa Trưa Năng Động (Cơm Gà + Trà Đào)', 'Tiết kiệm hơn khi mua combo cơm gà và trà đào mát lạnh.', 'Trọn gói bữa trưa đủ chất gồm 1 đĩa cơm gà xối mỡ da giòn và 1 ly trà đào cam sả size lớn.', 60000, 5000, 65000, 4.9, 380, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80', TRUE, TRUE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- 5. DISH_CATEGORIES MAPPING
INSERT INTO dish_categories (dish_id, category_id)
VALUES
('pho-bo-tai-lan', 'mi-pho'),
('pho-tron-chua-ngot', 'mi-pho'),
('bun-bo-hue', 'mi-pho'),
('bun-rieu-cua-dong', 'mi-pho'),
('com-ga-xoi-mo', 'com-hop'),
('com-suon-nuong', 'com-hop'),
('tra-sua-tran-chau', 'do-uong'),
('tra-dao-cam-sa', 'do-uong'),
('nem-chua-ran', 'an-vat'),
('combo-com-ga-tra-dao', 'combos'),
('combo-com-ga-tra-dao', 'com-hop'),
('combo-com-ga-tra-dao', 'do-uong')
ON CONFLICT DO NOTHING;

-- 6. DISH_BADGES (NHÃN MÓN ĂN)
INSERT INTO dish_badges (id, dish_id, badge)
VALUES
(1, 'pho-bo-tai-lan', 'bestSeller'),
(2, 'pho-bo-tai-lan', 'hot'),
(3, 'bun-bo-hue', 'hot'),
(4, 'com-ga-xoi-mo', 'bestSeller'),
(5, 'com-ga-xoi-mo', 'hot'),
(6, 'tra-sua-tran-chau', 'bestSeller'),
(7, 'nem-chua-ran', 'bestSeller'),
(8, 'combo-com-ga-tra-dao', 'new')
ON CONFLICT (id) DO NOTHING;

SELECT setval('dish_badges_id_seq', (SELECT MAX(id) FROM dish_badges));

-- 7. SYSTEM_SETTINGS (CẤU HÌNH THAM SỐ HỆ THỐNG - 2.3.5)
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES
('order_timeout_minutes', '10', 'Thời gian tối đa để Canteen tiếp nhận hoặc từ chối đơn hàng (phút)'),
('pickup_hold_minutes', '30', 'Thời gian lưu giữ món tại quầy Canteen A2 trước khi hủy đơn bỏ rơi (phút)'),
('auto_complete_minutes', '30', 'Thời gian tự động hoàn thành đơn hàng kể từ lúc giao nếu không khiếu nại (phút)'),
('complaint_window_hours', '24', 'Thời gian tối đa cho phép khách hàng gửi ticket khiếu nại sau khi nhận hàng (giờ)'),
('system_maintenance_fee', '5000', 'Phụ phí bảo trì hệ thống trực tuyến cộng vào giá niêm yết mỗi món (VNĐ)'),
('delivery_fee', '5000', 'Phí vận chuyển cố định cho đơn giao tận nơi nội khu NEU (VNĐ)'),
('max_cod_amount', '500000', 'Hạn mức giá trị tối đa cho một đơn hàng thanh toán COD (VNĐ)'),
('max_dish_quantity_per_order', '10', 'Số lượng tối đa của một món ăn trong một đơn hàng (phần)'),
('min_preorder_lead_minutes', '30', 'Thời gian đặt trước tối thiểu cho đơn hẹn giờ (phút)'),
('canteen_open_time', '06:30', 'Giờ mở cửa phục vụ hàng ngày của Canteen A2'),
('canteen_close_time', '19:30', 'Giờ đóng cửa ngừng nhận đơn của Canteen A2')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- 8. ORDERS (ĐƠN HÀNG MẪU VỚI 14 TRẠNG THÁI TIẾNG VIỆT KHÔNG DẤU)
--
-- Đơn 1: Đang chờ Canteen xác nhận (CHO_XAC_NHAN)
-- Giao tận nơi: Phở Bò Tái Lăn (50k) + Trà Sữa (35k) + Ship 5k = 90.000đ. COD Tiền mặt. 4 số cuối: 3456
INSERT INTO orders (
    id, order_code_suffix, user_id, staff_id, order_type, recipient_name, recipient_phone,
    campus_location_id, room_detail, delivery_address, delivery_note, is_preorder, scheduled_at,
    status, subtotal_amount, ship_fee, total_amount, payment_method, payment_status, eta, created_at
) VALUES (
    'NF2610153456', '3456', 4, NULL, 'delivery', 'Nguyễn Sinh Viên', '0977112233',
    1, 'P.502 Tầng 5', 'P.502 Tầng 5, Tòa nhà Thế Kỷ A1, Đại học Kinh tế Quốc dân',
    'Gọi trước khi lên phòng giúp em', FALSE, NULL,
    'CHO_XAC_NHAN', 85000, 5000, 90000, 'cod_cash', 'chua_thanh_toan', '15 - 25 phút',
    NOW() - INTERVAL '3 minutes'
) ON CONFLICT (id) DO NOTHING;

-- Đơn 2: Bếp đang chuẩn bị món (DANG_CHUAN_BI)
-- Nhận tại quầy: Cơm gà xối mỡ (45k). Phí ship 0đ. Tổng 45.000đ. COD VietQR. 4 số cuối: 7812
INSERT INTO orders (
    id, order_code_suffix, user_id, staff_id, order_type, recipient_name, recipient_phone,
    campus_location_id, room_detail, delivery_address, delivery_note, is_preorder, scheduled_at,
    status, subtotal_amount, ship_fee, total_amount, payment_method, payment_status, eta, created_at
) VALUES (
    'NF2610157812', '7812', 5, 3, 'pickup', 'Lê Thị Thanh Hương', '0912345678',
    2, 'Quầy trả món Canteen A2', 'Canteen A2 Tầng 1, Nhà A2, Đại học Kinh tế Quốc dân',
    'Cho nhiều tương ớt', FALSE, NULL,
    'DANG_CHUAN_BI', 45000, 0, 45000, 'cod_vietqr', 'chua_thanh_toan', '10 - 15 phút',
    NOW() - INTERVAL '8 minutes'
) ON CONFLICT (id) DO NOTHING;

-- Đơn 3: Shipper đang giao tận nơi (DANG_GIAO)
-- Giao tận nơi: Bún Bò Huế (55k) + Ship 5k = 60.000đ. 4 số cuối: 9921
INSERT INTO orders (
    id, order_code_suffix, user_id, staff_id, order_type, recipient_name, recipient_phone,
    campus_location_id, room_detail, delivery_address, delivery_note, is_preorder, scheduled_at,
    status, subtotal_amount, ship_fee, total_amount, payment_method, payment_status, eta, created_at
) VALUES (
    'NF2610159921', '9921', 4, 3, 'delivery', 'Nguyễn Sinh Viên', '0977112233',
    6, 'Phòng 304 Nhà 5 KTX', 'Phòng 304 Nhà 5 KTX, Ký túc xá Sinh viên NEU',
    'Giao đến cổng KTX gọi em xuống lấy', FALSE, NULL,
    'DANG_GIAO', 55000, 5000, 60000, 'cod_cash', 'chua_thanh_toan', '5 - 10 phút',
    NOW() - INTERVAL '15 minutes'
) ON CONFLICT (id) DO NOTHING;

-- Đơn 4: Đã hoàn thành (HOAN_THANH)
-- Đơn hôm qua: Combo cơm gà + Trà đào (65k) + Nem chua rán (35k) + Ship 5k = 105.000đ. Đã giao thành công.
INSERT INTO orders (
    id, order_code_suffix, user_id, staff_id, order_type, recipient_name, recipient_phone,
    campus_location_id, room_detail, delivery_address, delivery_note, is_preorder, scheduled_at,
    status, subtotal_amount, ship_fee, total_amount, payment_method, payment_status, eta,
    delivered_at, completed_at, created_at
) VALUES (
    'NF2610148833', '8833', 4, 3, 'delivery', 'Nguyễn Sinh Viên', '0977112233',
    3, 'P.201 Giảng đường B', 'P.201 Giảng đường B, Đại học Kinh tế Quốc dân',
    NULL, FALSE, NULL,
    'HOAN_THANH', 100000, 5000, 105000, 'cod_cash', 'da_thanh_toan', NULL,
    NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '30 minutes',
    NOW() - INTERVAL '1 day' - INTERVAL '20 minutes'
) ON CONFLICT (id) DO NOTHING;

-- Đơn 5: Đang có khiếu nại (KHIEU_NAI - BR-23, UC15)
-- Đơn nhận tại quầy sáng nay, khách khiếu nại giao nhầm món
INSERT INTO orders (
    id, order_code_suffix, user_id, staff_id, order_type, recipient_name, recipient_phone,
    campus_location_id, room_detail, delivery_address, delivery_note, is_preorder, scheduled_at,
    status, subtotal_amount, ship_fee, total_amount, payment_method, payment_status, eta,
    delivered_at, completed_at, created_at
) VALUES (
    'NF2610155566', '5566', 5, 3, 'pickup', 'Lê Thị Thanh Hương', '0912345678',
    2, 'Quầy trả món Canteen A2', 'Canteen A2 Tầng 1, Nhà A2, Đại học Kinh tế Quốc dân',
    NULL, FALSE, NULL,
    'KHIEU_NAI', 45000, 0, 45000, 'cod_vietqr', 'da_thanh_toan', NULL,
    NOW() - INTERVAL '3 hours', NULL,
    NOW() - INTERVAL '4 hours'
) ON CONFLICT (id) DO NOTHING;

-- Đơn 6: Bỏ đơn vi phạm đưa vào Blacklist (BO_DON_BLACKLIST - BR-22, EX-18)
INSERT INTO orders (
    id, order_code_suffix, user_id, staff_id, order_type, recipient_name, recipient_phone,
    campus_location_id, room_detail, delivery_address, delivery_note, is_preorder, scheduled_at,
    status, subtotal_amount, ship_fee, total_amount, payment_method, payment_status, eta,
    cancelled_reason, created_at
) VALUES (
    'NF2610134411', '4411', 6, 3, 'delivery', 'Vũ Boom Hàng', '0901234567',
    4, 'P.102 Giảng đường C', 'P.102 Giảng đường C, Đại học Kinh tế Quốc dân',
    NULL, FALSE, NULL,
    'BO_DON_BLACKLIST', 50000, 5000, 55000, 'cod_cash', 'chua_thanh_toan', NULL,
    'Shipper gọi liên tục 10 phút không bắt máy, hàng mang về quầy quá 30 phút khách không tới nhận',
    NOW() - INTERVAL '2 days'
) ON CONFLICT (id) DO NOTHING;

-- 9. ORDER_ITEMS MAPPING
INSERT INTO order_items (id, order_id, dish_id, dish_name, unit_price, base_price, quantity, note, subtotal)
VALUES
-- Items cho Đơn 1
(1, 'NF2610153456', 'pho-bo-tai-lan', 'Phở Bò Tái Lăn', 50000, 45000, 1, 'Nhiều hành tây', 50000),
(2, 'NF2610153456', 'tra-sua-tran-chau', 'Trà Sữa Trân Châu Đường Đen', 35000, 30000, 1, '70% đường 50% đá', 35000),

-- Items cho Đơn 2
(3, 'NF2610157812', 'com-ga-xoi-mo', 'Cơm Gà Xối Mỡ Da Giòn', 45000, 40000, 1, 'Xin thêm tương ớt', 45000),

-- Items cho Đơn 3
(4, 'NF2610159921', 'bun-bo-hue', 'Bún Bò Xứ Huế', 55000, 50000, 1, 'Không lấy tiết', 55000),

-- Items cho Đơn 4 (Đã hoàn thành)
(5, 'NF2610148833', 'combo-com-ga-tra-dao', 'Combo Bữa Trưa Năng Động (Cơm Gà + Trà Đào)', 65000, 60000, 1, NULL, 65000),
(6, 'NF2610148833', 'nem-chua-ran', 'Nem Chua Rán Giòn Rụm (10 chiếc)', 35000, 30000, 1, NULL, 35000),

-- Items cho Đơn 5 (Đang khiếu nại)
(7, 'NF2610155566', 'pho-tron-chua-ngot', 'Phở Trộn Chua Ngọt', 45000, 40000, 1, 'Ít lạc rang', 45000),

-- Items cho Đơn 6 (Boom hàng)
(8, 'NF2610134411', 'pho-bo-tai-lan', 'Phở Bò Tái Lăn', 50000, 45000, 1, NULL, 50000)
ON CONFLICT (id) DO NOTHING;

SELECT setval('order_items_id_seq', (SELECT MAX(id) FROM order_items));

-- 10. REVIEWS (ĐÁNH GIÁ MẪU CHO ĐƠN ĐÃ HOÀN THÀNH - UC14)
INSERT INTO reviews (id, order_id, dish_id, user_id, rating, comment, created_at)
VALUES
(1, 'NF2610148833', 'combo-com-ga-tra-dao', 4, 5, 'Cơm gà nóng hổi, da giòn rụm, trà đào thanh mát rất đáng tiền!', NOW() - INTERVAL '23 hours'),
(2, 'NF2610148833', 'nem-chua-ran', 4, 5, 'Nem chiên xù nóng giòn chấm tương ớt ngon đỉnh chóp.', NOW() - INTERVAL '23 hours')
ON CONFLICT (id) DO NOTHING;

SELECT setval('reviews_id_seq', (SELECT MAX(id) FROM reviews));

-- 11. COMPLAINTS (TICKET KHIẾU NẠI MẪU - UC15, UC25, BR-23, BR-24, EX-15)
INSERT INTO complaints (id, order_id, user_id, reason, description, proof_image_url, status, admin_response, resolved_by, resolved_at, created_at)
VALUES
(1, 'NF2610155566', 5, 'Giao nhầm món ăn', 'Em đặt Phở Trộn Chua Ngọt nhưng khi mở hộp ra lại là Bún Riêu Cua Đồng. Kèm ảnh chụp món nhận được tại phòng.', 'https://i.ytimg.com/vi/C1P1Cw9J1-I/maxresdefault.jpg', 'DANG_XU_LY', NULL, NULL, NULL, NOW() - INTERVAL '2 hours')
ON CONFLICT (id) DO NOTHING;

SELECT setval('complaints_id_seq', (SELECT MAX(id) FROM complaints));

-- 12. STAFF_SHIFTS (CA LÀM VIỆC VÀ ĐỐI SOÁT NỘP TIỀN COD CUỐI CA - BR-25, UC20)
INSERT INTO staff_shifts (
    id, staff_id, shift_date, total_orders_handled, expected_cash, expected_qr,
    actual_cash, actual_qr, discrepancy_amount, discrepancy_note, status, closed_by, closed_at, created_at
) VALUES (
    1, 3, CURRENT_DATE, 5, 270000, 125000, 270000, 125000, 0,
    'Khớp 100% tiền mặt và sao kê QR cá nhân', 'CHO_DUYET', NULL, NULL, NOW() - INTERVAL '30 minutes'
) ON CONFLICT (id) DO NOTHING;

SELECT setval('staff_shifts_id_seq', (SELECT MAX(id) FROM staff_shifts));

-- Hoàn tất nạp dữ liệu mẫu chuẩn NEUFood.
