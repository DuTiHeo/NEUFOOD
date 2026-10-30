import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, RefreshCw, UtensilsCrossed } from 'lucide-react'
import { dishService } from '../../services/dishService'
import type { Category, Dish } from '../../types/dish'
import { getDishImageUrl, handleDishImageError } from '../../utils/dishImages'
import { loadCanteenDishes } from './managerData'
import { money, requestMessage } from './managerRules'

export default function ManagerMenuPage() {
  const [dishes, setDishes] = useState<Dish[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true; setLoading(true); setError('')
    Promise.all([loadCanteenDishes(), dishService.getCategories()]).then(([items, cats]) => { if (active) { setDishes(items); setCategories(cats) } }).catch((e) => { if (active) setError(requestMessage(e, 'Không tải được thực đơn.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])
  const filtered = dishes.filter((dish) => dish.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')) && (category === 'all' || dish.category_ids?.includes(category)) && (filter === 'all' || (filter === 'out' ? !dish.is_available : dish.is_available)))
  async function toggleAvailability(dish: Dish) {
    if (busy) return
    setBusy(dish.id); setError(''); setNotice('')
    try {
      const updated = await dishService.updateAvailability(dish.id, !dish.is_available)
      setDishes((items) => items.map((item) => item.id === updated.id ? updated : item))
      setNotice(`${updated.name}: ${updated.is_available ? 'đã đánh dấu còn món.' : 'đã đánh dấu hết món.'}`)
    } catch (e) { setError(requestMessage(e, 'Không cập nhật được món.')) }
    finally { setBusy('') }
  }
  return <div className="manager-page"><section className="manager-heading"><div><span className="manager-eyebrow">THỰC ĐƠN CANTEEN A2</span><h1>Món ăn & giá bán</h1><p>Quản lý giá gốc, hình ảnh và tình trạng còn/hết món. Lịch sử đơn giữ nguyên giá đã chốt.</p></div><div className="manager-tools"><button className="manager-button" disabled={loading || Boolean(busy)} onClick={() => setRevision((n) => n + 1)}><RefreshCw size={15} />Làm mới</button><Link to="/quan-ly/mon/them" className="manager-button primary"><Plus size={16} />Thêm món</Link></div></section>
    {error && <p className="manager-alert error" role="alert">{error}</p>}{notice && <p className="manager-alert success" role="status">{notice}</p>}
    <div className="manager-tabs" aria-label="Tình trạng món">{[['all', 'Tất cả'], ['in', 'Còn món'], ['out', 'Hết món']].map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label} · {loading ? '—' : dishes.filter((dish) => key === 'all' || (key === 'in' ? dish.is_available : !dish.is_available)).length}</button>)}</div>
    <div className="manager-toolbar"><input className="manager-input" type="search" aria-label="Tìm tên món" placeholder="Tìm tên món ăn…" value={query} onChange={(e) => setQuery(e.target.value)} /><select className="manager-select" aria-label="Lọc danh mục món" value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">Tất cả danh mục</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.label || item.name}</option>)}</select></div>
    <section className="manager-card"><div className="manager-table-wrap"><table className="manager-table"><thead><tr><th>Món ăn</th><th>Giá gốc tại quầy</th><th>Giá niêm yết</th><th>Tình trạng món</th><th>Quản lý</th></tr></thead><tbody>{loading ? <tr><td colSpan={5}>Đang tải thực đơn…</td></tr> : filtered.length ? filtered.map((dish) => <tr key={dish.id}><td><div className="manager-product"><img src={getDishImageUrl(dish)} alt="" onError={handleDishImageError} /><div><strong>{dish.name}</strong><small>{dish.category_ids?.map((id) => categories.find((c) => c.id === id)?.label || id).join(' · ') || 'Chưa phân loại'}</small></div></div></td><td><strong>{money(dish.base_price || 0)}</strong><small>Giá món Canteen</small></td><td><strong>{money(dish.price)}</strong><small>Đã cộng {money(dish.system_fee || 0)} phụ phí</small></td><td><span className={`manager-pill ${dish.is_available ? 'good' : 'warn'}`}>{dish.is_available ? 'Còn món' : 'Hết món'}</span><br /><button className="manager-button" onClick={() => void toggleAvailability(dish)} disabled={Boolean(busy)}>{busy === dish.id ? 'Đang lưu…' : dish.is_available ? 'Đánh dấu hết món' : 'Đánh dấu còn món'}</button></td><td><div className="manager-actions"><Link className="manager-button" to={`/quan-ly/mon/sua/${encodeURIComponent(dish.id)}`} aria-label={`Sửa ${dish.name}`}><Pencil size={15} />Sửa</Link></div></td></tr>) : <tr><td colSpan={5}><div className="manager-state"><UtensilsCrossed size={26} />Không có món phù hợp.</div></td></tr>}</tbody></table></div><footer className="manager-pagination">{filtered.length} / {dishes.length} món</footer></section>
    <p className="manager-alert">Món hết hàng vẫn xuất hiện trên thực đơn để khách xem thông tin, nhưng không thể thêm vào giỏ hoặc đặt món đó. Đánh dấu Còn món khi có thể phục vụ trở lại.</p>
  </div>
}
