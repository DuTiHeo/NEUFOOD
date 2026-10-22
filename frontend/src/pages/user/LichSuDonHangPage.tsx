import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrderHistory } from '../../contexts/OrderHistoryContext'
import { formatVnd } from '../../utils/money'
import { formatOrderTime, orderStatusLabels } from '../../utils/orders'
import styles from '../../components/orders/Orders.module.css'

export default function LichSuDonHangPage() {
  const { orders, loading, error, refresh } = useOrderHistory()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  useEffect(() => {
    refresh()
    const timer = setInterval(() => { if (!document.hidden) refresh() }, 120000)
    return () => clearInterval(timer)
  }, [refresh])
  const filtered = orders.filter(order => (!status || order.status === status) && (order.id + ' ' + order.items.map(item => item.dish_name).join(' ')).toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')))
  const pages = Math.max(1, Math.ceil(filtered.length / 10))
  const current = Math.min(page, pages)
  return <main className={styles.page}>
    <div className={styles.row}><h1 className={styles.heading}>Lịch sử đơn hàng</h1><button className={styles.button} disabled={loading} onClick={refresh}>Làm mới</button></div>
    <label className={styles.field}>Tìm mã đơn hoặc tên món<input className={styles.input} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} /></label>
    <label className={styles.field}>Trạng thái<select className={styles.input} value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}><option value="">Tất cả</option>{Object.entries(orderStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {loading && <p role="status">Đang tải lịch sử…</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {!loading && !error && !filtered.length && <p>Chưa có đơn hàng phù hợp. <Link to="/menu">Đặt món</Link></p>}
    {filtered.slice((current - 1) * 10, current * 10).map(order => <article key={order.id} className={styles.panel}>
      <div className={styles.row}><Link to={'/don-hang/' + encodeURIComponent(order.id)}><strong>{order.id}</strong></Link><span className={styles.status}>{orderStatusLabels[order.status]}</span></div>
      <p>{formatOrderTime(order.created_at)} · {order.order_type === 'delivery' ? 'Giao tận nơi' : 'Nhận tại quầy'}</p>
      <p>{order.items.map(item => item.dish_name + ' × ' + item.quantity).join(', ')}</p>
      <p><strong>{formatVnd(order.total_amount)}</strong> · {order.payment_status === 'da_thanh_toan' ? 'Đã thanh toán' : 'Chưa thanh toán'}</p>
      <div className={styles.actions}><Link className={styles.button} to={'/don-hang/' + encodeURIComponent(order.id)}>Xem chi tiết</Link></div>
    </article>)}
    <div className={styles.actions}><button className={styles.button} disabled={current <= 1} onClick={() => setPage(current - 1)}>Trang trước</button><span>Trang {current}/{pages}</span><button className={styles.button} disabled={current >= pages} onClick={() => setPage(current + 1)}>Trang sau</button></div>
  </main>
}
