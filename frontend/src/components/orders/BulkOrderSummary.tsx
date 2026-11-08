import { Order } from '../../types/order'
import { formatVnd } from '../../utils/money'
export default function BulkOrderSummary({ order }: { order: Order }) {
  const p = order.bulk_pricing
  if (!p || p.eligible_servings === undefined) return null
  return <div>
    <p>Suất đủ điều kiện: {p.eligible_servings} · Giảm {p.discount_rate}%: {formatVnd(Number(p.discount_amount))}</p>
    {Number(p.deposit_amount) > 0 && <><p>Cọc mô phỏng: {formatVnd(Number(p.deposit_amount))}{p.deposit_status === 'cancelled' ? ' (đã hủy, không hoàn tiền thật)' : ' (không phải tiền chuyển khoản thật)'}</p>{p.deposit_status !== 'cancelled' && <p>{order.payment_status === 'da_thanh_toan' ? 'COD đã thu khi nhận' : 'COD còn lại khi nhận'}: <strong>{formatVnd(Number(order.cod_due ?? p.cod_due))}</strong></p>}</>}
  </div>
}
