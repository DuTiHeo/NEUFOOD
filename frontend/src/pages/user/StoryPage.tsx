import { Link } from 'react-router-dom'
import Footer from '../../components/layout/Footer'
import styles from './Story.module.css'

export default function StoryPage() {
  return (
    <>
      <main className={styles.storyPage}>
        <div className={`wrap ${styles.container}`}>
          <nav className={styles.crumb} aria-label="Breadcrumb">
            <Link to="/" className={styles.crumbLink}>
              ← Trang chủ
            </Link>
            <span className={styles.crumbSep}>/</span>
            <span className={styles.crumbCurrent}>Câu chuyện của chúng tôi</span>
          </nav>

          <header className={styles.header}>
            <div className={styles.tagWrap}>
              <span className={styles.tag}>Sứ mệnh NEUFood</span>
            </div>
            <h1 className={styles.title}>Câu chuyện của chúng tôi</h1>
            <p className={styles.subtitle}>
              Từ những trăn trở tại canteen trường đến giải pháp công nghệ vì sinh viên NEU.
            </p>
          </header>

          <article className={styles.card}>
            <div className={styles.content}>
              <p>
                Ở một buổi trưa vội vã nơi giảng đường đông đúc, khi chuông báo giờ ra chơi vừa vang lên, dòng sinh viên lại đổ xuống canteen như một cơn sóng quen thuộc. Những hàng người nối dài, tiếng gọi món dồn dập, nhưng đi kèm với đó là sự quá tải và chậm trễ. Không ít sinh viên đành quay trở lại lớp khi chưa kịp ăn gì. Ở các tầng cao như 7, 8, 9, 10, nhiều bạn thậm chí từ bỏ việc xuống canteen, bởi chỉ riêng việc di chuyển đã tiêu tốn gần hết khoảng thời gian nghỉ ngắn ngủi.
              </p>

              <blockquote className={styles.quote}>
                &ldquo;Dù lượng sinh viên đông, nhu cầu cao, nhưng chất lượng trải nghiệm bữa ăn phải là ưu tiên số một. Nếu giảm được thời gian chờ đợi, sinh viên sẽ có bữa trưa trọn vẹn và tràn đầy năng lượng.&rdquo;
              </blockquote>

              <p>
                Đứng phía sau quầy phục vụ, chị Hương — một nhân viên lâu năm của canteen NEU — chứng kiến tình trạng này diễn ra mỗi ngày. Chị nhận ra một vấn đề lớn: dù lượng sinh viên đông, nhu cầu cao, nhưng doanh thu của canteen vẫn chưa tương xứng. Nguyên nhân không nằm ở chất lượng món ăn, mà ở cách vận hành chưa tối ưu. Những giờ cao điểm thì quá tải, còn những thời điểm khác lại dư thừa đồ ăn. Việc phục vụ hoàn toàn thủ công khiến quá trình bán hàng bị gián đoạn, mất đi nhiều cơ hội phục vụ khách hàng.
              </p>

              <p>
                Chị Hương bắt đầu suy nghĩ nghiêm túc hơn về việc thay đổi. Nếu có thể giảm thời gian chờ đợi, phân bổ đơn hàng hợp lý và giúp sinh viên tiếp cận đồ ăn dễ dàng hơn, thì không chỉ trải nghiệm được cải thiện mà hiệu quả của canteen cũng sẽ tăng lên đáng kể. Và rồi một câu hỏi xuất hiện: liệu công nghệ có thể giải quyết tất cả những điều đó?
              </p>

              <div className={styles.highlightBox}>
                <span className={`material-symbols-outlined ${styles.highlightIcon}`}>lightbulb</span>
                <div>
                  <h3 className={styles.highlightTitle}>Khởi nguồn của NEUFood</h3>
                  <p className={styles.highlightDesc}>
                    Giải pháp đặt món trước, giao tận phòng học và theo dõi trực tiếp tiến trình đơn hàng giúp tối ưu 100% thời gian nghỉ giữa giờ cho giảng viên và sinh viên.
                  </p>
                </div>
              </div>

              <p>
                Từ ý tưởng ấy, <strong>NEUFood</strong> ra đời — nền tảng đặt đồ ăn trực tuyến dành riêng cho sinh viên trong trường. Thông qua hệ thống này, sinh viên có thể xem thực đơn, đặt món trước và lựa chọn thời gian nhận phù hợp. Điều này giúp giảm đáng kể tình trạng chen lấn, đồng thời phân tán lượng khách theo từng khung giờ, giúp canteen vận hành mượt mà hơn.
              </p>

              <p>
                Không dừng lại ở đó, NEUFood còn giúp canteen quản lý đơn hàng một cách khoa học, dự đoán nhu cầu theo thời điểm, từ đó chuẩn bị nguyên liệu hợp lý, giảm lãng phí và tối ưu chi phí. Nhờ vậy, hiệu quả không chỉ tăng về số lượng đơn hàng mà còn tăng về tính bền vững.
              </p>

              <p className={styles.closing}>
                Và từ đó, mỗi giờ ra chơi không còn là áp lực thời gian, mà trở thành một khoảng nghỉ đúng nghĩa — nơi chỉ cần một cú chạm trên điện thoại, bữa ăn nóng hổi đã sẵn sàng phục vụ bạn ngay tại giảng đường.
              </p>
            </div>
          </article>
        </div>
      </main>

      <Footer />
    </>
  )
}
