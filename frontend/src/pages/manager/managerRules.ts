import type { Order } from '../../types/order'
import type { StaffShift } from '../../services/shiftService'

export const orderLabels = {
  CHO_XAC_NHAN: 'Chờ xác nhận', DANG_CHUAN_BI: 'Đang chuẩn bị', DANG_GIAO: 'Đang giao',
  SAN_SANG_LAY: 'Sẵn sàng lấy', GIAO_THAT_BAI: 'Giữ tại quầy', DA_GIAO: 'Đã giao',
  DA_BAN_GIAO: 'Đã bàn giao', HOAN_THANH: 'Hoàn thành', DA_HUY_KHACH: 'Khách đã hủy',
  TU_CHOI: 'Đã từ chối', TU_DONG_HUY: 'Tự động hủy', BO_DON_BLACKLIST: 'Bỏ đơn',
  KHIEU_NAI: 'Đang khiếu nại', DA_GIAI_QUYET: 'Đã giải quyết',
}
export const activeStatuses = ['CHO_XAC_NHAN', 'DANG_CHUAN_BI', 'DANG_GIAO', 'SAN_SANG_LAY', 'GIAO_THAT_BAI']
export const money = (value: number) => `${Number(value).toLocaleString('vi-VN')}đ`
export const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }) : '—'
export function vietnamDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
export function dateRange(days: number, now = new Date()) {
  const to = vietnamDate(now)
  const from = new Date(`${to}T00:00:00+07:00`)
  from.setUTCDate(from.getUTCDate() - days + 1)
  return { from: vietnamDate(from), to }
}
export type OrderAction = 'accept' | 'reject' | 'ready' | 'handover' | 'issue'
export function orderActions(order: Order, now = Date.now(), timeoutMinutes = 10): OrderAction[] {
  if (order.payment_status === 'da_thanh_toan') return []
  if (order.status === 'CHO_XAC_NHAN') {
    if (!order.created_at || !Number.isFinite(Date.parse(order.created_at)) || now - Date.parse(order.created_at) > timeoutMinutes * 60_000) return []
    return ['accept', 'reject']
  }
  if (order.status === 'DANG_CHUAN_BI') return ['ready']
  if (order.status === 'DANG_GIAO' && order.order_type === 'delivery') return ['handover', 'issue']
  if ((order.status === 'SAN_SANG_LAY' && order.order_type === 'pickup') || (order.status === 'GIAO_THAT_BAI' && order.order_type === 'delivery')) {
    if (!order.pickup_deadline || !Number.isFinite(Date.parse(order.pickup_deadline))) return []
    return now <= Date.parse(order.pickup_deadline) ? ['handover', 'issue'] : ['issue']
  }
  return []
}
export function shiftDifferences(shift: StaffShift) {
  const cash = Math.round((shift.actual_cash - shift.expected_cash) * 100) / 100
  const qr = Math.round((shift.actual_qr - shift.expected_qr) * 100) / 100
  return { cash, qr, total: Math.round((cash + qr) * 100) / 100, hasDifference: cash !== 0 || qr !== 0 }
}
export function canCloseShift(shift: StaffShift, managerNote = '') {
  return shift.status !== 'DA_CHOT' && (!shiftDifferences(shift).hasDifference || Boolean(shift.discrepancy_note?.trim() || managerNote.trim()))
}
export function requestMessage(error: any, fallback: string) {
  if (error?.response?.status === 429) return 'Máy chủ đang giới hạn lượt truy cập (429). Vui lòng chờ và thử lại sau, tránh bấm Làm mới liên tục.'
  return error?.response?.data?.message || (error?.code === 'ECONNABORTED' ? 'Máy chủ phản hồi chậm. Vui lòng thử lại.' : fallback)
}
