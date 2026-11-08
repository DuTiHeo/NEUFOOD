import { useEffect, useMemo, useState } from 'react'
import { MessageSquareText, RefreshCw, Search, Star, UtensilsCrossed } from 'lucide-react'
import { reviewService } from '../../services/reviewService'
import { dishService } from '../../services/dishService'
import type { Category, Dish, DishReview } from '../../types/dish'
import { getDishImageUrl, handleDishImageError } from '../../utils/dishImages'
import { loadCanteenDishes } from './managerData'
import { dateTime, money, requestMessage } from './managerRules'
import styles from './ManagerReviewsPage.module.css'

function Stars({ value, large = false }: { value: number; large?: boolean }) {
  const rounded = Math.round(value)
  return <span className={`${styles.stars} ${large ? styles.starsLarge : ''}`} aria-label={`${value.toFixed(1)} trên 5 sao`}>
    {[1, 2, 3, 4, 5].map((star) => <Star key={star} size={large ? 20 : 13} fill={star <= rounded ? 'currentColor' : 'none'} />)}
  </span>
}

export default function ManagerReviewsPage() {
  const [dishes, setDishes] = useState<Dish[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selected, setSelected] = useState('')
  const [reviews, setReviews] = useState<DishReview[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    setCatalogLoading(true)
    setError('')
    loadCanteenDishes()
      .then((items) => {
        if (!active) return
        setDishes(items)
        setSelected((current) => items.some((dish) => dish.id === current) ? current : items[0]?.id || '')
      })
      .catch((requestError) => { if (active) setError(requestMessage(requestError, 'Không tải được danh sách món.')) })
      .finally(() => { if (active) setCatalogLoading(false) })
    dishService.getCategories().then((items) => { if (active) setCategories(items) }).catch(() => {})
    return () => { active = false }
  }, [revision])

  useEffect(() => {
    if (!selected) {
      setReviews([])
      setReviewsLoading(false)
      return
    }
    let active = true
    setReviewsLoading(true)
    setReviews([])
    setError('')
    reviewService.getDishReviews(selected)
      .then((items) => { if (active) setReviews(items) })
      .catch((requestError) => { if (active) setError(requestMessage(requestError, 'Không tải được đánh giá món.')) })
      .finally(() => { if (active) setReviewsLoading(false) })
    return () => { active = false }
  }, [selected, revision])

  const selectedDish = dishes.find((dish) => dish.id === selected)
  const filteredDishes = useMemo(() => dishes.filter((dish) =>
    dish.name.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))
    && (categoryFilter === 'all' || dish.category_ids?.includes(categoryFilter))
  ), [dishes, search, categoryFilter])
  const average = reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length : 0

  return <div className="manager-page">
    <section className="manager-heading">
      <div><span className="manager-eyebrow">PHẢN HỒI TỪ SINH VIÊN</span><h1>Đánh giá món ăn</h1><p>Chọn món trong thực đơn để xem thông tin, điểm sao và nhận xét.</p></div>
      <button className="manager-button" disabled={catalogLoading || reviewsLoading} onClick={() => setRevision((current) => current + 1)}><RefreshCw size={15} />Làm mới</button>
    </section>

    {error && <p className="manager-alert error" role="alert">{error}</p>}

    <div className={styles.reviewLayout}>
      <section className={`manager-card ${styles.menuPanel}`} aria-label="Thực đơn món ăn">
        <header className={styles.panelHeader}><div><h2>Thực đơn</h2><p>{catalogLoading ? 'Đang tải món…' : `${dishes.length} món`}</p></div></header>
        <div className={styles.menuFilters}>
          <label className={styles.searchBox}><Search size={16} /><input type="search" placeholder="Tìm món ăn…" aria-label="Tìm món ăn" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <select className="manager-select" aria-label="Lọc món theo danh mục" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">Tất cả danh mục</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.label || category.name || category.id}</option>)}
          </select>
        </div>
        <div className={styles.dishList}>
          {catalogLoading ? <div className="manager-state">Đang tải thực đơn…</div> : filteredDishes.length ? filteredDishes.map((dish) => {
            const rating = Number(dish.rating || 0)
            const count = Number(dish.reviewCount ?? dish.review_count ?? 0)
            return <button type="button" key={dish.id} className={`${styles.dishChoice} ${selected === dish.id ? styles.dishChoiceActive : ''}`} aria-pressed={selected === dish.id} onClick={() => setSelected(dish.id)}>
              <img src={getDishImageUrl(dish)} alt="" onError={handleDishImageError} loading="lazy" />
              <span className={styles.dishCopy}><strong>{dish.name}</strong><small>{money(dish.price)}</small><span className={styles.dishRating}><Star size={13} fill="currentColor" />{count ? `${rating.toFixed(1)} · ${count} đánh giá` : 'Chưa có đánh giá'}</span></span>
            </button>
          }) : <div className="manager-state"><UtensilsCrossed size={25} /><strong>{dishes.length ? 'Không tìm thấy món' : 'Thực đơn chưa có món'}</strong></div>}
        </div>
      </section>

      <section className={styles.detailColumn} aria-live="polite">
        {!selectedDish ? <div className={`manager-card ${styles.emptyDetail}`}><MessageSquareText size={30} /><strong>Chọn một món ăn</strong><span>Thông tin và đánh giá sẽ hiển thị tại đây.</span></div> : <>
          <article className={`manager-card ${styles.dishDetail}`}>
            <img className={styles.detailImage} src={getDishImageUrl(selectedDish)} alt={selectedDish.name} onError={handleDishImageError} />
            <div className={styles.detailInfo}>
              <span className="manager-eyebrow">THÔNG TIN MÓN ĂN</span>
              <h2>{selectedDish.name}</h2>
              <p>{selectedDish.short_description || selectedDish.shortDescription || selectedDish.description || 'Chưa có mô tả cho món ăn này.'}</p>
              <div className={styles.detailMeta}><strong>{money(selectedDish.price)}</strong><span className={`manager-pill ${selectedDish.is_available === false ? 'warn' : 'good'}`}>{selectedDish.is_available === false ? 'Hết món' : 'Còn món'}</span></div>
            </div>
          </article>

          <section className={`manager-card ${styles.reviewPanel}`}>
            <header className={styles.reviewSummary}>
              <div><span className="manager-eyebrow">ĐÁNH GIÁ CỦA SINH VIÊN</span><h2>Nhận xét về {selectedDish.name}</h2><p>{reviewsLoading ? 'Đang tải đánh giá…' : `${reviews.length} đánh giá`}</p></div>
              <div className={styles.ratingScore}><strong>{reviewsLoading || !reviews.length ? '—' : average.toFixed(1)}</strong><Stars value={average} large /><small>trên 5 sao</small></div>
            </header>
            {reviewsLoading ? <div className="manager-state">Đang tải nhận xét…</div> : reviews.length ? <div className={styles.reviewList}>{reviews.map((review) => <article key={review.id} className="manager-review">
              <header><div><strong>{review.user_name || 'Sinh viên NEU'}</strong><small>{review.created_at ? dateTime(review.created_at) : 'Đã đánh giá món ăn'} · Đơn #{review.order_id}</small></div><span className={styles.reviewRating}><Star size={14} fill="currentColor" />{review.rating}/5</span></header>
              <p>{review.comment?.trim() || 'Sinh viên không để lại bình luận.'}</p>
            </article>)}</div> : <div className="manager-state"><MessageSquareText size={28} /><strong>Món này chưa có đánh giá</strong><span>Nhận xét sẽ xuất hiện khi sinh viên đánh giá món đã nhận.</span></div>}
          </section>
        </>}
      </section>
    </div>
  </div>
}
