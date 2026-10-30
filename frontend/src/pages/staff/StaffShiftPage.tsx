import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, RefreshCw, Send, Wallet } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { shiftService, type CurrentShiftSummary, type StaffShift } from '../../services/shiftService'
import ManagerDialog from '../../components/manager/ManagerDialog'
import { dateTime, money, requestMessage, vietnamDate } from '../manager/managerRules'
import { MAX_SHIFT_AMOUNT, shiftComparison, shiftLabels, shiftSnapshotChanged, validateShiftDraft } from './staffRules'
import styles from './StaffWorkspace.module.css'

function ComparisonTable({ summary, cash, qr }: { summary: CurrentShiftSummary; cash: number; qr: number }) {
  const diff = shiftComparison(summary, cash, qr)
  return <div className="manager-table-wrap"><table className={styles.comparison}><thead><tr><th>Hình thức</th><th>Hệ thống</th><th>Thực kiểm đếm</th><th>Chênh lệch</th></tr></thead><tbody><tr><td>Tiền mặt</td><td>{money(summary.expected_cash)}</td><td>{money(cash)}</td><td className={diff.cash ? styles.difference : ''}>{money(diff.cash)}</td></tr><tr><td>VietQR</td><td>{money(summary.expected_qr)}</td><td>{money(qr)}</td><td className={diff.qr ? styles.difference : ''}>{money(diff.qr)}</td></tr><tr><td>Tổng COD</td><td>{money(summary.expected_cash + summary.expected_qr)}</td><td>{money(cash + qr)}</td><td className={diff.needsExplanation ? styles.difference : ''}>{money(diff.total)}</td></tr></tbody></table></div>
}
export default function StaffShiftPage() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<CurrentShiftSummary | null>(null)
  const [cash, setCash] = useState('0')
  const [qr, setQr] = useState('0')
  const [note, setNote] = useState('')
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [review, setReview] = useState<CurrentShiftSummary | null>(null)
  const [checked, setChecked] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [history, setHistory] = useState<StaffShift[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [historyState, setHistoryState] = useState('all')
  const [historyDate, setHistoryDate] = useState('')

  function hydrate(current: CurrentShiftSummary) {
    setCash(String(current.actual_cash ?? 0)); setQr(String(current.actual_qr ?? 0)); setNote(current.discrepancy_note || ''); setDirty(false)
  }
  async function refresh() {
    setLoading(true); setError('')
    try {
      const current = await shiftService.getCurrentShift()
      setSummary(current)
      if (!dirty || current.shift_date !== summary?.shift_date || current.status === 'DA_CHOT') hydrate(current)
    } catch (e) { setError(requestMessage(e, 'Chưa tải được số liệu ca. Vui lòng thử lại.')) }
    finally { setLoading(false) }
  }
  async function refreshHistory() {
    setHistoryLoading(true); setHistoryError('')
    try { const items = await shiftService.getShifts(); setHistory(items.filter((item) => item.staff_id === user?.id)) }
    catch (e) { setHistoryError(requestMessage(e, 'Chưa tải được lịch sử ca.')) }
    finally { setHistoryLoading(false) }
  }
  useEffect(() => {
    let active = true
    shiftService.getCurrentShift().then((current) => { if (active) { setSummary(current); hydrate(current) } }).catch((e) => { if (active) setError(requestMessage(e, 'Chưa tải được số liệu ca. Vui lòng thử lại.')) }).finally(() => { if (active) setLoading(false) })
    shiftService.getShifts().then((items) => { if (active) setHistory(items.filter((item) => item.staff_id === user?.id)) }).catch((e) => { if (active) setHistoryError(requestMessage(e, 'Chưa tải được lịch sử ca.')) }).finally(() => { if (active) setHistoryLoading(false) })
    return () => { active = false }
  }, [user?.id])

  async function prepareReview(event: FormEvent) {
    event.preventDefault()
    if (checking || saving) return
    setError(''); setNotice('')
    const problem = validateShiftDraft(summary, cash, qr, note, vietnamDate())
    if (problem) { setError(problem); return }
    setChecking(true)
    try {
      const current = await shiftService.getCurrentShift()
      setSummary(current)
      const latestProblem = validateShiftDraft(current, cash, qr, note, vietnamDate())
      if (latestProblem) { setError(latestProblem); return }
      if (current.shift_date !== summary?.shift_date) { setError('Ngày ca đã thay đổi. Làm mới và kiểm đếm lại trước khi nộp.'); return }
      setReview(current); setChecked(false); setReviewError('')
    } catch (e) { setError(requestMessage(e, 'Chưa xác nhận được số liệu mới nhất. Chưa gửi dữ liệu ca.')) }
    finally { setChecking(false) }
  }
  async function submit() {
    if (!review || saving || !checked) return
    setSaving(true); setReviewError('')
    try {
      const current = await shiftService.getCurrentShift()
      setSummary(current)
      if (current.shift_date !== review.shift_date) { setReview(null); hydrate(current); setError('Ngày ca đã thay đổi. Kiểm đếm lại số liệu cho ca hôm nay trước khi nộp.'); return }
      const problem = validateShiftDraft(current, cash, qr, note, vietnamDate())
      if (problem) { setReviewError(problem); setChecked(false); return }
      if (shiftSnapshotChanged(current, review)) {
        setReview(current); setChecked(false); setReviewError('Số liệu ca vừa thay đổi. Kiểm tra lại bảng đối chiếu và xác nhận trước khi gửi.'); return
      }
      const result = await shiftService.submitShift({ actual_cash: Number(cash), actual_qr: Number(qr), ...(note.trim() ? { discrepancy_note: note.trim() } : {}) })
      const currentResult: CurrentShiftSummary = { ...result, shift_id: result.id, staff_name: result.staff_name || undefined }
      setSummary(currentResult); hydrate(currentResult)
      setHistory((items) => [result, ...(items || []).filter((item) => item.id !== result.id)])
      setNotice(`Đã nộp số liệu ca ${result.shift_date}. ${shiftLabels[result.status]}.`); setReview(null)
    } catch (e) { setReviewError(requestMessage(e, 'Chưa nộp được số liệu ca. Vui lòng kiểm tra trạng thái trước khi thử lại.')); setChecked(false) }
    finally { setSaving(false) }
  }
  const actualCash = cash.trim() && Number.isFinite(Number(cash)) ? Number(cash) : null
  const actualQr = qr.trim() && Number.isFinite(Number(qr)) ? Number(qr) : null
  const diff = summary && actualCash != null && actualQr != null ? shiftComparison(summary, Number(actualCash), Number(actualQr)) : null
  const locked = loading || checking || saving || !summary || summary.status === 'DA_CHOT'
  const visibleHistory = [...(history || [])].filter((item) => (historyState === 'all' || item.status === historyState) && (!historyDate || item.shift_date === historyDate)).sort((a, b) => b.shift_date.localeCompare(a.shift_date) || b.id - a.id)
  return <div className="manager-page">
    <section className="manager-heading"><div><span className="manager-eyebrow">TIỀN MẶT & SAO KÊ VIETQR</span><h1>Chốt ca COD</h1><p>Đối chiếu số tiền của tài khoản trong ngày và gửi quản lý duyệt.</p></div><button type="button" className="manager-button" disabled={loading || checking || saving} onClick={() => void refresh()}><RefreshCw size={15} />Làm mới số liệu</button></section>
    {error && <p className="manager-alert error" role="alert">{error}</p>}{notice && <p className="manager-alert success" role="status"><CheckCircle2 size={17} />{notice}</p>}
    <section className="manager-card"><header className="manager-card-header"><div><h2>Ca hôm nay · {summary?.shift_date || vietnamDate()}</h2><p>Đơn đã thu COD được tính theo thời điểm bàn giao thực tế, giờ Việt Nam.</p></div><span className={`manager-pill ${summary?.status === 'DA_CHOT' ? 'good' : 'warn'}`}>{loading ? 'Đang tải…' : !summary ? 'Chưa có dữ liệu' : summary.status ? shiftLabels[summary.status] : 'Chưa nộp'}</span></header><div className="manager-card-body"><div className={styles.summaryColumns}><div><span>Đơn đã bàn giao & thu COD</span><strong>{loading || !summary ? '—' : summary.total_orders_handled}</strong></div><div><span>Tiền mặt theo hệ thống</span><strong>{loading || !summary ? '—' : money(summary.expected_cash)}</strong></div><div><span>VietQR theo hệ thống</span><strong>{loading || !summary ? '—' : money(summary.expected_qr)}</strong></div></div></div></section>
    <form className="manager-card" onSubmit={prepareReview}><header className="manager-card-header"><div><h2>Số tiền thực kiểm đếm</h2><p>Nhập riêng tiền mặt và số chuyển khoản thực nhận; tối đa 2 chữ số thập phân.</p></div><Wallet size={20} /></header><div className="manager-card-body manager-form"><fieldset disabled={locked} className={styles.fieldset}><div className="manager-form-grid"><label className="manager-field">Tiền mặt thực đếm (đ)<input className="manager-input" type="number" required min={0} max={MAX_SHIFT_AMOUNT} step="0.01" value={cash} onChange={(e) => { setCash(e.target.value); setDirty(true) }} /></label><label className="manager-field">VietQR theo sao kê (đ)<input className="manager-input" type="number" required min={0} max={MAX_SHIFT_AMOUNT} step="0.01" value={qr} onChange={(e) => { setQr(e.target.value); setDirty(true) }} /></label></div><label className="manager-field">Ghi chú / giải trình{diff?.needsExplanation ? ' (bắt buộc)' : ''}<textarea className="manager-input" rows={4} maxLength={1000} required={Boolean(diff?.needsExplanation)} value={note} onChange={(e) => { setNote(e.target.value); setDirty(true) }} placeholder="Giải thích chênh lệch tiền mặt hoặc sao kê QR…" /></label></fieldset>
    {summary && actualCash !== null && actualQr !== null && <ComparisonTable summary={summary} cash={Number(actualCash)} qr={Number(actualQr)} />}
    {diff && <p className={`manager-alert ${diff.needsExplanation ? '' : 'success'}`}>{diff.needsExplanation ? `Có chênh lệch giữa các kênh thu tiền (tổng ${money(diff.total)}). Bổ sung giải trình trước khi nộp, kể cả khi tổng chênh lệch bằng 0.` : 'Tiền mặt và VietQR đều khớp với số liệu hệ thống.'}</p>}
    {summary?.discrepancy_note && <p className={styles.smallNote}><strong>Ghi chú ca đang lưu</strong><br />{summary.discrepancy_note}</p>}
    <div className={styles.formActions}>{summary?.status === 'DA_CHOT' ? <p className="manager-alert success"><CheckCircle2 size={17} />Quản lý đã chốt ca này. Số liệu được khóa và không thể nộp lại.</p> : <><p className={styles.draftHint}>{dirty ? 'Có thay đổi chưa nộp. Làm mới số liệu sẽ giữ số tiền bạn đang nhập.' : 'Bạn có thể cập nhật lại khi ca đang chờ duyệt hoặc cần giải trình.'}</p><button className="manager-button primary" type="submit" disabled={locked}><Send size={16} />{checking ? 'Đang kiểm tra số liệu…' : summary?.status ? 'Kiểm tra & nộp cập nhật' : 'Kiểm tra & nộp ca'}</button></>}</div></div></form>
    <p className="manager-hint">Mỗi tài khoản nhân viên có một ca mỗi ngày Việt Nam. Nếu dùng chung tài khoản, số liệu bao gồm các đơn do tài khoản đó bàn giao; thống nhất tiền mặt và sao kê của cả ca trước khi nộp.</p>
    <section className="manager-card"><header className="manager-card-header"><div><h2>Lịch sử ca của tài khoản</h2><p>Tra cứu số đã nộp, trạng thái và ghi chú đối soát</p></div><button className="manager-button" onClick={() => void refreshHistory()} disabled={historyLoading}><RefreshCw size={15} />Tải lại lịch sử</button></header><div className="manager-card-body manager-toolbar"><select className="manager-select" aria-label="Lọc lịch sử ca" value={historyState} onChange={(e) => setHistoryState(e.target.value)}><option value="all">Tất cả trạng thái</option>{Object.entries(shiftLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select><label className="manager-field">Ngày ca<input className="manager-input" type="date" value={historyDate} onChange={(e) => setHistoryDate(e.target.value)} /></label>{historyDate && <button className="manager-button" onClick={() => setHistoryDate('')}>Bỏ lọc ngày</button>}</div>{historyError && <p className="manager-alert error" role="alert">{historyError}</p>}<div className="manager-table-wrap"><table className="manager-table"><thead><tr><th>Ca / Ngày</th><th>COD hệ thống</th><th>Thực nộp</th><th>Trạng thái & ghi chú</th></tr></thead><tbody>{historyLoading ? <tr><td colSpan={4}>Đang tải lịch sử ca…</td></tr> : visibleHistory.length ? visibleHistory.map((item) => <tr key={item.id}><td><strong>Ca #{item.id}</strong><small>{item.shift_date} · {item.total_orders_handled} đơn</small></td><td>{money(item.expected_cash + item.expected_qr)}<small>Tiền mặt: {money(item.expected_cash)}</small><small>VietQR: {money(item.expected_qr)}</small></td><td>{money(item.actual_cash + item.actual_qr)}<small>Tiền mặt: {money(item.actual_cash)}</small><small>VietQR: {money(item.actual_qr)}</small></td><td><span className={`manager-pill ${item.status === 'DA_CHOT' ? 'good' : 'warn'}`}>{shiftLabels[item.status]}</span>{item.discrepancy_note && <p className={styles.historyNote}>{item.discrepancy_note}</p>}{item.closed_at && <small>Chốt: {dateTime(item.closed_at)}</small>}</td></tr>) : <tr><td colSpan={4}>{historyError ? 'Chưa tải được dữ liệu lịch sử.' : 'Chưa có ca phù hợp.'}</td></tr>}</tbody></table></div></section>
    {review && <ManagerDialog title="Xác nhận nộp số liệu ca" busy={saving} onClose={() => setReview(null)}><div className="manager-dialog-body"><p className="manager-hint">Ngày ca {review.shift_date} · {review.total_orders_handled} đơn bàn giao · {user?.full_name}</p><ComparisonTable summary={review} cash={Number(cash)} qr={Number(qr)} />{note.trim() && <p className="manager-note"><strong>Giải trình</strong><br />{note.trim()}</p>}<p className={styles.confirmation}>Số liệu sẽ được gửi cho quản lý đối soát. Thao tác này ghi nhận số tiền nộp ca; bạn vẫn cần bàn giao tiền và sao kê thực tế cho Canteen.</p><label className="manager-check"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} disabled={saving} />Đã kiểm đếm tiền mặt, đối chiếu sao kê QR và kiểm tra số liệu của ca.</label>{reviewError && <p className="manager-alert error" role="alert">{reviewError}</p>}</div><footer className="manager-dialog-foot"><button className="manager-button" type="button" onClick={() => setReview(null)} disabled={saving}>Quay lại</button><button className="manager-button primary" type="button" disabled={saving || !checked} onClick={() => void submit()}>{saving ? 'Đang nộp…' : 'Xác nhận nộp số liệu'}</button></footer></ManagerDialog>}
  </div>
}
