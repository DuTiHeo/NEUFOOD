import { useEffect, useState } from 'react'
import { reportService, RevenueReport } from '../../services/reportService'
import styles from './AdminBaoCaoPage.module.css'

function dateValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function money(value: number) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`
}

function defaultRange(days: number) {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - days + 1)
  return { from: dateValue(from), to: dateValue(to) }
}

export default function AdminBaoCaoPage() {
  const [range, setRange] = useState(() => defaultRange(30))
  const [quickRange, setQuickRange] = useState(30)
  const [report, setReport] = useState<RevenueReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!range.from || !range.to || range.from > range.to) {
      setError('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.')
      setReport(null)
      setIsLoading(false)
      return
    }

    let active = true
    setIsLoading(true)
    setError('')
    reportService.getRevenueSummary(range.from, range.to)
      .then((result) => { if (active) setReport(result) })
      .catch((requestError: any) => {
        if (active) {
          setReport(null)
          setError(requestError?.response?.data?.message || 'Không tải được báo cáo doanh thu từ máy chủ.')
        }
      })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [range.from, range.to])

  function chooseDays(days: number) {
    setQuickRange(days)
    setRange(defaultRange(days))
  }

  const reportForDisplay: RevenueReport = report || {
    from_date: range.from,
    to_date: range.to,
    total_orders: 0,
    completed_orders: 0,
    cancelled_or_rejected_orders: 0,
    blacklisted_orders: 0,
    gross_revenue: 0,
    canteen_net_revenue: 0,
    system_fee_total: 0,
    ship_fee_total: 0,
    top_dishes: [],
  }
  const topQuantity = Math.max(1, ...reportForDisplay.top_dishes.map((dish) => dish.total_quantity))

  return (
    <>
      <header className={styles.hd}>
        <div>
          <h1 className={styles.h1}>Báo cáo doanh thu</h1>
          <p className={styles.sub}>Số liệu đơn hàng và COD do API tổng hợp theo thời gian bàn giao.</p>
        </div>
        <div className={styles.range} aria-label="Khoảng thời gian báo cáo">
          <button type="button" className={`${styles.rngBtn} ${quickRange === 30 ? styles.rngOn : ''}`} onClick={() => chooseDays(30)}>30 ngày</button>
          <button type="button" className={`${styles.rngBtn} ${quickRange === 90 ? styles.rngOn : ''}`} onClick={() => chooseDays(90)}>90 ngày</button>
        </div>
      </header>

      <section className={styles.dateRange} aria-label="Tùy chọn khoảng ngày">
        <label>Từ ngày <input type="date" value={range.from} max={range.to || undefined} onChange={(event) => { setQuickRange(0); setRange((current) => ({ ...current, from: event.target.value })) }} /></label>
        <label>Đến ngày <input type="date" value={range.to} min={range.from || undefined} max={dateValue(new Date())} onChange={(event) => { setQuickRange(0); setRange((current) => ({ ...current, to: event.target.value })) }} /></label>
      </section>

      {error ? <p role="alert" className={styles.reportError}>{error}</p> : null}
      {isLoading ? <p role="status" className={styles.reportNotice}>Đang tải báo cáo…</p> : null}

      {!isLoading ? <>
        <section className={styles.metrics} aria-label="Chỉ số tổng hợp">
          <article className={styles.mc}><div className={styles.mcTop}><span className={`material-symbols-outlined ${styles.mcIco}`} style={{ background: '#eff6ff', color: '#2563eb' }}>payments</span></div><p className={styles.mcLbl}>Tổng doanh thu đã thu</p><p className={styles.mcVal}>{money(reportForDisplay.gross_revenue)}</p></article>
          <article className={styles.mc}><div className={styles.mcTop}><span className={`material-symbols-outlined ${styles.mcIco}`} style={{ background: '#eef2ff', color: '#4f46e5' }}>receipt_long</span></div><p className={styles.mcLbl}>Tổng đơn trong kỳ</p><p className={styles.mcVal}>{reportForDisplay.total_orders.toLocaleString('vi-VN')}</p></article>
          <article className={styles.mc}><div className={styles.mcTop}><span className={`material-symbols-outlined ${styles.mcIco}`} style={{ background: '#ecfdf5', color: '#059669' }}>storefront</span></div><p className={styles.mcLbl}>Doanh thu Canteen</p><p className={styles.mcVal}>{money(reportForDisplay.canteen_net_revenue)}</p></article>
          <article className={styles.mc}><div className={styles.mcTop}><span className={`material-symbols-outlined ${styles.mcIco}`} style={{ background: '#fffbeb', color: '#d97706' }}>task_alt</span></div><p className={styles.mcLbl}>Đã bàn giao / hoàn tất</p><p className={styles.mcVal}>{reportForDisplay.completed_orders.toLocaleString('vi-VN')}</p></article>
        </section>

        <section className={styles.charts}>
          <article className={styles.chartCard}>
            <div className={styles.chartHd}><div><h2 className={styles.chartTit}>Cơ cấu doanh thu</h2><p className={styles.chartSub}>Khoản thu từ đơn đã thanh toán trong kỳ</p></div></div>
            <dl className={styles.reportBreakdown}>
              <div><dt>Doanh thu món (Canteen)</dt><dd>{money(reportForDisplay.canteen_net_revenue)}</dd></div>
              <div><dt>Phụ phí hệ thống</dt><dd>{money(reportForDisplay.system_fee_total)}</dd></div>
              <div><dt>Phí giao hàng</dt><dd>{money(reportForDisplay.ship_fee_total)}</dd></div>
              <div className={styles.reportTotal}><dt>Tổng tiền đã thu</dt><dd>{money(reportForDisplay.gross_revenue)}</dd></div>
            </dl>
            <p className={styles.chartSub}>Kỳ báo cáo: {new Date(`${reportForDisplay.from_date}T00:00:00`).toLocaleDateString('vi-VN')} – {new Date(`${reportForDisplay.to_date}T00:00:00`).toLocaleDateString('vi-VN')}</p>
          </article>
          <article className={styles.chartCard}>
            <div className={styles.chartHd}><div><h2 className={styles.chartTit}>Món bán nhiều nhất</h2><p className={styles.chartSub}>Sắp xếp theo số lượng đã bán</p></div></div>
            {reportForDisplay.top_dishes.length ? <div className={styles.topList}>
              {reportForDisplay.top_dishes.map((dish, index) => <div key={dish.dish_id} className={styles.topItem}>
                <div className={styles.reportRank}>{index + 1}</div>
                <div className={styles.topBody}><div className={styles.topRow}><span className={styles.topName}>{dish.dish_name}</span><span className={styles.topSold}>{dish.total_quantity} phần</span></div><div className={styles.barBg}><div className={styles.barFg} style={{ width: `${Math.round((dish.total_quantity / topQuantity) * 100)}%` }} /></div><span className={styles.chartSub}>{money(dish.total_revenue)}</span></div>
              </div>)}
            </div> : <p className={styles.chartSub}>Chưa có đơn đã thanh toán trong khoảng thời gian này.</p>}
          </article>
        </section>

        <section className={styles.reportStatus} aria-label="Trạng thái đơn hàng">
          <div><span>Đã hủy hoặc bị từ chối</span><strong>{reportForDisplay.cancelled_or_rejected_orders.toLocaleString('vi-VN')}</strong></div>
          <div><span>Đơn bị đưa vào danh sách đen</span><strong>{reportForDisplay.blacklisted_orders.toLocaleString('vi-VN')}</strong></div>
        </section>
      </> : null}
    </>
  )
}
