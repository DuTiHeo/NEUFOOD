import { useEffect, useState } from 'react'
import { CheckCircle2, RefreshCw, Search, UtensilsCrossed } from 'lucide-react'
import { dishService } from '../../services/dishService'
import type { Category, Dish } from '../../types/dish'
import { getDishImageUrl, handleDishImageError } from '../../utils/dishImages'
import { loadCanteenDishes } from '../manager/managerData'
import { money, requestMessage } from '../manager/managerRules'
import styles from './StaffWorkspace.module.css'

export default function StaffMenuPage() {
  const [dishes, setDishes] = useState<Dish[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [stock, setStock] = useState('all')
  const [busy, setBusy] = useState('')
  useEffect(() => {
    let active = true; setLoading(true); setError('')
    Promise.all([loadCanteenDishes(), dishService.getCategories()]).then(([items, cats]) => { if (active) { setDishes(items); setCategories(cats); setHasLoaded(true) } }).catch((e) => { if (active) setError(requestMessage(e, 'Chưa tải được thực đơn. Vui lòng thử lại.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])
  async function change(dish: Dish) {
    if (busy) return
    setBusy(dish.id); setError(''); setNotice('')
    try {
      const updated = await dishService.updateAvailability(dish.id, !dish.is_available)
      setDishes((items) => items.map((item) => item.id === updated.id ? updated : item))
      setNotice(`${updated.name}: ${updated.is_available ? 'đã mở nhận đơn trở lại.' : 'đã đánh dấu hết món.'}`)
    } catch (e) { setError(requestMessage(e, 'Không đổi được tình trạng món. Vui lòng thử lại.')) }
    finally { setBusy('') }
  }
  const filtered = dishes.filter((dish) => dish.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')) && (category === 'all' || dish.category_ids?.includes(category)) && (stock === 'all' || (stock === 'in' ? dish.is_available : !dish.is_available)))
  return <div className="manager-page"><section className="manager-heading"><div><span className="manager-eyebrow">CẬP NHẬT TẠI QUẦY</span><h1>Tình trạng món hôm nay</h1><p>Đánh dấu hết món khi không còn phục vụ; mở lại khi có nguyên liệu.</p></div><button className="manager-button" onClick={() => setRevision((n) => n + 1)} disabled={loading || Boolean(busy)}><RefreshCw size={15} />Làm mới</button></section>
    {error && <p className="manager-alert error" role="alert">{error}</p>}{notice && <p className="manager-alert success" role="status"><CheckCircle2 size={17} />{notice}</p>}
    <div className="manager-tabs" aria-label="Tình trạng món">{[['all', 'Tất cả'], ['in', 'Còn món'], ['out', 'Hết món']].map(([key, label]) => <button key={key} aria-pressed={stock === key} onClick={() => setStock(key)}>{label} · {loading || !hasLoaded ? '—' : dishes.filter((dish) => key === 'all' || (key === 'in' ? dish.is_available : !dish.is_available)).length}</button>)}</div>
    <div className="manager-toolbar"><Search size={18} color="#839caf" /><input className="manager-input" type="search" aria-label="Tìm món ăn" placeholder="Tìm tên món…" value={query} onChange={(e) => setQuery(e.target.value)} /><select className="manager-select" aria-label="Danh mục món" value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">Tất cả danh mục</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.label || item.name}</option>)}</select></div>
    {loading ? <div className="manager-state">Đang tải thực đơn…</div> : filtered.length ? <section className={styles.menuGrid} aria-label="Danh sách món">{filtered.map((dish) => <article className={styles.dishCard} key={dish.id}><img className={styles.dishImage} src={getDishImageUrl(dish)} alt="" onError={handleDishImageError} /><div className={styles.dishBody}><div className={styles.dishHeading}><h2>{dish.name}</h2><span className={`manager-pill ${dish.is_available ? 'good' : 'warn'}`}>{dish.is_available ? 'Còn món' : 'Hết món'}</span></div><p className="manager-hint">{dish.category_ids?.map((id) => categories.find((item) => item.id === id)?.label || id).join(' · ') || 'Chưa phân loại'}</p><strong className={styles.dishPrice}>{money(dish.price)}</strong><button className={`manager-button ${dish.is_available ? '' : 'primary'}`} disabled={Boolean(busy)} onClick={() => void change(dish)} aria-label={`${dish.is_available ? 'Đánh dấu hết món' : 'Đánh dấu còn món'}: ${dish.name}`}>{busy === dish.id ? 'Đang cập nhật…' : dish.is_available ? 'Đánh dấu hết món' : 'Đánh dấu còn món'}</button></div></article>)}</section> : <section className="manager-card manager-state"><UtensilsCrossed size={28} /><strong>{error ? 'Chưa có dữ liệu thực đơn' : 'Không có món phù hợp'}</strong></section>}
    <p className="manager-hint">Món hết hàng vẫn được khách xem thông tin nhưng không thể thêm vào giỏ hoặc đặt mua. Nhân viên chỉ cập nhật tình trạng còn/hết món.</p>
  </div>
}
