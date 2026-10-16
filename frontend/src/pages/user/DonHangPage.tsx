import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Navigate, useParams } from 'react-router-dom'
import OrderReviewModal from '../../components/orders/OrderReviewModal'
import { useOrderHistory } from '../../contexts/OrderHistoryContext'
import { NEU_CAMPUS_MAP_EMBED_URL } from '../../data/campusMap'
import { resolveTrackingOrder } from '../../lib/resolveTrackingOrder'
import { appendReviewsFromOrder } from '../../lib/dishReviews'
import { getReviewForOrder, saveReviewForOrder } from '../../lib/orderReviews'
import styles from './DonHangPage.module.css'

function formatPrice(n) {
  return `${n.toLocaleString('vi-VN')}đ`
}

export default function DonHangPage() {
  const { orderId } = useParams()
  const { orders } = useOrderHistory()
  const view = useMemo(() => resolveTrackingOrder(orderId, orders), [orderId, orders])

  const [simPhase, setSimPhase] = useState('preparing')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRecord, setReviewRecord] = useState(null)
  const [reviewToast, setReviewToast] = useState(false)

  useEffect(() => {
    setReviewRecord(getReviewForOrder(orderId))
  }, [orderId])

  useEffect(() => {
    if (!view || view.status !== 'preparing') return
    setSimPhase('preparing')
    const t1 = setTimeout(() => setSimPhase('delivering'), 5000)
    const t2 = setTimeout(() => setSimPhase('delivered'), 10000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [view?.id, view?.status])

  useEffect(() => {
    if (!reviewToast) return
    const t = setTimeout(() => setReviewToast(false), 4500)
    return () => clearTimeout(t)
  }, [reviewToast])

  if (!orderId) {
    return <Navigate to="/lich-su-don" replace />
  }

  if (!view) {
    return <Navigate to="/lich-su-don" replace />
  }

  const displayPhase =
    view.status === 'delivered' ? 'delivered' : view.status === 'cancelled' ? 'cancelled' : simPhase

  const progress =
    displayPhase === 'preparing' ? 33 : displayPhase === 'delivering' ? 66 : displayPhase === 'delivered' ? 100 : 0

  const title =
    displayPhase === 'cancelled'
      ? 'Đơn hàng đã huỷ'
      : displayPhase === 'delivered'
        ? 'Đã giao hàng'
        : displayPhase === 'preparing'
          ? 'Đang chuẩn bị'
          : 'Đang giao hàng'

  const lead =
    displayPhase === 'cancelled'
      ? 'Đơn này không còn hiệu lực. Nếu đã thanh toán trước, tiền sẽ được hoàn theo chính sách.'
      : displayPhase === 'delivered'
        ? 'Cảm ơn bạn đã tin tưởng NEUFood. Chúc bạn ngon miệng!'
        : displayPhase === 'preparing'
          ? 'Nhà bếp đang hối hả chuẩn bị bữa ăn tuyệt vời nhất dành riêng cho bạn.'
          : 'Shipper đang trên đường tới địa chỉ của bạn. Chuẩn bị nhận món nhé!'

  const showLive = displayPhase !== 'cancelled' && displayPhase !== 'delivered'

  const canOpenReview = displayPhase === 'delivered' && !reviewRecord

  function handleReviewSaved(data) {
    saveReviewForOrder(orderId, data)
    appendReviewsFromOrder(orderId, view.items, data.starsByLine, data.comment, data.photosByLine)
    setReviewRecord(getReviewForOrder(orderId))
    setReviewOpen(false)
    setReviewToast(true)
  }

  return (
    <main class={styles.page}>
      {reviewToast && typeof document !== 'undefined'
        ? createPortal(
            <div className={styles.reviewToast} role="status">
              <span class={`material-symbols-outlined ${styles.reviewToastIco}`}>check_circle</span>
              Cảm ơn bạn đã đánh giá!
            </div>,
            document.body,
          )
        : null}

      {reviewOpen && canOpenReview ? (
        <OrderReviewModal
          orderId={orderId}
          items={view.items}
          onClose={() => setReviewOpen(false)}
          onSubmitReview={handleReviewSaved}
        />
      ) : null}

      <div class={`wrap ${styles.layout}`}>
        <div class={styles.main}>
          <Link class={styles.back} to="/lich-su-don">
            ← Lịch sử đơn
          </Link>
          <header class={styles.head}>
            {showLive ? (
              <div class={styles.live}>
                <span class={styles.ping}>
                  <span class={styles.pingDot} />
                </span>
                Cập nhật trực tiếp
              </div>
            ) : null}
            <h1 class={styles.title}>{title}</h1>
            <p class={styles.lead}>{lead}</p>
          </header>

          {displayPhase === 'cancelled' ? (
            <section class={styles.cancelBox} aria-label="Trạng thái đơn">
              <span class={`material-symbols-outlined ${styles.cancelIco}`}>cancel</span>
              <p class={styles.cancelTxt}>Mã đơn #{view.id}</p>
            </section>
          ) : (
            <section class={styles.track} aria-label="Tiến trình đơn hàng">
              <div class={styles.steps}>
                <div class={styles.line} aria-hidden>
                  <div class={styles.fill} style={{ width: `${progress}%` }} />
                </div>
                <div class={styles.step}>
                  <div class={`${styles.dot} ${styles.dotOn}`}>
                    <span class={`material-symbols-outlined ${styles.ico} ${styles.icoFill}`}>check</span>
                  </div>
                  <span class={styles.lbl}>Đã đặt</span>
                </div>
                <div class={styles.step}>
                  <div
                    class={`${styles.dot} ${
                      displayPhase === 'preparing'
                        ? `${styles.dotOn} ${styles.dotPulse}`
                        : displayPhase === 'delivering' || displayPhase === 'delivered'
                          ? styles.dotOn
                          : ''
                    }`}
                  >
                    {displayPhase === 'preparing' ? (
                      <span class={`material-symbols-outlined ${styles.ico}`}>restaurant</span>
                    ) : (
                      <span class={`material-symbols-outlined ${styles.ico} ${styles.icoFill}`}>check</span>
                    )}
                  </div>
                  <span class={styles.lbl}>Chuẩn bị</span>
                </div>
                <div class={styles.step}>
                  <div
                    class={`${styles.dot} ${
                      displayPhase === 'delivering'
                        ? `${styles.dotOn} ${styles.dotPulse}`
                        : displayPhase === 'delivered'
                          ? styles.dotOn
                          : ''
                    }`}
                  >
                    {displayPhase === 'delivered' ? (
                      <span class={`material-symbols-outlined ${styles.ico} ${styles.icoFill}`}>check</span>
                    ) : (
                      <span class={`material-symbols-outlined ${styles.ico}`}>delivery_dining</span>
                    )}
                  </div>
                  <span class={displayPhase === 'delivering' || displayPhase === 'delivered' ? styles.lbl : styles.lblOff}>
                    Đang giao
                  </span>
                </div>
                <div class={styles.step}>
                  <div class={`${styles.dot} ${displayPhase === 'delivered' ? styles.dotOn : ''}`}>
                    {displayPhase === 'delivered' ? (
                      <span class={`material-symbols-outlined ${styles.ico} ${styles.icoFill}`}>check</span>
                    ) : (
                      <span class={`material-symbols-outlined ${styles.ico}`}>inventory_2</span>
                    )}
                  </div>
                  <span class={displayPhase === 'delivered' ? styles.lbl : styles.lblOff}>Đã giao</span>
                </div>
              </div>
            </section>
          )}

          {displayPhase !== 'cancelled' ? (
            <section class={styles.map} aria-label="Bản đồ khuôn viên NEU">
              <iframe
                title="Bản đồ Đại học Kinh tế Quốc dân (NEU)"
                src={NEU_CAMPUS_MAP_EMBED_URL}
                class={styles.mapIframe}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div class={styles.mapGrad} aria-hidden />
              {showLive ? (
                <div class={styles.mapFoot}>
                  <div class={styles.glass}>
                    <div class={styles.drvPic}>
                      <img src={view.driver.photo} alt="" />
                    </div>
                    <div>
                      <p class={styles.drvLbl}>Shipper của bạn</p>
                      <p class={styles.drvName}>{view.driver.name}</p>
                    </div>
                  </div>
                  <div class={styles.shipBtns}>
                    <button type="button" class={`${styles.round} ${styles.roundPri}`} aria-label="Gọi shipper">
                      <span class="material-symbols-outlined">call</span>
                    </button>
                    <button type="button" class={`${styles.round} ${styles.roundSec}`} aria-label="Nhắn tin">
                      <span class="material-symbols-outlined">chat_bubble</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        <aside class={styles.aside}>
          <div class={styles.card}>
            <h2 class={styles.cardTitle}>Chi tiết đơn hàng #{view.id}</h2>
            <div class={styles.items}>
              {view.items.map((item, idx) => (
                <div key={`${view.id}-${idx}`} class={styles.row}>
                  <div class={styles.thumb}>
                    <img src={item.image} alt={item.name} />
                  </div>
                  <div class={styles.rowBody}>
                    <h3 class={styles.rowName}>{item.name}</h3>
                    {item.note ? <p class={styles.rowNote}>{item.note}</p> : null}
                    <div class={styles.rowFoot}>
                      <span class={styles.qty}>x{item.qty}</span>
                      <span class={styles.price}>{formatPrice(item.price * item.qty)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {view.orderNote ? (
                <p class={styles.orderNote}>
                  <span class="material-symbols-outlined">sticky_note_2</span>
                  Ghi chú: {view.orderNote}
                </p>
              ) : null}
              <div class={styles.bill}>
                <div class={styles.billRow}>
                  <span>Tạm tính</span>
                  <span>{formatPrice(view.subtotal)}</span>
                </div>
                {(view.discount ?? 0) > 0 ? (
                  <div class={styles.billRow}>
                    <span>Giảm giá Campus</span>
                    <span>-{formatPrice(view.discount)}</span>
                  </div>
                ) : null}
                <div class={styles.billRow}>
                  <span>Phí giao hàng</span>
                  <span>{formatPrice(view.shipFee)}</span>
                </div>
                <div class={styles.billTotal}>
                  <span>Tổng cộng</span>
                  <span class={styles.billSum}>{formatPrice(view.total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div class={styles.info}>
            <div class={styles.infoList}>
              <div class={styles.infoRow}>
                <span class="material-symbols-outlined">location_on</span>
                <div>
                  <p class={styles.infoLbl}>Địa chỉ nhận</p>
                  <p class={styles.infoTxt}>{view.address.line1}</p>
                  <p class={styles.infoSub}>{view.address.line2}</p>
                </div>
              </div>
              <div class={styles.infoRow}>
                <span class="material-symbols-outlined">schedule</span>
                <div>
                  <p class={styles.infoLbl}>Dự kiến giao</p>
                  <p class={styles.infoTxt}>{view.eta}</p>
                </div>
              </div>
            </div>
          </div>

          <div class={styles.act2}>
            <Link to="/menu" class={`${styles.actBtn} ${styles.actGhost}`}>
              <span class="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>
                replay
              </span>
              Đặt lại
            </Link>
            <button
              type="button"
              class={
                reviewRecord
                  ? `${styles.actBtn} ${styles.actDone}`
                  : `${styles.actBtn} ${styles.actPri}`
              }
              disabled={displayPhase === 'cancelled' || displayPhase !== 'delivered' || !!reviewRecord}
              title={
                displayPhase === 'cancelled'
                  ? 'Đơn đã huỷ'
                  : displayPhase !== 'delivered'
                    ? 'Chỉ đánh giá sau khi đơn ở trạng thái đã giao'
                    : reviewRecord
                      ? 'Bạn đã gửi đánh giá cho đơn này'
                      : undefined
              }
              onClick={() => {
                if (canOpenReview) setReviewOpen(true)
              }}
            >
              <span class={`material-symbols-outlined ${styles.icoFill}`} style={{ fontSize: '1.125rem' }}>
                {reviewRecord ? 'check_circle' : 'star'}
              </span>
              {reviewRecord ? 'Đã đánh giá' : 'Đánh giá'}
            </button>
          </div>
        </aside>
      </div>
    </main>
  )
}
