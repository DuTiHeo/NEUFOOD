import { Link } from 'react-router-dom'
import Footer from '../../components/layout/Footer'
import styles from './HomePage.module.css'

export default function HomePage() {
  return (
    <>
      <main className={styles.pageHome}>
        <section className={`wrap ${styles.sectionMb12}`}>
          <div className={styles.hero}>
            <video
              className={styles.heroBg}
              autoPlay
              loop
              muted
              playsInline
              aria-label="Video nền trang chủ"
              src="https://www.shutterstock.com/shutterstock/videos/3775829335/preview/stock-footage-fast-food-leftovers-wasted-food.webm"
            />
            <div className={styles.heroBox}>
              <h1 className={styles.heroTitle}>Đặt đồ ăn giao tại phòng học</h1>
              <p className={styles.heroLead}>
                Cùng cấp năng lượng tức thì cho những giờ học căng thẳng.
              </p>
              <Link className={`btn-brand ${styles.heroButton}`} to="/menu">
                Đặt ngay
              </Link>
            </div>
          </div>
        </section>

        <section className={`wrap ${styles.sectionMb12}`}>
          <div className={styles.promoBanner}>
            <div className={styles.promoTextCol}>
              <p className={styles.promoHeadline}>SƠN TÙNG ĐÃ ĐẶT, CÒN BẠN THÌ SAO?</p>
            </div>
            <div className={styles.promoImageCol}>
              <img
                className={styles.promoImage}
                src="https://i.pinimg.com/736x/f8/4a/1c/f84a1c045f0c5096945577c734f601ee.jpg"
                alt="Banner quảng cáo"
              />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
