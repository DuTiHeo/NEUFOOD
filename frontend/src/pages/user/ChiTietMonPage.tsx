import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCart } from '../../contexts/CartContext'
import { useDishes } from '../../contexts/DishesContext'
import { reviewService } from '../../services/reviewService'
import { DishReview } from '../../types/dish'
import { getDishImageUrl, handleDishImageError } from '../../utils/dishImages'
import Footer from '../../components/layout/Footer'
import styles from './ChiTietMonPage.module.css'

function formatPrice(value: number) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`
}

function StarRow({ value }: { value: number }) {
  const rating = Math.max(0, Math.min(5, Math.round(value)))
  return <div className={styles.reviewsStars} aria-label={`${value.toFixed(1)} trên 5 sao`}>
    {[1, 2, 3, 4, 5].map((number) => <span key={number} className={`material-symbols-outlined ${number <= rating ? styles.avgStarFill : styles.avgStarEmpty}`}>star</span>)}
  </div>
}

function ReviewStars({ value }: { value: number }) {
  return <div className={styles.reviewStars} aria-label={`${value} sao`}>
    {[1, 2, 3, 4, 5].map((number) => <span key={number} className={`material-symbols-outlined ${styles.starSm} ${number <= value ? styles.cardStarFill : styles.cardStarEmpty}`}>star</span>)}
  </div>
}

export default function ChiTietMonPage() {
  const { id } = useParams()
  const { dishes, getById, isLoading, error, refresh } = useDishes()
  const dish = getById(id)
  const { add, getQty, maxDishQuantity } = useCart()
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [reviews, setReviews] = useState<DishReview[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsError, setReviewsError] = useState('')
  const [reviewsExpanded, setReviewsExpanded] = useState(false)

  useEffect(() => {
    setQty(1)
    setAdded(false)
    setReviewsExpanded(false)
  }, [id])

  useEffect(() => {
    if (!id) return
    let active = true
    setReviewsLoading(true)
    reviewService.getDishReviews(id)
      .then((result) => { if (active) { setReviews(result); setReviewsError('') } })
      .catch((requestError: any) => { if (active) setReviewsError(requestError?.response?.data?.message || 'Không thể tải đánh giá.') })
      .finally(() => { if (active) setReviewsLoading(false) })
    return () => { active = false }
  }, [id])

  const suggestedDishes = useMemo(() => {
    const ids = new Set(dish?.categoryIds ?? dish?.category_ids ?? [])
    return dishes
      .filter((item) => item.id !== dish?.id && (item.categoryIds ?? item.category_ids ?? []).some((categoryId) => ids.has(categoryId)))
      .slice(0, 6)
  }, [dishes, dish])

  if (isLoading) return <main className={styles.detail}><div className="wrap"><p role="status">Đang tải món ăn…</p></div><Footer /></main>
  if (error) return <main className={styles.detail}><div className="wrap"><p role="alert">{error}</p><button type="button" onClick={() => void refresh()}>Thử tải lại</button></div><Footer /></main>
  if (!dish) {
    return <main className={styles.detail}><div className="wrap" style={{ textAlign: 'center', padding: '4rem 0' }}><h2>Không tìm thấy món ăn</h2><Link to="/menu">Quay lại thực đơn</Link></div><Footer /></main>
  }

  const reviewCount = Number(dish.reviewCount ?? dish.review_count ?? 0)
  const rating = reviewCount > 0 ? Number(dish.rating || 0) : 0
  const visibleReviews = reviewsExpanded ? reviews : reviews.slice(0, 4)
  const canAdd = dish.is_available !== false
  const reachedCartLimit = getQty(dish.id) >= maxDishQuantity

  function handleAddToCart() {
    if (!canAdd) return
    const remaining = Math.max(0, maxDishQuantity - getQty(dish.id))
    const quantityToAdd = Math.min(qty, remaining)
    if (quantityToAdd > 0 && add(dish.id, quantityToAdd)) {
      setQty(quantityToAdd)
      setAdded(true)
      window.setTimeout(() => setAdded(false), 1500)
    }
  }

  return (
    <>
      <main className={styles.detail}>
        <div className="wrap">
          <nav className={styles.crumb} aria-label="Đường dẫn">
            <Link className={styles.crumbLink} to="/">Trang chủ</Link>
            <span className={`material-symbols-outlined ${styles.crumbSep}`}>chevron_right</span>
            <Link className={styles.crumbLink} to="/menu">Menu</Link>
            <span className={`material-symbols-outlined ${styles.crumbSep}`}>chevron_right</span>
            <span className={styles.crumbHere}>{dish.name}</span>
          </nav>

          <section className={styles.detailMain}>
            <div className={styles.detailShot}>
              <div className={styles.detailFrame}><img className={styles.detailPhoto} src={getDishImageUrl(dish)} alt={dish.name} onError={handleDishImageError} /></div>
              <div className={styles.detailRate}>{reviewCount > 0 ? <><span className={`material-symbols-outlined material-symbols-fill ${styles.starSm}`}>star</span>{rating.toFixed(1)}/5 ({reviewCount.toLocaleString('vi-VN')} đánh giá)</> : 'Chưa có đánh giá'}</div>
            </div>

            <div className={styles.detailInfo}>
              <div>
                <h1 className={styles.detailName}>{dish.name}</h1>
                <div className={styles.detailPrices}><span className={styles.detailPrice}>{formatPrice(dish.price)}</span></div>
                {dish.is_available === false ? <p role="status">Món hiện đã hết.</p> : null}
              </div>
              <div className={styles.detailBlock}><h3 className={styles.detailH}>Mô tả món ăn</h3><p className={styles.detailQuote}>{dish.description || dish.shortDescription || 'Chưa có mô tả cho món ăn này.'}</p></div>
              <div className={styles.detailBuy}>
                <div className={styles.qty}>
                  <button type="button" className={styles.qtyBtn} onClick={() => setQty((value) => Math.max(1, value - 1))} disabled={qty <= 1} aria-label="Giảm số lượng"><span className="material-symbols-outlined">remove</span></button>
                  <span className={styles.qtyNum}>{qty}</span>
                  <button type="button" className={styles.qtyBtn} onClick={() => setQty((value) => Math.min(maxDishQuantity, value + 1))} disabled={qty >= maxDishQuantity || !canAdd || reachedCartLimit} aria-label="Tăng số lượng"><span className="material-symbols-outlined">add</span></button>
                </div>
                <button type="button" className={styles.detailCart} onClick={handleAddToCart} disabled={!canAdd || reachedCartLimit} style={added ? { backgroundColor: '#16A34A', color: '#fff' } : undefined}>
                  <span className="material-symbols-outlined">{added ? 'check' : 'shopping_bag'}</span>{!canAdd ? 'Tạm hết món' : reachedCartLimit ? 'Đã đạt giới hạn trong giỏ' : added ? `Đã thêm ${qty} món vào giỏ!` : 'Thêm vào giỏ hàng'}
                </button>
                <Link to="/gio-hang" className={styles.detailCart} style={{ backgroundColor: 'var(--color-brand)', color: '#fff' }}><span className="material-symbols-outlined">shopping_cart_checkout</span>Xem giỏ hàng</Link>
                <p className={styles.purchaseLimit}>Mỗi món tối đa {maxDishQuantity} phần theo cấu hình hiện hành.</p>
              </div>
            </div>
          </section>

          <section className={styles.reviewsSection}>
            <div className={styles.reviewsHead}>
              <div><h2 className={styles.reviewsTitle}>Đánh giá khách hàng</h2>{reviewCount > 0 ? <div className={styles.reviewsMeta}><StarRow value={rating} /><span className={styles.metaBold}>{rating.toFixed(1)}</span><span className={styles.metaMuted}>({reviews.length.toLocaleString('vi-VN')} đánh giá)</span></div> : null}</div>
            </div>
            {reviewsError ? <p role="alert">{reviewsError}</p> : null}
            {reviewsLoading ? <p role="status">Đang tải đánh giá…</p> : null}
            {!reviewsLoading && reviews.length === 0 ? <p className={styles.reviewText}>Món này chưa có đánh giá.</p> : null}
            <div className={styles.reviewsGrid}>
              {visibleReviews.map((review) => <ReviewCard key={review.id} review={review} />)}
            </div>
            {reviews.length > 4 ? <div className={styles.reviewsMore}><button type="button" className={styles.reviewsMoreBtn} onClick={() => setReviewsExpanded((value) => !value)} aria-expanded={reviewsExpanded}>{reviewsExpanded ? 'Thu gọn' : `Xem thêm đánh giá (${reviews.length - 4})`}<span className={`material-symbols-outlined ${styles.reviewsMoreIco}`}>{reviewsExpanded ? 'expand_less' : 'expand_more'}</span></button></div> : null}
          </section>

          {suggestedDishes.length > 0 ? <section><h2 className={styles.suggestTitle}>Gợi ý món liên quan</h2><div className={`${styles.suggestRow} scrollbar-hide`}>
            {suggestedDishes.map((suggestion) => <div key={suggestion.id} className={styles.suggestCard}><div className={styles.suggestImgBox}><img className={styles.suggestImg} src={getDishImageUrl(suggestion)} alt={suggestion.name} onError={handleDishImageError} /></div><div className={styles.suggestBody}><h4 className={styles.suggestName}>{suggestion.name}</h4><div className={styles.suggestFoot}><span className={styles.suggestPrice}>{formatPrice(suggestion.price)}</span><Link className={styles.suggestAdd} to={`/mon/${suggestion.id}`} aria-label={`Xem ${suggestion.name}`}><span className={`material-symbols-outlined ${styles.suggestAddIcon}`}>arrow_forward</span></Link></div></div></div>)}
          </div></section> : null}
        </div>
      </main>
      <Footer />
    </>
  )
}

function ReviewCard({ review }: { review: DishReview }) {
  const author = review.user_name || 'Sinh viên NEU'
  return <article className={styles.review}>
    <div className={styles.reviewTop}>
      <div className={styles.reviewUser}><div className={`${styles.reviewAvatar} ${styles.reviewAvatarYou}`} aria-hidden><span className={styles.avatarLetter}>{author.charAt(0)}</span></div><div><h3 className={styles.metaBold}>{author}</h3><p className={styles.reviewRole}>{review.created_at ? new Date(review.created_at).toLocaleDateString('vi-VN') : 'Đã mua qua NEUFood'}</p></div></div>
      <ReviewStars value={review.rating} />
    </div>
    {review.comment ? <p className={styles.reviewText}>{review.comment}</p> : null}
  </article>
}
