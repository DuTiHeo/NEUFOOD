import type { Order } from '../../types/order'
import { formatVnd } from '../../utils/money'
import { formatOrderTime, orderStatusLabels } from '../../utils/orders'
import styles from './Orders.module.css'

export default function OrderDetails({ order, showSuffix = false }: { order: Order; showSuffix?: boolean }) {
  return <section className={styles.panel} aria-label={`Chi tiết ${order.id}`}>
    <div className={styles.row}><h2 className={styles.heading}>{order.id}</h2><strong className={styles.status}>{orderStatusLabels[order.status] || order.status}</strong></div>
    <p>{order.order_type === 'delivery' ? 'Giao tận nơi' : 'Nhận tại quầy'} · {order.recipient_name} · {order.recipient_phone}</p>
    <p>{order.delivery_address}</p>
    <p className={styles.muted}>Đặt lúc {formatOrderTime(order.created_at)}</p>
    {order.is_preorder && <p>Hẹn nhận: {formatOrderTime(order.scheduled_at)}</p>}
    {order.delivery_note && <p>Ghi chú: {order.delivery_note}</p>}
    {order.cancelled_reason && <p>Lý do hủy/từ chối: {order.cancelled_reason}</p>}
    {order.pickup_deadline && ['SAN_SANG_LAY', 'GIAO_THAT_BAI'].includes(order.status) && <p>Hạn nhận tại quầy: {formatOrderTime(order.pickup_deadline)}. Quá hạn nhận hoặc từ chối thanh toán COD sẽ bị khóa đặt COD.</p>}
    {showSuffix && <p>Mã đối chiếu khi nhận hàng: <span className={styles.code}>{order.order_code_suffix}</span></p>}
    <div className={styles.tableWrap}><table className={styles.table}>
      <thead><tr><th>Món</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
      <tbody>{order.items.map(item => <tr key={item.id}><td>{item.dish_name}{item.note && <p>{item.note}</p>}</td><td>{item.quantity}</td><td>{formatVnd(item.unit_price)}</td><td>{formatVnd(item.subtotal)}</td></tr>)}</tbody>
    </table></div>
    <p>Tạm tính: {formatVnd(order.subtotal_amount)} · Phí giao: {formatVnd(order.ship_fee)}</p>
    <p><strong>Tổng cộng: {formatVnd(order.total_amount)}</strong></p>
    <p>{order.payment_method === 'cod_cash' ? 'Tiền mặt khi nhận hàng' : 'VietQR khi nhận hàng'} · {order.payment_status === 'da_thanh_toan' ? 'Đã thanh toán' : 'Chưa thanh toán'}</p>
    {order.delivered_at && <p>Đã bàn giao lúc {formatOrderTime(order.delivered_at)}</p>}
    {order.auto_complete_at && ['DA_GIAO', 'DA_BAN_GIAO'].includes(order.status) && <p className={styles.muted}>Tự hoàn thành sau {formatOrderTime(order.auto_complete_at)} nếu không có khiếu nại.</p>}
    {order.completed_at && <p>Hoàn thành lúc {formatOrderTime(order.completed_at)}</p>}
  </section>
}
