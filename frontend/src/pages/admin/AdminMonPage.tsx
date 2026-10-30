import { useMemo, useState } from 'react'
import { useAdminDishes } from '../../contexts/AdminDishesContext'
import { getDishImageUrl, handleDishImageError } from '../../utils/dishImages'
import styles from './AdminMonPage.module.css'

function formatPrice(value: number) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`
}

export default function AdminMonPage() {
  const { list, isLoading, error, refresh, updateAvailability } = useAdminDishes()
  const [query, setQuery] = useState('')
  const [actionError, setActionError] = useState('')

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return list
    return list.filter((dish) => dish.name.toLowerCase().includes(search) || (dish.category || '').toLowerCase().includes(search))
  }, [list, query])

  const availableCount = list.filter((dish) => dish.available).length
  const unavailableCount = list.filter((dish) => !dish.available).length

  async function toggleAvailability(id: string, available: boolean) {
    setActionError('')
    try {
      await updateAvailability(id, !available)
    } catch (requestError: any) {
      setActionError(requestError?.response?.data?.message || 'Không thể cập nhật trạng thái còn/hết món.')
    }
  }

  return (
    <>
      <div className={styles.head}>
        <div><h2 className={styles.h1}>Tình trạng món</h2><p className={styles.sub}>Dữ liệu món được lấy từ hệ thống NEUFood.</p></div>
      </div>

      {error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => void refresh()}>Tải lại</button></div> : null}
      {actionError ? <p role="status">{actionError}</p> : null}

      <div className={styles.stats}>
        <div className={styles.stat}><div className={styles.statTop}><span className={styles.statLbl}>Tổng món</span><span className={`material-symbols-outlined ${styles.statIco}`}>restaurant</span></div><p className={styles.statNum}>{list.length}</p><p className={styles.statFoot}>Tổng món trên thực đơn</p></div>
        <div className={styles.stat}><div className={styles.statTop}><span className={styles.statLbl}>Còn món</span><span className={`material-symbols-outlined ${styles.statIco}`}>visibility</span></div><p className={styles.statNum}>{availableCount}</p><p className={styles.statFoot}>Có thể nhận đơn</p></div>
        <div className={styles.stat}><div className={styles.statTop}><span className={styles.statLbl}>Hết món</span><span className={`material-symbols-outlined ${styles.statIco}`}>block</span></div><p className={styles.statNum}>{unavailableCount}</p><p className={styles.statFoot}>Trạng thái bán hiện tại</p></div>
      </div>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <div className={styles.search}><span className={`material-symbols-outlined ${styles.searchIco}`}>search</span><input className={styles.searchInp} type="search" placeholder="Tìm theo tên, danh mục..." value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Tìm món" /></div>
          <div className={styles.tools}><button type="button" className={styles.tool} onClick={() => void refresh()}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>refresh</span>Tải lại</button></div>
        </div>
        <div className={styles.scroll}>
          <table className={styles.tbl}>
            <thead><tr><th>Món</th><th>Danh mục</th><th>Giá niêm yết</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={4}>Đang tải thực đơn…</td></tr> : null}
              {!isLoading && filtered.length === 0 ? <tr><td colSpan={4}>Không có món phù hợp.</td></tr> : null}
              {!isLoading ? filtered.map((dish) => <tr key={dish.id} className={styles.row}>
                <td><div className={styles.dish}><div className={styles.thumb}><img src={getDishImageUrl(dish)} alt="" onError={handleDishImageError} /></div><div><p className={styles.dishName}>{dish.name}</p><p className={styles.dishSub}>{dish.shortDescription?.slice(0, 48) || '—'}</p></div></div></td>
                <td><span className={styles.tag}>{dish.category || '—'}</span></td>
                <td className={styles.price}>{formatPrice(dish.price)}</td>
                <td><span className={dish.available ? styles.stLbl : styles.stLblOff}>{dish.available ? 'Còn món' : 'Hết món'}</span><br /><button type="button" onClick={() => void toggleAvailability(dish.id, dish.available)} style={{ marginTop: '0.35rem', border: 0, background: 'transparent', color: 'var(--color-brand)', cursor: 'pointer', font: 'inherit', fontSize: '0.8rem', fontWeight: 700 }}>{dish.available ? 'Đánh dấu hết món' : 'Đánh dấu còn món'}</button></td>

              </tr>) : null}
            </tbody>
          </table>
        </div>
        <div className={styles.foot}><p className={styles.footTxt}>Hiển thị {filtered.length} / {list.length} món</p></div>
      </section>
    </>
  )
}
