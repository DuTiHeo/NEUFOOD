import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ClipboardList, Clock3, PackageCheck, RefreshCw, UtensilsCrossed, Wallet } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { shiftService, type CurrentShiftSummary } from '../../services/shiftService'
import type { Order } from '../../types/order'
import type { Dish } from '../../types/dish'
import { loadCanteenDishes, loadCanteenOrders } from '../manager/managerData'
import { activeStatuses, dateTime, money, orderLabels, vietnamDate } from '../manager/managerRules'
import { shiftLabels } from './staffRules'
import styles from './StaffWorkspace.module.css'

export default function StaffDashboardPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [dishes, setDishes] = useState<Dish[] | null>(null)
  const [shift, setShift] = useState<CurrentShiftSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [updated, setUpdated] = useState('')
  useEffect(() => {
    let active = true
    let running = false
    let rateLimited = false
    async function load(initial = false) {
      if (running) return
      running = true
      if (initial) setLoading(true)
      const [o, s, d] = await Promise.allSettled([loadCanteenOrders(), shiftService.getCurrentShift(), loadCanteenDishes()])
      if (active) {
        setOrders(o.status === 'fulfilled' ? o.value : null)
        setShift(s.status === 'fulfilled' ? s.value : null)
        setDishes(d.status === 'fulfilled' ? d.value : null)
        const failed = [o.status === 'rejected' && 'đơn hàng', s.status === 'rejected' && 'ca COD', d.status === 'rejected' && 'thực đơn'].filter(Boolean)
        rateLimited = [o, s, d].some((result) => result.status === 'rejected' && result.reason?.response?.status === 429)
        setError(rateLimited ? 'Máy chủ đang giới hạn lượt truy cập (429). Đã tạm dừng tự cập nhật. Vui lòng chờ và thử Làm mới sau.' : failed.length ? `Chưa tải được ${failed.join(', ')}. Bạn có thể làm mới để thử lại.` : '')
        setUpdated(new Date().toISOString()); setLoading(false)
      }
      running = false
    }
    void load(true)
    const interval = window.setInterval(() => { if (!document.hidden && !rateLimited) void load() }, 300000)
    return () => { active = false; window.clearInterval(interval) }
  }, [revision])
  const count = (value?: number | null) => loading || value == null ? '—' : value.toLocaleString('vi-VN')
  const queue = orders ? [...orders].filter((o) => activeStatuses.includes(o.status)).sort((a, b) => Number(b.status === 'CHO_XAC_NHAN') - Number(a.status === 'CHO_XAC_NHAN') || (a.scheduled_at || a.created_at || '').localeCompare(b.scheduled_at || b.created_at || '')).slice(0, 5) : []
  const metrics = [
    { label: 'Đơn mới chờ nhận', value: count(orders?.filter((o) => o.status === 'CHO_XAC_NHAN').length), note: 'Ưu tiên phản hồi trước khi hết hạn', Icon: Clock3 },
    { label: 'Đang chuẩn bị / Giao nhận', value: count(orders?.filter((o) => activeStatuses.includes(o.status) && o.status !== 'CHO_XAC_NHAN').length), note: 'Đơn đang phục vụ của Canteen A2', Icon: PackageCheck },
    { label: 'Tiền mặt đã thu', value: loading || !shift ? '—' : money(shift.expected_cash), note: 'Theo tài khoản trong ngày', Icon: Wallet },
    { label: 'VietQR đã thu', value: loading || !shift ? '—' : money(shift.expected_qr), note: 'Theo tài khoản trong ngày', Icon: Wallet },
  ]
  return <div className="manager-page" aria-busy={loading}>
    <section className="manager-heading"><div><span className="manager-eyebrow">NHÂN VIÊN CANTEEN A2</span><h1>Ca làm hôm nay</h1><p>Chào {user?.full_name}. Theo dõi hàng đợi, chuẩn bị món và bàn giao đúng đơn.</p></div><button className="manager-button" disabled={loading} onClick={() => setRevision((n) => n + 1)}><RefreshCw size={15} />{loading ? 'Đang cập nhật…' : 'Làm mới'}</button></section>
    {error && <p className="manager-alert error" role="alert">{error}</p>}
    <div className="manager-status-line"><i />{updated ? `Cập nhật ${dateTime(updated)} · Tự làm mới mỗi 5 phút khi mở trang` : 'Đang kết nối ca làm việc'}</div>
    <section className="manager-metrics" aria-label="Số liệu ca làm">{metrics.map(({ label, value, note, Icon }) => <article className="manager-metric" key={label}><div><span>{label}</span><Icon size={19} /></div><strong>{value}</strong><small>{note}</small></article>)}</section>
    <div className="manager-split"><section className="manager-card"><header className="manager-card-header"><div><h2>Hàng đợi cần xử lý</h2><p>Ưu tiên đơn mới, theo dõi lịch hẹn và các đơn đang giao nhận</p></div><Link to="/nhan-vien/don">Mở xử lý đơn <ArrowRight size={14} /></Link></header>{loading ? <div className="manager-state">Đang tải hàng đợi…</div> : !orders ? <div className="manager-state">Chưa tải được đơn hàng.</div> : queue.length ? <div className="manager-table-wrap"><table className="manager-table"><thead><tr><th>Đơn hàng</th><th>Nhận món</th><th>Trạng thái</th></tr></thead><tbody>{queue.map((o) => <tr key={o.id}><td><Link to={`/nhan-vien/don?order=${encodeURIComponent(o.id)}`}><strong>#{o.id}</strong></Link><small>{o.recipient_name}</small><small>{money(o.total_amount || 0)} · {o.payment_method === 'cod_vietqr' ? 'VietQR' : 'Tiền mặt'}</small></td><td>{o.order_type === 'pickup' ? 'Tại quầy Canteen A2' : 'Giao tận nơi'}<small>{o.is_preorder ? `Hẹn ${dateTime(o.scheduled_at)}` : 'Làm ngay'}</small></td><td><span className={`manager-pill ${o.status === 'CHO_XAC_NHAN' ? 'warn' : ''}`}>{orderLabels[o.status]}</span></td></tr>)}</tbody></table></div> : <div className="manager-state"><CheckCircle2 size={30} /><strong>Hiện không có đơn cần xử lý</strong><span>Đơn mới sẽ xuất hiện khi khách đặt món.</span></div>}</section>
    <section className="manager-card"><header className="manager-card-header"><div><h2>Tiền bàn giao hôm nay</h2><p>{shift?.shift_date || vietnamDate()} · Theo tài khoản đăng nhập</p></div><Wallet size={20} /></header><div className="manager-card-body manager-totals"><div><span>Tiền mặt</span><strong>{loading || !shift ? '—' : money(shift.expected_cash)}</strong></div><div><span>VietQR</span><strong>{loading || !shift ? '—' : money(shift.expected_qr)}</strong></div><div><span>Đơn đã thu COD</span><strong>{count(shift?.total_orders_handled)}</strong></div><div><span>Tổng cần bàn giao</span><strong>{loading || !shift ? '—' : money(shift.expected_cash + shift.expected_qr)}</strong></div></div><div className="manager-card-body" style={{ paddingTop: 0 }}><div className={styles.shiftStatus}><span className={`manager-pill ${shift?.status === 'DA_CHOT' ? 'good' : 'warn'}`}>{!shift ? 'Chưa có dữ liệu' : shift.status ? shiftLabels[shift.status] : 'Chưa nộp số liệu'}</span><Link className="manager-button" to="/nhan-vien/ca">{shift?.status === 'DA_CHOT' ? 'Xem ca đã chốt' : 'Đối chiếu & nộp ca'}</Link></div></div></section></div>
    <section className={styles.serviceGrid}><Link className={styles.serviceCard} to="/nhan-vien/don?status=CHO_XAC_NHAN"><ClipboardList size={23} /><div><h3>Nhận & xử lý đơn</h3><p>Xác nhận, chế biến, giao nhận và ghi nhận sự cố.</p></div></Link><Link className={styles.serviceCard} to="/nhan-vien/mon"><UtensilsCrossed size={23} /><div><h3>Cập nhật tình trạng món</h3><p>{count(dishes?.filter((dish) => dish.is_available).length)} món còn phục vụ · {count(dishes?.filter((dish) => !dish.is_available).length)} món đã hết.</p></div></Link><Link className={styles.serviceCard} to="/nhan-vien/ca"><Wallet size={23} /><div><h3>Nộp số liệu cuối ca</h3><p>Đếm tiền mặt, đối chiếu sao kê QR và giải trình chênh lệch.</p></div></Link></section>
    <section className={styles.hero}><div><h2>Đúng mã nhận, đủ tiền COD.</h2><p>Yêu cầu khách đọc 4 số cuối mã đơn trước khi thu tiền và bàn giao. Đơn giao thất bại mang về quầy vẫn giữ nguyên tiền món và phí giao hàng.</p></div><span className={styles.heroIcon}><PackageCheck size={28} /></span></section>
    <p className="manager-hint">Số COD ghi nhận theo tài khoản đã bàn giao đơn. Nếu nhiều người dùng chung tài khoản, thống nhất số liệu tiền mặt và sao kê trước khi nộp ca.</p>
  </div>
}
