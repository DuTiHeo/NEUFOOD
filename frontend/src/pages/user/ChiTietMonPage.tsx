import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCart } from '../../contexts/CartContext'
import { useDishes } from '../../contexts/DishesContext'
import { reviewService } from '../../services/reviewService'
import { DishReview } from '../../types/dish'
import { getDishImageUrl, handleDishImageError } from '../../utils/dishImages'
import { defaultPortions, resolvePortions } from '../../utils/portions'
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
  const [selections, setSelections] = useState<any[]>([])
  const [note, setNote] = useState('')
  const [qty, setQty] = useState(1)
  const portionConfig = JSON.stringify(dish?.portion_groups || [])
  useEffect(() => { setSelections(defaultPortions(JSON.parse(portionConfig))); setNote('') }, [id, portionConfig])
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

  if (isLoading) return <><main className={styles.detail}><div className="wrap"><p role="status">Đang tải món ăn…</p></div></main><Footer /></>
  if (error) return <><main className={styles.detail}><div className="wrap"><p role="alert">{error}</p><button type="button" onClick={() => void refresh()}>Thử tải lại</button></div></main><Footer /></>
  if (!dish) {
    return <><main className={styles.detail}><div className="wrap" style={{ textAlign: 'center', padding: '4rem 0' }}><h2>Không tìm thấy món ăn</h2><Link to="/menu">Quay lại thực đơn</Link></div></main><Footer /></>
  }

  const reviewCount = Number(dish.reviewCount ?? dish.review_count ?? 0)
  const rating = reviewCount > 0 ? Number(dish.rating || 0) : 0
  const visibleReviews = reviewsExpanded ? reviews : reviews.slice(0, 4)
  const groups = dish.portion_groups || []
  let extraPrice = 0, configError = ''
  try { extraPrice = resolvePortions(groups, selections).extraPrice } catch { configError = 'Vui lòng chọn lại phần thêm.' }
  const unitPrice = dish.price + extraPrice
  const selectionsReady = selections.length === groups.length && groups.every((group: any) => selections.some(p => p.slot_id === group.id && group.choices.some((choice: any) => choice.id === p.choice_id)))
  const canAdd = dish.is_available !== false && !configError && selectionsReady
  const reachedCartLimit = getQty(dish.id) >= maxDishQuantity

  function handleAddToCart() {
    if (!canAdd) return
    const remaining = Math.max(0, maxDishQuantity - getQty(dish.id))
    const quantityToAdd = Math.min(qty, remaining)
    if (quantityToAdd > 0 && add(dish.id, quantityToAdd, { portions: selections, note })) {
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
                <div className={styles.detailPrices}><span className={styles.detailPrice}>{formatPrice(unitPrice)}</span></div>
                {dish.is_available === false ? <p role="status">Món hiện đã hết.</p> : null}
              </div>
              <div className={styles.detailBlock}><h3 className={styles.detailH}>Mô tả món ăn</h3><p className={styles.detailQuote}>{dish.description || dish.shortDescription || 'Chưa có mô tả cho món ăn này.'}</p></div>
              {groups.length > 0 && <section className={styles.portions} aria-label="Thêm khẩu phần ăn">
                <h3>Thêm khẩu phần ăn</h3>
                <p>Chọn tối đa một phần mỗi loại cho từng suất. Giá tính cho mỗi món/combo.</p>
                {groups.map((group: any) => {
                  const selection = selections.find(p => p.slot_id === group.id)
                  const choice = group.choices.find((c: any) => c.id === selection?.choice_id) || group.choices[0]
                  return <fieldset key={group.id} disabled={!canAdd || group.is_available === false}>
                    <legend>{group.label}</legend>
                    {group.choices.length > 1 ? <label>Món chính
                      <select aria-label={`${group.label} - Món chính`} value={choice.id} onChange={e => setSelections(prev => prev.map(p => p.slot_id === group.id ? { ...p, choice_id: e.target.value, addon_ids: [] } : p))}>
                        {group.choices.map((c: any) => <option key={c.id} value={c.id} disabled={c.is_available === false}>{c.name}</option>)}
                      </select></label> : <p>{choice.name}</p>}
                    <div className={styles.portionButtons}>{choice.addons.map((addon: any) => {
                      const selected = selection?.addon_ids.includes(addon.id) || false
                      return <button key={addon.id} type="button" aria-pressed={selected} disabled={addon.is_available === false} onClick={() => setSelections(prev => prev.map(p => p.slot_id === group.id ? { ...p, addon_ids: selected ? p.addon_ids.filter((a: string) => a !== addon.id) : [...p.addon_ids, addon.id] } : p))}>+ {addon.name} ({addon.price / 1000}k){addon.is_available === false ? ' — Hết' : ''}</button>
                    })}</div>
                  </fieldset>
                })}
                <label>Ghi chú món (không bắt buộc)<input value={note} maxLength={1000} onChange={e => setNote(e.target.value)} placeholder="Ví dụ: không ớt" /></label>
                <p aria-live="polite">Giá mỗi món/combo: {formatPrice(unitPrice)} · {qty} phần: {formatPrice(unitPrice * qty)}</p>
                {configError && <p role="alert">{configError}</p>}
              </section>}
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
