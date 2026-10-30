import type { CurrentShiftSummary } from '../../services/shiftService'

export const shiftLabels = { CHO_DUYET: 'Chờ quản lý duyệt', CAN_GIAI_TRINH: 'Cần giải trình', DA_CHOT: 'Đã chốt' }
export const MAX_SHIFT_AMOUNT = 9999999999.99
export function shiftSnapshotChanged(current: CurrentShiftSummary, reviewed: CurrentShiftSummary) {
  return (['shift_date', 'shift_id', 'status', 'total_orders_handled', 'expected_cash', 'expected_qr', 'actual_cash', 'actual_qr', 'discrepancy_note'] as const).some((key) => (current[key] ?? null) !== (reviewed[key] ?? null))
}
export function shiftComparison(summary: Pick<CurrentShiftSummary, 'expected_cash' | 'expected_qr'>, cash: number, qr: number) {
  const cashDifference = Math.round((cash - summary.expected_cash) * 100) / 100
  const qrDifference = Math.round((qr - summary.expected_qr) * 100) / 100
  return { cash: cashDifference, qr: qrDifference, total: Math.round((cashDifference + qrDifference) * 100) / 100, needsExplanation: cashDifference !== 0 || qrDifference !== 0 }
}
export function validateShiftDraft(summary: CurrentShiftSummary | null, cash: string, qr: string, note: string, today: string) {
  if (!summary) return 'Chưa tải được số liệu ca. Vui lòng làm mới trước khi nộp.'
  if (summary.shift_date !== today) return 'Ngày ca đã thay đổi. Làm mới trang để nộp đúng ca hôm nay.'
  if (summary.status === 'DA_CHOT') return 'Quản lý đã chốt ca này. Không thể cập nhật thêm.'
  if (![summary.expected_cash, summary.expected_qr].every((value) => Number.isFinite(value) && value >= 0)) return 'Số liệu hệ thống chưa hợp lệ. Vui lòng làm mới.'
  if (!cash.trim() || !qr.trim()) return 'Nhập đầy đủ tiền mặt thực đếm và VietQR theo sao kê.'
  const values = [Number(cash), Number(qr)]
  if (!values.every((value) => Number.isFinite(value) && value >= 0 && value <= MAX_SHIFT_AMOUNT)) return 'Số tiền phải không âm và không vượt quá 9.999.999.999,99đ.'
  if (!values.every((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.0001)) return 'Số tiền chỉ được có tối đa 2 chữ số thập phân.'
  if (note.trim().length > 1000) return 'Giải trình tối đa 1.000 ký tự.'
  if (shiftComparison(summary, values[0], values[1]).needsExplanation && !note.trim()) return 'Có chênh lệch tiền mặt hoặc VietQR. Nhập giải trình trước khi nộp.'
  return ''
}
