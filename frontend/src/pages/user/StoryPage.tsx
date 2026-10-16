import styles from "./Story.module.css";

export default function Story() {
  return (
    <div className={styles.container}>
      <img src="/neu-food.png" alt="NEU Food Logo" className={styles.logo} />
      <h1 className={styles.title}>Câu chuyện của chúng tôi</h1>
  
      <div className={styles.content}>
        <p>
      Ở một buổi trưa vội vã nơi giảng đường đông đúc, khi chuông báo giờ ra chơi vừa vang lên, dòng sinh viên lại đổ xuống canteen như một cơn sóng quen thuộc. Những hàng người nối dài, tiếng gọi món dồn dập, nhưng đi kèm với đó là sự quá tải và chậm trễ. Không ít sinh viên đành quay trở lại lớp khi chưa kịp ăn gì. Ở các tầng cao như 7, 8, 9, 10, nhiều bạn thậm chí từ bỏ việc xuống canteen, bởi chỉ riêng việc di chuyển đã tiêu tốn gần hết khoảng thời gian nghỉ ngắn ngủi.

Đứng phía sau quầy phục vụ, chị Hương một nhân viên lâu năm của canteen NEU. chứng kiến tình trạng này diễn ra mỗi ngày. Chị nhận ra một vấn đề lớn: dù lượng sinh viên đông, nhu cầu cao, nhưng doanh thu của canteen vẫn chưa tương xứng. Nguyên nhân không nằm ở chất lượng món ăn, mà ở cách vận hành chưa tối ưu. Những giờ cao điểm thì quá tải, còn những thời điểm khác lại dư thừa đồ ăn. Việc phục vụ hoàn toàn thủ công khiến quá trình bán hàng bị gián đoạn, mất đi nhiều cơ hội phục vụ khách hàng.

Chị Hương bắt đầu suy nghĩ nghiêm túc hơn về việc thay đổi. Nếu có thể giảm thời gian chờ đợi, phân bổ đơn hàng hợp lý và giúp sinh viên tiếp cận đồ ăn dễ dàng hơn, thì không chỉ trải nghiệm được cải thiện mà doanh thu của canteen cũng sẽ tăng lên đáng kể. Và rồi một câu hỏi xuất hiện: liệu công nghệ có thể giải quyết tất cả những điều đó?

Từ ý tưởng ấy, NEUFood ra đời một nền tảng đặt đồ ăn trực tuyến dành riêng cho sinh viên trong trường. Thông qua hệ thống này, sinh viên có thể xem thực đơn, đặt món trước và lựa chọn thời gian nhận phù hợp. Điều này giúp giảm đáng kể tình trạng chen lấn, đồng thời phân tán lượng khách theo từng khung giờ, giúp canteen vận hành mượt mà hơn.

Không dừng lại ở đó, NEUFood còn giúp canteen quản lý đơn hàng một cách khoa học, dự đoán nhu cầu theo thời điểm, từ đó chuẩn bị nguyên liệu hợp lý, giảm lãng phí và tối ưu chi phí. Nhờ vậy, doanh thu không chỉ tăng về số lượng đơn hàng mà còn tăng về hiệu quả vận hành.

Từ một vấn đề tưởng chừng rất nhỏ trong đời sống hằng ngày, chị Hương đã góp phần xây dựng nên một hệ thống mang lại giá trị thực tế: giúp sinh viên ăn uống tiện lợi hơn, đồng thời giúp canteen phát triển bền vững hơn. NEUFood không chỉ là một trang web bán đồ ăn, mà còn là bước chuyển mình trong cách phục vụ, nơi công nghệ được sử dụng để nâng cao trải nghiệm và tối đa hóa hiệu quả kinh doanh.

Và từ đó, mỗi giờ ra chơi không còn là áp lực thời gian, mà trở thành một khoảng nghỉ đúng nghĩa nơi chỉ cần một cú click, mọi thứ đã sẵn sàng.
        </p>
      </div>

    </div>
  );
}