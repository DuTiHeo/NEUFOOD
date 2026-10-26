import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useOrderHistory } from '../../contexts/OrderHistoryContext'
import { useDishes } from '../../contexts/DishesContext'
import { getDishImageUrl, handleDishImageError } from '../../utils/dishImages'
import Footer from '../../components/layout/Footer'
import styles from './LichSuDonHangPage.module.css'

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

const statusUi = {
  CHO_XAC_NHAN: { label: 'Chờ xác nhận', cls: styles.badgeWait },
  DANG_CHUAN_BI: { label: 'Đang chuẩn bị', cls: styles.badgeWait },
  DANG_GIAO: { label: 'Đang giao', cls: styles.badgeWait },
  SAN_SANG_LAY: { label: 'Sẵn sàng nhận', cls: styles.badgeWait },
  GIAO_THAT_BAI: { label: 'Chờ nhận tại quầy', cls: styles.badgeWait },
  DA_GIAO: { label: 'Đã giao', cls: styles.badgeOk },
  DA_BAN_GIAO: { label: 'Đã bàn giao', cls: styles.badgeOk },
  HOAN_THANH: { label: 'Hoàn thành', cls: styles.badgeOk },
  KHIEU_NAI: { label: 'Đang khiếu nại', cls: styles.badgeWait },
  DA_GIAI_QUYET: { label: 'Đã xử lý khiếu nại', cls: styles.badgeOk },
  DA_HUY_KHACH: { label: 'Đã hủy', cls: styles.badgeBad },
  TU_CHOI: { label: 'Bị từ chối', cls: styles.badgeBad },
  TU_DONG_HUY: { label: 'Tự động hủy', cls: styles.badgeBad },
  BO_DON_BLACKLIST: { label: 'Đơn bị bỏ', cls: styles.badgeBad },
}

const INITIAL_VISIBLE = 3
const PAGE_SIZE = 10

export default function LichSuDonHangPage() {
  const { orders, isLoading, error, refresh } = useOrderHistory()
  const { getById } = useDishes()
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
    const timer = window.setTimeout(() => setOrderFlash(false), 6000)
    return () => window.clearTimeout(timer)
  }, [orderFlash])

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase().replace(/^#/, '')
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    return [...orders]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .filter((order) => {
        if (query && !order.id.toLowerCase().includes(query)) return false
        const timestamp = new Date(order.created_at || 0).getTime()
        if (!Number.isFinite(timestamp) || timestamp <= 0) return timeFilter === 'all'
        if (timeFilter === '30') return timestamp >= now - 30 * dayMs
        if (timeFilter === '90') return timestamp >= now - 90 * dayMs
        if (timeFilter === '180') return timestamp >= now - 180 * dayMs
        if (timeFilter === '365') return timestamp >= now - 365 * dayMs
        if (timeFilter === '2026') return new Date(timestamp).getFullYear() === 2026
        if (timeFilter === '2025') return new Date(timestamp).getFullYear() === 2025
        if (timeFilter === '2024') return new Date(timestamp).getFullYear() === 2024
        if (timeFilter === 'old') return new Date(timestamp).getFullYear() < 2024
        return true
      })
  }, [orders, q, timeFilter])

  useEffect(() => {
    setShowAll(false)
    setCurrentPage(1)
  }, [q, timeFilter])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)
  const hasMore = rows.length > INITIAL_VISIBLE
  const rowsToRender = showAll ? rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) : rows.slice(0, INITIAL_VISIBLE)

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.hd}>
          <h1 className={styles.title}>Lịch sử đơn hàng</h1>
          <p className={styles.lead}>Đơn hàng và trạng thái được đồng bộ từ NEUFood.</p>
        </header>

        {orderFlash ? (
          <div className={styles.flash} role="status">
            <span className={`material-symbols-outlined ${styles.flashIco}`}>check_circle</span>
            <p className={styles.flashTxt}>Đặt hàng thành công. Đơn của bạn đã được lưu.</p>
          </div>
        ) : null}

        {error ? (
          <div role="alert" className={styles.flash}>
            <p className={styles.flashTxt}>{error}</p>
            <button type="button" onClick={() => void refresh()}>Thử tải lại</button>
          </div>
        ) : null}

        <section className={styles.tools} aria-label="Lọc đơn hàng">
          <div className={styles.search}>
            <span className={`material-symbols-outlined ${styles.searchIco}`}>search</span>
            <input
              className={styles.searchInp}
              type="search"
              placeholder="Tìm theo mã đơn (vd. NF2610211234)"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              aria-label="Tìm theo mã đơn"
            />
          </div>
          <div className={styles.filt}>
            <div className={styles.selWrap}>
              <select className={styles.sel} value={timeFilter} onChange={(event) => setTimeFilter(event.target.value)} aria-label="Khoảng thời gian">
                <option value="30">30 ngày gần đây</option>
                <option value="90">3 tháng</option>
                <option value="180">6 tháng</option>
                <option value="365">12 tháng</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
                <option value="old">Cũ hơn</option>
                <option value="all">Tất cả</option>
              </select>
              <span className={`material-symbols-outlined ${styles.selChev}`}>expand_more</span>
            </div>
            <button type="button" className={styles.filtBtn} onClick={() => void refresh()} aria-label="Tải lại lịch sử đơn">
              <span className="material-symbols-outlined">refresh</span>
            </button>
          </div>
        </section>

        <div className={styles.list}>
          {isLoading ? <p role="status">Đang tải lịch sử đơn hàng…</p> : null}
          {!isLoading && rowsToRender.length === 0 ? (
            <p className={styles.empty}>{orders.length ? `Không có đơn nào khớp “${q}”.` : 'Bạn chưa có đơn hàng nào.'}</p>
          ) : null}
          {!isLoading ? rowsToRender.map((order) => {
            const status = statusUi[order.status] || { label: order.status, cls: styles.badgeWait }
            const firstItem = order.items?.[0]
            const firstDish = getById(firstItem?.dish_id)
            const summary = order.items?.map((item) => `${item.dish_name} ×${item.quantity}`).join(', ') || 'Đơn hàng NEUFood'
            const place = order.order_type === 'pickup' ? 'Nhận tại quầy Canteen A2' : order.delivery_address || 'Trong khuôn viên NEU'
            return (
              <article key={order.id} className={styles.card}>
                <div className={styles.top}>
                  <div className={styles.meta}>
                    <div className={styles.idRow}>
                      <span className={styles.oid}>#{order.id}</span>
                      <span className={`${styles.badge} ${status.cls}`}>{status.label}</span>
                    </div>
                    <p className={styles.when}>Đặt ngày {formatDate(order.created_at)}</p>
                  </div>
                  <div className={styles.sum}>
                    <p className={styles.sumN}>{formatPrice(order.total_amount)}</p>
                  </div>
                </div>
                <div className={styles.body}>
                  <div className={styles.thumb}>
                    <img src={getDishImageUrl(firstDish)} alt="" onError={handleDishImageError} />
                  </div>
                  <div className={styles.txt}>
                    <h3 className={styles.name}>{summary}</h3>
                    <p className={styles.sub}>{place}{order.delivery_note ? ` • ${order.delivery_note}` : ''}</p>
                  </div>
                </div>
                <div className={styles.foot}>
                  <Link className={`${styles.btn} ${styles.btnGhost}`} to={`/don-hang/${order.id}`}>Xem chi tiết</Link>
                  <Link className={`${styles.btn} ${styles.btnPri}`} to="/menu">Đặt lại</Link>
                </div>
              </article>
            )
          }) : null}
        </div>

        {hasMore ? (
          <div className={styles.more}>
            <button type="button" className={styles.moreBtn} onClick={() => { setShowAll((prev) => !prev); setCurrentPage(1) }}>
              <span>{showAll ? 'Thu gọn đơn' : `Xem thêm đơn (${rows.length - INITIAL_VISIBLE})`}</span>
              <span className="material-symbols-outlined">{showAll ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}</span>
            </button>
          </div>
        ) : null}

        {showAll && rows.length > PAGE_SIZE ? (
          <div className={styles.pagination} aria-label="Chuyển trang lịch sử đơn">
            <button type="button" className={styles.pageBtn} disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>‹</button>
            {pageNumbers.map((page) => (
              <button key={page} type="button" className={page === currentPage ? styles.pageBtnOn : styles.pageBtn} onClick={() => setCurrentPage(page)} aria-current={page === currentPage ? 'page' : undefined}>{page}</button>
            ))}
            <button type="button" className={styles.pageBtn} disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>›</button>
          </div>
        ) : null}
      </div>
      <Footer />
    </main>
  )
}
