import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Upload } from 'lucide-react'
import { dishService } from '../../services/dishService'
import { settingsService } from '../../services/settingsService'
import type { Category, DishWritePayload } from '../../types/dish'
import { money, requestMessage } from './managerRules'
import { getDishImageUrl, handleDishImageError } from '../../utils/dishImages'

export default function ManagerDishFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [fee, setFee] = useState(5000)
  const [revision, setRevision] = useState(0)
  const [form, setForm] = useState({ name: '', short_description: '', description: '', base_price: '', image_url: '', category_ids: [] as string[], badges: [] as string[], is_available: true })
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setLoaded(false)
    Promise.all([dishService.getCategories(), settingsService.getSettings(), id ? dishService.getDishById(id) : Promise.resolve(null)]).then(([cats, settings, dish]) => {
      if (!active) return
      setCategories(cats)
      const setting = settings.find((item) => item.setting_key === 'system_maintenance_fee')
      const feeValue = setting ? Number(setting.setting_value) : 5000
      if (!Number.isFinite(feeValue) || feeValue < 0) throw new Error('Phụ phí hệ thống không hợp lệ.')
      setFee(feeValue)
      if (dish) setForm({ name: dish.name, short_description: dish.short_description || '', description: dish.description || '', base_price: String(dish.base_price || 0), image_url: dish.image_url || '', category_ids: dish.category_ids || [], badges: dish.badges || [], is_available: dish.is_available !== false })
      setLoaded(true)
    }).catch((e) => { if (active) setError(requestMessage(e, 'Không tải được thông tin món hoặc phụ phí hiện hành. Vui lòng thử lại.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, revision])
  async function upload(file?: File) {
    if (!file) return
    setUploading(true); setError('')
    try { const image_url = await dishService.uploadImage(file); setForm((current) => ({ ...current, image_url })) }
    catch (e) { setError(requestMessage(e, 'Không tải được ảnh. Chọn PNG, JPG, JPEG, WEBP hoặc GIF.')) }
    finally { setUploading(false) }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || uploading || !loaded) return
    const amount = Number(form.base_price)
    if (!form.name.trim() || !Number.isFinite(amount) || amount < 0) { setError('Tên món và giá gốc không hợp lệ.'); return }
    setSaving(true); setError('')
    try {
      const payload: DishWritePayload = { name: form.name.trim(), short_description: form.short_description.trim(), description: form.description.trim(), base_price: amount, image_url: form.image_url.trim(), category_ids: form.category_ids, badges: form.badges, is_available: form.is_available }
      if (id) await dishService.updateDish(id, payload)
      else {
        const slug = form.name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
        await dishService.createDish({ ...payload, id: `${slug || 'mon-moi'}-${crypto.randomUUID().slice(0, 8)}` })
      }
      navigate('/quan-ly/mon')
    } catch (e) { setError(requestMessage(e, 'Chưa lưu được món. Vui lòng thử lại.')) }
    finally { setSaving(false) }
  }
  const blocked = loading || saving || uploading || !loaded
  return <div className="manager-page"><Link className="manager-hint" to="/quan-ly/mon"><ArrowLeft size={14} /> Trở về thực đơn</Link><section className="manager-heading"><div><span className="manager-eyebrow">QUẢN LÝ MÓN ĂN</span><h1>{id ? 'Chỉnh sửa món ăn' : 'Thêm món mới'}</h1><p>Nhập giá gốc tại quầy; giá niêm yết được cộng phụ phí hệ thống hiện hành.</p></div></section>{error && <div className="manager-alert error" role="alert">{error}{!loaded && <button className="manager-button" disabled={loading} onClick={() => setRevision((n) => n + 1)}>Thử lại</button>}</div>}
    {loading ? <div className="manager-state">Đang tải thông tin thực đơn…</div> : <form onSubmit={save} className="manager-page"><fieldset disabled={blocked} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}><div className="manager-split"><section className="manager-card"><header className="manager-card-header"><h2>Thông tin món ăn</h2></header><div className="manager-card-body manager-form"><label className="manager-field">Tên món<input className="manager-input" required minLength={2} maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ví dụ: Cơm gà sốt tiêu" /></label><label className="manager-field">Giá gốc tại quầy (VNĐ)<input className="manager-input" type="number" min={0} step={1} required value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} placeholder="40000" /></label><div className="manager-field"><span>Danh mục món ăn</span><div className="manager-chip-row">{categories.map((category) => <label key={category.id}><input type="checkbox" checked={form.category_ids.includes(category.id)} onChange={(e) => setForm({ ...form, category_ids: e.target.checked ? [...form.category_ids, category.id] : form.category_ids.filter((key) => key !== category.id) })} />{category.label || category.name}</label>)}</div></div><label className="manager-field">Mô tả ngắn<input className="manager-input" maxLength={300} value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} /></label><label className="manager-field">Mô tả chi tiết<textarea className="manager-input" rows={5} maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Nguyên liệu, khẩu phần, lưu ý cho khách…" /></label></div></section>
    <div className="manager-page"><section className="manager-card"><header className="manager-card-header"><h2>Hình ảnh món ăn</h2></header><div className="manager-card-body manager-form"><img key={form.image_url} className="manager-image-preview" src={getDishImageUrl({ id, image: form.image_url })} alt="Ảnh xem trước món ăn" onError={handleDishImageError} /><label className="manager-field"><span><Upload size={15} /> Tải ảnh từ máy</span><input type="file" accept=".png,.jpg,.jpeg,.webp,.gif" onChange={(e) => void upload(e.target.files?.[0])} /></label><label className="manager-field">Hoặc đường dẫn ảnh<input className="manager-input" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://… hoặc /uploads/…" /></label><p className="manager-hint">PNG, JPG, JPEG, WEBP, GIF. Có thể để trống để dùng ảnh mặc định.</p></div></section><section className="manager-card"><div className="manager-card-body manager-form"><h2>Giá niêm yết dự kiến</h2><div className="manager-price-preview"><span>{money(Number(form.base_price || 0))} giá gốc + {money(fee)} phụ phí</span><strong>{money(Number(form.base_price || 0) + fee)}</strong><p className="manager-hint">Thay đổi giá không ảnh hưởng đến đơn đã tạo.</p></div><label className="manager-check"><input type="checkbox" checked={form.is_available} onChange={(e) => setForm({ ...form, is_available: e.target.checked })} />Đang còn món</label><label className="manager-check"><input type="checkbox" checked={form.badges.includes('signature')} onChange={(e) => setForm({ ...form, badges: e.target.checked ? [...form.badges, 'signature'] : form.badges.filter((badge) => badge !== 'signature') })} />Món đặc trưng của Canteen</label></div></section></div></div></fieldset><div className="manager-actions"><Link to="/quan-ly/mon" className="manager-button">Hủy</Link><button type="submit" className="manager-button primary" disabled={blocked}><Save size={16} />{uploading ? 'Đang tải ảnh…' : saving ? 'Đang lưu…' : id ? 'Lưu thay đổi' : 'Tạo món'}</button></div></form>}
  </div>
}
