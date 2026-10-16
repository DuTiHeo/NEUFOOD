import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getDishById, suggestedDishes } from '../../data/dishes'
import { computeListedReviewStats, getReviewsForDish, starStepsFromAvg, subscribeDishReviews } from '../../lib/dishReviews'
import styles from './ChiTietMonPage.module.css'

function formatPrice(vnd) {
  return `${vnd.toLocaleString('vi-VN')}đ`
}

const PLACEHOLDER_REVIEWS = [
  {
    id: 'p1',
    name: 'Hoàng Anh',
    role: 'Sinh viên Kinh tế',
    stars: 5,
    text: 'Gà giòn đúng điệu, da gà xối mỡ mặn mặn ngọt ngọt rất bắt miệng. Cơm không bị khô quá. Suất ăn khá nhiều, đủ no cho cả buổi chiều lên giảng đường.',
    avatar:
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
  },
  {
    id: 'p2',
    name: 'Minh Anh',
    role: 'Giảng viên',
    stars: 4,
    text: 'Dịch vụ giao hàng nhanh, cơm vẫn còn nóng hổi khi nhận. Nước mắm tỏi ớt là linh hồn của món này, rất đậm đà. Sẽ tiếp tục ủng hộ NEUFood.',
    avatar:
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face',
  },
]

const REVIEWS_INITIAL = 4

function AvgStarRow({ avg }) {
  return (
    <div className={styles.reviewsStars}>
      {starStepsFromAvg(avg).map((kind, i) => (
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
  const dish = getDishById(id)
  const [qty, setQty] = useState(1)
  const [reviewsTick, setReviewsTick] = useState(0)

  useEffect(() => {
    return subscribeDishReviews(() => setReviewsTick((t) => t + 1))
  }, [])

  const userReviews = useMemo(() => getReviewsForDish(dish.id), [dish.id, reviewsTick])
  const listedStats = useMemo(
    () => computeListedReviewStats(PLACEHOLDER_REVIEWS, userReviews),
    [userReviews],
  )
  const [reviewsExpanded, setReviewsExpanded] = useState(false)

  const allDisplayReviews = useMemo(() => {
    const samples = PLACEHOLDER_REVIEWS.map((r) => ({ kind: 'sample', key: r.id, data: r }))
    const yours = userReviews.map((r, idx) => ({
      kind: 'yours',
      key: `u-${r.orderId}-${r.savedAt}-${idx}`,
      data: r,
    }))
    return [...samples, ...yours]
  }, [userReviews])

  const visibleReviews = reviewsExpanded ? allDisplayReviews : allDisplayReviews.slice(0, REVIEWS_INITIAL)
  const hiddenCount = Math.max(0, allDisplayReviews.length - REVIEWS_INITIAL)
  const showMoreToggle = allDisplayReviews.length > REVIEWS_INITIAL

  useEffect(() => {
    setReviewsExpanded(false)
  }, [dish.id])

  const detailImg = dish.detailImage ?? dish.image
  const ingredients = dish.ingredients ?? []
  const oldPrice = dish.oldPrice

  return (
    <>
      <main class={styles.detail}>
        <div class="wrap">
          <nav class={styles.crumb}>
            <Link class={styles.crumbLink} to="/">
              Trang chủ
            </Link>
            <span class={`material-symbols-outlined ${styles.crumbSep}`}>chevron_right</span>
            <Link class={styles.crumbLink} to="/menu">
              Menu
            </Link>
            <span class={`material-symbols-outlined ${styles.crumbSep}`}>chevron_right</span>
            <span class={styles.crumbHere}>{dish.name}</span>
          </nav>

          <section class={styles.detailMain}>
            <div class={styles.detailShot}>
              <div class={styles.detailFrame}>
                <img class={styles.detailPhoto} src={detailImg} alt={dish.name} />
              </div>
              <div class={styles.detailRate}>
                <span class={`material-symbols-outlined material-symbols-fill ${styles.starSm}`}>star</span>
                {listedStats.count > 0 ? `${listedStats.avg.toFixed(1)}/5` : `${Number(dish.rating).toFixed(1)}/5`}
                {' '}
                ({listedStats.count.toLocaleString('vi-VN')} đánh giá)
              </div>
            </div>

            <div class={styles.detailInfo}>
              <div>
                <h1 class={styles.detailName}>{dish.name}</h1>
                <div class={styles.detailPrices}>
                  <span class={styles.detailPrice}>{formatPrice(dish.price)}</span>
                  {oldPrice ? <span class={styles.detailOld}>{formatPrice(oldPrice)}</span> : null}
                </div>
              </div>
              <div class={styles.detailBlock}>
                <h3 class={styles.detailH}>Mô tả món ăn</h3>
                <p class={styles.detailQuote}>&quot;{dish.description}&quot;</p>
              </div>
              {ingredients.length > 0 ? (
                <div class={styles.detailIngredients}>
                  <h4 class={styles.detailIngTitle}>Thành phần chính</h4>
                  <ul class={styles.detailIngList}>
                    {ingredients.map((item) => (
                      <li key={item} class={styles.detailIngItem}>
                        <span class={styles.detailDot} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div class={styles.detailBuy}>
                <div class={styles.qty}>
                  <button type="button" class={styles.qtyBtn} onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Giảm số lượng">
                    <span class="material-symbols-outlined">remove</span>
                  </button>
                  <span class={styles.qtyNum}>{qty}</span>
                  <button type="button" class={styles.qtyBtn} onClick={() => setQty((q) => q + 1)} aria-label="Tăng số lượng">
                    <span class="material-symbols-outlined">add</span>
                  </button>
                </div>
                <Link class={styles.detailCart} to="/gio-hang">
                  <span class="material-symbols-outlined">shopping_bag</span>
                  Thêm vào giỏ hàng
                </Link>
              </div>
            </div>
          </section>

          <section class={styles.reviewsSection}>
            <div class={styles.reviewsHead}>
              <div>
                <h2 class={styles.reviewsTitle}>Đánh giá khách hàng</h2>
                <div class={styles.reviewsMeta}>
                  <AvgStarRow avg={listedStats.count > 0 ? listedStats.avg : Number(dish.rating) || 0} />
                  <span class={styles.metaBold}>
                    {(listedStats.count > 0 ? listedStats.avg : Number(dish.rating) || 0).toFixed(1)}
                  </span>
                  <span class={styles.metaMuted}>({listedStats.count.toLocaleString('vi-VN')} đánh giá)</span>
                </div>
              </div>
            </div>
            <div class={styles.reviewsGrid}>
              {visibleReviews.map((entry) =>
                entry.kind === 'sample' ? (
                  <div key={entry.key} class={styles.review}>
                    <div class={styles.reviewTop}>
                      <div class={styles.reviewUser}>
                        <div class={styles.reviewAvatar}>
                          <img alt="" src={entry.data.avatar} />
                        </div>
                        <div>
                          <h4 class={styles.metaBold}>{entry.data.name}</h4>
                          <p class={styles.reviewRole}>{entry.data.role}</p>
                        </div>
                      </div>
                      <CardStars value={entry.data.stars} />
                    </div>
                    <p class={styles.reviewText}>{entry.data.text}</p>
                  </div>
                ) : (
                  <div key={entry.key} class={`${styles.review} ${styles.reviewYours}`}>
                    <div class={styles.reviewTop}>
                      <div class={styles.reviewUser}>
                        <div class={`${styles.reviewAvatar} ${styles.reviewAvatarYou}`} aria-hidden>
                          <span class={styles.avatarLetter}>{(entry.data.authorLabel || 'B').charAt(0)}</span>
                        </div>
                        <div>
                          <h4 class={styles.metaBold}>{entry.data.authorLabel || 'Bạn'}</h4>
                          <p class={styles.reviewRole}>Đã mua qua NEUFood</p>
                        </div>
                      </div>
                      <CardStars value={entry.data.stars} />
                    </div>
                    {entry.data.photo ? (
                      <div class={styles.reviewPhotoBox}>
                        <img class={styles.reviewPhoto} src={entry.data.photo} alt="Ảnh món ăn khách hàng chia sẻ" />
                      </div>
                    ) : null}
                    {entry.data.comment ? <p class={styles.reviewText}>{entry.data.comment}</p> : null}
                  </div>
                ),
              )}
            </div>
            {showMoreToggle ? (
              <div class={styles.reviewsMore}>
                <button
                  type="button"
                  class={styles.reviewsMoreBtn}
                  onClick={() => setReviewsExpanded((v) => !v)}
                  aria-expanded={reviewsExpanded}
                >
                  {reviewsExpanded ? (
                    <>
                      Thu gọn
                      <span class={`material-symbols-outlined ${styles.reviewsMoreIco}`}>expand_less</span>
                    </>
                  ) : (
                    <>
                      Xem thêm đánh giá ({hiddenCount.toLocaleString('vi-VN')})
                      <span class={`material-symbols-outlined ${styles.reviewsMoreIco}`}>expand_more</span>
                    </>
                  )}
                </button>
              </div>
            ) : null}
          </section>

          <section>
            <h2 class={styles.suggestTitle}>Gợi ý món liên quan</h2>
            <div class={`${styles.suggestRow} scrollbar-hide`}>
              {suggestedDishes.map((s) => (
                <div key={s.id} class={styles.suggestCard}>
                  <div class={styles.suggestImgBox}>
                    <img class={styles.suggestImg} src={s.image} alt={s.name} />
                  </div>
                  <div class={styles.suggestBody}>
                    <h4 class={styles.suggestName}>{s.name}</h4>
                    <div class={styles.suggestFoot}>
                      <span class={styles.suggestPrice}>{formatPrice(s.price)}</span>
                      <Link class={styles.suggestAdd} to={`/mon/${s.id}`} aria-label={`Thêm ${s.name}`}>
                        <span class={`material-symbols-outlined ${styles.suggestAddIcon}`}>add</span>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <footer class={styles.detailFoot}>
        <div class={`wrap ${styles.detailFootInner}`}>
          <div class={styles.detailFootBrand}>
            <div class={styles.detailFootName}>NEUFood Campus Dining</div>
            <div class={styles.detailFootCopy}>© 2024 NEUFood Campus Dining. All rights reserved.</div>
          </div>
          <div class={styles.detailFootLinks}>
            <a class={styles.detailFootA} href="#">
              Support
            </a>
            <a class={styles.detailFootA} href="#">
              Privacy Policy
            </a>
            <a class={styles.detailFootA} href="#">
              Terms of Service
            </a>
            <a class={styles.detailFootA} href="#">
              Campus Map
            </a>
          </div>
        </div>
      </footer>
    </>
  )
}
