import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, RefreshCw, Wallet } from 'lucide-react'
import { shiftService, type StaffShift } from '../../services/shiftService'
import { canCloseShift, dateTime, money, requestMessage, shiftDifferences } from './managerRules'
import ManagerDialog from '../../components/manager/ManagerDialog'

const labels = { CHO_DUYET: 'Chờ duyệt', CAN_GIAI_TRINH: 'Cần giải trình', DA_CHOT: 'Đã chốt' }
function CashComparison({ shift }: { shift: StaffShift }) {
  const diff = shiftDifferences(shift)
  return <div className="manager-table-wrap"><table className="manager-table"><thead><tr><th>Hình thức</th><th>Theo hệ thống</th><th>Thực nộp</th><th>Chênh lệch</th></tr></thead><tbody><tr><td>Tiền mặt</td><td>{money(shift.expected_cash)}</td><td>{money(shift.actual_cash)}</td><td className={diff.cash ? 'manager-money-diff' : ''}>{money(diff.cash)}</td></tr><tr><td>VietQR</td><td>{money(shift.expected_qr)}</td><td>{money(shift.actual_qr)}</td><td className={diff.qr ? 'manager-money-diff' : ''}>{money(diff.qr)}</td></tr><tr><td><strong>Tổng COD</strong></td><td>{money(shift.expected_cash + shift.expected_qr)}</td><td>{money(shift.actual_cash + shift.actual_qr)}</td><td className={diff.hasDifference ? 'manager-money-diff' : ''}>{money(diff.total)}</td></tr></tbody></table></div>
}
export default function ManagerShiftsPage() {
  const [shifts, setShifts] = useState<StaffShift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [filter, setFilter] = useState('pending')
  const [query, setQuery] = useState('')
  const [date, setDate] = useState('')
  const [modal, setModal] = useState<{ shift: StaffShift; action: 'DA_CHOT' | 'CAN_GIAI_TRINH' } | null>(null)
  const [note, setNote] = useState('')
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [modalError, setModalError] = useState('')
  useEffect(() => {
    let active = true; setLoading(true); setError('')
    shiftService.getShifts().then((items) => { if (active) setShifts(items) }).catch((e) => { if (active) setError(requestMessage(e, 'Không tải được danh sách ca COD.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])
  const filtered = shifts.filter((shift) => (filter === 'all' || (filter === 'pending' ? shift.status !== 'DA_CHOT' : shift.status === filter)) && (!date || shift.shift_date === date) && `${shift.staff_name || ''} ${shift.staff_id}`.toLowerCase().includes(query.trim().toLowerCase()))
  function open(shift: StaffShift, action: 'DA_CHOT' | 'CAN_GIAI_TRINH') { setModal({ shift, action }); setNote(shift.discrepancy_note || ''); setChecked(false); setModalError('') }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!modal || busy) return
    if (modal.action === 'DA_CHOT' && (!checked || !canCloseShift(modal.shift, note))) { setModalError('Đối chiếu tiền và bổ sung giải trình chênh lệch trước khi duyệt.'); return }
    if (modal.action === 'CAN_GIAI_TRINH' && !note.trim()) { setModalError('Nhập nội dung cần nhân viên giải trình.'); return }
    setBusy(true); setModalError('')
    try {
      const updated = await shiftService.closeShift(modal.shift.id, modal.action, note.trim() || undefined)
      setShifts((items) => items.map((shift) => shift.id === updated.id ? updated : shift))
      setNotice(`Ca #${updated.id}: ${labels[updated.status]}.`); setModal(null)
    } catch (e) { setModalError(requestMessage(e, 'Không cập nhật được ca. Vui lòng làm mới để kiểm tra trạng thái mới nhất.')) }
    finally { setBusy(false) }
  }
  return <div className="manager-page"><section className="manager-heading"><div><span className="manager-eyebrow">KIỂM ĐẾM & BÀN GIAO</span><h1>Đối soát ca COD</h1><p>Đối chiếu tiền mặt, sao kê VietQR và giải trình trước khi duyệt chốt ca.</p></div><button className="manager-button" onClick={() => setRevision((n) => n + 1)} disabled={loading}><RefreshCw size={15} />Làm mới</button></section>
    <div className="manager-report-intro">Số tiền theo hệ thống được ghi nhận theo thời điểm nhân viên thực tế bàn giao và thu COD, tính theo ngày Việt Nam. Phí giao hàng nằm trong tiền nộp lại Canteen.</div>
    {error && <p className="manager-alert error" role="alert">{error}</p>}{notice && <p className="manager-alert success" role="status"><CheckCircle2 size={16} />{notice}</p>}
    <div className="manager-toolbar"><input className="manager-input" type="search" placeholder="Tìm tên hoặc mã nhân viên…" aria-label="Tìm nhân viên đối soát" value={query} onChange={(e) => setQuery(e.target.value)} /><select className="manager-select" aria-label="Lọc trạng thái ca" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="pending">Ca chưa chốt</option><option value="all">Tất cả ca</option>{Object.entries(labels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select><label className="manager-hint">Ngày ca <input className="manager-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>{date && <button className="manager-button" onClick={() => setDate('')}>Bỏ lọc ngày</button>}</div>
    {loading ? <div className="manager-state">Đang tải ca làm việc…</div> : !filtered.length ? <section className="manager-card manager-state"><Wallet size={30} /><strong>Không có ca phù hợp</strong><span>Ca nhân viên đã nộp sẽ xuất hiện tại đây để quản lý đối soát.</span></section> : filtered.map((shift) => { const diff = shiftDifferences(shift); return <section className="manager-card" key={shift.id}><header className="manager-card-header"><div><h2>{shift.staff_name || `Nhân viên #${shift.staff_id}`}</h2><p>Ca #{shift.id} · {shift.shift_date} · {shift.total_orders_handled} đơn đã bàn giao</p></div><span className={`manager-pill ${shift.status === 'DA_CHOT' ? 'good' : 'warn'}`}>{labels[shift.status]}</span></header><CashComparison shift={shift} /><div className="manager-card-body manager-form">{diff.hasDifference && <p className="manager-alert">Có chênh lệch {diff.cash ? 'tiền mặt' : ''}{diff.cash && diff.qr ? ' và ' : ''}{diff.qr ? 'VietQR' : ''}. Cần đối chiếu sao kê và ghi nhận giải trình trước khi ký chốt.</p>}<p className="manager-note"><strong>Giải trình / ghi chú hiện tại</strong><br />{shift.discrepancy_note || 'Chưa có ghi chú.'}</p>{shift.status !== 'DA_CHOT' ? <div className="manager-actions"><button className="manager-button" onClick={() => open(shift, 'CAN_GIAI_TRINH')}>Yêu cầu giải trình</button><button className="manager-button primary" onClick={() => open(shift, 'DA_CHOT')}>Kiểm tra & duyệt chốt ca</button></div> : <p className="manager-hint">Đã chốt lúc {dateTime(shift.closed_at)} · Người duyệt #{shift.closed_by}. Ca đã chốt không thể chốt lại.</p>}</div></section> })}
    {modal && <ManagerDialog title={modal.action === 'DA_CHOT' ? 'Duyệt chốt ca COD' : 'Yêu cầu nhân viên giải trình'} busy={busy} onClose={() => setModal(null)}><form onSubmit={save}><div className="manager-dialog-body"><strong>{modal.shift.staff_name} · {modal.shift.shift_date}</strong><CashComparison shift={modal.shift} /><label className="manager-field">Giải trình / ghi chú xác nhận<textarea className="manager-input" rows={4} value={note} maxLength={1000} required={modal.action === 'CAN_GIAI_TRINH' || shiftDifferences(modal.shift).hasDifference} onChange={(e) => setNote(e.target.value)} placeholder="Ghi kết quả kiểm đếm hoặc nội dung cần giải trình…" /></label><p className="manager-hint">Giữ nội dung giải trình đã có và bổ sung kết quả đối chiếu vào ghi chú trước khi lưu.</p>{modal.action === 'DA_CHOT' && <label className="manager-check"><input type="checkbox" required checked={checked} onChange={(e) => setChecked(e.target.checked)} />Đã đối chiếu tiền mặt, sao kê QR và kiểm tra giải trình. Xác nhận chốt ca này.</label>}{modalError && <p className="manager-alert error" role="alert">{modalError}</p>}</div><footer className="manager-dialog-foot"><button className="manager-button" type="button" disabled={busy} onClick={() => setModal(null)}>Hủy</button><button className="manager-button primary" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : modal.action === 'DA_CHOT' ? 'Xác nhận chốt ca' : 'Gửi yêu cầu giải trình'}</button></footer></form></ManagerDialog>}
  </div>
}
