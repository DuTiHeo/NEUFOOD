import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAdminDishes } from '../../contexts/AdminDishesContext'
import f from './AdminForm.module.css'

const CATS = ['Cơm', 'Đồ uống', 'Ăn vặt', 'Healthy', 'Món khác']

export default function AdminSuaMonPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getById, updateDish } = useAdminDishes()
  const dish = id ? getById(id) : null

  const [name, setName] = useState('')
  const [category, setCategory] = useState('Cơm')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState('')
  const [active, setActive] = useState(true)
  const [signature, setSignature] = useState(false)
  const [stock, setStock] = useState('in')

  useEffect(() => {
    if (!dish) return
    setName(dish.name)
    setCategory(dish.category || 'Cơm')
    setPrice(String(dish.price ?? ''))
    setDescription(dish.description || dish.shortDescription || '')
    setImage(dish.image || '')
    setActive(dish.active !== false)
    setSignature(Boolean(dish.signature))
    setStock(dish.stock || 'in')
  }, [dish])

  if (!dish) {
    return (
      <div class={f.page}>
        <p>Không tìm thấy món.</p>
        <Link class={f.btnGhost} to="/quan-ly/mon">
          Về danh sách
        </Link>
      </div>
    )
  }

  function save() {
    const p = Number(String(price).replace(/\D/g, '')) || 0
    updateDish(id, {
      name: name.trim(),
      category,
      price: p,
      description: description.trim(),
      shortDescription: description.trim().slice(0, 120),
      image: image.trim() || dish.image,
      active,
      signature,
      stock,
    })
    navigate('/quan-ly/mon')
  }

  const ingredients = dish.ingredients ?? ['Đùi gà', 'Cơm', 'Dưa leo']

  return (
    <>
      <div class={f.page} style={{ paddingBottom: '5rem' }}>
        <button type="button" class={f.back} onClick={() => navigate('/quan-ly/mon')}>
          <span class="material-symbols-outlined" style={{ fontSize: '18px' }}>
            arrow_back
          </span>
          Về danh sách món
        </button>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontFamily: 'var(--font-headline)',
                fontSize: 'clamp(1.5rem, 3vw, 2rem)',
                fontWeight: 800,
              }}
            >
              Sửa món: {dish.name}
            </h1>
            <p style={{ margin: '0.5rem 0 0', color: 'var(--color-muted)' }}>
              Cập nhật giá, mô tả và trạng thái hiển thị.
            </p>
          </div>
          <div class={f.badges}>
            {signature ? (
              <span class={`${f.badge} ${f.badgeSig}`}>
                <span class="material-symbols-outlined" style={{ fontSize: '14px' }}>
                  star
                </span>
                Signature
              </span>
            ) : null}
            <span class={`${f.badge} ${f.badgeId}`}>ID: {dish.id}</span>
          </div>
        </div>

        <div class={f.grid}>
          <div class={f.col}>
            <div class={f.card}>
              <h2 class={f.cardHd}>
                <span class="material-symbols-outlined" style={{ color: 'var(--color-brand)' }}>
                  info
                </span>
                Thông tin cơ bản
              </h2>
              <div class={f.field}>
                <label class={f.lbl} htmlFor="sm-name">
                  Tên món
                </label>
                <input id="sm-name" class={f.inp} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div class={f.row2}>
                <div class={f.field}>
                  <label class={f.lbl} htmlFor="sm-cat">
                    Danh mục
                  </label>
                  <div class={f.selWrap}>
                    <select
                      id="sm-cat"
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
                  <label class={f.lbl} htmlFor="sm-price">
                    Giá (VNĐ)
                  </label>
                  <div class={f.priceWrap}>
                    <input
                      id="sm-price"
                      class={f.inp}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                    <span class={f.priceSuf}>đ</span>
                  </div>
                </div>
              </div>
              <div class={f.field}>
                <label class={f.lbl} htmlFor="sm-desc">
                  Mô tả
                </label>
                <textarea
                  id="sm-desc"
                  class={f.area}
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div class={f.card}>
              <h2 class={f.cardHd}>
                <span class="material-symbols-outlined" style={{ color: 'var(--color-brand)' }}>
                  restaurant
                </span>
                Nguyên liệu (xem nhanh)
              </h2>
              <div class={f.ing}>
                {ingredients.map((x) => (
                  <span key={x} class={f.chip}>
                    {x}
                  </span>
                ))}
              </div>
              <div class={f.tip}>
                <span class="material-symbols-outlined" style={{ color: 'var(--color-brand)' }}>
                  tips_and_updates
                </span>
                <span>Danh sách đầy đủ có thể chỉnh trong phiên bản có API.</span>
              </div>
            </div>
          </div>

          <div class={f.col}>
            <div class={f.card}>
              <h2 class={f.cardHd}>
                <span class="material-symbols-outlined" style={{ color: 'var(--color-brand)' }}>
                  image
                </span>
                Ảnh món
              </h2>
              <div class={f.imgBox}>
                <img src={image || dish.image} alt="" />
                <div class={f.imgOverlay}>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.875rem' }}>
                    Chỉnh URL bên dưới
                  </span>
                </div>
              </div>
              <div class={f.field}>
                <label class={f.lbl} htmlFor="sm-img">
                  URL ảnh
                </label>
                <input id="sm-img" class={f.inp} value={image} onChange={(e) => setImage(e.target.value)} />
              </div>
            </div>

            <div class={f.card}>
              <h2 class={f.cardHd}>
                <span class="material-symbols-outlined" style={{ color: 'var(--color-brand)' }}>
                  visibility
                </span>
                Trạng thái
              </h2>
              <label class={f.chkRow}>
                <input
                  type="checkbox"
                  class={f.chk}
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Hiển thị trên app (demo)</span>
              </label>
              <label class={f.chkRow} style={{ marginTop: '0.75rem' }}>
                <input
                  type="checkbox"
                  class={f.chk}
                  checked={signature}
                  onChange={(e) => setSignature(e.target.checked)}
                />
                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Món signature</span>
              </label>
              <div class={f.field} style={{ marginTop: '1rem' }}>
                <label class={f.lbl} htmlFor="sm-stock">
                  Tồn kho (demo)
                </label>
                <div class={f.selWrap}>
                  <select
                    id="sm-stock"
                    class={f.sel}
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  >
                    <option value="in">Còn hàng</option>
                    <option value="low">Sắp hết</option>
                    <option value="out">Hết hàng</option>
                  </select>
                  <span class={`material-symbols-outlined ${f.selChev}`}>expand_more</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer class={f.bar}>
        <div class={f.barHint}>
          <span class="material-symbols-outlined" style={{ color: 'var(--color-brand)' }}>
            save_as
          </span>
          Nhấn Lưu để cập nhật bản demo trên trình duyệt.
        </div>
        <div class={f.barAct}>
          <button type="button" class={f.btnGhost} onClick={() => navigate('/quan-ly/mon')}>
            Huỷ
          </button>
          <button type="button" class={f.btnPri} onClick={save}>
            Lưu thay đổi
          </button>
        </div>
      </footer>
    </>
  )
}
