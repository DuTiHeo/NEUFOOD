import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAdminDishes } from '../../contexts/AdminDishesContext'
import styles from './AdminMonPage.module.css'

function formatPrice(n) {
  return `${Number(n).toLocaleString('vi-VN')}đ`
}

export default function AdminMonPage() {
  const { list, updateDish, removeDish } = useAdminDishes()
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return list
    return list.filter(
      (d) =>
        d.name.toLowerCase().includes(s) ||
        (d.category || '').toLowerCase().includes(s),
    )
  }, [list, q])

  const total = list.length
  const activeN = list.filter((d) => d.active).length
  const inactiveN = total - activeN
  const lowStock = list.filter((d) => d.stock === 'out').length

  function onDelete(id, name) {
    if (window.confirm(`Xóa món “${name}”?`)) removeDish(id)
  }

  return (
    <>
      <div class={styles.head}>
        <div>
          <h2 class={styles.h1}>Quản lý thực đơn</h2>
          <p class={styles.sub}>Cập nhật món ăn hiển thị trên campus dining.</p>
        </div>
        <Link class={styles.add} to="/quan-ly/mon/them">
          <span class="material-symbols-outlined" aria-hidden>
            add
          </span>
          Thêm món
        </Link>
      </div>

      <div class={styles.stats}>
        <div class={styles.stat}>
          <div class={styles.statTop}>
            <span class={styles.statLbl}>Tổng món</span>
            <span class={`material-symbols-outlined ${styles.statIco}`}>restaurant</span>
          </div>
          <p class={styles.statNum}>{total}</p>
          <p class={styles.statFoot}>Trong hệ thống quản trị</p>
        </div>
        <div class={styles.stat}>
          <div class={styles.statTop}>
            <span class={styles.statLbl}>Đang bật</span>
            <span class={`material-symbols-outlined ${styles.statIco}`}>visibility</span>
          </div>
          <p class={styles.statNum}>{activeN}</p>
          <p class={styles.statFoot}>Hiển thị cho người dùng (demo)</p>
        </div>
        <div class={styles.stat}>
          <div class={styles.statTop}>
            <span class={styles.statLbl}>Đang tắt</span>
            <span class={`material-symbols-outlined ${styles.statIco}`}>inventory_2</span>
          </div>
          <p class={styles.statNum}>{inactiveN}</p>
          <p class={styles.statFoot}>Ẩn khỏi app</p>
        </div>
        <div class={styles.stat}>
          <div class={styles.statTop}>
            <span class={styles.statLbl}>Hết hàng</span>
            <span class={`material-symbols-outlined ${styles.statIco}`}>block</span>
          </div>
          <p class={styles.statNum}>{lowStock}</p>
          <p class={styles.statFoot}>Trạng thái kho (demo)</p>
        </div>
      </div>

      <section class={styles.panel}>
        <div class={styles.toolbar}>
          <div class={styles.search}>
            <span class={`material-symbols-outlined ${styles.searchIco}`}>search</span>
            <input
              class={styles.searchInp}
              type="search"
              placeholder="Tìm theo tên, danh mục..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Tìm món"
            />
          </div>
          <div class={styles.tools}>
            <button type="button" class={styles.tool}>
              <span class="material-symbols-outlined" style={{ fontSize: '18px' }}>
                filter_list
              </span>
              Lọc
            </button>
            <button type="button" class={styles.tool}>
              <span class="material-symbols-outlined" style={{ fontSize: '18px' }}>
                download
              </span>
              Xuất
            </button>
          </div>
        </div>
        <div class={styles.scroll}>
          <table class={styles.tbl}>
            <thead>
              <tr>
                <th>Món</th>
                <th>Danh mục</th>
                <th>Giá</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} class={styles.row}>
                  <td>
                    <div class={styles.dish}>
                      <div class={styles.thumb}>
                        <img src={d.image} alt="" />
                      </div>
                      <div>
                        <p class={styles.dishName}>{d.name}</p>
                        <p class={styles.dishSub}>{d.shortDescription?.slice(0, 48) || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class={styles.tag}>{d.category || '—'}</span>
                  </td>
                  <td class={styles.price}>{formatPrice(d.price)}</td>
                  <td>
                    <div class={styles.toggle}>
                      <button
                        type="button"
                        class={`${styles.switch} ${d.active ? styles.switchOn : ''}`}
                        onClick={() => updateDish(d.id, { active: !d.active })}
                        aria-pressed={d.active}
                        aria-label={d.active ? 'Đang bật' : 'Đang tắt'}
                      >
                        <span class={styles.knob} />
                      </button>
                      <span class={d.active ? styles.stLbl : styles.stLblOff}>
                        {d.active ? 'Bật' : 'Tắt'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div class={styles.act}>
                      <Link
                        class={styles.iconBtn}
                        to={`/quan-ly/mon/sua/${d.id}`}
                        aria-label={`Sửa ${d.name}`}
                      >
                        <span class="material-symbols-outlined">edit</span>
                      </Link>
                      <button
                        type="button"
                        class={`${styles.iconBtn} ${styles.iconDel}`}
                        onClick={() => onDelete(d.id, d.name)}
                        aria-label={`Xóa ${d.name}`}
                      >
                        <span class="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div class={styles.foot}>
          <p class={styles.footTxt}>
            Hiển thị {filtered.length} / {total} món
          </p>
          <div class={styles.pg}>
            <button type="button" class={styles.pgBtn} disabled>
              Trước
            </button>
            <button type="button" class={styles.pgBtn}>
              Sau
            </button>
          </div>
        </div>
      </section>
    </>
  )
}
