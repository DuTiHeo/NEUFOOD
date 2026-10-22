import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { orderService } from '../../services/orderService'
import type { Order, DeliveryIssue } from '../../types/order'
import { allowedIssues, canHandover, formatOrderTime, orderError, orderStatusLabels } from '../../utils/orders'
import { formatVnd } from '../../utils/money'
import Modal from '../../components/common/Modal'
import OrderDetails from '../../components/orders/OrderDetails'
import styles from '../../components/orders/Orders.module.css'

type Action = 'accept' | 'reject' | 'finish' | 'handover' | DeliveryIssue
const labels: Record<Action, string> = {
  accept: 'Duyệt đơn', reject: 'Từ chối đơn', finish: 'Nấu xong',
  handover: 'Bàn giao và xác nhận đã thu tiền',
  no_answer: 'Khách không nghe máy — giữ món tại quầy',
  refuse_payment: 'Khách từ chối thanh toán — khóa COD',
  pickup_timeout: 'Quá hạn nhận tại quầy — khóa COD',
}
function actionsFor(order: Order): Action[] {
  if (order.status === 'CHO_XAC_NHAN') return ['accept', 'reject']
  if (order.status === 'DANG_CHUAN_BI') return ['finish']
  return canHandover(order) ? ['handover', ...allowedIssues(order)] : []
}
export default function AdminDonPage() {
  const { user, token } = useAuth()
  const canOperate = ['staff', 'manager'].includes(user.role)
  const [rows, setRows] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Order | null>(null)
  const [action, setAction] = useState<Action | ''>('')
  const [suffix, setSuffix] = useState('')
  const [paid, setPaid] = useState(false)
  const [reason, setReason] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const version = useRef(0)
  const load = useCallback(async () => {
    const current = ++version.current
    setLoading(true)
    try {
      const response = await orderService.getAllOrdersAdmin({ status: status || undefined, page, limit: 20 })
      if (current !== version.current || localStorage.getItem('neufood_token') !== token) return
      setRows(response.items); setTotal(response.total); setError('')
      setSelected(previous => previous ? response.items.find(row => row.id === previous.id) || previous : null)
    } catch (err) { if (current === version.current) setError(orderError(err)) }
    finally { if (current === version.current) setLoading(false) }
  }, [status, page, token])
  useEffect(() => {
    setRows([]); setSelected(null); load()
    const timer = setInterval(() => { if (!document.hidden && !lock.current) load() }, 120000)
    const focus = () => { if (!lock.current) load() }
    window.addEventListener('focus', focus)
    return () => { version.current++; clearInterval(timer); window.removeEventListener('focus', focus) }
  }, [load])
  function choose(order: Order) {
    setSelected(order); setAction(''); setSuffix(''); setReason(''); setPaid(false); setActionError('')
  }
  async function submit(event) {
    event.preventDefault()
    if (lock.current || loading || error || !selected || !canOperate || !action) return
    setActionError('')
    if (!actionsFor(selected).includes(action)) { setActionError('Trạng thái đã thay đổi. Vui lòng chọn lại thao tác.'); return }
    if (action === 'handover' && (!/^[0-9]{4}$/.test(suffix) || !paid)) { setActionError('Nhập đúng 4 chữ số và xác nhận đã thu đủ tiền.'); return }
    if (['reject', 'no_answer', 'refuse_payment', 'pickup_timeout'].includes(action) && !reason.trim()) { setActionError('Vui lòng nhập lý do.'); return }
    lock.current = true; setBusy(true); version.current++
    try {
      let updated: Order
      if (action === 'accept' || action === 'reject') updated = await orderService.processOrder(selected.id, action, reason.trim())
      else if (action === 'finish') updated = await orderService.updateOrderStatus(selected.id, selected.order_type === 'delivery' ? 'DANG_GIAO' : 'SAN_SANG_LAY')
      else if (action === 'handover') updated = await orderService.handover(selected.id, suffix)
      else updated = await orderService.reportIssue(selected.id, action, reason.trim())
      if (localStorage.getItem('neufood_token') === token) { setSelected(updated); setAction(''); setSuffix(''); setPaid(false); setReason('') }
      await load()
    } catch (err) {
      setActionError(orderError(err))
      try {
        const latest = await orderService.getOrderById(selected.id)
        if (localStorage.getItem('neufood_token') === token) setSelected(latest)
      } catch { /* Keep the failed action visible if refreshing also fails. */ }
      await load()
    }
    finally { lock.current = false; setBusy(false) }
  }
  const pages = Math.max(1, Math.ceil(total / 20))
  return <section>
    <div className={styles.row}><h2 className={styles.heading}>Đơn hàng COD</h2><button className={styles.button} disabled={loading || busy} onClick={load}>Làm mới</button></div>
    {!canOperate && <p className={styles.muted}>Tài khoản quản trị viên chỉ xem đơn. Nhân viên và quản lý thực hiện bàn giao.</p>}
    <label className={styles.field}>Lọc trạng thái<select className={styles.input} value={status} disabled={busy} onChange={e => { setStatus(e.target.value); setPage(1) }}><option value="">Tất cả</option>{Object.entries(orderStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {loading && <p role="status">Đang tải đơn…</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.tableWrap}><table className={styles.table}>
      <thead><tr><th>Mã đơn / thời gian</th><th>Người nhận</th><th>Hình thức</th><th>Tổng tiền</th><th>Trạng thái</th><th>Chi tiết</th></tr></thead>
      <tbody>{rows.map(order => <tr key={order.id}><td>{order.id}<p className={styles.muted}>{formatOrderTime(order.created_at)}</p>{order.is_preorder && <p>Hẹn {formatOrderTime(order.scheduled_at)}</p>}</td><td>{order.recipient_name}<p>{order.recipient_phone}</p></td><td>{order.order_type === 'delivery' ? 'Giao tận nơi' : 'Tại quầy'}</td><td>{formatVnd(order.total_amount)}</td><td>{orderStatusLabels[order.status]}</td><td><button className={styles.button} onClick={() => choose(order)} disabled={busy}>Xem đơn {order.id}</button></td></tr>)}</tbody>
    </table></div>
    {!loading && !error && !rows.length && <p>Không có đơn phù hợp.</p>}
    <div className={styles.actions}><button className={styles.button} disabled={page <= 1 || busy || loading} onClick={() => setPage(page - 1)}>Trang trước</button><span>Trang {page}/{pages} · {total} đơn</span><button className={styles.button} disabled={page >= pages || busy || loading} onClick={() => setPage(page + 1)}>Trang sau</button></div>
    <Modal isOpen={!!selected} onClose={() => { if (!lock.current) setSelected(null) }} title={selected?.id} maxWidth="max-w-3xl">
      {selected && <>
        <OrderDetails order={selected} />
        {canOperate && <form onSubmit={submit}>
          <div className={styles.actions}>{actionsFor(selected).map(value => <button type="button" className={styles.button} key={value} aria-pressed={action === value} disabled={busy || loading || !!error} onClick={() => { setAction(value); setActionError(''); setSuffix(''); setReason(''); setPaid(false) }}>{labels[value]}</button>)}</div>
          {action && actionsFor(selected).includes(action) && <div className={styles.panel}>
            <h3>{labels[action]}</h3>
            {action === 'finish' && <p>{selected.order_type === 'delivery' ? 'Chuyển sang đang giao.' : 'Chuyển sang sẵn sàng lấy món và bắt đầu hạn giữ tại quầy.'}</p>}
            {action === 'handover' && <>
              <label className={styles.field}>4 số cuối khách cung cấp<input className={styles.input} value={suffix} onChange={e => setSuffix(e.target.value)} inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} required autoComplete="off" /></label>
              <label><input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)} required /> Đã nhận đủ {formatVnd(selected.total_amount)} {selected.payment_method === 'cod_cash' ? 'tiền mặt' : 'qua VietQR'}</label>
            </>}
            {['reject', 'no_answer', 'refuse_payment', 'pickup_timeout'].includes(action) && <label className={styles.field}>Lý do<textarea className={styles.input} value={reason} onChange={e => setReason(e.target.value)} required /></label>}
            {action === 'no_answer' && <p>Chỉ báo sự cố sau khi đã liên lạc và chờ khách theo quy trình. Món được giữ tại quầy 30 phút.</p>}
            {['refuse_payment', 'pickup_timeout'].includes(action) && <p role="alert">Xác nhận sẽ chuyển đơn sang bỏ đơn và khóa đặt COD của khách.</p>}
            <div className={styles.actions}><button type="submit" className={styles.button} disabled={busy || loading || !!error}>{busy ? 'Đang cập nhật…' : 'Xác nhận thao tác'}</button></div>
          </div>}
        </form>}
        {actionError && <p role="alert" className={styles.error}>{actionError}</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </>}
    </Modal>
  </section>
}
