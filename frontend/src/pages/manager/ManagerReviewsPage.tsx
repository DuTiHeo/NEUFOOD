import { useEffect, useState } from 'react'
import { MessageSquareText, RefreshCw, Star } from 'lucide-react'
import { reviewService } from '../../services/reviewService'
import type { Dish, DishReview } from '../../types/dish'
import { loadCanteenDishes } from './managerData'
import { dateTime, requestMessage } from './managerRules'

export default function ManagerReviewsPage() {
  const [dishes, setDishes] = useState<Dish[]>([])
  const [selected, setSelected] = useState('')
  const [reviews, setReviews] = useState<DishReview[]>([])
  const [loading, setLoading] = useState(true)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true; setCatalogLoading(true); setError('')
    loadCanteenDishes().then((items) => { if (active) { setDishes(items); setSelected((value) => items.some((dish) => dish.id === value) ? value : items[0]?.id || '') } }).catch((e) => { if (active) setError(requestMessage(e, 'Không tải được danh sách món.')) }).finally(() => { if (active) { setCatalogLoading(false); setLoading(false) } })
    return () => { active = false }
  }, [revision])
  useEffect(() => {
    if (!selected) return
    let active = true; setLoading(true); setReviews([]); setError('')
    reviewService.getDishReviews(selected).then((items) => { if (active) setReviews(items) }).catch((e) => { if (active) setError(requestMessage(e, 'Không tải được đánh giá món.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [selected, revision])
  const average = reviews.length ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length : null
  return <div className="manager-page"><section className="manager-heading"><div><span className="manager-eyebrow">PHẢN HỒI TỪ KHÁCH HÀNG</span><h1>Đánh giá món ăn</h1><p>Theo dõi chất lượng món qua điểm số và nhận xét của khách.</p></div><button className="manager-button" disabled={loading || catalogLoading} onClick={() => setRevision((n) => n + 1)}><RefreshCw size={15} />Làm mới</button></section><select className="manager-select" aria-label="Chọn món xem đánh giá" value={selected} onChange={(e) => setSelected(e.target.value)} disabled={catalogLoading}><option value="">Chọn món ăn</option>{dishes.map((dish) => <option key={dish.id} value={dish.id}>{dish.name}</option>)}</select>{error && <p className="manager-alert error" role="alert">{error}</p>}<section className="manager-card"><header className="manager-card-header"><div><h2>{dishes.find((dish) => dish.id === selected)?.name || 'Chưa chọn món'}</h2><p>{loading ? 'Đang cập nhật…' : `${reviews.length} đánh giá`}</p></div><span className="manager-stars"><Star size={20} fill="currentColor" /><strong>{loading || average == null ? '—' : average.toFixed(1)} / 5</strong></span></header>{loading || catalogLoading ? <div className="manager-state">Đang tải đánh giá…</div> : reviews.length ? reviews.map((review) => <article key={review.id} className="manager-review"><header><div><strong>{review.user_name || 'Khách hàng'}</strong><small>Đơn #{review.order_id} · {dateTime(review.created_at)}</small></div><span className="manager-stars"><Star size={15} fill="currentColor" />{review.rating}/5</span></header><p>{review.comment || 'Khách hàng không để lại bình luận.'}</p></article>) : !error && <div className="manager-state"><MessageSquareText size={28} /><strong>Chưa có đánh giá cho món này</strong><span>Phản hồi sẽ xuất hiện khi khách đánh giá món đã nhận.</span></div>}</section><p className="manager-hint">Quản lý xem phản hồi để cải thiện món ăn. Khiếu nại đơn hàng được chuyển đến quản trị viên xử lý.</p></div>
}
