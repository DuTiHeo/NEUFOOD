import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCart } from '../../contexts/CartContext'
import api from '../../services/api'
import { orderError } from '../../utils/orders'
import styles from './ChiTietMonPage.module.css'

function formatPrice(vnd) {
  return `${vnd.toLocaleString('vi-VN')}đ`
}

const REVIEWS_INITIAL = 4

function AvgStarRow({ avg }) {
  return (
    <div className={styles.reviewsStars}>
      {[1, 2, 3, 4, 5].map(n => avg >= n ? 'full' : avg >= n - .5 ? 'half' : 'empty').map((kind, i) => (
        <span
          key={i}
          className={`material-symbols-outlined ${kind === 'empty' ? styles.avgStarEmpty : styles.avgStarFill}`}
        >
          {kind === 'half' ? 'star_half' : 'star'}
        </span>
      ))}
    </div>
  )
}

function CardStars({ value }) {
  return (
    <div className={styles.reviewStars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`material-symbols-outlined ${styles.starSm} ${n <= value ? styles.cardStarFill : styles.cardStarEmpty}`}
        >
          star
        </span>
      ))}
    </div>
  )
}

export default function ChiTietMonPage() {
  const { id } = useParams()
  const { catalog, catalogLoading, catalogError, cartError, add } = useCart()
  const dish = catalog.find(row => row.id === id)
  const suggestedDishes = catalog.filter(row => row.id !== id).slice(0, 3)
  const [qty, setQty] = useState(1)
  const [reviews, setReviews] = useState([])
  const [reviewError, setReviewError] = useState('')
  const [reviewsExpanded, setReviewsExpanded] = useState(false)
  useEffect(() => {
    let ignore = false
    setReviews([]); setReviewError(''); setReviewsExpanded(false); setQty(1)
    api.get('/reviews/dish/' + encodeURIComponent(id)).then(response => {
      if (!ignore) setReviews(response.data.data)
    }).catch(err => { if (!ignore) setReviewError(orderError(err)) })
    return () => { ignore = true }
  }, [id])
  const listedStats = { count: reviews.length, avg: reviews.length ? reviews.reduce((sum, row) => sum + row.rating, 0) / reviews.length : 0 }
  const allDisplayReviews = reviews.map(row => ({ key: row.id, data: { authorLabel: row.user_name, stars: row.rating, comment: row.comment } }))
  const visibleReviews = reviewsExpanded ? allDisplayReviews : allDisplayReviews.slice(0, REVIEWS_INITIAL)
  const hiddenCount = Math.max(0, allDisplayReviews.length - REVIEWS_INITIAL)
  const showMoreToggle = hiddenCount > 0
  if (catalogLoading) return <main className={styles.detail}><p role="status">Đang tải món…</p></main>
  if (catalogError || !dish) return <main className={styles.detail}><p role="alert">{catalogError || 'Không tìm thấy món.'}</p><Link to="/menu">Về thực đơn</Link></main>

  const detailImg = dish.detailImage ?? dish.image
  const ingredients = dish.ingredients ?? []
  const oldPrice = dish.oldPrice

  return (
    <>
      <main className={styles.detail}>
        <div className="wrap">
          <nav className={styles.crumb}>
            <Link className={styles.crumbLink} to="/">
              Trang chủ
            </Link>
            <span className={`material-symbols-outlined ${styles.crumbSep}`}>chevron_right</span>
            <Link className={styles.crumbLink} to="/menu">
              Menu
            </Link>
            <span className={`material-symbols-outlined ${styles.crumbSep}`}>chevron_right</span>
            <span className={styles.crumbHere}>{dish.name}</span>
          </nav>

          <section className={styles.detailMain}>
            <div className={styles.detailShot}>
              <div className={styles.detailFrame}>
                <img className={styles.detailPhoto} src={detailImg} alt={dish.name} />
              </div>
              <div className={styles.detailRate}>
                <span className={`material-symbols-outlined material-symbols-fill ${styles.starSm}`}>star</span>
                {listedStats.count > 0 ? `${listedStats.avg.toFixed(1)}/5` : `${Number(dish.rating).toFixed(1)}/5`}
                {' '}
                ({listedStats.count.toLocaleString('vi-VN')} đánh giá)
              </div>
            </div>

            <div className={styles.detailInfo}>
              <div>
                <h1 className={styles.detailName}>{dish.name}</h1>
                <div className={styles.detailPrices}>
                  <span className={styles.detailPrice}>{formatPrice(dish.price)}</span>
                  {oldPrice ? <span className={styles.detailOld}>{formatPrice(oldPrice)}</span> : null}
                </div>
              </div>
              <div className={styles.detailBlock}>
                <h3 className={styles.detailH}>Mô tả món ăn</h3>
                <p className={styles.detailQuote}>&quot;{dish.description}&quot;</p>
              </div>
              {ingredients.length > 0 ? (
                <div className={styles.detailIngredients}>
                  <h4 className={styles.detailIngTitle}>Thành phần chính</h4>
                  <ul className={styles.detailIngList}>
                    {ingredients.map((item) => (
                      <li key={item} className={styles.detailIngItem}>
                        <span className={styles.detailDot} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className={styles.detailBuy}>
                <div className={styles.qty}>
                  <button type="button" className={styles.qtyBtn} onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Giảm số lượng">
                    <span className="material-symbols-outlined">remove</span>
                  </button>
                  <span className={styles.qtyNum}>{qty}</span>
                  <button type="button" className={styles.qtyBtn} disabled={qty >= 10} onClick={() => setQty((q) => Math.min(10, q + 1))} aria-label="Tăng số lượng">
                    <span className="material-symbols-outlined">add</span>
                  </button>
                </div>
                <button type="button" className={styles.detailCart} disabled={!dish.is_available} onClick={() => add(dish.id, qty)}>
                  <span className="material-symbols-outlined" aria-hidden="true">shopping_bag</span>
                  {dish.is_available ? 'Thêm vào giỏ hàng' : 'Món đã hết'}
                </button>
                {cartError && <p role="alert">{cartError}</p>}
                <Link to="/gio-hang">Xem giỏ hàng</Link>
              </div>
            </div>
          </section>

          <section className={styles.reviewsSection}>
            <div className={styles.reviewsHead}>
              <div>
                <h2 className={styles.reviewsTitle}>Đánh giá khách hàng</h2>
                <div className={styles.reviewsMeta}>
                  <AvgStarRow avg={listedStats.count > 0 ? listedStats.avg : Number(dish.rating) || 0} />
                  <span className={styles.metaBold}>
                    {(listedStats.count > 0 ? listedStats.avg : Number(dish.rating) || 0).toFixed(1)}
                  </span>
                  <span className={styles.metaMuted}>({listedStats.count.toLocaleString('vi-VN')} đánh giá)</span>
                </div>
              </div>
            </div>
            {reviewError && <p role="alert">{reviewError}</p>}
            {!reviewError && !reviews.length && <p>Chưa có đánh giá.</p>}
            <div className={styles.reviewsGrid}>
              {visibleReviews.map((entry) => (
                  <div key={entry.key} className={`${styles.review} ${styles.reviewYours}`}>
                    <div className={styles.reviewTop}>
                      <div className={styles.reviewUser}>
                        <div className={`${styles.reviewAvatar} ${styles.reviewAvatarYou}`} aria-hidden>
                          <span className={styles.avatarLetter}>{(entry.data.authorLabel || 'B').charAt(0)}</span>
                        </div>
                        <div>
                          <h4 className={styles.metaBold}>{entry.data.authorLabel || 'Bạn'}</h4>
                          <p className={styles.reviewRole}>Đã mua qua NEUFood</p>
                        </div>
                      </div>
                      <CardStars value={entry.data.stars} />
                    </div>
                    {entry.data.comment ? <p className={styles.reviewText}>{entry.data.comment}</p> : null}
                  </div>
                ),
              )}
            </div>
            {showMoreToggle ? (
              <div className={styles.reviewsMore}>
                <button
                  type="button"
                  className={styles.reviewsMoreBtn}
                  onClick={() => setReviewsExpanded((v) => !v)}
                  aria-expanded={reviewsExpanded}
                >
                  {reviewsExpanded ? (
                    <>
                      Thu gọn
                      <span className={`material-symbols-outlined ${styles.reviewsMoreIco}`}>expand_less</span>
                    </>
                  ) : (
                    <>
                      Xem thêm đánh giá ({hiddenCount.toLocaleString('vi-VN')})
                      <span className={`material-symbols-outlined ${styles.reviewsMoreIco}`}>expand_more</span>
                    </>
                  )}
                </button>
              </div>
            ) : null}
          </section>

          <section>
            <h2 className={styles.suggestTitle}>Gợi ý món liên quan</h2>
            <div className={`${styles.suggestRow} scrollbar-hide`}>
              {suggestedDishes.map((s) => (
                <div key={s.id} className={styles.suggestCard}>
                  <div className={styles.suggestImgBox}>
                    <img className={styles.suggestImg} src={s.image} alt={s.name} />
                  </div>
                  <div className={styles.suggestBody}>
                    <h4 className={styles.suggestName}>{s.name}</h4>
                    <div className={styles.suggestFoot}>
                      <span className={styles.suggestPrice}>{formatPrice(s.price)}</span>
                      <Link className={styles.suggestAdd} to={`/mon/${s.id}`} aria-label={`Thêm ${s.name}`}>
                        <span className={`material-symbols-outlined ${styles.suggestAddIcon}`}>add</span>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <footer className={styles.detailFoot}>
        <div className={`wrap ${styles.detailFootInner}`}>
          <div className={styles.detailFootBrand}>
            <div className={styles.detailFootName}>NEUFood Campus Dining</div>
            <div className={styles.detailFootCopy}>© 2024 NEUFood Campus Dining. All rights reserved.</div>
          </div>
          <div className={styles.detailFootLinks}>
            <a className={styles.detailFootA} href="#">
              Support
            </a>
            <a className={styles.detailFootA} href="#">
              Privacy Policy
            </a>
            <a className={styles.detailFootA} href="#">
              Terms of Service
            </a>
            <a className={styles.detailFootA} href="#">
              Campus Map
            </a>
          </div>
        </div>
      </footer>
    </>
  )
}
