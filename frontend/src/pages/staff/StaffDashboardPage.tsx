import { useEffect, useState } from 'react'
import { ArrowUpRight, ClipboardList, Clock3, PackageCheck, Utensils, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { orderService } from '../../services/orderService'
import { shiftService, type CurrentShiftSummary } from '../../services/shiftService'
import type { Order } from '../../types/order'
import styles from './StaffPages.module.css'

const active = ['CHO_XAC_NHAN', 'DANG_CHUAN_BI', 'DANG_GIAO', 'SAN_SANG_LAY', 'GIAO_THAT_BAI']
const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`

export default function StaffDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [shift, setShift] = useState<CurrentShiftSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    let mounted = true
    Promise.allSettled([orderService.getAllOrdersAdmin({ page: 1, limit: 100 }), shiftService.getCurrentShift()]).then(([ordersResult, shiftResult]) => {
      if (!mounted) return
      const nextErrors: string[] = []
      if (ordersResult.status === 'fulfilled') setOrders(ordersResult.value.items)
      else nextErrors.push('Không tải được đơn hàng từ API.')
      if (shiftResult.status === 'fulfilled') setShift(shiftResult.value)
      else nextErrors.push('Không tải được thống kê ca hiện tại.')
      setErrors(nextErrors)
      setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  const pending = orders.filter((order) => order.status === 'CHO_XAC_NHAN').length
  const processing = orders.filter((order) => ['DANG_CHUAN_BI', 'DANG_GIAO', 'SAN_SANG_LAY', 'GIAO_THAT_BAI'].includes(order.status)).length
  const latest = orders.filter((order) => active.includes(order.status)).slice(0, 4)

  return <div className={styles.page}>
    <section className={styles.welcome}><div><span className={styles.eyebrow}>TỔNG QUAN CA LÀM</span><h2>Chào mừng bạn trở lại</h2><p>Tiếp nhận đơn đúng hạn, theo dõi tiến độ chế biến và bàn giao COD trong ca.</p></div><Link className={styles.primaryLink} to="/nhan-vien/don"><ClipboardList size={17} /> Mở hàng đợi đơn</Link></section>
    {errors.map((error) => <p className={styles.error} role="alert" key={error}>{error}</p>)}
    <section className={styles.metrics}>
      <article><span className={styles.metricIcon}><Clock3 size={19} /></span><small>Đơn mới cần nhận</small><strong>{loading ? '—' : pending}</strong><span>Phản hồi trong tối đa 10 phút</span></article>
      <article><span className={styles.metricIcon}><PackageCheck size={19} /></span><small>Đang xử lý</small><strong>{loading ? '—' : processing}</strong><span>Nấu, giao hoặc chờ khách đến lấy</span></article>
      <article><span className={styles.metricIcon}><Wallet size={19} /></span><small>Tiền COD trong ngày</small><strong>{shift ? money(shift.expected_cash + shift.expected_qr) : '—'}</strong><span>{shift?.total_orders_handled ?? 0} đơn đã giao trong ngày</span></article>
    </section>
    <section className={styles.grid}>
      <article className={styles.panel}><div className={styles.panelHead}><div><span className={styles.eyebrow}>ƯU TIÊN TIẾP THEO</span><h2>Đơn cần xử lý</h2></div><Link to="/nhan-vien/don">Tất cả đơn <ArrowUpRight size={15} /></Link></div>
        {loading ? <p className={styles.empty}>Đang tải dữ liệu ca…</p> : latest.length ? <div className={styles.orderPreview}>{latest.map((order) => <div key={order.id}><div><strong>#{order.id}</strong><span>{order.recipient_name} · {order.order_type === 'pickup' ? 'Nhận tại quầy' : 'Giao nội khu'}</span></div><b className={order.status === 'CHO_XAC_NHAN' ? styles.waiting : ''}>{order.status === 'CHO_XAC_NHAN' ? 'Chờ nhận' : order.status === 'DANG_CHUAN_BI' ? 'Đang chuẩn bị' : order.status === 'DANG_GIAO' ? 'Đang giao' : order.status === 'SAN_SANG_LAY' ? 'Chờ lấy' : 'Có sự cố'}</b></div>)}</div> : <p className={styles.empty}>Không có đơn đang hoạt động.</p>}
      </article>
      <aside className={styles.panel}><div className={styles.panelHead}><div><span className={styles.eyebrow}>THAO TÁC NHANH</span><h2>Trong ca hôm nay</h2></div></div><div className={styles.quickLinks}><Link to="/nhan-vien/don"><ClipboardList /><span><strong>Xử lý đơn hàng</strong><small>Nhận, chuyển trạng thái, bàn giao hoặc báo sự cố</small></span><ArrowUpRight /></Link><Link to="/nhan-vien/mon"><Utensils /><span><strong>Tình trạng món</strong><small>Bật hoặc tắt món còn phục vụ trong ngày</small></span><ArrowUpRight /></Link><Link to="/nhan-vien/ca"><Wallet /><span><strong>Chốt ca COD</strong><small>Đối chiếu tiền mặt và sao kê VietQR</small></span><ArrowUpRight /></Link></div></aside>
    </section>
  </div>
}
