import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAdminDishes } from '../../contexts/AdminDishesContext'
import f from './AdminForm.module.css'

const CATS = ['Cơm', 'Đồ uống', 'Ăn vặt', 'Healthy', 'Món khác']

export default function AdminThemMonPage() {
  const navigate = useNavigate()
  const { addDish } = useAdminDishes()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Cơm')
  const [price, setPrice] = useState('')
  const [shortDescription, setShortDescription] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState('')
  const [signature, setSignature] = useState(false)

  function onSubmit(e) {
    e.preventDefault()
    const p = Number(String(price).replace(/\D/g, '')) || 0
    addDish({
      name: name.trim() || 'Món mới',
      category,
      price: p,
      shortDescription: shortDescription.trim(),
      description: description.trim() || shortDescription.trim(),
      image: image.trim() || 'https://placehold.co/400x300/e2e8f0/64748b?text=NEUFood',
      signature,
      active: true,
      stock: 'in',
    })
    navigate('/quan-ly/mon')
  }

  return (
    <div class={f.page}>
      <Link class={f.back} to="/quan-ly/mon">
        <span class="material-symbols-outlined" style={{ fontSize: '18px' }}>
          arrow_back
        </span>
        Về danh sách món
      </Link>
      <h2 class={f.cardHd} style={{ marginBottom: 0 }}>
        <span class="material-symbols-outlined" style={{ color: 'var(--color-brand)' }}>
          add_circle
        </span>
        Thêm món mới
      </h2>
      <p style={{ margin: '0 0 1rem', color: 'var(--color-muted)', fontSize: '0.875rem' }}>
        Điền thông tin món — dữ liệu lưu cục bộ trên trình duyệt (demo).
      </p>

      <form onSubmit={onSubmit}>
        <div class={f.grid}>
          <div class={f.col}>
            <div class={f.card} style={{ boxShadow: 'none', border: '1px solid var(--color-edge)' }}>
              <div class={f.field}>
                <label class={f.lbl} htmlFor="tm-name">
                  Tên món
                </label>
                <input
                  id="tm-name"
                  class={f.inp}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Phở bò tái"
                  required
                />
              </div>
              <div class={f.row2}>
                <div class={f.field}>
                  <label class={f.lbl} htmlFor="tm-cat">
                    Danh mục
                  </label>
                  <div class={f.selWrap}>
                    <select
                      id="tm-cat"
                      class={f.sel}
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      {CATS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <span class={`material-symbols-outlined ${f.selChev}`}>expand_more</span>
                  </div>
                </div>
                <div class={f.field}>
                  <label class={f.lbl} htmlFor="tm-price">
                    Giá (VNĐ)
                  </label>
                  <div class={f.priceWrap}>
                    <input
                      id="tm-price"
                      class={f.inp}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="45000"
                    />
                    <span class={f.priceSuf}>đ</span>
                  </div>
                </div>
              </div>
              <div class={f.field}>
                <label class={f.lbl} htmlFor="tm-short">
                  Mô tả ngắn
                </label>
                <input
                  id="tm-short"
                  class={f.inp}
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="Hiển thị trên thẻ món"
                />
              </div>
              <div class={f.field}>
                <label class={f.lbl} htmlFor="tm-desc">
                  Mô tả chi tiết
                </label>
                <textarea
                  id="tm-desc"
                  class={f.area}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Nguyên liệu, ghi chú dinh dưỡng..."
                />
              </div>
            </div>
          </div>
          <div class={f.col}>
            <div class={f.card} style={{ boxShadow: 'none', border: '1px solid var(--color-edge)' }}>
              <div class={f.field}>
                <label class={f.lbl} htmlFor="tm-img">
                  URL ảnh món
                </label>
                <input
                  id="tm-img"
                  class={f.inp}
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <label class={f.drop}>
                <span class={`material-symbols-outlined ${f.dropIco}`}>add_photo_alternate</span>
                <span class={f.dropTit}>Ảnh minh họa</span>
                <span class={f.dropSub}>Dán URL ở trên hoặc dùng ảnh mặc định khi để trống</span>
              </label>
              <label class={f.chkRow}>
                <input
                  type="checkbox"
                  class={f.chk}
                  checked={signature}
                  onChange={(e) => setSignature(e.target.checked)}
                />
                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Đánh dấu món signature</span>
              </label>
            </div>
          </div>
        </div>
        <div class={f.act}>
          <Link class={f.btnGhost} to="/quan-ly/mon">
            Huỷ
          </Link>
          <button type="submit" class={f.btnPri}>
            Tạo món
          </button>
        </div>
      </form>
    </div>
  )
}
