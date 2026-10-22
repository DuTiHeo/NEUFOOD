import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'
import { useOrderHistory } from '../../contexts/OrderHistoryContext'
import { orderService } from '../../services/orderService'
import { activeOrderStatuses, orderError } from '../../utils/orders'
import { formatVnd } from '../../utils/money'
import type { CampusLocation, Order } from '../../types/order'
import styles from '../../components/orders/Orders.module.css'

export default function ThanhToanPage() {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const { addOrder, orders, loading: ordersLoading, error: ordersError } = useOrderHistory()
  const { lines, subtotal, clear, catalogLoading, catalogError } = useCart()
  const [locations, setLocations] = useState<CampusLocation[]>([])
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [name, setName] = useState(user?.full_name || '')
  const [phone, setPhone] = useState(user?.phone_number || '')
  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery')
  const [location, setLocation] = useState('')
  const [room, setRoom] = useState('')
  const [note, setNote] = useState('')
  const [isPreorder, setPreorder] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [payment, setPayment] = useState<Order['payment_method']>('cod_cash')

  useEffect(() => {
    let ignore = false
    Promise.all([orderService.getLocations(), orderService.getSettings()])
      .then(([rows, config]) => { if (!ignore) { setLocations(rows); setSettings(config) } })
      .catch(err => { if (!ignore) setLoadError(orderError(err)) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [])
  const shipping = orderType === 'delivery' ? Number(settings.delivery_fee ?? 5000) : 0
  const total = subtotal + shipping
  const activeOrder = orders.find(order => activeOrderStatuses.includes(order.status))
  const blocked = busy || loading || catalogLoading || ordersLoading || !!(loadError || catalogError || ordersError) || !lines.length || !!user?.is_blacklisted || !!activeOrder || lines.some(line => !line.dish.is_available)

  async function submit(event) {
    event.preventDefault()
    if (lock.current || blocked) return
    setError('')
    if (name.trim().length < 2) { setError('Vui lòng nhập họ tên người nhận.'); return }
    if (!/^0[35789][0-9]{8}$/.test(phone.trim())) { setError('Số điện thoại Việt Nam không hợp lệ.'); return }
    if (orderType === 'delivery' && !locations.some(row => row.id === Number(location))) { setError('Vui lòng chọn địa điểm giao hợp lệ.'); return }
    if (lines.some(line => !Number.isInteger(line.qty) || line.qty < 1 || line.qty > Math.min(10, Number(settings.max_dish_quantity_per_order ?? 10)))) { setError('Số lượng mỗi món phải từ 1 đến 10.'); return }
    if (total > Math.min(500000, Number(settings.max_cod_amount ?? 500000))) { setError('Tổng đơn vượt hạn mức COD.'); return }
    const scheduled = isPreorder ? new Date(scheduledAt) : null
    if (isPreorder && (!scheduledAt || !Number.isFinite(scheduled.getTime()) || scheduled.getTime() - Date.now() < Math.max(30, Number(settings.min_preorder_lead_minutes ?? 30)) * 60000)) {
      setError('Giờ hẹn phải cách hiện tại ít nhất 30 phút hoặc thời gian tối thiểu của canteen.'); return
    }
    lock.current = true; setBusy(true)
    try {
      const order = await addOrder({
        order_type: orderType, recipient_name: name.trim(), recipient_phone: phone.trim(),
        campus_location_id: orderType === 'delivery' ? Number(location) : null,
        room_detail: orderType === 'delivery' ? room.trim() || null : null,
        delivery_note: note.trim() || null, payment_method: payment,
        is_preorder: isPreorder, scheduled_at: scheduled ? scheduled.toISOString() : null,
        items: lines.map(line => ({ dish_id: line.dish.id, quantity: line.qty })),
      })
      if (localStorage.getItem('neufood_token') !== token) return
      clear()
      navigate('/don-hang/' + encodeURIComponent(order.id))
    } catch (err) { setError(orderError(err)) }
    finally { lock.current = false; setBusy(false) }
  }

  return <main className={styles.page}>
    <h1 className={styles.heading}>Xác nhận đơn COD</h1>
    <Link to="/gio-hang">← Quay lại giỏ hàng</Link>
    {(loading || catalogLoading || ordersLoading) && <p role="status">Đang tải thông tin đặt hàng…</p>}
    {(loadError || catalogError || ordersError) && <p role="alert" className={styles.error}>{loadError || catalogError || ordersError} Vui lòng tải lại trang.</p>}
    {user?.is_blacklisted && <p role="alert" className={styles.error}>Tài khoản đang bị khóa đặt COD.</p>}
    {activeOrder && <p role="alert">Bạn đang có đơn chưa kết thúc. <Link to={'/don-hang/' + activeOrder.id}>Xem đơn {activeOrder.id}</Link></p>}
    {!lines.length && !catalogLoading && <p>Giỏ hàng trống. <Link to="/menu">Chọn món</Link></p>}
    <form onSubmit={submit} className={styles.panel}>
      <label className={styles.field}>Họ tên người nhận<input className={styles.input} required minLength={2} maxLength={150} value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
      <label className={styles.field}>Số điện thoại<input className={styles.input} required type="tel" pattern="0[35789][0-9]{8}" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" /></label>
      <label className={styles.field}>Cách nhận món<select className={styles.input} value={orderType} onChange={e => setOrderType(e.target.value as typeof orderType)}><option value="delivery">Giao trong khuôn viên</option><option value="pickup">Nhận tại quầy — miễn phí giao</option></select></label>
      {orderType === 'delivery' && <>
        <label className={styles.field}>Địa điểm giao<select className={styles.input} required value={location} onChange={e => setLocation(e.target.value)}><option value="">Chọn địa điểm</option>{locations.map(row => <option key={row.id} value={row.id}>{row.building_name}</option>)}</select></label>
        <label className={styles.field}>Phòng / vị trí cụ thể<input className={styles.input} maxLength={100} value={room} onChange={e => setRoom(e.target.value)} /></label>
      </>}
      <label className={styles.field}>Ghi chú<textarea className={styles.input} value={note} onChange={e => setNote(e.target.value)} /></label>
      <label><input type="checkbox" checked={isPreorder} onChange={e => setPreorder(e.target.checked)} /> Đặt trước theo giờ hẹn</label>
      {isPreorder && <label className={styles.field}>Giờ nhận (theo giờ trên thiết bị)<input className={styles.input} type="datetime-local" required value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} /></label>}
      <label className={styles.field}>Thanh toán khi nhận hàng<select className={styles.input} value={payment} onChange={e => setPayment(e.target.value as typeof payment)}><option value="cod_cash">Tiền mặt COD</option><option value="cod_vietqr">VietQR COD</option></select></label>
      <p className={styles.muted}>Thanh toán cho nhân viên lúc bàn giao món và đối chiếu 4 số cuối mã đơn.</p>
      {lines.map(line => <p key={line.dish.id}>{line.dish.name} × {line.qty} — {formatVnd(line.dish.price * line.qty)} {!line.dish.is_available && <strong role="alert">Món đã hết — vui lòng xóa khỏi giỏ.</strong>}</p>)}
      <p>Tạm tính: {formatVnd(subtotal)} · Phí giao: {formatVnd(shipping)}</p>
      <p><strong>Tổng dự kiến: {formatVnd(total)}</strong></p>
      <p className={styles.muted}>Giá cuối cùng được chốt tại thời điểm đặt hàng. Giờ mở cửa: {settings.canteen_open_time || '06:30'}–{settings.canteen_close_time || '19:30'}.</p>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <button className={styles.button} disabled={blocked} type="submit">{busy ? 'Đang gửi đơn…' : 'Xác nhận đặt hàng COD'}</button>
    </form>
  </main>
}
