import { useEffect, useState, type FormEvent } from 'react'
import { CircleDollarSign, Clock3, Save, Send } from 'lucide-react'
import { shiftService, type CurrentShiftSummary } from '../../services/shiftService'
import styles from './StaffPages.module.css'

const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`

export default function StaffShiftPage() {
  const [summary, setSummary] = useState<CurrentShiftSummary | null>(null)
  const [cash, setCash] = useState('0')
  const [qr, setQr] = useState('0')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const result = await shiftService.getCurrentShift()
      setSummary(result)
      setCash(String(result.actual_cash ?? 0))
      setQr(String(result.actual_qr ?? 0))
      setNote(result.discrepancy_note || '')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không tải được thông tin ca làm việc.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void refresh() }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    const actualCash = Number(cash)
    const actualQr = Number(qr)
    if (![actualCash, actualQr].every((value) => Number.isFinite(value) && value >= 0)) {
      setError('Số tiền kiểm đếm phải là số không âm.')
      return
    }
    const expectedTotal = (summary?.expected_cash || 0) + (summary?.expected_qr || 0)
    const difference = actualCash + actualQr - expectedTotal
    if (difference !== 0 && !note.trim()) {
      setError('Ca có chênh lệch COD; vui lòng ghi giải trình trước khi nộp.')
      return
    }
    setSaving(true)
    try {
      await shiftService.submitShift({ actual_cash: actualCash, actual_qr: actualQr, ...(note.trim() ? { discrepancy_note: note.trim() } : {}) })
      setSuccess('Đã gửi số liệu chốt ca. Quản lý có thể xem và duyệt đối soát.')
      await refresh()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể nộp số liệu chốt ca.')
    } finally { setSaving(false) }
  }

  const expectedTotal = (summary?.expected_cash || 0) + (summary?.expected_qr || 0)
  const difference = Number(cash || 0) + Number(qr || 0) - expectedTotal
  const status = summary?.status === 'DA_CHOT' ? 'Đã chốt' : summary?.status === 'CAN_GIAI_TRINH' ? 'Cần giải trình' : summary?.status === 'CHO_DUYET' ? 'Chờ quản lý duyệt' : 'Chưa nộp'

  return <div className={styles.page}>
    <section className={styles.welcome}><div><span className={styles.eyebrow}>ĐỐI SOÁT CA · GIỜ VIỆT NAM</span><h2>Chốt ca COD</h2><p>Hệ thống chỉ tính các đơn đã bàn giao và thu tiền trong ngày hiện tại.</p></div><span className={styles.status}>{status}</span></section>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}{success ? <p className={styles.success} role="status">{success}</p> : null}
    <section className={styles.metrics}>
      <article><span className={styles.metricIcon}><Clock3 size={18} /></span><small>Đơn đã giao trong ngày</small><strong>{loading ? '—' : summary?.total_orders_handled ?? 0}</strong><span>{summary?.shift_date || 'Đang tải ngày ca'}</span></article>
      <article><span className={styles.metricIcon}><CircleDollarSign size={18} /></span><small>Tiền mặt dự kiến</small><strong>{money(summary?.expected_cash || 0)}</strong><span>Theo COD cash trong đơn đã giao</span></article>
      <article><span className={styles.metricIcon}><CircleDollarSign size={18} /></span><small>VietQR dự kiến</small><strong>{money(summary?.expected_qr || 0)}</strong><span>Theo COD VietQR trong đơn đã giao</span></article>
    </section>
    <form className={styles.formPanel} onSubmit={submit}>
      <span className={styles.eyebrow}>SỐ TIỀN THỰC KIỂM ĐẾM</span><h2>Đối chiếu tiền đã bàn giao</h2><p>Độ lệch được so với tiền hệ thống tổng hợp từ các đơn đã thanh toán theo thời điểm giao hàng.</p>
      <div className={styles.formGrid}>
        <label className={styles.field}>Tiền mặt thực đếm (đ)<input type="number" min="0" step="1000" value={cash} onChange={(event) => setCash(event.target.value)} disabled={loading || summary?.status === 'DA_CHOT'} required /></label>
        <label className={styles.field}>VietQR theo sao kê (đ)<input type="number" min="0" step="1000" value={qr} onChange={(event) => setQr(event.target.value)} disabled={loading || summary?.status === 'DA_CHOT'} required /></label>
        <label className={styles.field}>Ghi chú / giải trình<textarea rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Bắt buộc nếu số thực đếm lệch dự kiến…" disabled={loading || summary?.status === 'DA_CHOT'} /></label>
      </div>
      <p className={difference === 0 ? styles.notice : styles.error}>{difference === 0 ? `Khớp với hệ thống · tổng dự kiến ${money(expectedTotal)}.` : `Chênh lệch ${difference > 0 ? '+' : '−'}${money(Math.abs(difference))}; cần giải trình.`}</p>
      {summary?.status === 'DA_CHOT' ? <p className={styles.notice}>Quản lý đã chốt ca này; API không nhận cập nhật thêm.</p> : <button className={styles.button} type="submit" disabled={loading || saving}>{saving ? <Save size={15} /> : <Send size={15} />}{saving ? 'Đang gửi…' : summary?.status ? 'Cập nhật và nộp số liệu' : 'Nộp số liệu chốt ca'}</button>}
    </form>
  </div>
}
