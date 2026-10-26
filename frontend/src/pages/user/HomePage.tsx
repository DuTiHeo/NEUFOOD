import { Link } from 'react-router-dom'
import { ShoppingBag, Truck, Clock, Sparkles } from 'lucide-react'
import { useDishes } from '../../contexts/DishesContext'
import { useCart } from '../../contexts/CartContext'
import FoodCard from '../../components/dishes/FoodCard'
import Footer from '../../components/layout/Footer'
import styles from './HomePage.module.css'

const CATEGORY_ICONS: Record<string, string> = {
  'all': '🍽️',
  'com-hop': '🍱',
  'mi-pho': '🍜',
  'combos': '🎁',
  'banh-kem': '🎂',
  'trang-mieng': '🍨',
  'mon-chinh': '🥘',
  'do-uong': '🧋',
  'an-vat': '🍿',
}

function getBestSellers(dishes) {
  return [...dishes]
    .sort((a, b) => {
      const reviewDifference = Number(b.reviewCount || 0) - Number(a.reviewCount || 0)
      if (reviewDifference) return reviewDifference
      const badgeDifference = Number(b.badges?.includes('bestSeller')) - Number(a.badges?.includes('bestSeller'))
      if (badgeDifference) return badgeDifference
      return Number(b.rating || 0) - Number(a.rating || 0)
    })
    .slice(0, 8)
}

export default function HomePage() {
  const { dishes, categories, isLoading, error, refresh } = useDishes()
  const bestSellers = getBestSellers(dishes)

  return (
    <>
      <main className={styles.pageHome}>
        {/* ───── HERO ───── */}
        <section className={styles.heroSection}>
          <div className={styles.hero}>
            <img
              className={styles.heroBg}
              src="/background.jpg"
              alt="NEUFood - Đặt đồ ăn khu vực NEU"
              loading="eager"
            />
            <div className={styles.heroOverlay} />
            <div className={styles.heroContent}>
              <div className={styles.heroBadge}>
                <Sparkles size={14} />
                Giao đồ ăn tại Đại học Kinh tế Quốc dân
              </div>
              <h1 className={styles.heroTitle}>
                Đặt món ngay,{'\u00A0'}
                <span className={styles.heroAccent}>giao tận nơi học</span>
              </h1>
              <p className={styles.heroLead}>
                Năng lượng tức thì cho những giờ học căng thẳng. Giao nhanh tận giảng đường, thư viện & KTX.
              </p>
              <div className={styles.heroCtas}>
                <Link className="btn-brand" to="/menu">
                  <ShoppingBag size={18} />
                  Đặt món ngay
                </Link>
                <Link className="btn-outline" to="/menu">
                  Xem thực đơn
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ───── CATEGORIES ───── */}
        <section className={`wrap ${styles.section} ${styles.categorySection}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Khám phá danh mục</h2>
          </div>
          <div className={styles.catRow}>
            {categories.map(cat => (
              <Link
                key={cat.id}
                to={`/menu?cat=${cat.id}`}
                className={styles.catChip}
              >
                <span className={styles.catIcon}>
                  {CATEGORY_ICONS[cat.id] || '🍽️'}
                </span>
                <span className={styles.catLabel}>{cat.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ───── BEST SELLERS ───── */}
        <section className={`wrap ${styles.section}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>🔥 Món nổi bật</h2>
            <Link to="/menu" className={styles.sectionLink}>
              Xem tất cả →
            </Link>
          </div>
          <div className={styles.foodGrid}>
            {isLoading ? <p role="status">Đang tải thực đơn…</p> : null}
            {error ? (
              <div role="alert">
                <p>Chưa tải được thực đơn từ máy chủ: {error}</p>
                <button type="button" onClick={() => void refresh()}>Thử lại</button>
              </div>
            ) : null}
            {!isLoading && !error && bestSellers.length === 0 ? <p>Hiện chưa có món đang bán.</p> : null}
            {bestSellers.map(dish => (
              <FoodCard key={dish.id} dish={dish} />
            ))}
          </div>
        </section>

        {/* ───── PROMO BANNER ───── */}
        <section className={`wrap ${styles.section}`}>
          <div className={styles.promoBanner}>
            <div className={styles.promoContent}>
              <span className={styles.promoTag}>Ưu đãi sinh viên</span>
              <h2 className={styles.promoTitle}>
                Phí giao hàng theo cấu hình hiện hành của Canteen
              </h2>
              <p className={styles.promoDesc}>
                Bạn cũng có thể chọn nhận món tại quầy Canteen A2 khi đặt hàng.
              </p>
              <Link className="btn-brand" to="/menu">
                Đặt ngay
              </Link>
            </div>
            <div className={styles.promoVisual}>
              <img
                src="/linhvat.png"
                alt="Linh vật NEUFood"
                className={styles.promoImg}
              />
            </div>
          </div>
        </section>

        {/* ───── WHY NEUFOOD ───── */}
        <section className={`wrap ${styles.section}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Tại sao chọn NEUFood?</h2>
          </div>
          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <Truck size={24} />
              </div>
              <h3 className={styles.featureTitle}>Giao tận nơi</h3>
              <p className={styles.featureDesc}>
                Giao đồ ăn đến giảng đường A1, B2, nhà văn hóa, thư viện & KTX trong khuôn viên NEU.
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <Clock size={24} />
              </div>
              <h3 className={styles.featureTitle}>Đặt món siêu nhanh</h3>
              <p className={styles.featureDesc}>
                Quy trình đặt hàng đơn giản, chỉ vài bước là có đồ ăn ngay giờ ra chơi.
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <Sparkles size={24} />
              </div>
              <h3 className={styles.featureTitle}>Giá sinh viên</h3>
              <p className={styles.featureDesc}>
                Tất cả món ăn đều có giá phù hợp với sinh viên, kèm khuyến mãi hàng tuần.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
