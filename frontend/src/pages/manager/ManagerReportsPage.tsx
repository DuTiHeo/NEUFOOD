import { useEffect, useState } from 'react'
import { BarChart3, ClipboardCheck, RefreshCw, Store, Wallet } from 'lucide-react'
import { reportService, type RevenueReport } from '../../services/reportService'
import { dateRange, money, requestMessage, vietnamDate } from './managerRules'

export default function ManagerReportsPage() {
  const [range, setRange] = useState(() => dateRange(7))
  const [days, setDays] = useState(7)
  const [report, setReport] = useState<RevenueReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true; setError(''); setReport(null)
    const span = (Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86400000
    if (!range.from || !range.to || !Number.isFinite(span) || span < 0 || span > 365) { setError('Chọn khoảng ngày hợp lệ, ngày bắt đầu không sau ngày kết thúc và tối đa 366 ngày.'); setLoading(false); return }
    setLoading(true)
    reportService.getRevenueSummary(range.from, range.to).then((data) => { if (active) setReport(data) }).catch((e) => { if (active) setError(requestMessage(e, 'Không tải được báo cáo doanh thu.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [range.from, range.to, revision])
  const metrics = report ? [
    { label: 'Doanh thu gốc Canteen', value: money(report.canteen_net_revenue), note: 'Giá gốc đã chốt × số lượng món', Icon: Store },
    { label: 'Tổng COD đã thu', value: money(report.gross_revenue), note: 'Tiền món + phụ phí + phí giao hàng', Icon: Wallet },
    { label: 'Đơn đã thu tiền', value: report.completed_orders.toLocaleString('vi-VN'), note: 'Theo ngày bàn giao thực tế', Icon: ClipboardCheck },
    { label: 'Tổng đơn trong kỳ', value: report.total_orders.toLocaleString('vi-VN'), note: 'Đơn đã thu tiền và chưa thu tiền', Icon: BarChart3 },
  ] : []
  return <div className="manager-page"><section className="manager-heading"><div><span className="manager-eyebrow">SỐ LIỆU KINH DOANH</span><h1>Doanh thu Canteen A2</h1><p>Tách rõ tiền món Canteen, phụ phí hệ thống và phí giao hàng.</p></div><button className="manager-button" onClick={() => setRevision((n) => n + 1)} disabled={loading}><RefreshCw size={15} />Làm mới</button></section><div className="manager-toolbar"><div className="manager-tabs">{[[1, 'Hôm nay'], [7, '7 ngày'], [30, '30 ngày'], [90, '90 ngày']].map(([count, label]) => <button key={count} aria-pressed={days === count} onClick={() => { setDays(Number(count)); setRange(dateRange(Number(count))) }}>{label}</button>)}</div></div><div className="manager-tools"><label className="manager-field">Từ ngày<input className="manager-input" type="date" value={range.from} max={range.to} onChange={(e) => { setDays(0); setRange({ ...range, from: e.target.value }) }} /></label><label className="manager-field">Đến ngày<input className="manager-input" type="date" value={range.to} min={range.from} max={vietnamDate()} onChange={(e) => { setDays(0); setRange({ ...range, to: e.target.value }) }} /></label></div>
    <p className="manager-report-intro">Doanh thu chỉ tính đơn đã thu COD, theo thời điểm bàn giao thực tế trong múi giờ Việt Nam (UTC+7). Đơn hủy, từ chối và bỏ hàng được thống kê theo thời điểm tạo đơn.</p>{error && <p className="manager-alert error" role="alert">{error}</p>}{loading && <div className="manager-state">Đang tổng hợp doanh thu…</div>}
    {!loading && report && <><section className="manager-metrics">{metrics.map(({ label, value, note, Icon }) => <article key={label} className="manager-metric"><div><span>{label}</span><Icon size={19} /></div><strong>{value}</strong><small>{note}</small></article>)}</section><div className="manager-split"><section className="manager-card"><header className="manager-card-header"><h2>Cơ cấu doanh thu</h2></header><div className="manager-card-body manager-totals"><div><span>Doanh thu gốc Canteen</span><strong>{money(report.canteen_net_revenue)}</strong></div><div><span>Phụ phí hệ thống</span><strong>{money(report.system_fee_total)}</strong></div><div><span>Phí giao hàng</span><strong>{money(report.ship_fee_total)}</strong></div><div><span>Tổng COD đã thu</span><strong>{money(report.gross_revenue)}</strong></div></div></section><section className="manager-card"><header className="manager-card-header"><h2>Đơn không phát sinh thu tiền</h2></header><div className="manager-card-body manager-mini-list"><div><span>Đã hủy / Từ chối</span><strong>{report.cancelled_or_rejected_orders}</strong></div><div><span>Bỏ hàng / Blacklist COD</span><strong>{report.blacklisted_orders}</strong></div></div></section></div><section className="manager-card"><header className="manager-card-header"><div><h2>5 món bán chạy trong kỳ</h2><p>Xếp theo số lượng món từ đơn đã thu COD</p></div></header>{report.top_dishes.length ? <div className="manager-table-wrap"><table className="manager-table"><thead><tr><th>Hạng</th><th>Món ăn</th><th>Số phần đã bán</th><th>Doanh thu niêm yết</th></tr></thead><tbody>{report.top_dishes.map((dish, index) => <tr key={dish.dish_id}><td>#{index + 1}</td><td><strong>{dish.dish_name}</strong></td><td>{dish.total_quantity}</td><td>{money(dish.total_revenue)}</td></tr>)}</tbody></table></div> : <div className="manager-state">Chưa có món được thanh toán trong kỳ đã chọn.</div>}</section></>}
  </div>
}
