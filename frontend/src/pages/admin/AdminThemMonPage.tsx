import { FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAdminDishes } from '../../contexts/AdminDishesContext'
import f from './AdminForm.module.css'

export default function AdminThemMonPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const basePath = pathname.startsWith('/admin') ? '/admin' : '/quan-ly'
  const { addDish, categories, isLoading } = useAdminDishes()
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [price, setPrice] = useState('')
  const [shortDescription, setShortDescription] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState('')
  const [signature, setSignature] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!categoryId && categories.length) setCategoryId(categories[0].id)
  }, [categoryId, categories])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const basePrice = Number(String(price).replace(/\D/g, ''))
      await addDish({
        name: name.trim(),
        categoryIds: categoryId ? [categoryId] : [],
        basePrice,
        shortDescription: shortDescription.trim(),
        description: description.trim() || shortDescription.trim(),
        image: image.trim(),
        signature,
        available: true,
      })
      navigate(`${basePath}/mon`)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể tạo món. Vui lòng kiểm tra dữ liệu và quyền quản lý.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={f.page}>
      <Link className={f.back} to={`${basePath}/mon`}>
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
          arrow_back
        </span>
        Về danh sách món
      </Link>
      <h2 className={f.cardHd} style={{ marginBottom: 0 }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--color-brand)' }}>
          add_circle
        </span>
        Thêm món mới
      </h2>
      <p style={{ margin: '0 0 1rem', color: 'var(--color-muted)', fontSize: '0.875rem' }}>
        Nhập giá gốc tại quầy. Hệ thống sẽ áp dụng phụ phí theo cấu hình khi tính giá niêm yết.
      </p>

      {error ? <p role="alert">{error}</p> : null}

      <form onSubmit={onSubmit}>
        <div className={f.grid}>
          <div className={f.col}>
            <div className={f.card} style={{ boxShadow: 'none', border: '1px solid var(--color-edge)' }}>
              <div className={f.field}>
                <label className={f.lbl} htmlFor="tm-name">
                  Tên món
                </label>
                <input
                  id="tm-name"
                  className={f.inp}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Phở bò tái"
                  required
                />
              </div>
              <div className={f.row2}>
                <div className={f.field}>
                  <label className={f.lbl} htmlFor="tm-cat">
                    Danh mục
                  </label>
                  <div className={f.selWrap}>
                    <select
                      id="tm-cat"
                      className={f.sel}
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      disabled={isLoading || categories.length === 0}
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label || category.name || category.id}
                        </option>
                      ))}
                    </select>
                    <span className={`material-symbols-outlined ${f.selChev}`}>expand_more</span>
                  </div>
                </div>
                <div className={f.field}>
                  <label className={f.lbl} htmlFor="tm-price">
                    Giá gốc tại quầy (VNĐ)
                  </label>
                  <div className={f.priceWrap}>
                    <input
                      id="tm-price"
                      className={f.inp}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="40000"
                      inputMode="numeric"
                      required
                    />
                    <span className={f.priceSuf}>đ</span>
                  </div>
                </div>
              </div>
              <div className={f.field}>
                <label className={f.lbl} htmlFor="tm-short">
                  Mô tả ngắn
                </label>
                <input
                  id="tm-short"
                  className={f.inp}
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="Hiển thị trên thẻ món"
                />
              </div>
              <div className={f.field}>
                <label className={f.lbl} htmlFor="tm-desc">
                  Mô tả chi tiết
                </label>
                <textarea
                  id="tm-desc"
                  className={f.area}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Nguyên liệu, ghi chú dinh dưỡng..."
                />
              </div>
            </div>
          </div>
          <div className={f.col}>
            <div className={f.card} style={{ boxShadow: 'none', border: '1px solid var(--color-edge)' }}>
              <div className={f.field}>
                <label className={f.lbl} htmlFor="tm-img">
                  URL ảnh món
                </label>
                <input
                  id="tm-img"
                  className={f.inp}
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <label className={f.drop}>
                <span className={`material-symbols-outlined ${f.dropIco}`}>add_photo_alternate</span>
                <span className={f.dropTit}>Ảnh minh họa</span>
                <span className={f.dropSub}>Dán URL ảnh món. Có thể để trống.</span>
              </label>
              <label className={f.chkRow}>
                <input
                  type="checkbox"
                  className={f.chk}
                  checked={signature}
                  onChange={(e) => setSignature(e.target.checked)}
                />
                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Đánh dấu món signature</span>
              </label>
            </div>
          </div>
        </div>
        <div className={f.act}>
          <Link className={f.btnGhost} to={`${basePath}/mon`}>
            Huỷ
          </Link>
          <button type="submit" className={f.btnPri} disabled={saving || isLoading || categories.length === 0}>
            {saving ? 'Đang lưu…' : 'Tạo món'}
          </button>
        </div>
      </form>
    </div>
  )
}
