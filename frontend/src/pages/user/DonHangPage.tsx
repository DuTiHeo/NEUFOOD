import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import OrderReviewModal from '../../components/orders/OrderReviewModal'
import { useOrderHistory } from '../../contexts/OrderHistoryContext'
import { useDishes } from '../../contexts/DishesContext'
import { orderService } from '../../services/orderService'
import { reviewService } from '../../services/reviewService'
import { getDishImageUrl, handleDishImageError } from '../../utils/dishImages'
import { Order } from '../../types/order'
import Footer from '../../components/layout/Footer'
import styles from './DonHangPage.module.css'

function formatPrice(value: number) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`
}

const TERMINAL_STATUSES = new Set(['HOAN_THANH', 'DA_HUY_KHACH', 'TU_CHOI', 'TU_DONG_HUY', 'BO_DON_BLACKLIST', 'DA_GIAI_QUYET'])
const DELIVERED_STATUSES = new Set(['DA_GIAO', 'DA_BAN_GIAO', 'HOAN_THANH'])

const STATUS_COPY = {
  CHO_XAC_NHAN: ['Chờ Canteen xác nhận', 'Canteen sẽ tiếp nhận hoặc từ chối đơn trong thời hạn xử lý.'],
  DANG_CHUAN_BI: ['Đang chuẩn bị món', 'Canteen đã xác nhận và đang chuẩn bị món cho bạn.'],
  DANG_GIAO: ['Đang giao hàng', 'Nhân viên đang giao đơn đến địa điểm bạn đã chọn.'],
  SAN_SANG_LAY: ['Sẵn sàng lấy món', 'Món đã sẵn sàng tại quầy trả món Canteen A2.'],
  GIAO_THAT_BAI: ['Đơn đang được giữ tại quầy', 'Vui lòng liên hệ Canteen và đến nhận trong thời hạn hiển thị.'],
  DA_GIAO: ['Đã giao hàng', 'Đơn đã được bàn giao và thanh toán COD.'],
  DA_BAN_GIAO: ['Đã nhận tại quầy', 'Đơn đã được bàn giao và thanh toán COD.'],
  HOAN_THANH: ['Đơn hàng hoàn tất', 'Cảm ơn bạn đã đặt món tại NEUFood.'],
  KHIEU_NAI: ['Đang xử lý khiếu nại', 'Canteen đang tiếp nhận yêu cầu của bạn.'],
  DA_GIAI_QUYET: ['Khiếu nại đã được xử lý', 'Kết quả xử lý đã được cập nhật cho đơn hàng.'],
  DA_HUY_KHACH: ['Đơn hàng đã hủy', 'Đơn được hủy theo yêu cầu của bạn.'],
  TU_CHOI: ['Canteen chưa thể nhận đơn', 'Đơn đã bị từ chối. Vui lòng xem lại ghi chú hoặc đặt món khác.'],
  TU_DONG_HUY: ['Đơn hàng tự động hủy', 'Đơn quá thời hạn xác nhận của Canteen.'],
  BO_DON_BLACKLIST: ['Đơn đã kết thúc', 'Đơn đã được đóng theo quy trình nhận hàng COD.'],
}

export default function DonHangPage() {
  const { orderId } = useParams()
  const { refresh: refreshHistory } = useOrderHistory()
  const { getById } = useDishes()
  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [isWorking, setIsWorking] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewedDishIds, setReviewedDishIds] = useState<string[]>([])
  const [reviewToast, setReviewToast] = useState(false)
  const reviewFetchKey = useRef('')

  const loadOrder = useCallback(async () => {
    if (!orderId) return
    try {
      const result = await orderService.getOrderById(orderId)
      setOrder(result)
      setError('')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể tải chi tiết đơn hàng.')
    } finally {
      setIsLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    setIsLoading(true)
    void loadOrder()
  }, [loadOrder])

  useEffect(() => {
    if (!order || !DELIVERED_STATUSES.has(order.status)) {
      reviewFetchKey.current = ''
      setReviewedDishIds([])
      return
    }
    const key = `${order.id}:${order.status}`
    if (reviewFetchKey.current === key) return
    reviewFetchKey.current = key
    let active = true
    const items = order.items || []
    Promise.all(items.map((item) => item.dish_id
      ? reviewService.getDishReviews(item.dish_id).catch(() => [])
      : Promise.resolve([])))
      .then((reviewLists) => {
        if (!active) return
        const reviewed = new Set<string>()
        reviewLists.forEach((reviews, index) => {
          if (reviews.some((review) => review.order_id === order.id)) {
            const dishId = items[index]?.dish_id
            if (dishId) reviewed.add(dishId)
          }
        })
        setReviewedDishIds([...reviewed])
      })
    return () => { active = false }
  }, [order])

  useEffect(() => {
    if (!order || TERMINAL_STATUSES.has(order.status)) return
    const timer = window.setInterval(() => void loadOrder(), 15000)
    return () => window.clearInterval(timer)
  }, [order, loadOrder])

  useEffect(() => {
    if (!reviewToast) return
    const timer = window.setTimeout(() => setReviewToast(false), 4000)
    return () => window.clearTimeout(timer)
  }, [reviewToast])

  const reviewItems = useMemo(
    () => (order?.items || [])
      .filter((item) => item.dish_id && !reviewedDishIds.includes(item.dish_id))
      .map((item) => ({ dishId: item.dish_id, name: item.dish_name || item.name || 'Món ăn', qty: item.quantity || item.qty || 1 })),
    [order, reviewedDishIds],
  )

  if (!orderId) return <Navigate to="/lich-su-don" replace />

  async function runOrderAction(action: () => Promise<Order>) {
    setActionError('')
    setIsWorking(true)
    try {
      setOrder(await action())
      void refreshHistory()
    } catch (actionFailure: any) {
      setActionError(actionFailure?.response?.data?.message || 'Không thể cập nhật đơn hàng. Vui lòng thử lại.')
      void loadOrder()
    } finally {
      setIsWorking(false)
    }
  }

  async function submitReviews(data: { starsByLine: number[]; comment: string }) {
    if (!order) return
    setIsWorking(true)
    setActionError('')
    try {
      await Promise.all(reviewItems.map((item, index) => reviewService.createReview({
        order_id: order.id,
        dish_id: item.dishId,
        rating: data.starsByLine[index],
        ...(data.comment.trim() ? { comment: data.comment.trim() } : {}),
      })))
      setReviewedDishIds((previous) => [...new Set([...previous, ...reviewItems.map((item) => item.dishId)])])
      setReviewOpen(false)
      setReviewToast(true)
    } catch (reviewError: any) {
      setActionError(reviewError?.response?.data?.message || 'Không gửi được đánh giá. Vui lòng thử lại.')
      throw reviewError
    } finally {
      setIsWorking(false)
    }
  }

  if (isLoading) {
    return <main className={styles.page}><div className="wrap"><p role="status">Đang tải đơn hàng…</p></div><Footer /></main>
  }
  if (!order || error) {
    return <main className={styles.page}><div className="wrap"><p role="alert">{error || 'Không tìm thấy đơn hàng.'}</p><Link to="/lich-su-don">Về lịch sử đơn</Link></div><Footer /></main>
  }

  const isPickup = order.order_type === 'pickup'
  const [title, lead] = STATUS_COPY[order.status] || [order.status, 'Trạng thái đơn hàng được cập nhật từ Canteen.']
  const isCancelled = ['DA_HUY_KHACH', 'TU_CHOI', 'TU_DONG_HUY', 'BO_DON_BLACKLIST'].includes(order.status)
  const progress = isCancelled ? 0 : DELIVERED_STATUSES.has(order.status) ? 100 : order.status === 'CHO_XAC_NHAN' ? 25 : order.status === 'DANG_CHUAN_BI' ? 50 : 75
  const canCancel = order.status === 'CHO_XAC_NHAN'
  const canConfirmReceipt = ['DA_GIAO', 'DA_BAN_GIAO'].includes(order.status)
  const canReview = DELIVERED_STATUSES.has(order.status) && reviewItems.length > 0
  const displayItems = order.items || []

  return (
    <main className={styles.page}>
      {reviewToast ? <div className={styles.reviewToast} role="status">Đánh giá của bạn đã được gửi.</div> : null}
      {reviewOpen && canReview ? <OrderReviewModal orderId={order.id} items={reviewItems} onClose={() => setReviewOpen(false)} onSubmitReview={submitReviews} /> : null}
      <div className={`wrap ${styles.layout}`}>
        <div className={styles.main}>
          <Link className={styles.back} to="/lich-su-don">← Lịch sử đơn</Link>
          <header className={styles.head}>
            {!TERMINAL_STATUSES.has(order.status) ? <div className={styles.live}><span className={styles.ping}><span className={styles.pingDot} /></span>Cập nhật từ Canteen</div> : null}
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.lead}>{lead}</p>
            <p>Mã đơn <strong>#{order.id}</strong> · Mã bàn giao <strong>{order.order_code_suffix}</strong></p>
          </header>

          {actionError ? <p role="alert" className={styles.cancelTxt}>{actionError}</p> : null}

          <section className={styles.track} aria-label="Tiến trình đơn hàng">
            <div className={styles.steps}>
              <div className={styles.line}><div className={styles.fill} style={{ width: `${progress}%` }} /></div>
              {[
                { label: 'Đã đặt', icon: 'receipt_long', active: true },
                { label: 'Đang chuẩn bị', icon: 'restaurant', active: ['DANG_CHUAN_BI', 'DANG_GIAO', 'SAN_SANG_LAY', 'GIAO_THAT_BAI', ...DELIVERED_STATUSES].includes(order.status) },
                { label: isPickup ? 'Sẵn sàng lấy' : 'Đang giao', icon: isPickup ? 'storefront' : 'delivery_dining', active: ['DANG_GIAO', 'SAN_SANG_LAY', 'GIAO_THAT_BAI', ...DELIVERED_STATUSES].includes(order.status) },
                { label: isPickup ? 'Đã bàn giao' : 'Đã giao', icon: 'check_circle', active: DELIVERED_STATUSES.has(order.status) },
              ].map((step) => (
                <div key={step.label} className={styles.step}>
                  <div className={`${styles.dot} ${step.active ? styles.dotOn : ''}`}><span className={`material-symbols-outlined ${styles.ico}`}>{step.icon}</span></div>
                  <span className={step.active ? styles.lbl : styles.lblOff}>{step.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.info}>
            <h2 className={styles.cardTitle}>Thông tin nhận món</h2>
            <div className={styles.infoList}>
              <div className={styles.infoRow}><span className="material-symbols-outlined">{isPickup ? 'storefront' : 'location_on'}</span><div><p className={styles.infoLbl}>{isPickup ? 'Địa điểm nhận' : 'Địa điểm giao'}</p><p className={styles.infoTxt}>{isPickup ? 'Quầy trả món Canteen A2' : order.delivery_address || 'Khuôn viên NEU'}</p>{order.room_detail ? <p className={styles.infoSub}>{order.room_detail}</p> : null}</div></div>
              <div className={styles.infoRow}><span className="material-symbols-outlined">payments</span><div><p className={styles.infoLbl}>COD</p><p className={styles.infoTxt}>{order.payment_method === 'cod_vietqr' ? 'VietQR khi nhận món' : 'Tiền mặt khi nhận món'} · {order.payment_status === 'da_thanh_toan' ? 'Đã thanh toán' : 'Chưa thanh toán'}</p></div></div>
              {order.pickup_deadline ? <div className={styles.infoRow}><span className="material-symbols-outlined">schedule</span><div><p className={styles.infoLbl}>Thời hạn nhận</p><p className={styles.infoTxt}>{new Date(order.pickup_deadline).toLocaleString('vi-VN')}</p></div></div> : null}
            </div>
          </section>

          <div className={styles.act2}>
            {canCancel ? <button type="button" className={`${styles.actBtn} ${styles.actGhost}`} disabled={isWorking} onClick={() => window.confirm('Bạn muốn hủy đơn hàng này?') && void runOrderAction(() => orderService.cancelOrder(order.id))}>Hủy đơn</button> : null}
            {canConfirmReceipt ? <button type="button" className={`${styles.actBtn} ${styles.actPri}`} disabled={isWorking} onClick={() => void runOrderAction(() => orderService.confirmReceipt(order.id))}>{isWorking ? 'Đang cập nhật…' : 'Xác nhận đã nhận món'}</button> : null}
            <Link to="/menu" className={`${styles.actBtn} ${styles.actGhost}`}>Đặt món khác</Link>
            {canReview ? <button type="button" className={`${styles.actBtn} ${styles.actPri}`} disabled={isWorking} onClick={() => setReviewOpen(true)}>Đánh giá món</button> : null}
            {DELIVERED_STATUSES.has(order.status) && reviewItems.length === 0 ? <span>Đã đánh giá các món trong đơn.</span> : null}
          </div>
        </div>

        <aside className={styles.aside}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Chi tiết đơn hàng</h2>
            <div className={styles.items}>
              {displayItems.map((item, index) => {
                const dish = getById(item.dish_id)
                const quantity = item.quantity || item.qty || 0
                const price = item.unit_price ?? item.price ?? 0
                return <div key={`${item.dish_id || item.id}-${index}`} className={styles.row}><div className={styles.thumb}><img src={getDishImageUrl(dish || { id: String(item.dish_id || item.id || '') })} alt="" onError={handleDishImageError} /></div><div className={styles.rowBody}><h3 className={styles.rowName}>{item.dish_name || item.name}</h3>{item.note ? <p className={styles.rowNote}>{item.note}</p> : null}<div className={styles.rowFoot}><span className={styles.qty}>×{quantity}</span><span className={styles.price}>{formatPrice(price * quantity)}</span></div></div></div>
              })}
              <div className={styles.bill}>
                <div className={styles.billRow}><span>Tạm tính</span><span>{formatPrice(order.subtotal_amount || 0)}</span></div>
                <div className={styles.billRow}><span>Phí giao hàng</span><span>{formatPrice(order.ship_fee || 0)}</span></div>
                <div className={styles.billTotal}><span>Tổng cộng</span><span className={styles.billSum}>{formatPrice(order.total_amount || 0)}</span></div>
              </div>
            </div>
          </div>
        </aside>
      </div>
      <Footer />
    </main>
  )
}
