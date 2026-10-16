import { useMemo, useState } from 'react'
import { adminOrderRows, orderStatusOptions } from '../../data/adminOrdersDemo'
import styles from './AdminDonPage.module.css'

function formatPrice(n) {
  return `${Number(n).toLocaleString('vi-VN')}đ`
}

export default function AdminDonPage() {
  const [rows, setRows] = useState(() =>
    adminOrderRows.map((r) => ({ ...r, status: r.status })),
  )
  const [tab, setTab] = useState('all')

  const filtered = useMemo(() => {
    if (tab === 'all') return rows
    if (tab === 'active') return rows.filter((r) => !['delivered', 'cancelled'].includes(r.status))
    if (tab === 'preparing') return rows.filter((r) => r.status === 'preparing')
    if (tab === 'delivered') return rows.filter((r) => r.status === 'delivered')
    return rows
  }, [rows, tab])

  function setStatus(orderId, value) {
    setRows((prev) => prev.map((x) => (x.id === orderId ? { ...x, status: value } : x)))
  }

  return (
    <>
      <section class={styles.top}>
        <div>
          <p class={styles.live}>Giám sát trực tiếp</p>
          <div class={styles.tabs}>
            <button
              type="button"
              class={`${styles.tab} ${tab === 'all' ? styles.tabOn : ''}`}
              onClick={() => setTab('all')}
            >
              Tất cả
            </button>
            <button
              type="button"
              class={`${styles.tab} ${tab === 'active' ? styles.tabOn : ''}`}
              onClick={() => setTab('active')}
            >
              Đang xử lý
            </button>
            <button
              type="button"
              class={`${styles.tab} ${tab === 'preparing' ? styles.tabOn : ''}`}
              onClick={() => setTab('preparing')}
            >
              Đang làm
            </button>
            <button
              type="button"
              class={`${styles.tab} ${tab === 'delivered' ? styles.tabOn : ''}`}
              onClick={() => setTab('delivered')}
            >
              Đã giao
            </button>
          </div>
        </div>
        <div class={styles.kpis}>
          <div class={styles.kpi}>
            <p class={styles.kpiLbl}>Đơn hôm nay</p>
            <p class={styles.kpiN}>124</p>
          </div>
          <div class={styles.kpi}>
            <p class={styles.kpiLbl}>TG TB</p>
            <p class={styles.kpiN}>18p</p>
          </div>
        </div>
      </section>

      <section class={styles.panel}>
        <div class={styles.scroll}>
          <table class={styles.tbl}>
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Sinh viên &amp; địa điểm</th>
                <th>Món</th>
                <th>Tổng</th>
                <th>Giờ</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => (
                <tr key={r.id} class={styles.row}>
                  <td>
                    <span class={styles.oid}>#{r.id}</span>
                  </td>
                  <td>
                    <p class={styles.stu}>{r.student}</p>
                    <p class={styles.loc}>
                      <span class="material-symbols-outlined" style={{ fontSize: '14px' }}>
                        location_on
                      </span>
                      {r.place}
                    </p>
                  </td>
                  <td>
                    <p class={styles.items}>{r.items}</p>
                    {r.note ? <p class={styles.note}>+ {r.note}</p> : null}
                  </td>
                  <td class={styles.total}>{formatPrice(r.total)}</td>
                  <td>
                    <p class={styles.time}>{r.time}</p>
                    <p class={styles.ago}>{r.ago}</p>
                  </td>
                  <td>
                    <select
                      class={`${styles.stSel} ${styles[`st_${r.status}`] || ''}`}
                      value={r.status}
                      onChange={(e) => setStatus(r.id, e.target.value)}
                      aria-label={`Trạng thái ${r.id}`}
                    >
                      {orderStatusOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div class={styles.act}>
                      <button type="button" class={styles.actBtn} aria-label="In">
                        <span class="material-symbols-outlined">print</span>
                      </button>
                      <button type="button" class={styles.actBtn} aria-label="Xem">
                        <span class="material-symbols-outlined">visibility</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div class={styles.foot}>
          <p class={styles.footTxt}>Hiển thị {filtered.length} đơn (demo)</p>
          <div class={styles.pg}>
            <button type="button" class={styles.pgBtn}>
              Trước
            </button>
            <button type="button" class={styles.pgBtn}>
              Sau
            </button>
          </div>
        </div>
      </section>

      <section class={styles.bento}>
        <div class={styles.hero}>
          <div>
            <h3 style={{ margin: '0 0 0.5rem', fontFamily: 'var(--font-headline)', fontSize: '1.25rem' }}>
              Cảnh báo giờ cao điểm
            </h3>
            <p>Đơn tăng ~22% so với cùng kỳ. Cân nhắc bố trí thêm nhân sự bếp.</p>
          </div>
          <button type="button" class={styles.heroBtn}>
            Tối ưu luồng
          </button>
        </div>
        <div class={styles.side}>
          <div>
            <div class={styles.sideHd}>
              <h3 class={styles.sideTit}>Khu bếp hiệu quả</h3>
              <span class={styles.tag}>Ổn định</span>
            </div>
            <div class={styles.station}>
              <div class={styles.stIco}>
                <span class="material-symbols-outlined">outdoor_grill</span>
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem' }}>Grill &amp; Burger</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                  TB chế biến: 8,5 phút
                </p>
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid var(--color-edge)',
              paddingTop: '1rem',
              fontSize: '0.75rem',
              color: 'var(--color-muted)',
            }}
          >
            <span>8 đơn chờ</span>
            <span class="material-symbols-outlined" style={{ fontSize: '18px' }}>
              chevron_right
            </span>
          </div>
        </div>
      </section>
    </>
  )
}
