import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useOrderHistory } from '../../contexts/OrderHistoryContext'
import { demoHistory } from '../../data/orders'
import styles from './LichSuDonHangPage.module.css'

function formatPrice(n) {
  return `${n.toLocaleString('vi-VN')}đ`
}

const statusUi = {
  preparing: { label: 'Đang xử lý', cls: styles.badgeWait },
  delivered: { label: 'Đã giao', cls: styles.badgeOk },
  cancelled: { label: 'Đã huỷ', cls: styles.badgeBad },
}

const INITIAL_VISIBLE = 3
const PAGE_SIZE = 10

export default function LichSuDonHangPage() {
  const { orders } = useOrderHistory()
  const location = useLocation()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [orderFlash, setOrderFlash] = useState(false)
  const [timeFilter, setTimeFilter] = useState('30')
  const [showAll, setShowAll] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    if (!location.state?.orderPlaced) return
    setOrderFlash(true)
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.state, location.pathname, navigate])

  useEffect(() => {
    if (!orderFlash) return
    const t = window.setTimeout(() => setOrderFlash(false), 6000)
    return () => window.clearTimeout(t)
  }, [orderFlash])

  const merged = useMemo(() => [...orders, ...demoHistory], [orders])

  function parseOrderTime(order) {
    const [d, m, y] = String(order?.date || '').split('/').map((v) => Number(v))
    const [hh, mm] = String(order?.time || '').split(':').map((v) => Number(v))
    if (!d || !m || !y) return null
    const dt = new Date(y, m - 1, d, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0)
    const t = dt.getTime()
    return Number.isFinite(t) ? t : null
  }

  const sortedMerged = useMemo(() => {
    return [...merged].sort((a, b) => (parseOrderTime(b) ?? 0) - (parseOrderTime(a) ?? 0))
  }, [merged])

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/^#/, '')
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000

    return sortedMerged.filter((o) => {
      const idMatch = !s || o.id.toLowerCase().includes(s)
      if (!idMatch) return false

      const t = parseOrderTime(o)
      if (t == null) return timeFilter === 'all'

      const dt = new Date(t)
      if (timeFilter === '30') return t >= now - 30 * dayMs
      if (timeFilter === '90') return t >= now - 90 * dayMs
      if (timeFilter === '180') return t >= now - 180 * dayMs
      if (timeFilter === '365') return t >= now - 365 * dayMs
      if (timeFilter === '2025') return dt.getFullYear() === 2025
      if (timeFilter === '2024') return dt.getFullYear() === 2024
      if (timeFilter === 'old') return dt.getFullYear() < 2024
      if (timeFilter === 'all') return true
      return true
    })
  }, [q, sortedMerged, timeFilter])

  useEffect(() => {
    setShowAll(false)
    setCurrentPage(1)
  }, [q, timeFilter])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
  const hasMore = rows.length > INITIAL_VISIBLE

  const rowsToRender = useMemo(() => {
    if (!showAll) return rows.slice(0, INITIAL_VISIBLE)
    const start = (currentPage - 1) * PAGE_SIZE
    return rows.slice(start, start + PAGE_SIZE)
  }, [rows, showAll, currentPage])

  return (
    <main class={styles.page}>
      <div class={styles.inner}>
        <header class={styles.hd}>
          <h1 class={styles.title}>Lịch sử đơn hàng</h1>
          <p class={styles.lead}>Xem và quản lý các đơn đặt món tại campus.</p>
        </header>

        {orderFlash ? (
          <div class={styles.flash} role="status">
            <span class={`material-symbols-outlined ${styles.flashIco}`}>check_circle</span>
            <p class={styles.flashTxt}>Đặt hàng thành công. Đơn của bạn đã được lưu vào lịch sử.</p>
          </div>
        ) : null}

        <section class={styles.tools} aria-label="Lọc đơn hàng">
          <div class={styles.search}>
            <span class={`material-symbols-outlined ${styles.searchIco}`}>search</span>
            <input
              class={styles.searchInp}
              type="search"
              placeholder="Tìm theo mã đơn (vd. NF12345)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Tìm theo mã đơn"
            />
          </div>
          <div class={styles.filt}>
            <div class={styles.selWrap}>
              <select class={styles.sel} value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} aria-label="Khoảng thời gian">
                <option value="30">30 ngày gần đây</option>
                <option value="90">3 tháng</option>
                <option value="180">6 tháng</option>
                <option value="365">12 tháng</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
                <option value="old">Cũ hơn</option>
                <option value="all">Tất cả</option>
              </select>
              <span class={`material-symbols-outlined ${styles.selChev}`}>expand_more</span>
            </div>
            <button type="button" class={styles.filtBtn} aria-label="Bộ lọc nâng cao">
              <span class="material-symbols-outlined">filter_list</span>
            </button>
          </div>
        </section>

        <div class={styles.list}>
          {rowsToRender.length === 0 ? (
            <p class={styles.empty}>Không có đơn nào khớp “{q}”.</p>
          ) : (
            rowsToRender.map((o) => {
              const st = statusUi[o.status] ?? statusUi.preparing
              return (
                <article key={o.id} class={styles.card}>
                  <div class={styles.top}>
                    <div class={styles.meta}>
                      <div class={styles.idRow}>
                        <span class={styles.oid}>#{o.id}</span>
                        <span class={`${styles.badge} ${st.cls}`}>{st.label}</span>
                      </div>
                      <p class={styles.when}>
                        Đặt ngày {o.date} • {o.time}
                      </p>
                    </div>
                    <div class={styles.sum}>
                      <p class={styles.sumN}>{formatPrice(o.total)}</p>
                    </div>
                  </div>
                  <div class={styles.body}>
                    <div class={o.dimmed ? `${styles.thumb} ${styles.thumbDim}` : styles.thumb}>
                      <img src={o.image} alt="" />
                    </div>
                    <div class={styles.txt}>
                      <h3 class={styles.name}>{o.summary}</h3>
                      <p class={styles.sub}>{o.detail}</p>
                    </div>
                  </div>
                  <div class={styles.foot}>
                    <Link class={`${styles.btn} ${styles.btnGhost}`} to={`/don-hang/${o.id}`}>
                      Xem chi tiết
                    </Link>
                    <Link class={`${styles.btn} ${styles.btnPri}`} to="/menu">
                      Đặt lại
                    </Link>
                  </div>
                </article>
              )
            })
          )}
        </div>

        {hasMore ? (
          <div class={styles.more}>
            <button
              type="button"
              class={styles.moreBtn}
              onClick={() => {
                setShowAll((prev) => !prev)
                setCurrentPage(1)
              }}
            >
              <span>{showAll ? 'Thu gọn đơn' : `Xem thêm đơn (${rows.length - INITIAL_VISIBLE})`}</span>
              <span class="material-symbols-outlined">{showAll ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}</span>
            </button>
          </div>
        ) : null}

        {showAll && rows.length > PAGE_SIZE ? (
          <div class={styles.pagination} aria-label="Chuyển trang lịch sử đơn">
            <button
              type="button"
              class={styles.pageBtn}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              {'‹'}
            </button>
            {pageNumbers.map((p) => (
              <button
                key={p}
                type="button"
                class={p === currentPage ? styles.pageBtnOn : styles.pageBtn}
                onClick={() => setCurrentPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              class={styles.pageBtn}
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              {'›'}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  )
}
