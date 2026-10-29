-- ==============================================================================
-- NEUFood Database Seed Data - Dữ Liệu Mẫu Chuẩn Nghiệp Vụ
-- Phù hợp 100% với tài liệu: docs/Quy_Trinh_Nghiep_Vu.md
-- Mật khẩu mặc định cho tất cả tài khoản mẫu: password123
-- Bcrypt hash: $2b$12$8MExWX3DjGGtc5FFYQu3yOM1.Th4Ky36280O2126Ux.A8ydGfDb/y
-- ==============================================================================

-- 1. USERS (4 VAI TRÒ ĐĂNG NHẬP THEO CHƯƠNG 2)
INSERT INTO users (id, email, password_hash, full_name, phone_number, student_id, role, avatar_url, is_active, is_blacklisted, blacklist_reason, blacklisted_at)
VALUES
-- Quản trị viên hệ thống (Admin)
(1, 'admin@neufood.vn', '$2b$12$8MExWX3DjGGtc5FFYQu3yOM1.Th4Ky36280O2126Ux.A8ydGfDb/y', 'Nguyễn Quản Trị (Admin)', '0988888888', 'ADMIN01', 'admin', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', TRUE, FALSE, NULL, NULL),

-- Quản lý Canteen A2 (Manager)
(2, 'manager.a2@neufood.vn', '$2b$12$8MExWX3DjGGtc5FFYQu3yOM1.Th4Ky36280O2126Ux.A8ydGfDb/y', 'Hoàng Văn Quản Lý (Canteen A2)', '0912345679', 'MGR01', 'manager', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', TRUE, FALSE, NULL, NULL),

-- Nhân viên Canteen A2 / Shipper nội bộ (Staff)
(3, 'shipper01@neufood.vn', '$2b$12$8MExWX3DjGGtc5FFYQu3yOM1.Th4Ky36280O2126Ux.A8ydGfDb/y', 'Trần Văn Nhân Viên (Bếp & Shipper)', '0987654321', 'STAFF01', 'staff', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80', TRUE, FALSE, NULL, NULL),

-- Khách hàng sinh viên NEU (Customer 1 - Bình thường)
(4, 'sinhvien@neu.edu.vn', '$2b$12$8MExWX3DjGGtc5FFYQu3yOM1.Th4Ky36280O2126Ux.A8ydGfDb/y', 'Nguyễn Sinh Viên', '0977112233', '11215432', 'customer', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80', TRUE, FALSE, NULL, NULL),

-- Khách hàng sinh viên NEU (Customer 2 - Đã có đơn khiếu nại)
(5, 'thanhhuong@neu.edu.vn', '$2b$12$8MExWX3DjGGtc5FFYQu3yOM1.Th4Ky36280O2126Ux.A8ydGfDb/y', 'Lê Thị Thanh Hương', '0912345678', '11200001', 'customer', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80', TRUE, FALSE, NULL, NULL),

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
('trang-mieng', 'Tráng Miệng', 'Chè, sữa chua, caramen mát lạnh sau bữa ăn', 6, TRUE),
('mon-chinh', 'Món Chính', 'Các món ăn chính no bụng cho bữa trưa và bữa tối', 7, TRUE),
('banh-kem', 'Bánh Kem', 'Bánh ngọt, bánh sinh nhật và bánh kem các loại', 8, TRUE)
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
('com-ga-xoi-mo', 'Cơm Gà Xối Mỡ Da Giòn', 'Đùi gà chiên da giòn rụm, cơm rang thơm béo.', 'Cơm rang hạt tơi màu đỏ hạt điều, ăn cùng đùi gà góc tư chiên xối mỡ giòn tan rụm và dưa chuột, đồ chua kèm nước mắm tỏi ớt.', 40000, 5000, 45000, 4.9, 530, 'https://cdn.tgdd.vn/2021/01/CookRecipe/GalleryStep/thanh-pham-362.jpg', TRUE, TRUE, FALSE),

-- Món 6: Cơm sườn nướng mật ong (Hết món hôm nay để test BR-06, EX-05)
('com-suon-nuong', 'Cơm Sườn Nướng Mật Ong', 'Miếng sườn cốt lết dày dặn ướp sốt mật ong thơm lừng.', 'Cơm tấm dẻo thơm ăn kèm sườn cốt lết nướng than hoa vàng óng, mỡ hành béo ngậy và trứng ốp la lòng đào.', 40000, 5000, 45000, 4.7, 210, 'https://mms.img.susercontent.com/vn-11134513-7r98o-lsvb7d0ao3b826@resize_ss1242x600!@crop_w1242_h600_cT', FALSE, TRUE, FALSE),

-- Món 7: Trà sữa trân châu đường đen (Còn món)
('tra-sua-tran-chau', 'Trà Sữa Trân Châu Đường Đen', 'Vị trà ô long sữa thơm béo, trân châu mềm dẻo.', 'Trà ô long thượng hạng hòa quyện sữa tươi béo ngậy cùng trân châu đen nấu đường nâu mật mía mềm dẻo thơm phức.', 30000, 5000, 35000, 4.7, 240, 'https://bizweb.dktcdn.net/100/519/595/files/1-180559f8-1ce7-43b7-83ce-a37eac803791.jpg?v=1744966178923', TRUE, TRUE, FALSE),

-- Món 8: Trà đào cam sả (Còn món)
('tra-dao-cam-sa', 'Trà Đào Cam Sả Tươi Mát', 'Thanh lọc cơ thể, hương sả thơm lừng miếng đào giòn ngọt.', 'Trà đen hảo hạng kết hợp nước cốt cam tươi nguyên chất, sả đập dập thơm dịu và những lát đào ngâm giòn tan.', 25000, 5000, 30000, 4.8, 195, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=400&q=80', TRUE, TRUE, FALSE),

-- Món 9: Nem chua rán giòn rụm (Ăn vặt)
('nem-chua-ran', 'Nem Chua Rán Giòn Rụm (10 chiếc)', 'Nem chua lăn bột chiên xù vàng rụm chấm tương ớt cay nồng.', 'Món ăn vặt quốc dân của sinh viên NEU, nem ngọt đậm đà, vỏ ngoài giòn rụm, bên trong dẻo mềm béo ngậy.', 30000, 5000, 35000, 4.9, 610, 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=400&q=80', TRUE, TRUE, FALSE),

-- Món 10: Combo Cơm Gà + Trà Đào (Combo)
('combo-com-ga-tra-dao', 'Combo Bữa Trưa Năng Động (Cơm Gà + Trà Đào)', 'Tiết kiệm hơn khi mua combo cơm gà và trà đào mát lạnh.', 'Trọn gói bữa trưa đủ chất gồm 1 đĩa cơm gà xối mỡ da giòn và 1 ly trà đào cam sả size lớn.', 60000, 5000, 65000, 4.9, 380, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80', TRUE, TRUE, FALSE),

-- Món 11: Phở (pho)
('pho', 'Phở', 'Phở truyền thống, nước dùng thanh ngọt, thịt bò mềm.', 'Bát phở truyền thống với nước dùng được ninh từ xương bò nhiều giờ, kết hợp cùng bánh phở dai mềm và thịt bò tươi ngon.', 45000, 5000, 50000, 4.8, 312, 'https://live2makan.com/wp-content/uploads/2022/08/l2m-vn-2207-pho10-05.jpg', TRUE, TRUE, FALSE),

-- Món 12: Phở Trộn (pho-tron)
('pho-tron', 'Phở Trộn', 'Phở trộn đậm đà cùng sốt me chua ngọt.', 'Bánh phở mềm dai trộn cùng thịt bò mềm, rau sống tươi mát và nước sốt me chua ngọt đặc trưng.', 40000, 5000, 45000, 4.6, 154, 'https://cdn.tgdd.vn/2021/08/CookRecipe/Avatar/pho-ga-tron-sa-te-thumbnail.jpg', TRUE, TRUE, FALSE),

-- Món 13: Bún Riêu (bun-rieu)
('bun-rieu', 'Bún Riêu', 'Bún riêu cua đồng thanh mát.', 'Bún riêu cua đồng với nước dùng chua thanh từ cà chua, gạch cua béo ngậy, đậu hũ chiên và chả.', 35000, 5000, 40000, 4.5, 180, 'https://i.ytimg.com/vi/C1P1Cw9J1-I/maxresdefault.jpg', TRUE, TRUE, FALSE),

-- Món 14: Hủ Tiếu (hu-tieu)
('hu-tieu', 'Hủ Tiếu', 'Hủ tiếu Nam Vang nước dùng ngọt thanh.', 'Sợi hủ tiếu dai ngon ăn kèm tôm, thịt băm, gan heo và trứng cút, nước dùng thanh ngọt từ xương.', 40000, 5000, 45000, 4.7, 210, 'https://media.cooky.vn/recipe/g3/22522/s800x500/recipe22522-636439367069081450.jpg', TRUE, TRUE, FALSE),

-- Món 15: Miến Gà (mien-ga)
('mien-ga', 'Miến Gà', 'Miến dong mộc nhĩ, thịt gà ta dai ngon.', 'Sợi miến dai mềm kết hợp cùng nước luộc gà ngọt thanh và thịt gà ta xé phay, thêm nấm hương thơm lừng.', 35000, 5000, 40000, 4.4, 120, 'https://cdn.tgdd.vn/Files/2017/03/22/963778/bi-quyet-nau-mien-ga-thom-ngon-da-ga-vang-gion-202208261323269332.jpg', TRUE, TRUE, FALSE),

-- Món 16: Cháo Sườn (chao-suon)
('chao-suon', 'Cháo Sườn', 'Cháo sườn sụn sánh mịn, quẩy giòn tan.', 'Cháo được nấu nhuyễn mịn cùng sườn sụn ninh nhừ, ăn kèm quẩy giòn và chút hạt tiêu thơm nồng.', 20000, 5000, 25000, 4.8, 305, 'https://cdn.tgdd.vn/2021/05/CookProduct/axresdefault(1)-1200x676.jpg', TRUE, TRUE, FALSE),

-- Món 17: Bánh Canh (banh-canh)
('banh-canh', 'Bánh Canh', 'Bánh canh chả cá đậm vị miền Trung.', 'Sợi bánh canh dai dai, nước lèo ngọt thanh từ cá, topping chả cá chiên và chả cá hấp.', 35000, 5000, 40000, 4.5, 140, 'https://i.ytimg.com/vi/ZjAxz95VJKQ/maxresdefault.jpg', TRUE, TRUE, FALSE),

-- Món 18: Bún Mọc (bun-moc)
('bun-moc', 'Bún Mọc', 'Bún mọc sườn non thanh đạm.', 'Viên mọc nhĩ nấm giòn giòn, sườn non mềm nục, nước dùng trong vắt thanh tao.', 35000, 5000, 40000, 4.6, 160, 'https://i.ytimg.com/vi/AwppaRlywik/maxresdefault.jpg', TRUE, TRUE, FALSE),

-- Món 19: Bún Thang (bun-thang)
('bun-thang', 'Bún Thang', 'Tinh hoa ẩm thực Hà thành.', 'Bát bún thang cầu kỳ với gà xé, trứng tráng thái chỉ, giò lụa, tôm khô và nước dùng trong vắt ngọt lịm.', 45000, 5000, 50000, 4.7, 195, 'https://noiphodien123.vn/wp-content/uploads/2022/02/bun-thang-ngon.jpg', TRUE, TRUE, FALSE),

-- Món 20: Bún Cá (bun-ca)
('bun-ca', 'Bún Cá', 'Bún cá rô đồng chiên giòn.', 'Miếng cá rô phi chiên giòn rụm bên ngoài, mềm ngọt bên trong, ăn kèm bún, dọc mùng và nước dùng chua thanh.', 35000, 5000, 40000, 4.5, 130, 'https://cdn.tgdd.vn/Files/2020/04/03/1246339/cach-nau-bun-ca-ha-noi-thom-ngon-chuan-vi-khong-ta-13.jpg', TRUE, TRUE, FALSE),

-- Món 21: Bún Chả (bun-cha)
('bun-cha', 'Bún Chả', 'Bún chả thịt nướng than hoa thơm lừng.', 'Chả miếng và chả băm nướng than hoa cháy xém, ăn cùng bún rối và nước mắm chua ngọt dưa góp.', 40000, 5000, 45000, 4.9, 520, 'https://www.seriouseats.com/thmb/J0g7JWjk9r6CHESo1CIrD1BfGd0=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/20231204-SEA-VyTran-BunChaHanoi-19-f623913c6ef34a9185bcd6e5680c545f.jpg', TRUE, TRUE, FALSE),

-- Món 22: Bún Mắm (bun-mam)
('bun-mam', 'Bún Mắm', 'Bún mắm miền Tây đậm đà, full topping.', 'Nước lèo mắm linh thơm phức, đầy ắp hải sản tôm mực, heo quay và các loại rau đặc trưng miền Tây.', 50000, 5000, 55000, 4.6, 110, 'https://cdn.tgdd.vn/Files/2019/03/12/1154316/cach-nau-bun-mam-mien-tay-chuan-thom-ngon-don-gian-tai-nha-202112211640380018.jpg', TRUE, TRUE, FALSE),

-- Món 23: Bún Đậu Mắm Tôm (bun-dau-mam-tom)
('bun-dau-mam-tom', 'Bún Đậu Mắm Tôm', 'Bún đậu tá lả mắm tôm chuẩn vị.', 'Mẹt bún đậu đầy đặn với đậu hũ chiên giòn, thịt luộc, chả cốm, dồi sụn và mắm tôm đánh bọt.', 45000, 5000, 50000, 4.8, 415, 'https://static.vinwonders.com/2023/01/bun-dau-mam-tom-thumb.jpg', TRUE, TRUE, FALSE),

-- Món 24: Nem Nướng Nha Trang (nem-nuong-nha-trang)
('nem-nuong-nha-trang', 'Nem Nướng Nha Trang', 'Nem nướng cuốn ram giòn, sốt chấm đậu phộng.', 'Nem nướng lụi thơm lừng, cuốn cùng bánh tráng, ram chiên giòn, rau sống và chấm nước sốt đặc biệt.', 40000, 5000, 45000, 4.7, 230, 'https://cdn.tgdd.vn/2021/09/CookDish/cach-lam-nem-nuong-nha-trang-bang-noi-chien-khong-dau-thom-avt-1200x676.jpg', TRUE, TRUE, FALSE),

-- Món 25: Gỏi Cuốn (goi-cuon)
('goi-cuon', 'Gỏi Cuốn', 'Gỏi cuốn tôm thịt thanh mát, chấm tương đen.', 'Cuốn tôm thịt luộc tươi ngon cùng bún và rau thơm, chấm mắm nêm hoặc tương đen bùi béo.', 25000, 5000, 30000, 4.5, 155, 'https://images.squarespace-cdn.com/content/v1/52d3fafee4b03c7eaedee15f/30cf6af1-a5a1-456f-ba8e-3d09713608e3/thumbnail-9264.jpg', TRUE, TRUE, FALSE),

-- Món 26: Cơm Tấm (com-tam)
('com-tam', 'Cơm Tấm', 'Cơm tấm sườn bì chả mỡ hành thơm nức.', 'Cơm tấm dẻo tơi, sườn nướng mọng nước đậm vị, bì dai giòn, chả trứng béo ngậy chan mắm chua ngọt.', 50000, 5000, 55000, 4.8, 380, 'https://statics.vinwonders.com/com-tam-ngon-o-sai-gon-0_1630562640.jpg', TRUE, TRUE, FALSE),

-- Món 27: Cơm Gà (com-ga)
('com-ga', 'Cơm Gà', 'Cơm gà Hội An vàng ươm, thịt gà xé.', 'Hạt cơm nấu nước luộc gà vàng ươm, thịt gà ta xé phay trộn gỏi hành tây chua ngọt.', 40000, 5000, 45000, 4.6, 210, 'https://static.vinwonders.com/2023/02/com-ga-da-nang-1.jpg', TRUE, TRUE, FALSE),

-- Món 28: Cơm Sườn Cốt Lết (com-suon)
('com-suon', 'Cơm Sườn Cốt Lết', 'Cơm sườn cốt lết rim mặn ngọt.', 'Miếng sườn cốt lết dày thịt, rim mặn ngọt đậm đà, ăn đưa cơm kèm canh chua giải nhiệt.', 35000, 5000, 40000, 4.5, 145, 'https://i.ytimg.com/vi/cJu6tFJe_Gc/maxresdefault.jpg', TRUE, TRUE, FALSE),

-- Món 29: Cơm Chiên Dương Châu (com-chien)
('com-chien', 'Cơm Chiên Dương Châu', 'Cơm chiên hạt tơi, thập cẩm rau củ và xúc xích.', 'Cơm chiên tơi xốp, kết hợp tôm khô, lạp xưởng, trứng và rau củ hạt lựu đẹp mắt.', 35000, 5000, 40000, 4.4, 185, 'https://tse2.mm.bing.net/th/id/OIP.nHkdDmDXSKC8cJ3PLVjgtQHaE6?pid=Api&P=0&h=180', TRUE, TRUE, FALSE),

-- Món 30: Cơm Bò Lúc Lắc (com-bo-luc-lac)
('com-bo-luc-lac', 'Cơm Bò Lúc Lắc', 'Bò lúc lắc mềm ngọt, ăn kèm khoai tây chiên.', 'Thịt bò thăn thái vuông xào lửa lớn giữ độ mềm ngọt, sốt đậm đà ăn kèm cơm trắng và salad.', 60000, 5000, 65000, 4.7, 220, 'https://i.ytimg.com/vi/RfGrzXPuKeM/maxresdefault.jpg', TRUE, TRUE, FALSE),

-- Món 31: Cơm Niêu (com-nieu)
('com-nieu', 'Cơm Niêu', 'Cơm niêu đập cháy giòn, kho quẹt.', 'Cơm nấu niêu đất có lớp cháy giòn rụm, chấm cùng kho quẹt tôm thịt ba chỉ đậm vị.', 45000, 5000, 50000, 4.8, 160, 'https://tse3.mm.bing.net/th/id/OIP.vdevG-D5cLXfSrBGkpqkHwHaEU?pid=Api&P=0&h=180', TRUE, TRUE, FALSE),

-- Món 32: Cơm Cá Kho Tộ (com-ca-kho)
('com-ca-kho', 'Cơm Cá Kho Tộ', 'Cơm trắng cá lóc kho tộ đậm đà.', 'Cá lóc kho tộ keo quánh, cay nồng tiêu ớt, ăn cùng cơm trắng dẻo thơm chuẩn vị cơm nhà.', 40000, 5000, 45000, 4.7, 140, 'https://img-global.cpcdn.com/recipes/8762fe6a5e6ac0b2/1200x630cq70/photo.jpg', TRUE, TRUE, FALSE),

-- Món 33: Cơm Gà Xối Mỡ (com-ga-xoi-mo-2)
('com-ga-xoi-mo-2', 'Cơm Gà Xối Mỡ', 'Gà xối mỡ giòn rụm, cơm chiên tỏi.', 'Đùi gà góc tư xối mỡ giòn da, thịt bên trong mọng nước, ăn cùng cơm chiên mỡ tỏi thơm phức.', 40000, 5000, 45000, 4.7, 250, 'https://ticotravel.com.vn/wp-content/uploads/2022/06/Com-ga-xoi-mo-15.jpg', TRUE, TRUE, FALSE),

-- Món 34: Cơm Trộn Hàn Quốc (com-tron)
('com-tron', 'Cơm Trộn Hàn Quốc', 'Bibimbap trộn tương ớt Hàn thơm ngon.', 'Cơm trộn thịt bò xào, các loại nấm, rau củ và trứng ốp la đào, trộn đều với tương ớt Gochujang.', 50000, 5000, 55000, 4.6, 190, 'https://cdn.tgdd.vn/Files/2018/07/05/1099587/cach-lam-com-tron-han-quoc-bibimbap-ngon-nhu-nha-hang-202205241021184780.jpg', TRUE, TRUE, FALSE),

-- Món 35: Cơm Cà Ri Gà (com-ca-ri)
('com-ca-ri', 'Cơm Cà Ri Gà', 'Cà ri gà nước cốt dừa béo ngậy.', 'Gà nấu cà ri cay nhẹ, khoai tây và cà rốt mềm tan sệt cùng nước cốt dừa bùi béo.', 40000, 5000, 45000, 4.5, 130, 'https://www.huongnghiepaau.com/wp-content/uploads/2024/07/cach-nau-com-ca-ri-nhat.jpg', TRUE, TRUE, FALSE),

-- Món 36: Cơm Thịt Kho Trứng (com-thit-kho)
('com-thit-kho', 'Cơm Thịt Kho Trứng', 'Thịt kho tàu mặn ngọt đưa cơm.', 'Thịt ba chỉ kho nhừ cùng trứng vịt, nước dừa ngọt thanh thấm đẫm từng thớ thịt.', 35000, 5000, 40000, 4.7, 175, 'https://tanmyholdings.com/wp-content/uploads/2024/10/Com-thit-kho-tieu1.png', TRUE, TRUE, FALSE),

-- Món 37: Bánh Mì Thịt (banh-mi)
('banh-mi', 'Bánh Mì Thịt', 'Bánh mì vỏ giòn, nhân thịt chả pate đầy đặn.', 'Ổ bánh mì Việt Nam giòn rụm với bơ, pate, thịt nguội, chả lụa, dưa leo và rau mùi thơm lừng.', 20000, 5000, 25000, 4.9, 650, 'https://tse4.mm.bing.net/th/id/OIP.yxsHU68P6sAzYizPNk64IwHaEo?pid=Api&P=0&h=180', TRUE, TRUE, FALSE),

-- Món 38: Bánh Xèo (banh-xeo)
('banh-xeo', 'Bánh Xèo', 'Bánh xèo miền Tây vỏ giòn, tôm thịt giá đỗ.', 'Vỏ bánh mỏng giòn rụm, nhân tôm thịt nấm đầy đặn, cuốn cùng cải xanh và chấm nước mắm chua ngọt.', 35000, 5000, 40000, 4.7, 210, 'https://cdn.tgdd.vn/2020/12/CookProduct/11-1200x676.jpg', TRUE, TRUE, FALSE),

-- Món 39: Bánh Cuốn (banh-cuon)
('banh-cuon', 'Bánh Cuốn', 'Bánh cuốn nhân thịt mộc nhĩ tráng mỏng.', 'Bánh cuốn tráng tay mềm mướt, nhân thịt băm mộc nhĩ, ăn kèm chả quế và hành phi.', 25000, 5000, 30000, 4.6, 180, 'https://i.ytimg.com/vi/5CRLn1Bb1bg/maxresdefault.jpg', TRUE, TRUE, FALSE),

-- Món 40: Bánh Khọt (banh-khot)
('banh-khot', 'Bánh Khọt', 'Bánh khọt tôm vàng ươm, giòn rụm.', 'Bánh khọt Vũng Tàu đổ ngập dầu giòn rụm, bên trên là tôm tươi, ăn kèm đồ chua rau sống.', 35000, 5000, 40000, 4.6, 150, 'http://foodisafourletterword.com/wp-content/uploads/2020/12/Vietnamese_Crispy_Savory_Shrimp_Pancakes_Recipe_Banh_Khot_top.jpg', TRUE, TRUE, FALSE),

-- Món 41: Bánh Căn (banh-can)
('banh-can', 'Bánh Căn', 'Bánh căn trứng cút, hải sản chấm xíu mại.', 'Bánh căn nướng khuôn đất, topping trứng cút, mực, tôm chấm cùng bát xíu mại mỡ hành.', 30000, 5000, 35000, 4.7, 135, 'https://static.vinwonders.com/production/banh-can-phan-thiet-01.jpeg', TRUE, TRUE, FALSE),

-- Món 42: Bánh Ướt Lòng Gà (banh-uot)
('banh-uot', 'Bánh Ướt Lòng Gà', 'Bánh ướt dẻo dai trộn lòng gà xé.', 'Bánh ướt Đà Lạt mềm mướt, trộn cùng lòng gà, thịt gà xé phay giòn dai và mắm chua ngọt.', 30000, 5000, 35000, 4.5, 120, 'https://img-global.cpcdn.com/recipes/922a89ff50818a94/1200x630cq70/photo.jpg', TRUE, TRUE, FALSE),

-- Món 43: Bánh Đúc Nóng (banh-duc)
('banh-duc', 'Bánh Đúc Nóng', 'Bánh đúc dẻo quánh, thịt băm mộc nhĩ ấm lòng.', 'Bát bánh đúc nóng hổi dẻo quánh, chan nước mắm ngọt dầm thịt băm mộc nhĩ và hành phi.', 15000, 5000, 20000, 4.8, 205, 'https://cdn.tgdd.vn/2020/10/CookProduct/1260-1200x676-31.jpg', TRUE, TRUE, FALSE),

-- Món 44: Bánh Hỏi Heo Quay (banh-hoi)
('banh-hoi', 'Bánh Hỏi Heo Quay', 'Bánh hỏi mỡ hành, heo quay da giòn.', 'Bánh hỏi tơi mềm thoảng mùi mỡ hành hẹ, ăn kèm thịt heo quay da giòn rụm và nước mắm nêm.', 40000, 5000, 45000, 4.6, 165, 'https://cdn.tgdd.vn/2021/05/content/hoi-3-800x450.jpg', TRUE, TRUE, FALSE),

-- Món 45: Bánh Tráng Nướng (banh-trang-nuong)
('banh-trang-nuong', 'Bánh Tráng Nướng', 'Pizza Đà Lạt nướng mỡ hành trứng cút.', 'Bánh tráng nướng than hoa với trứng cút, xúc xích, ruốc, phô mai và sốt mayonnaise.', 15000, 5000, 20000, 4.8, 300, 'https://tse4.mm.bing.net/th/id/OIP.YM3x3rt1KAYSy542j8U6cAHaEK?pid=Api&P=0&h=180', TRUE, TRUE, FALSE),

-- Món 46: Bánh Tráng Trộn (banh-trang-tron)
('banh-trang-tron', 'Bánh Tráng Trộn', 'Bánh tráng trộn bò khô sa tế chua cay.', 'Bánh tráng mềm trộn cùng khô bò, xoài xanh bào, trứng cút, đậu phộng và muối tôm sa tế.', 15000, 5000, 20000, 4.7, 450, 'https://tse3.mm.bing.net/th/id/OIP.Hi2jizeoppiVBf0rUdSHuQHaEK?pid=Api&P=0&h=180', TRUE, TRUE, FALSE),

-- Món 47: Bánh Bột Lọc (banh-bot-loc)
('banh-bot-loc', 'Bánh Bột Lọc', 'Bánh bột lọc tôm thịt dai sực.', 'Bánh bột lọc trong suốt, dai sực, nhân tôm rim ba chỉ đậm đà, rưới mắm ớt ngọt.', 20000, 5000, 25000, 4.6, 190, 'https://tse1.mm.bing.net/th/id/OIP.OnpBH_GEL59gT6nZGeCkLAHaGR?pid=Api&P=0&h=180', TRUE, TRUE, FALSE),

-- Món 48: Bánh Bao Nhân Thịt (banh-bao)
('banh-bao', 'Bánh Bao Nhân Thịt', 'Bánh bao nóng hổi nhân thịt trứng cút.', 'Vỏ bánh xốp mềm, nhân thịt lợn băm mộc nhĩ thơm lừng cùng trứng cút và lạp xưởng.', 10000, 5000, 15000, 4.5, 220, 'https://tse2.mm.bing.net/th/id/OIP.d0gK8bLS9Ix7SbiT_hhhJwHaE7?pid=Api&P=0&h=180', TRUE, TRUE, FALSE),

-- Món 49: Bánh Tráng Phơi Sương (banh-trang-phoi-suong)
('banh-trang-phoi-suong', 'Bánh Tráng Phơi Sương', 'Bánh tráng phơi sương muối nhuyễn xì ke.', 'Bánh tráng phơi sương dẻo dai, cuộn cùng muối tôm nhuyễn, hành phi và bơ béo ngậy.', 20000, 5000, 25000, 4.6, 145, 'https://tse3.mm.bing.net/th/id/OIP.VRXV5NTQLniOyMIYLeCcNgHaHa?pid=Api&P=0&h=180', TRUE, TRUE, FALSE),

-- Món 50: Chân Gà Sả Tắc (chan-ga-sa-tac)
('chan-ga-sa-tac', 'Chân Gà Sả Tắc', 'Chân gà rút xương ngâm sả tắc chua ngọt.', 'Chân gà rút xương giòn sần sật ngâm trong nước mắm sả tắc ớt chua ngọt siêu cuốn.', 45000, 5000, 50000, 4.8, 310, 'https://i.ytimg.com/vi/MVmtMJ3ILME/maxresdefault.jpg', TRUE, TRUE, FALSE),

-- Món 51: Xiên Bẩn (Xiên Nướng/Chiên) (xien-ban)
('xien-ban', 'Xiên Bẩn (Xiên Nướng/Chiên)', 'Combo xiên chiên cổng trường các loại.', 'Các loại cá viên, bò viên, xúc xích, lạp xưởng chiên ngập dầu chấm tương ớt.', 15000, 5000, 20000, 4.5, 280, 'https://tse3.mm.bing.net/th/id/OIP.vWFL1HTrGW3b8d6XNgsGcAHaEn?pid=Api&P=0&h=180', TRUE, TRUE, FALSE),

-- Món 52: Chè Anh Đẹp Trai (che-anh-dep-trai)
('che-anh-dep-trai', 'Chè Anh Đẹp Trai', 'Ly chè thập cẩm cốt dừa mát lạnh.', 'Món chè thập cẩm thanh mát với các loại thạch, đậu đỏ, trân châu và nước cốt dừa.', 15000, 5000, 20000, 4.4, 120, 'https://mms.img.susercontent.com/vn-11134513-7r98o-lt4u34allm6x4a@resize_ss640x400!@crop_w640_h400_cT', TRUE, TRUE, FALSE),

-- Món 53: Khoai Tây Chiên Lắc Phô Mai (khoai-tay-chien)
('khoai-tay-chien', 'Khoai Tây Chiên Lắc Phô Mai', 'Khoai tây chiên giòn lắc bột phô mai béo.', 'Khoai tây cắt sợi chiên vàng giòn rụm, xóc đều cùng bột phô mai mằn mặn béo ngậy.', 20000, 5000, 25000, 4.6, 195, 'https://tse2.mm.bing.net/th/id/OIP.Jto_K08lSADMshiKXHAMNwHaFj?pid=Api&P=0&h=180', TRUE, TRUE, FALSE),

-- Món 54: Trà Đá (tra-da)
('tra-da', 'Trà Đá', 'Trà đá giải khát thanh mát.', 'Trà xanh thoang thoảng hương lài pha loãng với đá viên, thức uống quốc dân giải khát.', 0, 5000, 5000, 4.9, 850, 'https://migrationology.com/wp-content/uploads/2015/02/vietnamese_tra-da.jpg', TRUE, TRUE, FALSE),

-- Món 55: Sữa Đậu Nành (sua-dau)
('sua-dau', 'Sữa Đậu Nành', 'Sữa đậu nguyên chất béo ngậy.', 'Sữa đậu nành nguyên chất, nấu thủ công giữ nguyên độ thơm béo, uống nóng hay đá đều ngon.', 10000, 5000, 15000, 4.7, 230, 'https://tse1.mm.bing.net/th/id/OIP.FprEjT4Qwbj3pGWwKeoDbwHaE7?pid=Api&P=0&h=180', TRUE, TRUE, FALSE),

-- Món 56: Nước Sâm Lạnh (nuoc-sam)
('nuoc-sam', 'Nước Sâm Lạnh', 'Nước sâm bí đao rong biển giải nhiệt.', 'Nước sâm nấu từ bí đao, rong biển, thục địa thanh mát giúp giải nhiệt cơ thể cực tốt.', 10000, 5000, 15000, 4.8, 160, 'https://tse2.mm.bing.net/th/id/OIP.AnBR19fel8FWNKVzFKiiVgHaEK?pid=Api&P=0&h=180', TRUE, TRUE, FALSE),

-- Món 57: Coca-Cola (coca-cola)
('coca-cola', 'Coca-Cola', 'Lon Coca-Cola mát lạnh.', 'Nước ngọt có gas Coca-Cola mát lạnh, sảng khoái.', 10000, 5000, 15000, 4.8, 400, 'https://tse4.mm.bing.net/th/id/OIP.vTgKkSg-OfavsyV138XHzAHaDs?pid=Api&P=0&h=180', TRUE, TRUE, FALSE),

-- Món 58: Pepsi (pepsi)
('pepsi', 'Pepsi', 'Lon Pepsi sảng khoái.', 'Nước ngọt có gas Pepsi mát lạnh, cực đã khát.', 10000, 5000, 15000, 4.8, 380, 'https://tse3.mm.bing.net/th/id/OIP.c2zUCO9Uqt-2U04GZ8MZYQHaFb?pid=Api&P=0&h=180', TRUE, TRUE, FALSE),

-- Món 59: Trà Chanh (tra-chanh)
('tra-chanh', 'Trà Chanh', 'Trà chanh phố cổ chua ngọt, thơm mát.', 'Hồng trà pha cùng nước cốt chanh tươi chua chua ngọt ngọt, thanh nhiệt tươi mát.', 10000, 5000, 15000, 4.6, 210, 'https://photo2.tinhte.vn/data/attachment-files/2025/03/8661218_TRA_CHANH.jpg', TRUE, TRUE, FALSE),

-- Món 60: Trà Tắc (Quất) (tra-tac)
('tra-tac', 'Trà Tắc (Quất)', 'Trà tắc xí muội siêu to khổng lồ.', 'Trà lài pha cùng nước cốt tắc (quất), thơm mùi vỏ tắc tinh dầu chua ngọt hài hòa.', 10000, 5000, 15000, 4.7, 260, 'https://tse2.mm.bing.net/th/id/OIP.g5WWRyhVoreZbTyolhFtdQHaEK?pid=Api&P=0&h=180', TRUE, TRUE, FALSE),

-- Món 61: Cá Viên Chiên Mắm (ca-vien-chien-mam)
('ca-vien-chien-mam', 'Cá Viên Chiên Mắm', 'Cá viên chiên giòn chấm mắm chua ngọt.', 'Cá viên dai giòn chiên vàng rụm, chấm cùng mắm chua ngọt pha ớt tỏi thơm lừng.', 20000, 5000, 25000, 4.6, 175, 'https://tse3.mm.bing.net/th/id/OIP.vWFL1HTrGW3b8d6XNgsGcAHaEn?pid=Api&P=0&h=180', TRUE, TRUE, FALSE),

-- Món 62: Combo 2 Người (combo-2-nguoi)
('combo-2-nguoi', 'Combo 2 Người', '2 Cơm tấm (hoặc Bún chả) + Cá viên chiên mắm + 2 Sữa đậu.', 'Combo dành cho 2 người với 2 phần cơm tấm hoặc bún chả tùy chọn, 1 phần cá viên chiên mắm chua ngọt và 2 ly sữa đậu nành thơm béo.', 140000, 5000, 145000, 4.8, 95, 'https://statics.vinwonders.com/com-tam-ngon-o-sai-gon-0_1630562640.jpg', TRUE, TRUE, FALSE),

-- Món 63: Combo 3 Người (combo-3-nguoi)
('combo-3-nguoi', 'Combo 3 Người', '3 Cơm gà xối mỡ + Khoai tây chiên + 3 Coca-Cola.', 'Combo no say cho 3 người với 3 phần cơm gà xối mỡ giòn rụm, 1 phần khoai tây chiên lắc phô mai và 3 lon Coca-Cola mát lạnh.', 200000, 5000, 205000, 4.7, 78, 'https://ticotravel.com.vn/wp-content/uploads/2022/06/Com-ga-xoi-mo-15.jpg', TRUE, TRUE, FALSE),

-- Món 64: Combo 4-5 Người (combo-4-5-nguoi)
('combo-4-5-nguoi', 'Combo 4-5 Người', '2 Bún đậu mắm tôm + 2 Bánh mì + Chân gà sả tắc + Khoai tây chiên + 5 Trà chanh.', 'Combo tiệc tùng cho 4-5 người với 2 mẹt bún đậu mắm tôm lớn, 2 ổ bánh mì giòn, 1 đĩa chân gà sả tắc chua ngọt, 1 phần khoai tây chiên phô mai và 5 ly trà chanh mát lạnh.', 325000, 5000, 330000, 4.9, 62, 'https://static.vinwonders.com/2023/01/bun-dau-mam-tom-thumb.jpg', TRUE, TRUE, FALSE),

-- Món 65: Combo Nhóm Ăn Nhẹ Tối (5 người) (combo-nhom-an-nhe-toi)
('combo-nhom-an-nhe-toi', 'Combo Nhóm Ăn Nhẹ Tối (5 người)', '5 Bánh bao + 5 Bánh mì + 5 Trà đá + 2 Bánh tráng phơi sương.', 'Combo ăn nhẹ buổi tối cho 5 người với bánh bao nóng hổi, bánh mì giòn rụm, trà đá thanh mát và bánh tráng phơi sương dẻo dai muối tôm. Nhẹ nhàng, tiện lợi, đủ no.', 190000, 5000, 195000, 4.6, 44, 'https://tse2.mm.bing.net/th/id/OIP.d0gK8bLS9Ix7SbiT_hhhJwHaE7?pid=Api&P=0&h=180', TRUE, TRUE, FALSE)
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
('combo-com-ga-tra-dao', 'do-uong'),
('pho', 'mi-pho'),
('pho', 'mon-chinh'),
('pho-tron', 'mi-pho'),
('pho-tron', 'mon-chinh'),
('bun-bo-hue', 'mon-chinh'),
('bun-rieu', 'mi-pho'),
('bun-rieu', 'mon-chinh'),
('hu-tieu', 'mi-pho'),
('hu-tieu', 'mon-chinh'),
('mien-ga', 'mi-pho'),
('mien-ga', 'mon-chinh'),
('chao-suon', 'an-vat'),
('banh-canh', 'mi-pho'),
('banh-canh', 'mon-chinh'),
('bun-moc', 'mi-pho'),
('bun-moc', 'mon-chinh'),
('bun-thang', 'mi-pho'),
('bun-thang', 'mon-chinh'),
('bun-ca', 'mi-pho'),
('bun-ca', 'mon-chinh'),
('bun-cha', 'mi-pho'),
('bun-cha', 'mon-chinh'),
('bun-mam', 'mi-pho'),
('bun-mam', 'mon-chinh'),
('bun-dau-mam-tom', 'mon-chinh'),
('nem-nuong-nha-trang', 'mon-chinh'),
('nem-nuong-nha-trang', 'an-vat'),
('goi-cuon', 'an-vat'),
('com-tam', 'com-hop'),
('com-tam', 'mon-chinh'),
('com-ga', 'com-hop'),
('com-ga', 'mon-chinh'),
('com-suon', 'com-hop'),
('com-suon', 'mon-chinh'),
('com-chien', 'com-hop'),
('com-chien', 'mon-chinh'),
('com-bo-luc-lac', 'com-hop'),
('com-bo-luc-lac', 'mon-chinh'),
('com-nieu', 'com-hop'),
('com-nieu', 'mon-chinh'),
('com-ca-kho', 'com-hop'),
('com-ca-kho', 'mon-chinh'),
('com-ga-xoi-mo-2', 'com-hop'),
('com-ga-xoi-mo-2', 'mon-chinh'),
('com-tron', 'com-hop'),
('com-tron', 'mon-chinh'),
('com-ca-ri', 'com-hop'),
('com-ca-ri', 'mon-chinh'),
('com-thit-kho', 'com-hop'),
('com-thit-kho', 'mon-chinh'),
('banh-mi', 'an-vat'),
('banh-mi', 'mon-chinh'),
('banh-xeo', 'mon-chinh'),
('banh-xeo', 'an-vat'),
('banh-cuon', 'mon-chinh'),
('banh-khot', 'an-vat'),
('banh-can', 'an-vat'),
('banh-uot', 'mon-chinh'),
('banh-duc', 'an-vat'),
('banh-hoi', 'mon-chinh'),
('banh-trang-nuong', 'an-vat'),
('banh-trang-tron', 'an-vat'),
('banh-bot-loc', 'an-vat'),
('banh-bao', 'an-vat'),
('banh-trang-phoi-suong', 'an-vat'),
('chan-ga-sa-tac', 'an-vat'),
('xien-ban', 'an-vat'),
('che-anh-dep-trai', 'trang-mieng'),
('che-anh-dep-trai', 'an-vat'),
('khoai-tay-chien', 'an-vat'),
('tra-da', 'do-uong'),
('sua-dau', 'do-uong'),
('nuoc-sam', 'do-uong'),
('coca-cola', 'do-uong'),
('pepsi', 'do-uong'),
('tra-chanh', 'do-uong'),
('tra-tac', 'do-uong'),
('ca-vien-chien-mam', 'an-vat'),
('combo-2-nguoi', 'combos'),
('combo-3-nguoi', 'combos'),
('combo-4-5-nguoi', 'combos'),
('combo-nhom-an-nhe-toi', 'combos')
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
(8, 'combo-com-ga-tra-dao', 'new'),
(9, 'pho', 'bestSeller'),
(10, 'pho', 'hot'),
(11, 'chao-suon', 'hot'),
(12, 'bun-cha', 'bestSeller'),
(13, 'bun-dau-mam-tom', 'hot'),
(14, 'com-tam', 'bestSeller'),
(15, 'com-bo-luc-lac', 'hot'),
(16, 'com-ga-xoi-mo-2', 'hot'),
(17, 'banh-mi', 'bestSeller'),
(18, 'banh-trang-nuong', 'hot'),
(19, 'banh-trang-tron', 'bestSeller'),
(20, 'chan-ga-sa-tac', 'hot'),
(21, 'tra-tac', 'hot'),
(22, 'combo-2-nguoi', 'hot'),
(23, 'combo-3-nguoi', 'bestSeller'),
(24, 'combo-4-5-nguoi', 'hot')
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
