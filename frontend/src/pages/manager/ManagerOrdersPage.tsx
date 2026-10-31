import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bell, BellOff, CheckCircle2, Clock3, Eye, RefreshCw, Search } from 'lucide-react'
import { orderService } from '../../services/orderService'
import { settingsService } from '../../services/settingsService'
import type { Order, OrderIssuePayload } from '../../types/order'
import ManagerDialog from '../../components/manager/ManagerDialog'
import { loadCanteenOrders } from './managerData'
import { activeStatuses, dateTime, money, orderActions, orderLabels, requestMessage, type OrderAction } from './managerRules'

const actionLabels = { accept: 'Tiếp nhận đơn', reject: 'Từ chối đơn', ready: 'Hoàn tất chế biến', handover: 'Bàn giao & thu COD', issue: 'Báo sự cố' }
export default function ManagerOrdersPage({ audience = 'manager' }: { audience?: 'manager' | 'staff' }) {
  const [params] = useSearchParams()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState(params.get('order') || '')
  const [status, setStatus] = useState(params.get('status') && Object.prototype.hasOwnProperty.call(orderLabels, params.get('status')!) ? params.get('status')! : 'active')
  const [type, setType] = useState('all')
  const [page, setPage] = useState(1)
  const [now, setNow] = useState(Date.now())
  const [timeout, setTimeoutMinutes] = useState(10)
  const [updatedAt, setUpdatedAt] = useState('')
  const [modal, setModal] = useState<{ order: Order; action: OrderAction | 'detail' } | null>(null)
  const [busy, setBusy] = useState(false)
  const [modalError, setModalError] = useState('')
  const [reason, setReason] = useState('')
  const [suffix, setSuffix] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [issue, setIssue] = useState<OrderIssuePayload['issue_type']>('no_answer')
  const [sound, setSound] = useState(false)
  const audio = useRef<AudioContext | null>(null)
  const soundEnabled = useRef(false)
  const seenPending = useRef<Set<string> | null>(null)
  const fetching = useRef(false)
  const rateLimited = useRef(false)
  const alive = useRef(true)
  const refresh = useCallback(async (silent = false) => {
    if (fetching.current) return
    fetching.current = true
    if (!silent) setLoading(true)
    try {
      const data = await loadCanteenOrders()
      if (alive.current) {
        rateLimited.current = false
        const pending = new Set(data.filter((order) => order.status === 'CHO_XAC_NHAN').map((order) => order.id))
        const incoming = seenPending.current ? [...pending].filter((id) => !seenPending.current!.has(id)) : []
        seenPending.current = pending
        if (incoming.length) {
          setNotice(`Có ${incoming.length} đơn mới chờ xác nhận.`)
          const context = audio.current
          if (soundEnabled.current && context?.state === 'running') {
            const tone = context.createOscillator(), volume = context.createGain()
            tone.frequency.value = 880; volume.gain.setValueAtTime(0.08, context.currentTime)
            volume.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35)
            tone.connect(volume); volume.connect(context.destination); tone.start(); tone.stop(context.currentTime + 0.4)
          }
        }
        setOrders(data); setError(''); setUpdatedAt(new Date().toISOString())
      }
    } catch (e) { if (alive.current) { rateLimited.current = (e as any)?.response?.status === 429; setError(requestMessage(e, 'Không tải được đơn hàng. Dữ liệu đang hiển thị có thể chưa cập nhật.') + (rateLimited.current ? ' Đã tạm dừng tự cập nhật.' : '')) } }
    finally { fetching.current = false; if (alive.current) setLoading(false) }
  }, [])
  useEffect(() => {
    alive.current = true
    void refresh()
    const timer = window.setInterval(() => { if (!document.hidden && !rateLimited.current) void refresh(true) }, 300000)
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    settingsService.getSettings().then((items) => { const n = Number(items.find((item) => item.setting_key === 'order_timeout_minutes')?.setting_value); if (alive.current && n > 0) setTimeoutMinutes(n) }).catch(() => {})
    return () => { alive.current = false; window.clearInterval(timer); window.clearInterval(clock); void audio.current?.close(); audio.current = null; soundEnabled.current = false }
  }, [refresh])
  async function toggleSound() {
    if (soundEnabled.current) { soundEnabled.current = false; setSound(false); return }
    try {
      if (!audio.current) audio.current = new AudioContext()
      await audio.current.resume(); soundEnabled.current = true; setSound(true)
    } catch { setError('Chưa bật được âm báo. Bạn vẫn có thể theo dõi đơn mới trên danh sách.'); soundEnabled.current = false; setSound(false) }
  }
  useEffect(() => {
    if (params.get('order')) { setQuery(params.get('order')!); setStatus('all') }
    else if (params.get('status') && Object.prototype.hasOwnProperty.call(orderLabels, params.get('status')!)) setStatus(params.get('status')!)
  }, [params])
  const filtered = orders.filter((order) => (status === 'all' || (status === 'active' ? activeStatuses.includes(order.status) : order.status === status)) && (type === 'all' || order.order_type === type) && `${order.id} ${order.recipient_name} ${order.recipient_phone}`.toLowerCase().includes(query.trim().toLowerCase()))
  const pages = Math.max(1, Math.ceil(filtered.length / 15))
  const currentPage = Math.min(page, pages)
  const visible = filtered.slice((currentPage - 1) * 15, currentPage * 15)
  function open(order: Order, action: OrderAction | 'detail') {
    setModal({ order, action }); setReason(''); setSuffix(''); setConfirmed(false); setModalError('')
    setIssue(order.status === 'DANG_GIAO' ? 'no_answer' : order.pickup_deadline && now > Date.parse(order.pickup_deadline) ? 'pickup_timeout' : 'refuse_payment')
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!modal || modal.action === 'detail' || busy) return
    const { order, action } = modal
    if (!orderActions(order, Date.now(), timeout).includes(action)) { setModalError('Trạng thái hoặc thời hạn của đơn đã thay đổi. Đóng cửa sổ và làm mới danh sách.'); return }
    if (action === 'handover' && (!/^\d{4}$/.test(suffix) || !confirmed)) { setModalError('Nhập 4 số cuối do khách cung cấp và xác nhận đã thu đủ COD.'); return }
    if (['reject', 'issue'].includes(action) && !reason.trim()) { setModalError('Vui lòng nhập lý do.'); return }
    if (action === 'issue' && issue === 'no_answer' && !confirmed) { setModalError('Cần xác nhận đã gọi và chờ khách 5–10 phút.'); return }
    setBusy(true); setModalError('')
    try {
      const updated = action === 'accept' ? await orderService.processOrder(order.id, { action: 'accept' })
        : action === 'reject' ? await orderService.processOrder(order.id, { action: 'reject', reason: reason.trim() })
        : action === 'ready' ? await orderService.updateOrderStatus(order.id, order.order_type === 'pickup' ? 'SAN_SANG_LAY' : 'DANG_GIAO')
        : action === 'handover' ? await orderService.handoverOrder(order.id, suffix)
        : await orderService.reportDeliveryIssue(order.id, { issue_type: issue, reason: reason.trim() })
      setOrders((items) => items.map((item) => item.id === updated.id ? updated : item))
      setNotice(`Đơn ${updated.id}: ${orderLabels[updated.status]}.`); setModal(null)
      void refresh(true)
    } catch (e) { setModalError(requestMessage(e, 'Không cập nhật được đơn. Vui lòng kiểm tra lại trạng thái và thử lại.')); void refresh(true) }
    finally { setBusy(false) }
  }
  function timing(order: Order) {
    if (order.status === 'CHO_XAC_NHAN' && order.created_at) {
      const seconds = Math.ceil((Date.parse(order.created_at) + timeout * 60_000 - now) / 1000)
      return seconds < 0 ? 'Đã quá hạn tiếp nhận · cần làm mới' : `Còn ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} để tiếp nhận`
    }
    if (['SAN_SANG_LAY', 'GIAO_THAT_BAI'].includes(order.status)) return order.pickup_deadline ? `Giữ đến ${dateTime(order.pickup_deadline)}` : 'Chưa có hạn nhận · cần kiểm tra'
    if (order.is_preorder && order.scheduled_at && order.status === 'DANG_CHUAN_BI') return now >= Date.parse(order.scheduled_at) - 20 * 60_000 ? 'Đến thời điểm chuẩn bị cho lịch hẹn' : `Bắt đầu chuẩn bị lúc ${dateTime(new Date(Date.parse(order.scheduled_at) - 20 * 60_000).toISOString())}`
    return ''
  }
  const selected = modal?.order
  return <div className="manager-page">
    <section className="manager-heading"><div><span className="manager-eyebrow">ĐIỀU PHỐI & LỊCH SỬ</span><h1>{audience === 'staff' ? 'Xử lý đơn trong ca' : 'Đơn hàng Canteen A2'}</h1><p>Tiếp nhận, chuẩn bị và bàn giao đúng lịch. Tự cập nhật mỗi 5 phút khi mở trang; bấm Làm mới khi cần dữ liệu mới nhất.</p></div><div className="manager-tools"><button className="manager-button" type="button" aria-pressed={sound} onClick={() => void toggleSound()}>{sound ? <Bell size={15} /> : <BellOff size={15} />}{sound ? 'Âm báo đơn: Bật' : 'Bật âm báo đơn'}</button><button className="manager-button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} />Làm mới</button></div></section>
    {error && <p className="manager-alert error" role="alert">{error}</p>}{notice && <p className="manager-alert success" role="status"><CheckCircle2 size={17} />{notice}</p>}
    <div className="manager-toolbar"><Search size={18} color="#89a0b4" /><input className="manager-input" type="search" aria-label="Tìm đơn hàng" placeholder="Mã đơn, tên khách hoặc số điện thoại…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} /><select className="manager-select" aria-label="Lọc trạng thái đơn" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}><option value="active">Đang phục vụ</option><option value="all">Tất cả / Lịch sử</option>{Object.entries(orderLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select className="manager-select" aria-label="Lọc hình thức nhận" value={type} onChange={(e) => { setType(e.target.value); setPage(1) }}><option value="all">Mọi hình thức</option><option value="delivery">Giao tận nơi</option><option value="pickup">Nhận tại quầy</option></select></div>
    <div className="manager-status-line"><i />{updatedAt ? `Cập nhật ${dateTime(updatedAt)} · ${orders.length} đơn trong lịch sử` : 'Đang kết nối dữ liệu đơn hàng'}</div>
    <section className="manager-card"><div className="manager-table-wrap"><table className="manager-table"><thead><tr><th>Đơn / Khách hàng</th><th>Nhận món & thời gian</th><th>Thanh toán COD</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{loading ? <tr><td colSpan={5}>Đang tải đơn hàng…</td></tr> : visible.length ? visible.map((order) => <tr key={order.id}><td><strong>#{order.id}</strong><small>{order.recipient_name}</small>{order.recipient_phone && <a href={`tel:${order.recipient_phone}`}>{order.recipient_phone}</a>}<small>{order.items?.map((item) => `${item.dish_name} ×${item.quantity}`).join(', ')}</small></td><td><span className="manager-pill">{order.order_type === 'delivery' ? 'Giao tận nơi' : 'Nhận tại quầy'}</span><small>{order.order_type === 'pickup' ? 'Quầy Canteen A2' : `${order.delivery_address || 'Nội khu NEU'}${order.room_detail && !order.delivery_address?.includes(order.room_detail) ? ' · ' + order.room_detail : ''}`}</small><small>Đặt: {dateTime(order.created_at)}</small><small>{order.is_preorder ? `Hẹn: ${dateTime(order.scheduled_at)}` : 'Làm ngay'}</small></td><td><strong>{money(order.total_amount || 0)}</strong><small>{order.payment_method === 'cod_vietqr' ? 'VietQR khi nhận hàng' : 'Tiền mặt khi nhận hàng'}</small><span className={`manager-pill ${order.payment_status === 'da_thanh_toan' ? 'good' : 'warn'}`}>{order.payment_status === 'da_thanh_toan' ? 'Đã thu COD' : 'Chưa thu COD'}</span></td><td><span className={`manager-pill ${order.status === 'CHO_XAC_NHAN' ? 'warn' : order.status === 'HOAN_THANH' ? 'good' : ''}`}>{orderLabels[order.status]}</span>{timing(order) && <small><Clock3 size={12} /> {timing(order)}</small>}{order.cancelled_reason && <small>Lý do: {order.cancelled_reason}</small>}</td><td><div className="manager-actions"><button className="manager-button" onClick={() => open(order, 'detail')} aria-label={`Xem đơn ${order.id}`}><Eye size={15} /></button>{orderActions(order, now, timeout).map((action) => <button key={action} className={`manager-button ${action === 'reject' || action === 'issue' ? '' : 'primary'}`} onClick={() => open(order, action)}>{actionLabels[action]}</button>)}</div></td></tr>) : <tr><td colSpan={5}>Không có đơn phù hợp với bộ lọc.</td></tr>}</tbody></table></div><footer className="manager-pagination"><span>{filtered.length} đơn phù hợp · Trang {currentPage}/{pages}</span><div className="manager-actions"><button className="manager-button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}>Trước</button><button className="manager-button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pages}>Sau</button></div></footer></section>
    {modal && selected && <ManagerDialog title={modal.action === 'detail' ? `Chi tiết ${selected.id}` : actionLabels[modal.action]} onClose={() => setModal(null)} busy={busy}><form onSubmit={submit}><div className="manager-dialog-body"><div><strong>#{selected.id} · {selected.recipient_name}</strong><p className="manager-hint">{selected.recipient_phone} · {orderLabels[selected.status]}</p></div><div className="manager-totals">{selected.items?.map((item, index) => <div key={index}><span>{item.dish_name} ×{item.quantity}{item.note ? ` · ${item.note}` : ''}</span><strong>{money(item.subtotal ?? (item.unit_price || 0) * (item.quantity || 0))}</strong></div>)}<div><span>Phí giao hàng</span><span>{money(selected.ship_fee || 0)}</span></div><div><span>Tổng COD cần thu</span><span>{money(selected.total_amount || 0)}</span></div></div>
      {selected.delivery_note && <p className="manager-note">Ghi chú khách: {selected.delivery_note}</p>}
      {modal.action === 'detail' && <div className="manager-form"><p className="manager-hint">{selected.order_type === 'pickup' ? 'Nhận tại quầy Canteen A2' : `${selected.delivery_address || ''} ${selected.room_detail || ''}`}</p><p className="manager-hint">{selected.is_preorder ? `Lịch hẹn: ${dateTime(selected.scheduled_at)}` : 'Đơn làm ngay'} · {selected.payment_method === 'cod_vietqr' ? 'VietQR' : 'Tiền mặt'}</p><p className="manager-hint">Bàn giao: {dateTime(selected.delivered_at)} · {selected.payment_status === 'da_thanh_toan' ? 'Đã thanh toán' : 'Chưa thanh toán'}</p>{selected.cancelled_reason && <p className="manager-note">{selected.cancelled_reason}</p>}</div>}
      {modal.action === 'accept' && <p className="manager-alert">Xác nhận Canteen có đủ nguyên liệu và khả năng phục vụ. Đơn hẹn giờ được xếp lịch sau khi tiếp nhận.</p>}
      {modal.action === 'ready' && <p className="manager-alert">{selected.order_type === 'pickup' ? 'Món đã đóng gói xong sẽ chuyển sang Sẵn sàng lấy. Thời hạn giữ món được tính từ lúc xác nhận.' : 'Món đã đóng gói xong sẽ chuyển sang Đang giao. Chưa ghi nhận thu tiền ở bước này.'}</p>}
      {modal.action === 'handover' && <><p className="manager-alert">Yêu cầu khách đọc 4 số cuối mã đơn. Chỉ bàn giao sau khi đã thu đủ {money(selected.total_amount || 0)} bằng {selected.payment_method === 'cod_vietqr' ? 'VietQR theo đơn' : 'tiền mặt theo đơn'}.{selected.status === 'GIAO_THAT_BAI' ? ' Đơn mang về quầy vẫn thu đủ cả phí giao hàng.' : ''}</p><label className="manager-field">4 số cuối khách cung cấp<input className="manager-input" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required value={suffix} onChange={(e) => setSuffix(e.target.value)} autoComplete="off" /></label><label className="manager-check"><input type="checkbox" checked={confirmed} required onChange={(e) => setConfirmed(e.target.checked)} />Đã đối chiếu đúng mã nhận và thu đủ tiền COD.</label></>}
      {modal.action === 'issue' && <><label className="manager-field">Loại sự cố<select className="manager-select" value={issue} onChange={(e) => { setIssue(e.target.value as typeof issue); setConfirmed(false) }}>{selected.status === 'DANG_GIAO' && <option value="no_answer">Không liên lạc được / Khách vắng mặt</option>}<option value="refuse_payment">Khách từ chối / Không đủ tiền thanh toán</option>{selected.pickup_deadline && now > Date.parse(selected.pickup_deadline) && <option value="pickup_timeout">Quá thời hạn giữ món tại quầy</option>}</select></label><p className="manager-alert">{issue === 'no_answer' ? 'Mang món về quầy và giữ theo thời hạn hệ thống. Chưa đưa khách vào blacklist ở bước này.' : 'Thao tác sẽ đóng đơn bỏ hàng và đưa khách vào blacklist COD theo quy định. Không bàn giao món.'}</p>{issue === 'no_answer' && <label className="manager-check"><input type="checkbox" required checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />Đã gọi và chờ khách từ 5–10 phút nhưng không liên lạc được.</label>}</>}
      {['reject', 'issue'].includes(modal.action) && <label className="manager-field">Lý do (bắt buộc)<textarea className="manager-input" rows={3} required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
      {modalError && <p className="manager-alert error" role="alert">{modalError}</p>}
    </div><footer className="manager-dialog-foot"><button type="button" className="manager-button" disabled={busy} onClick={() => setModal(null)}>Đóng</button>{modal.action !== 'detail' && <button className="manager-button primary" type="submit" disabled={busy}>{busy ? 'Đang xử lý…' : 'Xác nhận'}</button>}</footer></form></ManagerDialog>}
  </div>
}
