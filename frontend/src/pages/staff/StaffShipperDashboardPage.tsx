import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, MapPin, PackageCheck, RefreshCw, Truck } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { orderService } from '../../services/orderService'
import type { Order } from '../../types/order'
import { dateTime, money, orderLabels, requestMessage, vietnamDate } from '../manager/managerRules'

const inDelivery = (order: Order) => order.order_type === 'delivery' && ['DANG_GIAO', 'GIAO_THAT_BAI'].includes(order.status)
const isDeliveredToday = (order: Order) => order.order_type === 'delivery'
  && ['DA_GIAO', 'DA_BAN_GIAO', 'HOAN_THANH'].includes(order.status)
  && Boolean(order.delivered_at && vietnamDate(new Date(order.delivered_at)) === vietnamDate())

export default function StaffShipperDashboardPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[] | null>(null)
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
      try {
        const batches = await Promise.all((['available', 'mine', 'history'] as const).map((scope) => orderService.getShipperOrders(scope)))
        const data = batches.flatMap((batch) => batch.items)
        if (active) { setOrders(data); setError(''); setUpdated(new Date().toISOString()) }
      } catch (e: any) {
        if (active) {
          rateLimited = e?.response?.status === 429
          setError(requestMessage(e, 'Chưa tải được đơn giao hàng. Bạn có thể làm mới để thử lại.') + (rateLimited ? ' Đã tạm dừng tự cập nhật.' : ''))
        }
      } finally {
        running = false
        if (active) setLoading(false)
      }
    }
    void load(true)
    const interval = window.setInterval(() => { if (!document.hidden && !rateLimited) void load() }, 300000)
    return () => { active = false; window.clearInterval(interval) }
  }, [revision])

  const activeOrders = (orders || []).filter((order) => inDelivery(order) && order.shipper_id === user?.id).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
  const waitingCount = (orders || []).filter((order) => order.status === 'DANG_GIAO' && order.shipper_id == null).length
  const deliveredToday = (orders || []).filter(isDeliveredToday).length
  return <div className="manager-page" aria-busy={loading}>
    <section className="manager-heading"><div><span className="manager-eyebrow">CA LÀM · SHIPPER CANTEEN A2</span><h1>Ca làm hôm nay</h1><p>Chào {user?.full_name}. Theo dõi đơn đang giao và cập nhật kết quả giao hàng.</p></div><button className="manager-button" disabled={loading} onClick={() => setRevision((n) => n + 1)}><RefreshCw size={15} />{loading ? 'Đang cập nhật…' : 'Làm mới'}</button></section>
    {error && <p className="manager-alert error" role="alert">{error}</p>}
    <div className="manager-status-line"><i />{updated ? `Cập nhật ${dateTime(updated)} · Tự làm mới mỗi 5 phút khi mở trang` : 'Đang kết nối đơn giao hàng'}</div>
    <section className="manager-metrics" aria-label="Thống kê giao hàng">
      <article className="manager-metric"><div><span>Đơn chờ nhận</span><Truck size={19} /></div><strong>{loading || !orders ? '—' : waitingCount}</strong><small><Link to="/nhan-vien/don">Mở danh sách đơn cần nhận</Link></small></article>
      <article className="manager-metric"><div><span>Đang giao</span><PackageCheck size={19} /></div><strong>{loading || !orders ? '—' : activeOrders.filter((order) => order.status === 'DANG_GIAO').length}</strong><small>Đơn shipper đã nhận</small></article>
      <article className="manager-metric"><div><span>Cần xử lý sự cố</span><AlertTriangle size={19} /></div><strong>{loading || !orders ? '—' : activeOrders.filter((order) => order.status === 'GIAO_THAT_BAI').length}</strong><small>Đơn đang được giữ tại quầy</small></article>
      <article className="manager-metric"><div><span>Đã giao hôm nay</span><PackageCheck size={19} /></div><strong>{loading || !orders ? '—' : deliveredToday}</strong><small>Theo ngày Việt Nam</small></article>
    </section>
    <section className="manager-card"><header className="manager-card-header"><div><h2>Đơn cần giao</h2><p>Đơn giao tận nơi đang giao hoặc cần xử lý sự cố</p></div><Link to="/nhan-vien/don">Mở xử lý đơn →</Link></header>
      {!orders && !loading ? <div className="manager-state">Chưa tải được đơn giao hàng.</div> : activeOrders.length ? <div className="manager-table-wrap"><table className="manager-table"><thead><tr><th>Đơn / Khách</th><th>Địa điểm</th><th>Trạng thái</th><th>Tổng COD</th></tr></thead><tbody>{activeOrders.slice(0, 8).map((order) => <tr key={order.id}><td><Link to={`/nhan-vien/don?order=${encodeURIComponent(order.id)}`}><strong>#{order.id}</strong></Link><small>{order.recipient_name}</small>{order.recipient_phone && <a href={`tel:${order.recipient_phone}`}>{order.recipient_phone}</a>}</td><td><MapPin size={13} /> {order.delivery_address || 'Nội khu NEU'}{order.room_detail ? <small>{order.room_detail}</small> : null}</td><td><span className={`manager-pill ${order.status === 'GIAO_THAT_BAI' ? 'bad' : 'warn'}`}>{orderLabels[order.status]}</span><small>{order.created_at ? dateTime(order.created_at) : ''}</small></td><td>{money(order.total_amount || 0)}<small>{order.payment_method === 'cod_vietqr' ? 'VietQR' : 'Tiền mặt'}</small></td></tr>)}</tbody></table></div> : <div className="manager-state"><CheckCircle2 size={30} /><strong>Không có đơn cần giao</strong><span>Đơn đang giao mới sẽ xuất hiện tại đây.</span></div>}
    </section>
  </div>
}
