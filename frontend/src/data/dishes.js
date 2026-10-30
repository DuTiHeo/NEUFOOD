// Synced from the supplied sample_data.sql; prices include the system fee.
export const MENU_CATEGORIES = [
  {
    "id": "com-hop",
    "label": "Cơm Hộp",
    "description": "Các món cơm văn phòng, sinh viên nóng hổi đủ dinh dưỡng",
    "display_order": 1,
    "is_active": true
  },
  {
    "id": "mi-pho",
    "label": "Mì Phở",
    "description": "Bún, phở, mì xào, miến nước thanh ngọt đậm đà",
    "display_order": 2,
    "is_active": true
  },
  {
    "id": "combos",
    "label": "Combos Tiết Kiệm",
    "description": "Combo đồ ăn kèm nước siêu hời cho sinh viên",
    "display_order": 3,
    "is_active": true
  },
  {
    "id": "do-uong",
    "label": "Đồ Uống",
    "description": "Trà sữa, trà trái cây tươi, cà phê năng động",
    "display_order": 4,
    "is_active": true
  },
  {
    "id": "an-vat",
    "label": "Ăn Vặt",
    "description": "Nem chua rán, khoai tây lắc, xúc xích giòn rụm",
    "display_order": 5,
    "is_active": true
  },
  {
    "id": "trang-mieng",
    "label": "Tráng Miệng",
    "description": "Chè, sữa chua, caramen mát lạnh sau bữa ăn",
    "display_order": 6,
    "is_active": true
  },
  {
    "id": "mon-chinh",
    "label": "Món Chính",
    "description": "Các món ăn chính no bụng cho bữa trưa và bữa tối",
    "display_order": 7,
    "is_active": true
  },
  {
    "id": "banh-kem",
    "label": "Bánh Kem",
    "description": "Bánh ngọt, bánh sinh nhật và bánh kem các loại",
    "display_order": 8,
    "is_active": true
  }
]

export const dishes = [
  {
    "id": "pho-bo-tai-lan",
    "name": "Phở Bò Tái Lăn",
    "shortDescription": "Phở truyền thống, nước dùng thanh ngọt, thịt bò mềm.",
    "description": "Bát phở truyền thống với nước dùng được ninh từ xương bò nhiều giờ, kết hợp cùng bánh phở dai mềm và thịt bò tươi ngon xào tái lăn thơm nức.",
    "basePrice": 45000,
    "systemFee": 5000,
    "price": 50000,
    "rating": 4.8,
    "reviewCount": 312,
    "image": "https://live2makan.com/wp-content/uploads/2022/08/l2m-vn-2207-pho10-05.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "mi-pho"
    ],
    "badges": [
      "bestSeller",
      "hot"
    ]
  },
  {
    "id": "pho-tron-chua-ngot",
    "name": "Phở Trộn Chua Ngọt",
    "shortDescription": "Phở trộn đậm đà cùng sốt me chua ngọt.",
    "description": "Bánh phở mềm dai trộn cùng thịt bò mềm, rau sống tươi mát, lạc rang giòn bùi và nước sốt me chua ngọt đặc trưng của Canteen A2.",
    "basePrice": 40000,
    "systemFee": 5000,
    "price": 45000,
    "rating": 4.6,
    "reviewCount": 154,
    "image": "https://cdn.tgdd.vn/2021/08/CookRecipe/Avatar/pho-ga-tron-sa-te-thumbnail.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "mi-pho"
    ],
    "badges": []
  },
  {
    "id": "bun-bo-hue",
    "name": "Bún Bò Xứ Huế",
    "shortDescription": "Bún bò chuẩn vị Huế, cay nồng, đậm đà.",
    "description": "Nước dùng thơm lừng mùi mắm ruốc và sả, full topping với thịt bò bắp, giò heo giòn sần sật, chả cua và tiết luộc nóng hổi.",
    "basePrice": 50000,
    "systemFee": 5000,
    "price": 55000,
    "rating": 4.9,
    "reviewCount": 420,
    "image": "https://cdn.tgdd.vn/Files/2017/03/24/964495/cach-nau-bun-bo-hue-gio-heo-ngon-cong-thuc-chuan-vi-202208251617593627.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "mi-pho",
      "mon-chinh"
    ],
    "badges": [
      "hot"
    ]
  },
  {
    "id": "bun-rieu-cua-dong",
    "name": "Bún Riêu Cua Đồng",
    "shortDescription": "Bún riêu cua đồng thanh mát ngọt vị.",
    "description": "Bún riêu cua đồng với nước dùng chua thanh từ cà chua và giấm bỗng, gạch cua xào béo ngậy, đậu hũ chiên vàng và chả lá lốt.",
    "basePrice": 35000,
    "systemFee": 5000,
    "price": 40000,
    "rating": 4.5,
    "reviewCount": 180,
    "image": "https://i.ytimg.com/vi/C1P1Cw9J1-I/maxresdefault.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "mi-pho"
    ],
    "badges": []
  },
  {
    "id": "com-ga-xoi-mo",
    "name": "Cơm Gà Xối Mỡ Da Giòn",
    "shortDescription": "Đùi gà chiên da giòn rụm, cơm rang thơm béo.",
    "description": "Cơm rang hạt tơi màu đỏ hạt điều, ăn cùng đùi gà góc tư chiên xối mỡ giòn tan rụm và dưa chuột, đồ chua kèm nước mắm tỏi ớt.",
    "basePrice": 40000,
    "systemFee": 5000,
    "price": 45000,
    "rating": 4.9,
    "reviewCount": 530,
    "image": "https://cdn.tgdd.vn/2021/01/CookRecipe/GalleryStep/thanh-pham-362.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "com-hop"
    ],
    "badges": [
      "bestSeller",
      "hot"
    ]
  },
  {
    "id": "com-suon-nuong",
    "name": "Cơm Sườn Nướng Mật Ong",
    "shortDescription": "Miếng sườn cốt lết dày dặn ướp sốt mật ong thơm lừng.",
    "description": "Cơm tấm dẻo thơm ăn kèm sườn cốt lết nướng than hoa vàng óng, mỡ hành béo ngậy và trứng ốp la lòng đào.",
    "basePrice": 40000,
    "systemFee": 5000,
    "price": 45000,
    "rating": 4.7,
    "reviewCount": 210,
    "image": "https://mms.img.susercontent.com/vn-11134513-7r98o-lsvb7d0ao3b826@resize_ss1242x600!@crop_w1242_h600_cT",
    "is_available": false,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "com-hop"
    ],
    "badges": []
  },
  {
    "id": "tra-sua-tran-chau",
    "name": "Trà Sữa Trân Châu Đường Đen",
    "shortDescription": "Vị trà ô long sữa thơm béo, trân châu mềm dẻo.",
    "description": "Trà ô long thượng hạng hòa quyện sữa tươi béo ngậy cùng trân châu đen nấu đường nâu mật mía mềm dẻo thơm phức.",
    "basePrice": 30000,
    "systemFee": 5000,
    "price": 35000,
    "rating": 4.7,
    "reviewCount": 240,
    "image": "https://bizweb.dktcdn.net/100/519/595/files/1-180559f8-1ce7-43b7-83ce-a37eac803791.jpg?v=1744966178923",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "do-uong"
    ],
    "badges": [
      "bestSeller"
    ]
  },
  {
    "id": "tra-dao-cam-sa",
    "name": "Trà Đào Cam Sả Tươi Mát",
    "shortDescription": "Thanh lọc cơ thể, hương sả thơm lừng miếng đào giòn ngọt.",
    "description": "Trà đen hảo hạng kết hợp nước cốt cam tươi nguyên chất, sả đập dập thơm dịu và những lát đào ngâm giòn tan.",
    "basePrice": 25000,
    "systemFee": 5000,
    "price": 30000,
    "rating": 4.8,
    "reviewCount": 195,
    "image": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=400&q=80",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "do-uong"
    ],
    "badges": []
  },
  {
    "id": "nem-chua-ran",
    "name": "Nem Chua Rán Giòn Rụm (10 chiếc)",
    "shortDescription": "Nem chua lăn bột chiên xù vàng rụm chấm tương ớt cay nồng.",
    "description": "Món ăn vặt quốc dân của sinh viên NEU, nem ngọt đậm đà, vỏ ngoài giòn rụm, bên trong dẻo mềm béo ngậy.",
    "basePrice": 30000,
    "systemFee": 5000,
    "price": 35000,
    "rating": 4.9,
    "reviewCount": 610,
    "image": "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=400&q=80",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "an-vat"
    ],
    "badges": [
      "bestSeller"
    ]
  },
  {
    "id": "combo-com-ga-tra-dao",
    "name": "Combo Bữa Trưa Năng Động (Cơm Gà + Trà Đào)",
    "shortDescription": "Tiết kiệm hơn khi mua combo cơm gà và trà đào mát lạnh.",
    "description": "Trọn gói bữa trưa đủ chất gồm 1 đĩa cơm gà xối mỡ da giòn và 1 ly trà đào cam sả size lớn.",
    "basePrice": 60000,
    "systemFee": 5000,
    "price": 65000,
    "rating": 4.9,
    "reviewCount": 380,
    "image": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "combos",
      "com-hop",
      "do-uong"
    ],
    "badges": [
      "new"
    ]
  },
  {
    "id": "pho",
    "name": "Phở",
    "shortDescription": "Phở truyền thống, nước dùng thanh ngọt, thịt bò mềm.",
    "description": "Bát phở truyền thống với nước dùng được ninh từ xương bò nhiều giờ, kết hợp cùng bánh phở dai mềm và thịt bò tươi ngon.",
    "basePrice": 45000,
    "systemFee": 5000,
    "price": 50000,
    "rating": 4.8,
    "reviewCount": 312,
    "image": "https://live2makan.com/wp-content/uploads/2022/08/l2m-vn-2207-pho10-05.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "mi-pho",
      "mon-chinh"
    ],
    "badges": [
      "bestSeller",
      "hot"
    ]
  },
  {
    "id": "pho-tron",
    "name": "Phở Trộn",
    "shortDescription": "Phở trộn đậm đà cùng sốt me chua ngọt.",
    "description": "Bánh phở mềm dai trộn cùng thịt bò mềm, rau sống tươi mát và nước sốt me chua ngọt đặc trưng.",
    "basePrice": 40000,
    "systemFee": 5000,
    "price": 45000,
    "rating": 4.6,
    "reviewCount": 154,
    "image": "https://cdn.tgdd.vn/2021/08/CookRecipe/Avatar/pho-ga-tron-sa-te-thumbnail.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "mi-pho",
      "mon-chinh"
    ],
    "badges": []
  },
  {
    "id": "bun-rieu",
    "name": "Bún Riêu",
    "shortDescription": "Bún riêu cua đồng thanh mát.",
    "description": "Bún riêu cua đồng với nước dùng chua thanh từ cà chua, gạch cua béo ngậy, đậu hũ chiên và chả.",
    "basePrice": 35000,
    "systemFee": 5000,
    "price": 40000,
    "rating": 4.5,
    "reviewCount": 180,
    "image": "https://i.ytimg.com/vi/C1P1Cw9J1-I/maxresdefault.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "mi-pho",
      "mon-chinh"
    ],
    "badges": []
  },
  {
    "id": "hu-tieu",
    "name": "Hủ Tiếu",
    "shortDescription": "Hủ tiếu Nam Vang nước dùng ngọt thanh.",
    "description": "Sợi hủ tiếu dai ngon ăn kèm tôm, thịt băm, gan heo và trứng cút, nước dùng thanh ngọt từ xương.",
    "basePrice": 40000,
    "systemFee": 5000,
    "price": 45000,
    "rating": 4.7,
    "reviewCount": 210,
    "image": "https://media.cooky.vn/recipe/g3/22522/s800x500/recipe22522-636439367069081450.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "mi-pho",
      "mon-chinh"
    ],
    "badges": []
  },
  {
    "id": "mien-ga",
    "name": "Miến Gà",
    "shortDescription": "Miến dong mộc nhĩ, thịt gà ta dai ngon.",
    "description": "Sợi miến dai mềm kết hợp cùng nước luộc gà ngọt thanh và thịt gà ta xé phay, thêm nấm hương thơm lừng.",
    "basePrice": 35000,
    "systemFee": 5000,
    "price": 40000,
    "rating": 4.4,
    "reviewCount": 120,
    "image": "https://cdn.tgdd.vn/Files/2017/03/22/963778/bi-quyet-nau-mien-ga-thom-ngon-da-ga-vang-gion-202208261323269332.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "mi-pho",
      "mon-chinh"
    ],
    "badges": []
  },
  {
    "id": "chao-suon",
    "name": "Cháo Sườn",
    "shortDescription": "Cháo sườn sụn sánh mịn, quẩy giòn tan.",
    "description": "Cháo được nấu nhuyễn mịn cùng sườn sụn ninh nhừ, ăn kèm quẩy giòn và chút hạt tiêu thơm nồng.",
    "basePrice": 20000,
    "systemFee": 5000,
    "price": 25000,
    "rating": 4.8,
    "reviewCount": 305,
    "image": "https://cdn.tgdd.vn/2021/05/CookProduct/axresdefault(1)-1200x676.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "an-vat"
    ],
    "badges": [
      "hot"
    ]
  },
  {
    "id": "banh-canh",
    "name": "Bánh Canh",
    "shortDescription": "Bánh canh chả cá đậm vị miền Trung.",
    "description": "Sợi bánh canh dai dai, nước lèo ngọt thanh từ cá, topping chả cá chiên và chả cá hấp.",
    "basePrice": 35000,
    "systemFee": 5000,
    "price": 40000,
    "rating": 4.5,
    "reviewCount": 140,
    "image": "https://i.ytimg.com/vi/ZjAxz95VJKQ/maxresdefault.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "mi-pho",
      "mon-chinh"
    ],
    "badges": []
  },
  {
    "id": "bun-moc",
    "name": "Bún Mọc",
    "shortDescription": "Bún mọc sườn non thanh đạm.",
    "description": "Viên mọc nhĩ nấm giòn giòn, sườn non mềm nục, nước dùng trong vắt thanh tao.",
    "basePrice": 35000,
    "systemFee": 5000,
    "price": 40000,
    "rating": 4.6,
    "reviewCount": 160,
    "image": "https://i.ytimg.com/vi/AwppaRlywik/maxresdefault.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "mi-pho",
      "mon-chinh"
    ],
    "badges": []
  },
  {
    "id": "bun-thang",
    "name": "Bún Thang",
    "shortDescription": "Tinh hoa ẩm thực Hà thành.",
    "description": "Bát bún thang cầu kỳ với gà xé, trứng tráng thái chỉ, giò lụa, tôm khô và nước dùng trong vắt ngọt lịm.",
    "basePrice": 45000,
    "systemFee": 5000,
    "price": 50000,
    "rating": 4.7,
    "reviewCount": 195,
    "image": "https://noiphodien123.vn/wp-content/uploads/2022/02/bun-thang-ngon.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "mi-pho",
      "mon-chinh"
    ],
    "badges": []
  },
  {
    "id": "bun-ca",
    "name": "Bún Cá",
    "shortDescription": "Bún cá rô đồng chiên giòn.",
    "description": "Miếng cá rô phi chiên giòn rụm bên ngoài, mềm ngọt bên trong, ăn kèm bún, dọc mùng và nước dùng chua thanh.",
    "basePrice": 35000,
    "systemFee": 5000,
    "price": 40000,
    "rating": 4.5,
    "reviewCount": 130,
    "image": "https://cdn.tgdd.vn/Files/2020/04/03/1246339/cach-nau-bun-ca-ha-noi-thom-ngon-chuan-vi-khong-ta-13.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "mi-pho",
      "mon-chinh"
    ],
    "badges": []
  },
  {
    "id": "bun-cha",
    "name": "Bún Chả",
    "shortDescription": "Bún chả thịt nướng than hoa thơm lừng.",
    "description": "Chả miếng và chả băm nướng than hoa cháy xém, ăn cùng bún rối và nước mắm chua ngọt dưa góp.",
    "basePrice": 40000,
    "systemFee": 5000,
    "price": 45000,
    "rating": 4.9,
    "reviewCount": 520,
    "image": "https://www.seriouseats.com/thmb/J0g7JWjk9r6CHESo1CIrD1BfGd0=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/20231204-SEA-VyTran-BunChaHanoi-19-f623913c6ef34a9185bcd6e5680c545f.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "mi-pho",
      "mon-chinh"
    ],
    "badges": [
      "bestSeller"
    ]
  },
  {
    "id": "bun-mam",
    "name": "Bún Mắm",
    "shortDescription": "Bún mắm miền Tây đậm đà, full topping.",
    "description": "Nước lèo mắm linh thơm phức, đầy ắp hải sản tôm mực, heo quay và các loại rau đặc trưng miền Tây.",
    "basePrice": 50000,
    "systemFee": 5000,
    "price": 55000,
    "rating": 4.6,
    "reviewCount": 110,
    "image": "https://cdn.tgdd.vn/Files/2019/03/12/1154316/cach-nau-bun-mam-mien-tay-chuan-thom-ngon-don-gian-tai-nha-202112211640380018.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "mi-pho",
      "mon-chinh"
    ],
    "badges": []
  },
  {
    "id": "bun-dau-mam-tom",
    "name": "Bún Đậu Mắm Tôm",
    "shortDescription": "Bún đậu tá lả mắm tôm chuẩn vị.",
    "description": "Mẹt bún đậu đầy đặn với đậu hũ chiên giòn, thịt luộc, chả cốm, dồi sụn và mắm tôm đánh bọt.",
    "basePrice": 45000,
    "systemFee": 5000,
    "price": 50000,
    "rating": 4.8,
    "reviewCount": 415,
    "image": "https://static.vinwonders.com/2023/01/bun-dau-mam-tom-thumb.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "mon-chinh"
    ],
    "badges": [
      "hot"
    ]
  },
  {
    "id": "nem-nuong-nha-trang",
    "name": "Nem Nướng Nha Trang",
    "shortDescription": "Nem nướng cuốn ram giòn, sốt chấm đậu phộng.",
    "description": "Nem nướng lụi thơm lừng, cuốn cùng bánh tráng, ram chiên giòn, rau sống và chấm nước sốt đặc biệt.",
    "basePrice": 40000,
    "systemFee": 5000,
    "price": 45000,
    "rating": 4.7,
    "reviewCount": 230,
    "image": "https://cdn.tgdd.vn/2021/09/CookDish/cach-lam-nem-nuong-nha-trang-bang-noi-chien-khong-dau-thom-avt-1200x676.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "mon-chinh",
      "an-vat"
    ],
    "badges": []
  },
  {
    "id": "goi-cuon",
    "name": "Gỏi Cuốn",
    "shortDescription": "Gỏi cuốn tôm thịt thanh mát, chấm tương đen.",
    "description": "Cuốn tôm thịt luộc tươi ngon cùng bún và rau thơm, chấm mắm nêm hoặc tương đen bùi béo.",
    "basePrice": 25000,
    "systemFee": 5000,
    "price": 30000,
    "rating": 4.5,
    "reviewCount": 155,
    "image": "https://images.squarespace-cdn.com/content/v1/52d3fafee4b03c7eaedee15f/30cf6af1-a5a1-456f-ba8e-3d09713608e3/thumbnail-9264.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "an-vat"
    ],
    "badges": []
  },
  {
    "id": "com-tam",
    "name": "Cơm Tấm",
    "shortDescription": "Cơm tấm sườn bì chả mỡ hành thơm nức.",
    "description": "Cơm tấm dẻo tơi, sườn nướng mọng nước đậm vị, bì dai giòn, chả trứng béo ngậy chan mắm chua ngọt.",
    "basePrice": 50000,
    "systemFee": 5000,
    "price": 55000,
    "rating": 4.8,
    "reviewCount": 380,
    "image": "https://statics.vinwonders.com/com-tam-ngon-o-sai-gon-0_1630562640.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "com-hop",
      "mon-chinh"
    ],
    "badges": [
      "bestSeller"
    ]
  },
  {
    "id": "com-ga",
    "name": "Cơm Gà",
    "shortDescription": "Cơm gà Hội An vàng ươm, thịt gà xé.",
    "description": "Hạt cơm nấu nước luộc gà vàng ươm, thịt gà ta xé phay trộn gỏi hành tây chua ngọt.",
    "basePrice": 40000,
    "systemFee": 5000,
    "price": 45000,
    "rating": 4.6,
    "reviewCount": 210,
    "image": "https://static.vinwonders.com/2023/02/com-ga-da-nang-1.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "com-hop",
      "mon-chinh"
    ],
    "badges": []
  },
  {
    "id": "com-suon",
    "name": "Cơm Sườn Cốt Lết",
    "shortDescription": "Cơm sườn cốt lết rim mặn ngọt.",
    "description": "Miếng sườn cốt lết dày thịt, rim mặn ngọt đậm đà, ăn đưa cơm kèm canh chua giải nhiệt.",
    "basePrice": 35000,
    "systemFee": 5000,
    "price": 40000,
    "rating": 4.5,
    "reviewCount": 145,
    "image": "https://i.ytimg.com/vi/cJu6tFJe_Gc/maxresdefault.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "com-hop",
      "mon-chinh"
    ],
    "badges": []
  },
  {
    "id": "com-chien",
    "name": "Cơm Chiên Dương Châu",
    "shortDescription": "Cơm chiên hạt tơi, thập cẩm rau củ và xúc xích.",
    "description": "Cơm chiên tơi xốp, kết hợp tôm khô, lạp xưởng, trứng và rau củ hạt lựu đẹp mắt.",
    "basePrice": 35000,
    "systemFee": 5000,
    "price": 40000,
    "rating": 4.4,
    "reviewCount": 185,
    "image": "https://tse2.mm.bing.net/th/id/OIP.nHkdDmDXSKC8cJ3PLVjgtQHaE6?pid=Api&P=0&h=180",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "com-hop",
      "mon-chinh"
    ],
    "badges": []
  },
  {
    "id": "com-bo-luc-lac",
    "name": "Cơm Bò Lúc Lắc",
    "shortDescription": "Bò lúc lắc mềm ngọt, ăn kèm khoai tây chiên.",
    "description": "Thịt bò thăn thái vuông xào lửa lớn giữ độ mềm ngọt, sốt đậm đà ăn kèm cơm trắng và salad.",
    "basePrice": 60000,
    "systemFee": 5000,
    "price": 65000,
    "rating": 4.7,
    "reviewCount": 220,
    "image": "https://i.ytimg.com/vi/RfGrzXPuKeM/maxresdefault.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "com-hop",
      "mon-chinh"
    ],
    "badges": [
      "hot"
    ]
  },
  {
    "id": "com-nieu",
    "name": "Cơm Niêu",
    "shortDescription": "Cơm niêu đập cháy giòn, kho quẹt.",
    "description": "Cơm nấu niêu đất có lớp cháy giòn rụm, chấm cùng kho quẹt tôm thịt ba chỉ đậm vị.",
    "basePrice": 45000,
    "systemFee": 5000,
    "price": 50000,
    "rating": 4.8,
    "reviewCount": 160,
    "image": "https://tse3.mm.bing.net/th/id/OIP.vdevG-D5cLXfSrBGkpqkHwHaEU?pid=Api&P=0&h=180",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "com-hop",
      "mon-chinh"
    ],
    "badges": []
  },
  {
    "id": "com-ca-kho",
    "name": "Cơm Cá Kho Tộ",
    "shortDescription": "Cơm trắng cá lóc kho tộ đậm đà.",
    "description": "Cá lóc kho tộ keo quánh, cay nồng tiêu ớt, ăn cùng cơm trắng dẻo thơm chuẩn vị cơm nhà.",
    "basePrice": 40000,
    "systemFee": 5000,
    "price": 45000,
    "rating": 4.7,
    "reviewCount": 140,
    "image": "https://img-global.cpcdn.com/recipes/8762fe6a5e6ac0b2/1200x630cq70/photo.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "com-hop",
      "mon-chinh"
    ],
    "badges": []
  },
  {
    "id": "com-ga-xoi-mo-2",
    "name": "Cơm Gà Xối Mỡ",
    "shortDescription": "Gà xối mỡ giòn rụm, cơm chiên tỏi.",
    "description": "Đùi gà góc tư xối mỡ giòn da, thịt bên trong mọng nước, ăn cùng cơm chiên mỡ tỏi thơm phức.",
    "basePrice": 40000,
    "systemFee": 5000,
    "price": 45000,
    "rating": 4.7,
    "reviewCount": 250,
    "image": "https://ticotravel.com.vn/wp-content/uploads/2022/06/Com-ga-xoi-mo-15.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "com-hop",
      "mon-chinh"
    ],
    "badges": [
      "hot"
    ]
  },
  {
    "id": "com-tron",
    "name": "Cơm Trộn Hàn Quốc",
    "shortDescription": "Bibimbap trộn tương ớt Hàn thơm ngon.",
    "description": "Cơm trộn thịt bò xào, các loại nấm, rau củ và trứng ốp la đào, trộn đều với tương ớt Gochujang.",
    "basePrice": 50000,
    "systemFee": 5000,
    "price": 55000,
    "rating": 4.6,
    "reviewCount": 190,
    "image": "https://cdn.tgdd.vn/Files/2018/07/05/1099587/cach-lam-com-tron-han-quoc-bibimbap-ngon-nhu-nha-hang-202205241021184780.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "com-hop",
      "mon-chinh"
    ],
    "badges": []
  },
  {
    "id": "com-ca-ri",
    "name": "Cơm Cà Ri Gà",
    "shortDescription": "Cà ri gà nước cốt dừa béo ngậy.",
    "description": "Gà nấu cà ri cay nhẹ, khoai tây và cà rốt mềm tan sệt cùng nước cốt dừa bùi béo.",
    "basePrice": 40000,
    "systemFee": 5000,
    "price": 45000,
    "rating": 4.5,
    "reviewCount": 130,
    "image": "https://www.huongnghiepaau.com/wp-content/uploads/2024/07/cach-nau-com-ca-ri-nhat.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "com-hop",
      "mon-chinh"
    ],
    "badges": []
  },
  {
    "id": "com-thit-kho",
    "name": "Cơm Thịt Kho Trứng",
    "shortDescription": "Thịt kho tàu mặn ngọt đưa cơm.",
    "description": "Thịt ba chỉ kho nhừ cùng trứng vịt, nước dừa ngọt thanh thấm đẫm từng thớ thịt.",
    "basePrice": 35000,
    "systemFee": 5000,
    "price": 40000,
    "rating": 4.7,
    "reviewCount": 175,
    "image": "https://tanmyholdings.com/wp-content/uploads/2024/10/Com-thit-kho-tieu1.png",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "com-hop",
      "mon-chinh"
    ],
    "badges": []
  },
  {
    "id": "banh-mi",
    "name": "Bánh Mì Thịt",
    "shortDescription": "Bánh mì vỏ giòn, nhân thịt chả pate đầy đặn.",
    "description": "Ổ bánh mì Việt Nam giòn rụm với bơ, pate, thịt nguội, chả lụa, dưa leo và rau mùi thơm lừng.",
    "basePrice": 20000,
    "systemFee": 5000,
    "price": 25000,
    "rating": 4.9,
    "reviewCount": 650,
    "image": "https://tse4.mm.bing.net/th/id/OIP.yxsHU68P6sAzYizPNk64IwHaEo?pid=Api&P=0&h=180",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "an-vat",
      "mon-chinh"
    ],
    "badges": [
      "bestSeller"
    ]
  },
  {
    "id": "banh-xeo",
    "name": "Bánh Xèo",
    "shortDescription": "Bánh xèo miền Tây vỏ giòn, tôm thịt giá đỗ.",
    "description": "Vỏ bánh mỏng giòn rụm, nhân tôm thịt nấm đầy đặn, cuốn cùng cải xanh và chấm nước mắm chua ngọt.",
    "basePrice": 35000,
    "systemFee": 5000,
    "price": 40000,
    "rating": 4.7,
    "reviewCount": 210,
    "image": "https://cdn.tgdd.vn/2020/12/CookProduct/11-1200x676.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "mon-chinh",
      "an-vat"
    ],
    "badges": []
  },
  {
    "id": "banh-cuon",
    "name": "Bánh Cuốn",
    "shortDescription": "Bánh cuốn nhân thịt mộc nhĩ tráng mỏng.",
    "description": "Bánh cuốn tráng tay mềm mướt, nhân thịt băm mộc nhĩ, ăn kèm chả quế và hành phi.",
    "basePrice": 25000,
    "systemFee": 5000,
    "price": 30000,
    "rating": 4.6,
    "reviewCount": 180,
    "image": "https://i.ytimg.com/vi/5CRLn1Bb1bg/maxresdefault.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "mon-chinh"
    ],
    "badges": []
  },
  {
    "id": "banh-khot",
    "name": "Bánh Khọt",
    "shortDescription": "Bánh khọt tôm vàng ươm, giòn rụm.",
    "description": "Bánh khọt Vũng Tàu đổ ngập dầu giòn rụm, bên trên là tôm tươi, ăn kèm đồ chua rau sống.",
    "basePrice": 35000,
    "systemFee": 5000,
    "price": 40000,
    "rating": 4.6,
    "reviewCount": 150,
    "image": "http://foodisafourletterword.com/wp-content/uploads/2020/12/Vietnamese_Crispy_Savory_Shrimp_Pancakes_Recipe_Banh_Khot_top.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "an-vat"
    ],
    "badges": []
  },
  {
    "id": "banh-can",
    "name": "Bánh Căn",
    "shortDescription": "Bánh căn trứng cút, hải sản chấm xíu mại.",
    "description": "Bánh căn nướng khuôn đất, topping trứng cút, mực, tôm chấm cùng bát xíu mại mỡ hành.",
    "basePrice": 30000,
    "systemFee": 5000,
    "price": 35000,
    "rating": 4.7,
    "reviewCount": 135,
    "image": "https://static.vinwonders.com/production/banh-can-phan-thiet-01.jpeg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "an-vat"
    ],
    "badges": []
  },
  {
    "id": "banh-uot",
    "name": "Bánh Ướt Lòng Gà",
    "shortDescription": "Bánh ướt dẻo dai trộn lòng gà xé.",
    "description": "Bánh ướt Đà Lạt mềm mướt, trộn cùng lòng gà, thịt gà xé phay giòn dai và mắm chua ngọt.",
    "basePrice": 30000,
    "systemFee": 5000,
    "price": 35000,
    "rating": 4.5,
    "reviewCount": 120,
    "image": "https://img-global.cpcdn.com/recipes/922a89ff50818a94/1200x630cq70/photo.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "mon-chinh"
    ],
    "badges": []
  },
  {
    "id": "banh-duc",
    "name": "Bánh Đúc Nóng",
    "shortDescription": "Bánh đúc dẻo quánh, thịt băm mộc nhĩ ấm lòng.",
    "description": "Bát bánh đúc nóng hổi dẻo quánh, chan nước mắm ngọt dầm thịt băm mộc nhĩ và hành phi.",
    "basePrice": 15000,
    "systemFee": 5000,
    "price": 20000,
    "rating": 4.8,
    "reviewCount": 205,
    "image": "https://cdn.tgdd.vn/2020/10/CookProduct/1260-1200x676-31.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "an-vat"
    ],
    "badges": []
  },
  {
    "id": "banh-hoi",
    "name": "Bánh Hỏi Heo Quay",
    "shortDescription": "Bánh hỏi mỡ hành, heo quay da giòn.",
    "description": "Bánh hỏi tơi mềm thoảng mùi mỡ hành hẹ, ăn kèm thịt heo quay da giòn rụm và nước mắm nêm.",
    "basePrice": 40000,
    "systemFee": 5000,
    "price": 45000,
    "rating": 4.6,
    "reviewCount": 165,
    "image": "https://cdn.tgdd.vn/2021/05/content/hoi-3-800x450.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "mon-chinh"
    ],
    "badges": []
  },
  {
    "id": "banh-trang-nuong",
    "name": "Bánh Tráng Nướng",
    "shortDescription": "Pizza Đà Lạt nướng mỡ hành trứng cút.",
    "description": "Bánh tráng nướng than hoa với trứng cút, xúc xích, ruốc, phô mai và sốt mayonnaise.",
    "basePrice": 15000,
    "systemFee": 5000,
    "price": 20000,
    "rating": 4.8,
    "reviewCount": 300,
    "image": "https://tse4.mm.bing.net/th/id/OIP.YM3x3rt1KAYSy542j8U6cAHaEK?pid=Api&P=0&h=180",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "an-vat"
    ],
    "badges": [
      "hot"
    ]
  },
  {
    "id": "banh-trang-tron",
    "name": "Bánh Tráng Trộn",
    "shortDescription": "Bánh tráng trộn bò khô sa tế chua cay.",
    "description": "Bánh tráng mềm trộn cùng khô bò, xoài xanh bào, trứng cút, đậu phộng và muối tôm sa tế.",
    "basePrice": 15000,
    "systemFee": 5000,
    "price": 20000,
    "rating": 4.7,
    "reviewCount": 450,
    "image": "https://tse3.mm.bing.net/th/id/OIP.Hi2jizeoppiVBf0rUdSHuQHaEK?pid=Api&P=0&h=180",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "an-vat"
    ],
    "badges": [
      "bestSeller"
    ]
  },
  {
    "id": "banh-bot-loc",
    "name": "Bánh Bột Lọc",
    "shortDescription": "Bánh bột lọc tôm thịt dai sực.",
    "description": "Bánh bột lọc trong suốt, dai sực, nhân tôm rim ba chỉ đậm đà, rưới mắm ớt ngọt.",
    "basePrice": 20000,
    "systemFee": 5000,
    "price": 25000,
    "rating": 4.6,
    "reviewCount": 190,
    "image": "https://tse1.mm.bing.net/th/id/OIP.OnpBH_GEL59gT6nZGeCkLAHaGR?pid=Api&P=0&h=180",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "an-vat"
    ],
    "badges": []
  },
  {
    "id": "banh-bao",
    "name": "Bánh Bao Nhân Thịt",
    "shortDescription": "Bánh bao nóng hổi nhân thịt trứng cút.",
    "description": "Vỏ bánh xốp mềm, nhân thịt lợn băm mộc nhĩ thơm lừng cùng trứng cút và lạp xưởng.",
    "basePrice": 10000,
    "systemFee": 5000,
    "price": 15000,
    "rating": 4.5,
    "reviewCount": 220,
    "image": "https://tse2.mm.bing.net/th/id/OIP.d0gK8bLS9Ix7SbiT_hhhJwHaE7?pid=Api&P=0&h=180",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "an-vat"
    ],
    "badges": []
  },
  {
    "id": "banh-trang-phoi-suong",
    "name": "Bánh Tráng Phơi Sương",
    "shortDescription": "Bánh tráng phơi sương muối nhuyễn xì ke.",
    "description": "Bánh tráng phơi sương dẻo dai, cuộn cùng muối tôm nhuyễn, hành phi và bơ béo ngậy.",
    "basePrice": 20000,
    "systemFee": 5000,
    "price": 25000,
    "rating": 4.6,
    "reviewCount": 145,
    "image": "https://tse3.mm.bing.net/th/id/OIP.VRXV5NTQLniOyMIYLeCcNgHaHa?pid=Api&P=0&h=180",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "an-vat"
    ],
    "badges": []
  },
  {
    "id": "chan-ga-sa-tac",
    "name": "Chân Gà Sả Tắc",
    "shortDescription": "Chân gà rút xương ngâm sả tắc chua ngọt.",
    "description": "Chân gà rút xương giòn sần sật ngâm trong nước mắm sả tắc ớt chua ngọt siêu cuốn.",
    "basePrice": 45000,
    "systemFee": 5000,
    "price": 50000,
    "rating": 4.8,
    "reviewCount": 310,
    "image": "https://i.ytimg.com/vi/MVmtMJ3ILME/maxresdefault.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "an-vat"
    ],
    "badges": [
      "hot"
    ]
  },
  {
    "id": "xien-ban",
    "name": "Xiên Bẩn (Xiên Nướng/Chiên)",
    "shortDescription": "Combo xiên chiên cổng trường các loại.",
    "description": "Các loại cá viên, bò viên, xúc xích, lạp xưởng chiên ngập dầu chấm tương ớt.",
    "basePrice": 15000,
    "systemFee": 5000,
    "price": 20000,
    "rating": 4.5,
    "reviewCount": 280,
    "image": "https://tse3.mm.bing.net/th/id/OIP.vWFL1HTrGW3b8d6XNgsGcAHaEn?pid=Api&P=0&h=180",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "an-vat"
    ],
    "badges": []
  },
  {
    "id": "che-anh-dep-trai",
    "name": "Chè Anh Đẹp Trai",
    "shortDescription": "Ly chè thập cẩm cốt dừa mát lạnh.",
    "description": "Món chè thập cẩm thanh mát với các loại thạch, đậu đỏ, trân châu và nước cốt dừa.",
    "basePrice": 15000,
    "systemFee": 5000,
    "price": 20000,
    "rating": 4.4,
    "reviewCount": 120,
    "image": "https://mms.img.susercontent.com/vn-11134513-7r98o-lt4u34allm6x4a@resize_ss640x400!@crop_w640_h400_cT",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "trang-mieng",
      "an-vat"
    ],
    "badges": []
  },
  {
    "id": "khoai-tay-chien",
    "name": "Khoai Tây Chiên Lắc Phô Mai",
    "shortDescription": "Khoai tây chiên giòn lắc bột phô mai béo.",
    "description": "Khoai tây cắt sợi chiên vàng giòn rụm, xóc đều cùng bột phô mai mằn mặn béo ngậy.",
    "basePrice": 20000,
    "systemFee": 5000,
    "price": 25000,
    "rating": 4.6,
    "reviewCount": 195,
    "image": "https://tse2.mm.bing.net/th/id/OIP.Jto_K08lSADMshiKXHAMNwHaFj?pid=Api&P=0&h=180",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "an-vat"
    ],
    "badges": []
  },
  {
    "id": "tra-da",
    "name": "Trà Đá",
    "shortDescription": "Trà đá giải khát thanh mát.",
    "description": "Trà xanh thoang thoảng hương lài pha loãng với đá viên, thức uống quốc dân giải khát.",
    "basePrice": 0,
    "systemFee": 5000,
    "price": 5000,
    "rating": 4.9,
    "reviewCount": 850,
    "image": "https://migrationology.com/wp-content/uploads/2015/02/vietnamese_tra-da.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "do-uong"
    ],
    "badges": []
  },
  {
    "id": "sua-dau",
    "name": "Sữa Đậu Nành",
    "shortDescription": "Sữa đậu nguyên chất béo ngậy.",
    "description": "Sữa đậu nành nguyên chất, nấu thủ công giữ nguyên độ thơm béo, uống nóng hay đá đều ngon.",
    "basePrice": 10000,
    "systemFee": 5000,
    "price": 15000,
    "rating": 4.7,
    "reviewCount": 230,
    "image": "https://tse1.mm.bing.net/th/id/OIP.FprEjT4Qwbj3pGWwKeoDbwHaE7?pid=Api&P=0&h=180",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "do-uong"
    ],
    "badges": []
  },
  {
    "id": "nuoc-sam",
    "name": "Nước Sâm Lạnh",
    "shortDescription": "Nước sâm bí đao rong biển giải nhiệt.",
    "description": "Nước sâm nấu từ bí đao, rong biển, thục địa thanh mát giúp giải nhiệt cơ thể cực tốt.",
    "basePrice": 10000,
    "systemFee": 5000,
    "price": 15000,
    "rating": 4.8,
    "reviewCount": 160,
    "image": "https://tse2.mm.bing.net/th/id/OIP.AnBR19fel8FWNKVzFKiiVgHaEK?pid=Api&P=0&h=180",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "do-uong"
    ],
    "badges": []
  },
  {
    "id": "coca-cola",
    "name": "Coca-Cola",
    "shortDescription": "Lon Coca-Cola mát lạnh.",
    "description": "Nước ngọt có gas Coca-Cola mát lạnh, sảng khoái.",
    "basePrice": 10000,
    "systemFee": 5000,
    "price": 15000,
    "rating": 4.8,
    "reviewCount": 400,
    "image": "https://tse4.mm.bing.net/th/id/OIP.vTgKkSg-OfavsyV138XHzAHaDs?pid=Api&P=0&h=180",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "do-uong"
    ],
    "badges": []
  },
  {
    "id": "pepsi",
    "name": "Pepsi",
    "shortDescription": "Lon Pepsi sảng khoái.",
    "description": "Nước ngọt có gas Pepsi mát lạnh, cực đã khát.",
    "basePrice": 10000,
    "systemFee": 5000,
    "price": 15000,
    "rating": 4.8,
    "reviewCount": 380,
    "image": "https://tse3.mm.bing.net/th/id/OIP.c2zUCO9Uqt-2U04GZ8MZYQHaFb?pid=Api&P=0&h=180",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "do-uong"
    ],
    "badges": []
  },
  {
    "id": "tra-chanh",
    "name": "Trà Chanh",
    "shortDescription": "Trà chanh phố cổ chua ngọt, thơm mát.",
    "description": "Hồng trà pha cùng nước cốt chanh tươi chua chua ngọt ngọt, thanh nhiệt tươi mát.",
    "basePrice": 10000,
    "systemFee": 5000,
    "price": 15000,
    "rating": 4.6,
    "reviewCount": 210,
    "image": "https://photo2.tinhte.vn/data/attachment-files/2025/03/8661218_TRA_CHANH.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "do-uong"
    ],
    "badges": []
  },
  {
    "id": "tra-tac",
    "name": "Trà Tắc (Quất)",
    "shortDescription": "Trà tắc xí muội siêu to khổng lồ.",
    "description": "Trà lài pha cùng nước cốt tắc (quất), thơm mùi vỏ tắc tinh dầu chua ngọt hài hòa.",
    "basePrice": 10000,
    "systemFee": 5000,
    "price": 15000,
    "rating": 4.7,
    "reviewCount": 260,
    "image": "https://tse2.mm.bing.net/th/id/OIP.g5WWRyhVoreZbTyolhFtdQHaEK?pid=Api&P=0&h=180",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "do-uong"
    ],
    "badges": [
      "hot"
    ]
  },
  {
    "id": "ca-vien-chien-mam",
    "name": "Cá Viên Chiên Mắm",
    "shortDescription": "Cá viên chiên giòn chấm mắm chua ngọt.",
    "description": "Cá viên dai giòn chiên vàng rụm, chấm cùng mắm chua ngọt pha ớt tỏi thơm lừng.",
    "basePrice": 20000,
    "systemFee": 5000,
    "price": 25000,
    "rating": 4.6,
    "reviewCount": 175,
    "image": "https://tse3.mm.bing.net/th/id/OIP.vWFL1HTrGW3b8d6XNgsGcAHaEn?pid=Api&P=0&h=180",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "an-vat"
    ],
    "badges": []
  },
  {
    "id": "combo-2-nguoi",
    "name": "Combo 2 Người",
    "shortDescription": "2 Cơm tấm (hoặc Bún chả) + Cá viên chiên mắm + 2 Sữa đậu.",
    "description": "Combo dành cho 2 người với 2 phần cơm tấm hoặc bún chả tùy chọn, 1 phần cá viên chiên mắm chua ngọt và 2 ly sữa đậu nành thơm béo.",
    "basePrice": 140000,
    "systemFee": 5000,
    "price": 145000,
    "rating": 4.8,
    "reviewCount": 95,
    "image": "https://statics.vinwonders.com/com-tam-ngon-o-sai-gon-0_1630562640.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "combos"
    ],
    "badges": [
      "hot"
    ]
  },
  {
    "id": "combo-3-nguoi",
    "name": "Combo 3 Người",
    "shortDescription": "3 Cơm gà xối mỡ + Khoai tây chiên + 3 Coca-Cola.",
    "description": "Combo no say cho 3 người với 3 phần cơm gà xối mỡ giòn rụm, 1 phần khoai tây chiên lắc phô mai và 3 lon Coca-Cola mát lạnh.",
    "basePrice": 200000,
    "systemFee": 5000,
    "price": 205000,
    "rating": 4.7,
    "reviewCount": 78,
    "image": "https://ticotravel.com.vn/wp-content/uploads/2022/06/Com-ga-xoi-mo-15.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "combos"
    ],
    "badges": [
      "bestSeller"
    ]
  },
  {
    "id": "combo-4-5-nguoi",
    "name": "Combo 4-5 Người",
    "shortDescription": "2 Bún đậu mắm tôm + 2 Bánh mì + Chân gà sả tắc + Khoai tây chiên + 5 Trà chanh.",
    "description": "Combo tiệc tùng cho 4-5 người với 2 mẹt bún đậu mắm tôm lớn, 2 ổ bánh mì giòn, 1 đĩa chân gà sả tắc chua ngọt, 1 phần khoai tây chiên phô mai và 5 ly trà chanh mát lạnh.",
    "basePrice": 325000,
    "systemFee": 5000,
    "price": 330000,
    "rating": 4.9,
    "reviewCount": 62,
    "image": "https://static.vinwonders.com/2023/01/bun-dau-mam-tom-thumb.jpg",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "combos"
    ],
    "badges": [
      "hot"
    ]
  },
  {
    "id": "combo-nhom-an-nhe-toi",
    "name": "Combo Nhóm Ăn Nhẹ Tối (5 người)",
    "shortDescription": "5 Bánh bao + 5 Bánh mì + 5 Trà đá + 2 Bánh tráng phơi sương.",
    "description": "Combo ăn nhẹ buổi tối cho 5 người với bánh bao nóng hổi, bánh mì giòn rụm, trà đá thanh mát và bánh tráng phơi sương dẻo dai muối tôm. Nhẹ nhàng, tiện lợi, đủ no.",
    "basePrice": 190000,
    "systemFee": 5000,
    "price": 195000,
    "rating": 4.6,
    "reviewCount": 44,
    "image": "https://tse2.mm.bing.net/th/id/OIP.d0gK8bLS9Ix7SbiT_hhhJwHaE7?pid=Api&P=0&h=180",
    "is_available": true,
    "is_active": true,
    "is_deleted": false,
    "categoryIds": [
      "combos"
    ],
    "badges": []
  }
]

export const combos = dishes.filter((dish) => dish.categoryIds.includes('combos'))
export const getComboById = (id) => combos.find((dish) => dish.id === id)
export const getDishById = (id) => dishes.find((dish) => dish.id === id)
export const suggestedDishes = dishes.filter((dish) => ['pho', 'bun-cha', 'com-tam'].includes(dish.id))
