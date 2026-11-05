import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import OrderReviewModal from '../../components/orders/OrderReviewModal'
import OrderComplaintModal from '../../components/orders/OrderComplaintModal'
import { useOrderHistory } from '../../contexts/OrderHistoryContext'
import { useDishes } from '../../contexts/DishesContext'
import { orderService } from '../../services/orderService'
import { reviewService } from '../../services/reviewService'
import { complaintService, Complaint } from '../../services/complaintService'
import { getDishImageUrl, handleDishImageError } from '../../utils/dishImages'
import { Order } from '../../types/order'
import Footer from '../../components/layout/Footer'
import styles from './DonHangPage.module.css'

function formatPrice(value: number) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`
}

const TERMINAL_STATUSES = new Set(['HOAN_THANH', 'DA_HUY_KHACH', 'TU_CHOI', 'TU_DONG_HUY', 'BO_DON_BLACKLIST', 'DA_GIAI_QUYET'])
const REVIEWABLE_STATUSES = new Set(['DA_GIAO', 'DA_BAN_GIAO', 'HOAN_THANH', 'DA_GIAI_QUYET'])
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
  const [complaintOpen, setComplaintOpen] = useState(false)
  const [complaintToast, setComplaintToast] = useState(false)
  const [complaintData, setComplaintData] = useState<Complaint | null>(null)
  const [loadingComplaint, setLoadingComplaint] = useState(false)
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

  // UC14 / BR-23: Cho phép tải và thực hiện đánh giá món cho các đơn ở REVIEWABLE_STATUSES (bao gồm DA_GIAI_QUYET)
  useEffect(() => {
    if (!order || !REVIEWABLE_STATUSES.has(order.status)) {
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

  // UC15 / BR-23: Lấy thông tin khiếu nại nếu đơn hàng đang ở trạng thái KHIEU_NAI hoặc DA_GIAI_QUYET
  useEffect(() => {
    if (!order || !['KHIEU_NAI', 'DA_GIAI_QUYET'].includes(order.status)) {
      setComplaintData(null)
      return
    }
    let active = true
    setLoadingComplaint(true)
    complaintService.getComplaintByOrderId(order.id)
      .then((res) => {
        if (active) setComplaintData(res)
      })
      .catch(() => {
        if (active) setComplaintData(null)
      })
      .finally(() => {
        if (active) setLoadingComplaint(false)
      })
    return () => { active = false }
  }, [order?.id, order?.status])

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

  useEffect(() => {
    if (!complaintToast) return
    const timer = window.setTimeout(() => setComplaintToast(false), 4000)
    return () => window.clearTimeout(timer)
  }, [complaintToast])

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
    return (
      <div className={styles.pageWrapper}>
        <main className={styles.page}><div className="wrap"><p role="status">Đang tải đơn hàng…</p></div></main>
        <Footer />
      </div>
    )
  }
  if (!order || error) {
    return (
      <div className={styles.pageWrapper}>
        <main className={styles.page}><div className="wrap"><p role="alert">{error || 'Không tìm thấy đơn hàng.'}</p><Link to="/lich-su-don">Về lịch sử đơn</Link></div></main>
        <Footer />
      </div>
    )
  }

  const isPickup = order.order_type === 'pickup'
  const isCancelled = ['DA_HUY_KHACH', 'TU_CHOI', 'TU_DONG_HUY', 'BO_DON_BLACKLIST'].includes(order.status)
  const isComplaintFlow = ['KHIEU_NAI', 'DA_GIAI_QUYET'].includes(order.status) || Boolean(complaintData)

  let title = STATUS_COPY[order.status]?.[0] || order.status
  let lead = STATUS_COPY[order.status]?.[1] || 'Trạng thái đơn hàng được cập nhật từ Canteen.'

  if (order.status === 'DA_GIAI_QUYET' && complaintData) {
    if (complaintData.status === 'CHAP_NHAN') {
      lead = 'Canteen đã chấp thuận khiếu nại của bạn và tiến hành giải quyết.'
    } else if (complaintData.status === 'TU_CHOI') {
      lead = 'Khiếu nại đã bị từ chối. Vui lòng xem phản hồi chi tiết từ Ban Quản lý bên dưới.'
    }
  }

  // Cấu hình các bước trong thanh tiến trình (4 bước thông thường, 5 bước khi có khiếu nại)
  let trackingSteps: Array<{
    label: string
    icon: string
    active: boolean
    variant?: 'brand' | 'success' | 'danger' | 'warning'
  }> = []

  let progress = 0

  if (isComplaintFlow) {
    // Với đơn có khiếu nại: 4 bước giao hàng trước đó đã hoàn thành
    const complaintStatus = complaintData?.status
    let complaintStep: {
      label: string
      icon: string
      active: boolean
      variant: 'brand' | 'success' | 'danger' | 'warning'
    }

    if (complaintStatus === 'CHAP_NHAN') {
      complaintStep = {
        label: 'Khiếu nại thành công',
        icon: 'verified',
        active: true,
        variant: 'success',
      }
    } else if (complaintStatus === 'TU_CHOI') {
      complaintStep = {
        label: 'Khiếu nại không thành công',
        icon: 'cancel',
        active: true,
        variant: 'danger',
      }
    } else if (complaintStatus === 'YEU_CAU_BO_SUNG') {
      complaintStep = {
        label: 'Cần bổ sung minh chứng',
        icon: 'pending_actions',
        active: true,
        variant: 'warning',
      }
    } else if (order.status === 'DA_GIAI_QUYET') {
      complaintStep = {
        label: 'Khiếu nại đã xử lý',
        icon: 'task_alt',
        active: true,
        variant: 'success',
      }
    } else {
      complaintStep = {
        label: 'Đang xử lý khiếu nại',
        icon: 'report_problem',
        active: true,
        variant: 'warning',
      }
    }

    trackingSteps = [
      { label: 'Đã đặt', icon: 'receipt_long', active: true },
      { label: 'Đang chuẩn bị', icon: 'restaurant', active: true },
      { label: isPickup ? 'Sẵn sàng lấy' : 'Đang giao', icon: isPickup ? 'storefront' : 'delivery_dining', active: true },
      { label: isPickup ? 'Đã bàn giao' : 'Đã giao', icon: 'check_circle', active: true },
      complaintStep,
    ]
    progress = 100
  } else {
    progress = isCancelled
      ? 0
      : DELIVERED_STATUSES.has(order.status)
      ? 100
      : order.status === 'CHO_XAC_NHAN'
      ? 0
      : order.status === 'DANG_CHUAN_BI'
      ? 33.33
      : 66.67

    trackingSteps = [
      { label: 'Đã đặt', icon: 'receipt_long', active: true },
      {
        label: 'Đang chuẩn bị',
        icon: 'restaurant',
        active: ['DANG_CHUAN_BI', 'DANG_GIAO', 'SAN_SANG_LAY', 'GIAO_THAT_BAI', ...DELIVERED_STATUSES].includes(order.status),
      },
      {
        label: isPickup ? 'Sẵn sàng lấy' : 'Đang giao',
        icon: isPickup ? 'storefront' : 'delivery_dining',
        active: ['DANG_GIAO', 'SAN_SANG_LAY', 'GIAO_THAT_BAI', ...DELIVERED_STATUSES].includes(order.status),
      },
      {
        label: isPickup ? 'Đã bàn giao' : 'Đã giao',
        icon: 'check_circle',
        active: DELIVERED_STATUSES.has(order.status),
      },
    ]
  }

  const canCancel = order.status === 'CHO_XAC_NHAN'
  const canConfirmReceipt = ['DA_GIAO', 'DA_BAN_GIAO'].includes(order.status)

  // BUG-03 (UC14, BR-23): Đơn DA_GIAI_QUYET được phép đánh giá món
  const canReview = REVIEWABLE_STATUSES.has(order.status) && reviewItems.length > 0

  // BUG-02 (UC15, BR-23, EX-14): Cho phép khiếu nại trong vòng 24 giờ sau khi giao/hoàn thành
  const deliveryTime = order.delivered_at || order.completed_at || order.created_at
  const within24Hours = deliveryTime
    ? (Date.now() - new Date(deliveryTime).getTime()) <= 24 * 60 * 60 * 1000
    : true
  const canComplain = ['DA_GIAO', 'DA_BAN_GIAO', 'HOAN_THANH'].includes(order.status) &&
    within24Hours &&
    order.status !== 'KHIEU_NAI' &&
    order.status !== 'DA_GIAI_QUYET'

  const hasPartnerAction = canCancel || canConfirmReceipt || canReview || canComplain
  const displayItems = order.items || []

  return (
    <div className={styles.pageWrapper}>
      <main className={styles.page}>
        {reviewToast ? <div className={styles.reviewToast} role="status">Đánh giá của bạn đã được gửi.</div> : null}
        {complaintToast ? <div className={styles.reviewToast} role="status">Khiếu nại của bạn đã được gửi tới Canteen.</div> : null}
        {reviewOpen && canReview ? <OrderReviewModal orderId={order.id} items={reviewItems} onClose={() => setReviewOpen(false)} onSubmitReview={submitReviews} /> : null}
        {complaintOpen && canComplain ? (
          <OrderComplaintModal
            orderId={order.id}
            onClose={() => setComplaintOpen(false)}
            onSuccess={() => {
              setComplaintToast(true)
              void loadOrder()
              void refreshHistory()
            }}
          />
        ) : null}
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
              <div className={`${styles.steps} ${trackingSteps.length === 5 ? styles.steps5 : ''}`}>
                <div className={styles.line}><div className={styles.fill} style={{ width: `${progress}%` }} /></div>
                {trackingSteps.map((step) => {
                  let dotClass = `${styles.dot} ${step.active ? styles.dotOn : ''}`
                  let lblClass = step.active ? styles.lbl : styles.lblOff
                  if (step.active && step.variant === 'success') {
                    dotClass = `${styles.dot} ${styles.dotSuccess}`
                    lblClass = styles.lblSuccess
                  } else if (step.active && step.variant === 'danger') {
                    dotClass = `${styles.dot} ${styles.dotDanger}`
                    lblClass = styles.lblDanger
                  } else if (step.active && step.variant === 'warning') {
                    dotClass = `${styles.dot} ${styles.dotWarning}`
                    lblClass = styles.lblWarning
                  }
                  return (
                    <div key={step.label} className={styles.step}>
                      <div className={dotClass}>
                        <span className={`material-symbols-outlined ${styles.ico}`}>{step.icon}</span>
                      </div>
                      <span className={lblClass}>{step.label}</span>
                    </div>
                  )
                })}
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

            {/* UC15 / BR-23: Hiển thị khối thông tin Khiếu nại nếu đơn hàng đang ở KHIEU_NAI hoặc DA_GIAI_QUYET */}
            {['KHIEU_NAI', 'DA_GIAI_QUYET'].includes(order.status) ? (
              <section className={styles.complaintCard} aria-label="Thông tin khiếu nại đơn hàng">
                <div className={styles.complaintHead}>
                  <h2 className={styles.complaintTitle}>
                    <span className="material-symbols-outlined" style={{ color: '#ea580c' }}>report_problem</span>
                    Thông tin khiếu nại
                  </h2>
                  {complaintData ? (
                    <span className={`${styles.complaintBadge} ${
                      complaintData.status === 'CHAP_NHAN' ? styles.complaintAccepted :
                      complaintData.status === 'TU_CHOI' ? styles.complaintRejected :
                      complaintData.status === 'YEU_CAU_BO_SUNG' ? styles.complaintMoreInfo :
                      styles.complaintPending
                    }`}>
                      {complaintData.status === 'CHAP_NHAN' ? 'Đã chấp nhận' :
                       complaintData.status === 'TU_CHOI' ? 'Từ chối khiếu nại' :
                       complaintData.status === 'YEU_CAU_BO_SUNG' ? 'Yêu cầu bổ sung' :
                       'Đang xử lý'}
                    </span>
                  ) : null}
                </div>
                {loadingComplaint ? (
                  <p style={{ margin: 0, color: 'var(--color-muted)' }}>Đang tải thông tin khiếu nại...</p>
                ) : complaintData ? (
                  <div className={styles.complaintBody}>
                    <div className={styles.complaintRow}>
                      <span className={styles.complaintLbl}>Lý do khiếu nại</span>
                      <p className={styles.complaintTxt}><strong>{complaintData.reason}</strong></p>
                    </div>
                    <div className={styles.complaintRow}>
                      <span className={styles.complaintLbl}>Mô tả của bạn</span>
                      <p className={styles.complaintTxt}>{complaintData.description}</p>
                    </div>
                    {complaintData.proof_image_url && (
                      <div className={styles.complaintRow}>
                        <span className={styles.complaintLbl}>Ảnh minh chứng</span>
                        <a href={complaintData.proof_image_url} target="_blank" rel="noopener noreferrer">
                          <img src={complaintData.proof_image_url} alt="Minh chứng" className={styles.complaintThumb} />
                        </a>
                      </div>
                    )}
                    {complaintData.admin_response && (
                      <div className={styles.adminResponseBox}>
                        <h3 className={styles.adminResponseTitle}>
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>support_agent</span>
                          Phản hồi từ Ban Quản lý NEUFood
                        </h3>
                        <p className={styles.adminResponseTxt}>{complaintData.admin_response}</p>
                        {complaintData.resolved_at && (
                          <p className={styles.adminResponseTime}>
                            Thời gian giải quyết: {new Date(complaintData.resolved_at).toLocaleString('vi-VN')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ margin: 0, color: 'var(--color-muted)' }}>Đơn hàng đang trong tiến trình khiếu nại.</p>
                )}
              </section>
            ) : null}

            <div className={styles.act2}>
              <Link to="/menu" className={`${styles.actBtn} ${styles.actGhost} ${hasPartnerAction ? '' : styles.reorderFull}`}>Đặt món khác</Link>
              {canCancel ? <button type="button" className={`${styles.actBtn} ${styles.actDanger}`} disabled={isWorking} onClick={() => window.confirm('Bạn muốn hủy đơn hàng này?') && void runOrderAction(() => orderService.cancelOrder(order.id))}>Hủy đơn</button> : null}
              {canConfirmReceipt ? <button type="button" className={`${styles.actBtn} ${styles.actPri}`} disabled={isWorking} onClick={() => void runOrderAction(() => orderService.confirmReceipt(order.id))}>{isWorking ? 'Đang cập nhật…' : 'Xác nhận đã nhận món'}</button> : null}
              {canReview ? <button type="button" className={`${styles.actBtn} ${styles.actPri}`} disabled={isWorking} onClick={() => setReviewOpen(true)}>Đánh giá món</button> : null}
              {canComplain ? (
                <button
                  type="button"
                  className={`${styles.actBtn} ${styles.actWarn}`}
                  disabled={isWorking}
                  onClick={() => setComplaintOpen(true)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>report_problem</span>
                  Khiếu nại đơn
                </button>
              ) : null}
              {REVIEWABLE_STATUSES.has(order.status) && reviewItems.length === 0 ? <div className={styles.reviewedBadge}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span><span>Đã đánh giá các món trong đơn hàng.</span></div> : null}
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
      </main>
      <Footer />
    </div>
  )
}
