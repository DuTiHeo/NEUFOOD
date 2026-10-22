import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useOrderHistory } from '../../contexts/OrderHistoryContext'
import { orderService } from '../../services/orderService'
import type { Order } from '../../types/order'
import { orderError, receivedOrderStatuses } from '../../utils/orders'
import OrderDetails from '../../components/orders/OrderDetails'
import styles from '../../components/orders/Orders.module.css'

export default function DonHangPage() {
  const { orderId } = useParams()
  const { user, token } = useAuth()
  const { refresh } = useOrderHistory()
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const version = useRef(0)
  const load = useCallback(async () => {
    const current = ++version.current
    setLoading(true)
    try {
      const row = await orderService.getOrderById(orderId)
      if (current !== version.current || localStorage.getItem('neufood_token') !== token) return
      if (row.user_id !== user.id) { setOrder(null); setError('Không tìm thấy đơn hàng của bạn.'); return }
      setOrder(row); setError('')
    } catch (err) { if (current === version.current) setError(orderError(err)) }
    finally { if (current === version.current) setLoading(false) }
  }, [orderId, user.id, token])
  useEffect(() => {
    setOrder(null); setActionError(''); load()
    const timer = setInterval(() => { if (!document.hidden && !lock.current) load() }, 120000)
    const focus = () => { if (!lock.current) load() }
    window.addEventListener('focus', focus)
    return () => { version.current++; clearInterval(timer); window.removeEventListener('focus', focus) }
  }, [load])

  async function act(action: 'cancel' | 'confirm') {
    if (lock.current || error || !order) return
    lock.current = true; setBusy(true); setActionError(''); version.current++
    try {
      const updated = action === 'cancel' ? await orderService.cancelOrder(order.id) : await orderService.confirmReceipt(order.id)
      if (localStorage.getItem('neufood_token') === token) { setOrder(updated); refresh() }
    } catch (err) { setActionError(orderError(err)); await load() }
    finally { lock.current = false; setBusy(false) }
  }
  return <main className={styles.page}>
    <div className={styles.row}><h1 className={styles.heading}>Chi tiết đơn hàng</h1><button className={styles.button} disabled={loading || busy} onClick={load}>Làm mới</button></div>
    <p className={styles.muted}>Trạng thái cập nhật từ canteen, tự làm mới mỗi 2 phút khi mở trang.</p>
    <Link to="/lich-su-don">← Lịch sử đơn hàng</Link>
    {loading && <p role="status">Đang tải đơn…</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {order && <>
      <OrderDetails order={order} showSuffix />
      {order.status === 'CHO_XAC_NHAN' && <p>Có thể hủy trước khi canteen duyệt. Đơn chờ quá hạn duyệt sẽ được hệ thống hủy.</p>}
      {order.status === 'GIAO_THAT_BAI' && <p role="alert">Vui lòng đến quầy nhận và thanh toán trước hạn giữ món.</p>}
      <div className={styles.actions}>
        {order.status === 'CHO_XAC_NHAN' && <button className={styles.button} disabled={busy || loading || !!error} onClick={() => act('cancel')}>Hủy đơn</button>}
        {receivedOrderStatuses.includes(order.status) && order.payment_status === 'da_thanh_toan' && <button className={styles.button} disabled={busy || loading || !!error} onClick={() => act('confirm')}>Xác nhận đã nhận hàng</button>}
      </div>
      {busy && <p role="status">Đang cập nhật…</p>}
    </>}
    {actionError && <p role="alert" className={styles.error}>{actionError}</p>}
  </main>
}
