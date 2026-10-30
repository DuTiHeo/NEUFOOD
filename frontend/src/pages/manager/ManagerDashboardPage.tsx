import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, CheckCircle2, ClipboardList, RefreshCw, Store, UtensilsCrossed, Wallet } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { reportService, type RevenueReport } from '../../services/reportService'
import { shiftService, type StaffShift } from '../../services/shiftService'
import type { Order } from '../../types/order'
import type { Dish } from '../../types/dish'
import { loadCanteenOrders, loadCanteenDishes } from './managerData'
import { activeStatuses, dateRange, dateTime, money, orderLabels } from './managerRules'

export default function ManagerDashboardPage() {
  const { user } = useAuth()
  const [days, setDays] = useState(1)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [report, setReport] = useState<RevenueReport | null>(null)
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [dishes, setDishes] = useState<Dish[] | null>(null)
  const [shifts, setShifts] = useState<StaffShift[] | null>(null)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    const range = dateRange(days)
    Promise.allSettled([reportService.getRevenueSummary(range.from, range.to), loadCanteenOrders(), loadCanteenDishes(), shiftService.getShifts()]).then(([r, o, d, s]) => {
      if (!active) return
      setReport(r.status === 'fulfilled' ? r.value : null)
      setOrders(o.status === 'fulfilled' ? o.value : null)
      setDishes(d.status === 'fulfilled' ? d.value : null)
      setShifts(s.status === 'fulfilled' ? s.value : null)
      const missing = [r.status === 'rejected' && 'doanh thu', o.status === 'rejected' && 'đơn hàng', d.status === 'rejected' && 'thực đơn', s.status === 'rejected' && 'ca COD'].filter(Boolean)
      setError(missing.length ? `Chưa tải được ${missing.join(', ')}. Bạn có thể làm mới để thử lại.` : '')
      setLoading(false)
    })
    return () => { active = false }
  }, [days, revision])
  const pending = orders?.filter((order) => activeStatuses.includes(order.status))
  const waitingShifts = shifts?.filter((shift) => shift.status !== 'DA_CHOT')
  const upcoming = [...(pending || [])].sort((a, b) => (a.scheduled_at || a.created_at || '').localeCompare(b.scheduled_at || b.created_at || '')).slice(0, 5)
  const show = (count?: number | null) => loading || count == null ? '—' : count.toLocaleString('vi-VN')
  const cards = [
    { label: 'Doanh thu gốc Canteen', amount: loading || !report ? '—' : money(report.canteen_net_revenue), note: 'Tiền món theo giá gốc tại thời điểm đặt', Icon: BarChart3 },
    { label: 'Đơn đang phục vụ', amount: show(pending?.length), note: `${orders?.filter((order) => order.status === 'CHO_XAC_NHAN').length ?? '—'} đơn chờ xác nhận`, Icon: ClipboardList },
    { label: 'Món đang kinh doanh', amount: show(dishes?.length), note: `${dishes?.filter((dish) => !dish.is_available).length ?? '—'} món đang hết hàng`, Icon: UtensilsCrossed },
    { label: 'Ca cần đối soát', amount: show(waitingShifts?.length), note: 'Chờ duyệt và cần giải trình', Icon: Wallet },
  ]
  return <div className="manager-page" aria-busy={loading}>
    <section className="manager-heading"><div><span className="manager-eyebrow">ĐIỀU HÀNH CANTEEN A2</span><h1>Một ngày vận hành, trong tầm tay.</h1><p>Chào {user?.full_name}. Theo dõi đơn hàng, thực đơn và tiền bàn giao của Canteen.</p></div><button className="manager-button" onClick={() => setRevision((n) => n + 1)} disabled={loading}><RefreshCw size={15} />{loading ? 'Đang cập nhật…' : 'Làm mới'}</button></section>
    <div className="manager-toolbar"><div className="manager-tabs" aria-label="Kỳ doanh thu">{[[1, 'Hôm nay'], [7, '7 ngày'], [30, '30 ngày']].map(([count, label]) => <button key={count} aria-pressed={days === count} onClick={() => setDays(Number(count))}>{label}</button>)}</div><span className="manager-hint">Doanh thu theo ngày bàn giao thực tế · Giờ Việt Nam</span></div>
    {error && <p className="manager-alert error" role="alert">{error}</p>}
    <section className="manager-metrics" aria-label="Số liệu Canteen">{cards.map(({ label, amount, note, Icon }) => <article className="manager-metric" key={label}><div><span>{label}</span><Icon size={19} /></div><strong>{amount}</strong><small>{loading ? 'Đang tải dữ liệu…' : note}</small></article>)}</section>
    <div className="manager-split"><section className="manager-card"><header className="manager-card-header"><div><h2>Đơn hàng cần theo dõi</h2><p>Ưu tiên đơn đang phục vụ và lịch hẹn sắp tới</p></div><Link to="/quan-ly/don">Tất cả đơn hàng <ArrowRight size={14} /></Link></header>{loading ? <div className="manager-state">Đang tải đơn hàng…</div> : !orders ? <div className="manager-state">Chưa tải được đơn hàng.</div> : upcoming.length ? <div className="manager-table-wrap"><table className="manager-table"><thead><tr><th>Đơn / Khách hàng</th><th>Hình thức / Lịch hẹn</th><th>Trạng thái</th></tr></thead><tbody>{upcoming.map((order) => <tr key={order.id}><td><Link to={`/quan-ly/don?order=${encodeURIComponent(order.id)}`}><strong>#{order.id}</strong></Link><small>{order.recipient_name}</small></td><td>{order.order_type === 'delivery' ? 'Giao tận nơi' : 'Nhận tại quầy'}<small>{order.is_preorder ? `Hẹn ${dateTime(order.scheduled_at)}` : 'Làm ngay'}</small></td><td><span className={`manager-pill ${order.status === 'CHO_XAC_NHAN' ? 'warn' : ''}`}>{orderLabels[order.status]}</span></td></tr>)}</tbody></table></div> : <div className="manager-state"><CheckCircle2 size={30} /><strong>Đã xử lý hết đơn đang phục vụ</strong><span>Đơn hàng mới sẽ xuất hiện trong mục Đơn hàng.</span></div>}</section>
      <section className="manager-card"><header className="manager-card-header"><div><h2>Dòng tiền trong kỳ</h2><p>{days === 1 ? 'Hôm nay' : `${days} ngày gần nhất`} · Chỉ tính đơn đã thu COD</p></div><Wallet size={20} /></header><div className="manager-card-body manager-mini-list"><div><span>Tổng COD đã thu</span><strong>{loading || !report ? '—' : money(report.gross_revenue)}</strong></div><div><span>Doanh thu gốc Canteen</span><strong>{loading || !report ? '—' : money(report.canteen_net_revenue)}</strong></div><div><span>Phụ phí hệ thống</span><strong>{loading || !report ? '—' : money(report.system_fee_total)}</strong></div><div><span>Phí giao hàng</span><strong>{loading || !report ? '—' : money(report.ship_fee_total)}</strong></div><div><span>Đơn đã thu tiền</span><strong>{show(report?.completed_orders)}</strong></div></div><Link className="manager-shortcut" to="/quan-ly/bao-cao"><strong>Xem báo cáo chi tiết</strong><ArrowRight size={16} /></Link></section></div>
    <section className="manager-quick-grid">{[{ to: '/quan-ly/mon/them', title: 'Thêm món vào thực đơn', sub: 'Giá gốc, hình ảnh và danh mục món ăn', Icon: UtensilsCrossed }, { to: '/quan-ly/ca', title: 'Kiểm tra tiền cuối ca', sub: 'Đối chiếu tiền mặt và sao kê VietQR', Icon: Wallet }, { to: '/quan-ly/danh-gia', title: 'Lắng nghe khách hàng', sub: 'Xem điểm số và nhận xét theo món', Icon: Store }].map(({ to, title, sub, Icon }) => <Link key={to} to={to}><Icon size={24} /><div><h3>{title}</h3><p>{sub}</p></div></Link>)}</section>
    <div className="manager-alert"><ClipboardList size={18} /><span>Đơn hẹn giờ vẫn cần xác nhận trong 10 phút kể từ khi đặt. Chuẩn bị trước giờ hẹn 20 phút để bàn giao đúng lịch.</span></div>
  </div>
}
