import type { Order, OrderStatus, DeliveryIssue } from '../types/order'

export const orderStatusLabels: Record<OrderStatus, string> = {
  CHO_XAC_NHAN: 'Chờ xác nhận', DANG_CHUAN_BI: 'Đang chuẩn bị', DANG_GIAO: 'Đang giao',
  SAN_SANG_LAY: 'Sẵn sàng lấy món', DA_GIAO: 'Đã giao', DA_BAN_GIAO: 'Đã bàn giao',
  GIAO_THAT_BAI: 'Giao thất bại — giữ tại quầy', HOAN_THANH: 'Hoàn thành', DA_HUY_KHACH: 'Khách đã hủy',
  TU_CHOI: 'Canteen từ chối', TU_DONG_HUY: 'Tự hủy do quá hạn', BO_DON_BLACKLIST: 'Bỏ đơn — Blacklist COD',
  KHIEU_NAI: 'Đang khiếu nại', DA_GIAI_QUYET: 'Đã giải quyết khiếu nại',
}
export const activeOrderStatuses: OrderStatus[] = ['CHO_XAC_NHAN', 'DANG_CHUAN_BI', 'DANG_GIAO', 'SAN_SANG_LAY', 'GIAO_THAT_BAI']
export const receivedOrderStatuses: OrderStatus[] = ['DA_GIAO', 'DA_BAN_GIAO']
export function canHandover(order: Order) {
  return order.payment_status === 'chua_thanh_toan' && (
    (order.order_type === 'delivery' && ['DANG_GIAO', 'GIAO_THAT_BAI'].includes(order.status)) ||
    (order.order_type === 'pickup' && order.status === 'SAN_SANG_LAY'))
}
export function allowedIssues(order: Order, now = Date.now()): DeliveryIssue[] {
  if (!canHandover(order)) return []
  const issues: DeliveryIssue[] = ['refuse_payment']
  if (order.status === 'DANG_GIAO') issues.unshift('no_answer')
  if (['SAN_SANG_LAY', 'GIAO_THAT_BAI'].includes(order.status) && order.pickup_deadline && now > Date.parse(order.pickup_deadline)) issues.push('pickup_timeout')
  return issues
}
export function orderError(error: any): string {
  const response = error?.response?.data
  const detail = Array.isArray(response?.errors) ? response.errors.find((entry: any) => entry.msg)?.msg : null
  return detail ? `${response.message}: ${detail}` : response?.message || 'Không thể kết nối. Vui lòng thử lại.'
}
export function formatOrderTime(value: string | null) {
  return value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—'
}
