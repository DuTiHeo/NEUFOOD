import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAdminDishes } from '../../contexts/AdminDishesContext'
import { getDishImageUrl, handleDishImageError } from '../../utils/dishImages'
import f from './AdminForm.module.css'

export default function AdminSuaMonPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const basePath = pathname.startsWith('/admin') ? '/admin' : '/quan-ly'
  const { getById, updateDish, categories, isLoading, error: loadError } = useAdminDishes()
  const dish = id ? getById(id) : undefined
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState('')
  const [active, setActive] = useState(true)
  const [available, setAvailable] = useState(true)
  const [signature, setSignature] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!dish) return
    setName(dish.name)
    setCategoryId(dish.categoryIds?.[0] || '')
    setBasePrice(String(dish.basePrice ?? 0))
    setDescription(dish.description || dish.shortDescription || '')
    setImage(dish.image || '')
    setActive(dish.active !== false)
    setAvailable(dish.available !== false)
    setSignature(Boolean(dish.signature))
  }, [dish])

  if (isLoading && !dish) return <div className={f.page}><p role="status">Đang tải món…</p></div>
  if (!dish || !id) return <div className={f.page}><p role="alert">{loadError || 'Không tìm thấy món.'}</p><Link className={f.btnGhost} to={`${basePath}/mon`}>Về danh sách</Link></div>

  async function save() {
    setSaving(true)
    setSaveError('')
    try {
      await updateDish(id, {
        name: name.trim(),
        categoryIds: categoryId ? [categoryId] : [],
        basePrice: Number(String(basePrice).replace(/\D/g, '')) || 0,
        description: description.trim(),
        shortDescription: description.trim().slice(0, 120),
        image: image.trim(),
        active,
        available,
        signature,
      })
      navigate(`${basePath}/mon`)
    } catch (requestError: any) {
      setSaveError(requestError?.response?.data?.message || 'Không thể lưu món. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className={f.page} style={{ paddingBottom: '5rem' }}>
        <button type="button" className={f.back} onClick={() => navigate(`${basePath}/mon`)}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>Về danh sách món</button>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
          <div><h1 style={{ margin: 0, fontFamily: 'var(--font-headline)', fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800 }}>Sửa món: {dish.name}</h1><p style={{ margin: '0.5rem 0 0', color: 'var(--color-muted)' }}>Giá gốc tại quầy; backend áp dụng phụ phí cấu hình để tính giá niêm yết.</p></div>
          <span className={`${f.badge} ${f.badgeId}`}>ID: {dish.id}</span>
        </div>
        {saveError ? <p role="alert">{saveError}</p> : null}

        <div className={f.grid}>
          <div className={f.col}>
            <div className={f.card}>
              <h2 className={f.cardHd}><span className="material-symbols-outlined" style={{ color: 'var(--color-brand)' }}>info</span>Thông tin cơ bản</h2>
              <div className={f.field}><label className={f.lbl} htmlFor="sm-name">Tên món</label><input id="sm-name" className={f.inp} value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={200} required /></div>
              <div className={f.row2}>
                <div className={f.field}><label className={f.lbl} htmlFor="sm-cat">Danh mục</label><div className={f.selWrap}><select id="sm-cat" className={f.sel} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Chọn danh mục</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.label || category.name || category.id}</option>)}</select><span className={`material-symbols-outlined ${f.selChev}`}>expand_more</span></div></div>
                <div className={f.field}><label className={f.lbl} htmlFor="sm-price">Giá gốc tại quầy (VNĐ)</label><div className={f.priceWrap}><input id="sm-price" className={f.inp} value={basePrice} onChange={(event) => setBasePrice(event.target.value)} inputMode="numeric" required /><span className={f.priceSuf}>đ</span></div></div>
              </div>
              <div className={f.field}><label className={f.lbl} htmlFor="sm-desc">Mô tả</label><textarea id="sm-desc" className={f.area} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} /></div>
            </div>
            <div className={f.card}><h2 className={f.cardHd}><span className="material-symbols-outlined" style={{ color: 'var(--color-brand)' }}>payments</span>Giá niêm yết hiện tại</h2><div className={f.ing}><span className={f.chip}>{Number(basePrice || 0).toLocaleString('vi-VN')}đ + {Number(dish.systemFee || 0).toLocaleString('vi-VN')}đ = {(Number(basePrice || 0) + Number(dish.systemFee || 0)).toLocaleString('vi-VN')}đ</span></div><div className={f.tip}><span className="material-symbols-outlined" style={{ color: 'var(--color-brand)' }}>tips_and_updates</span><span>Giá sau khi lưu được backend tính lại theo cấu hình phụ phí hiện hành.</span></div></div>
          </div>
          <div className={f.col}>
            <div className={f.card}><h2 className={f.cardHd}><span className="material-symbols-outlined" style={{ color: 'var(--color-brand)' }}>image</span>Ảnh món</h2><div className={f.imgBox}><img src={getDishImageUrl({ id: dish.id, image })} alt="Ảnh xem trước món ăn" onError={handleDishImageError} /></div><div className={f.field}><label className={f.lbl} htmlFor="sm-img">URL ảnh</label><input id="sm-img" className={f.inp} value={image} onChange={(event) => setImage(event.target.value)} /></div></div>
            <div className={f.card}><h2 className={f.cardHd}><span className="material-symbols-outlined" style={{ color: 'var(--color-brand)' }}>visibility</span>Trạng thái</h2>
              <label className={f.chkRow}><input type="checkbox" className={f.chk} checked={active} onChange={(event) => setActive(event.target.checked)} /><span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Hiển thị trên thực đơn</span></label>
              <label className={f.chkRow} style={{ marginTop: '0.75rem' }}><input type="checkbox" className={f.chk} checked={available} onChange={(event) => setAvailable(event.target.checked)} /><span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Đang còn món</span></label>
              <label className={f.chkRow} style={{ marginTop: '0.75rem' }}><input type="checkbox" className={f.chk} checked={signature} onChange={(event) => setSignature(event.target.checked)} /><span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Món signature</span></label>
            </div>
          </div>
        </div>
      </div>
        <footer className={f.bar}><div className={f.barHint}><span className="material-symbols-outlined" style={{ color: 'var(--color-brand)' }}>save_as</span>Thay đổi được gửi lên API thực đơn.</div><div className={f.barAct}><button type="button" className={f.btnGhost} onClick={() => navigate(`${basePath}/mon`)}>Hủy</button><button type="button" className={f.btnPri} onClick={() => void save()} disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div></footer>
    </>
  )
}
