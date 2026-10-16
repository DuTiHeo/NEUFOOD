import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../../contexts/CartContext'
import { useOrderHistory } from '../../contexts/OrderHistoryContext'
import styles from './ThanhToanPage.module.css'

function formatPrice(vnd) {
  return `${vnd.toLocaleString('vi-VN')}đ`
}

export default function ThanhToanPage() {
  const navigate = useNavigate()
  const { addOrder } = useOrderHistory()
  const { lines, totalCount, subtotal, clear } = useCart()
  const [payment, setPayment] = useState('transfer')
  const [submitting, setSubmitting] = useState(false)
  const [confirmError, setConfirmError] = useState('')
  const [selectedBuilding, setSelectedBuilding] = useState('')
  const [isLocationOpen, setIsLocationOpen] = useState(false)
  const [room, setRoom] = useState('')
  const [note, setNote] = useState('')
  const locationRef = useRef(null)
  const shipping = totalCount > 0 ? 10000 : 0
  const discount = totalCount > 0 ? 5000 : 0
  const total = Math.max(0, subtotal + shipping - discount)
  const deliveryLocations = [
    { value: 'A1', label: 'Giảng đường A1' },
    { value: 'A2', label: 'Giảng đường A2' },
    { value: 'B', label: 'Giảng đường B' },
    { value: 'C', label: 'Giảng đường C' },
    { value: 'D', label: 'Giảng đường D' },
    { value: 'E', label: 'Nhà văn hóa' },
    { value: 'F', label: 'Hội trường A2' },
    { value: 'G', label: 'Kí túc xá' },
    { value: 'H', label: 'Thư viện' },
  ]

  useEffect(() => {
    function handleClickOutside(event) {
      if (locationRef.current && !locationRef.current.contains(event.target)) {
        setIsLocationOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  async function handleConfirmOrder() {
    if (totalCount === 0 || submitting) return
    setConfirmError('')
    if (!selectedBuilding) {
      setConfirmError('Vui lòng chọn địa điểm giao hàng trước khi xác nhận.')
      return
    }
    setSubmitting(true)
    try {
      addOrder({
        lines,
        total,
        subtotal,
        shipping,
        discount,
        payment,
        selectedBuilding,
        room,
        note,
        deliveryLocations,
      })
      clear()
      navigate('/lich-su-don', { state: { orderPlaced: true } })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <main class={styles.pay}>
        <div class="wrap">
          <section class={styles.paySteps}>
            <div class={styles.steps}>
              <div class={styles.stepsItem}>
                <div class={`${styles.stepsDot} ${styles.stepsDotOk}`}>
                  <span class={`material-symbols-outlined material-symbols-fill ${styles.stepsIcon}`}>check_circle</span>
                </div>
                <span class={`${styles.stepsLbl} ${styles.stepsLblOn}`}>Giỏ hàng</span>
              </div>
              <div class={`${styles.stepsBar} ${styles.stepsBarOn}`} />
              <div class={styles.stepsItem}>
                <div class={`${styles.stepsDot} ${styles.stepsDotHere}`}>
                  <span class={styles.stepsNum}>2</span>
                </div>
                <span class={`${styles.stepsLbl} ${styles.stepsLblBold}`}>Thanh toán</span>
              </div>
              <div class={styles.stepsBar} />
              <div class={styles.stepsItem}>
                <div class={`${styles.stepsDot} ${styles.stepsDotOff}`}>
                  <span class={styles.stepsNum}>3</span>
                </div>
                <span class={`${styles.stepsLbl} ${styles.stepsLblOff}`}>Hoàn tất</span>
              </div>
            </div>
          </section>

          <div class={styles.payGrid}>
            <div class={styles.payLeft}>
              <div class={styles.card}>
                <div class={styles.cardHead}>
                  <span class={`material-symbols-outlined ${styles.cardIcon}`}>location_on</span>
                  <h2 class={styles.cardH}>Thông tin giao hàng</h2>
                </div>
                <div class={styles.cardBody}>
                  <div class={styles.field}>
                    <span class={styles.fieldLbl}> Địa điểm giao hàng</span>
                    <div class={styles.locationSelect} ref={locationRef}>
                      <button
                        type="button"
                        class={styles.locationToggle}
                        onClick={() => setIsLocationOpen((prev) => !prev)}
                        aria-expanded={isLocationOpen}
                      >
                        <span>{deliveryLocations.find((item) => item.value === selectedBuilding)?.label ?? 'Chọn địa điểm giao hàng'}</span>
                        <span class={`material-symbols-outlined ${isLocationOpen ? styles.locationChevronOpen : ''}`}>expand_more</span>
                      </button>

                      {isLocationOpen ? (
                        <div class={styles.locationMenu}>
                          <button
                            type="button"
                            class={selectedBuilding === '' ? `${styles.locationItem} ${styles.locationItemActive}` : styles.locationItem}
                            onClick={() => {
                              setSelectedBuilding('')
                              setIsLocationOpen(false)
                            }}
                          >
                            Chọn địa điểm giao hàng
                          </button>
                          {deliveryLocations.map((location) => (
                            <button
                              key={location.value}
                              type="button"
                              class={selectedBuilding === location.value ? `${styles.locationItem} ${styles.locationItemActive}` : styles.locationItem}
                              onClick={() => {
                                setSelectedBuilding(location.value)
                                setIsLocationOpen(false)
                              }}
                            >
                              {location.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <label class={styles.field}>
                    <span class={styles.fieldLbl}>Phòng học / Vị trí cụ thể (Ví dụ: A101, B203)</span>
                    <input class={styles.fieldInput} id="room" type="text" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Nhập số phòng học của bạn..." />
                  </label>
                  <label class={styles.field}>
                    <span class={styles.fieldLbl}>Ghi chú</span>
                    <textarea class={styles.fieldArea} id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Ít cay, thêm đá, để ở bàn bảo vệ..." rows={3} />
                  </label>
                </div>
              </div>

              <div class={styles.card}>
                <div class={styles.cardHead}>
                  <span class={`material-symbols-outlined ${styles.cardIcon}`}>account_balance_wallet</span>
                  <h2 class={styles.cardH}>Phương thức thanh toán</h2>
                </div>
                <div class={styles.payOpts}>
                  <label class={payment === 'cash' ? `${styles.payOpt} ${styles.payOptOn}` : styles.payOpt}>
                    <input class="sr-only" type="radio" name="payment" value="cash" checked={payment === 'cash'} onChange={() => setPayment('cash')} />
                    <div class={styles.payOptIco}>
                      <span class="material-symbols-outlined">payments</span>
                    </div>
                    <div>
                      <p class={styles.payOptT}>Tiền mặt</p>
                      <p class={styles.payOptD}>Thanh toán khi nhận hàng</p>
                    </div>
                    <span class={payment === 'cash' ? `${styles.payOptRing} ${styles.payOptRingOn}` : styles.payOptRing} />
                  </label>
                  <label class={payment === 'transfer' ? `${styles.payOpt} ${styles.payOptOn}` : styles.payOpt}>
                    <input class="sr-only" type="radio" name="payment" value="transfer" checked={payment === 'transfer'} onChange={() => setPayment('transfer')} />
                    <div class={styles.payOptIco}>
                      <span class="material-symbols-outlined">qr_code_2</span>
                    </div>
                    <div>
                      <p class={styles.payOptT}>Chuyển khoản (QR)</p>
                      <p class={styles.payOptD}>Quét mã nhanh chóng</p>
                    </div>
                    <span class={payment === 'transfer' ? `${styles.payOptRing} ${styles.payOptRingOn}` : styles.payOptRing} />
                  </label>
                </div>

                {payment === 'transfer' ? (
                  <div class={styles.qr}>
                    <div class={styles.qrImg}>
                      <img
                        alt="QR thanh toán"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuBzmpJ6Yzy-8CIuFOtTul9dVhEGHNhtJqTSmW46lfAQNj3pKPXvohOWqbSzAcBcGpGRr4FiJCcD8nMIXou5TPyOeEesWaUsyYDh4ZXQxZnTPZH6iYO-DuL6VpFCMQ0LqbAz3h2GVU9VTkgsS1Y1Qhx-aegL3Ut8T4smSvrB4cNDfrfGtPnlvDhUOygAtDurMzrFfeve_iNpQK68VVBFdk7Fh9BfFB0EybmACihauiKdlRTL1U09guXUeFOthmpRODV6lysfikx1Cjs"
                      />
                    </div>
                    <div class={styles.qrTxt}>
                      <h3 class={styles.qrH}>Quét mã để thanh toán</h3>
                      <ul class={styles.qrList}>
                        <li>
                          <span class={styles.qrDot} />
                          Mở ứng dụng ngân hàng hoặc ví điện tử
                        </li>
                        <li>
                          <span class={styles.qrDot} />
                          Chọn quét mã QR và quét mã bên trái
                        </li>
                        <li>
                          <span class={styles.qrDot} />
                          Kiểm tra số tiền và nội dung chuyển khoản
                        </li>
                      </ul>
                      <span class={styles.qrTag}>Tự động xác nhận</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <aside class={styles.paySide}>
              <div class={styles.bill}>
                <div class={styles.billHead}>
                  <h2 class={styles.billTitle}>Chi tiết đơn hàng</h2>
                  <p class={styles.billHint}>Sẽ được giao trong vòng 15-20 phút</p>
                </div>
                <div class={styles.billBody}>
                  <div class={styles.billLines}>
                    {lines.length > 0 ? (
                      lines.map((line) => (
                        <div class={styles.billLine} key={line.dish.id}>
                          <div class={styles.billThumb}>
                            <img alt={line.dish.name} src={line.dish.image} />
                          </div>
                          <div class={styles.billMid}>
                            <h4 class={styles.billName}>{line.dish.name}</h4>
                            <p class={styles.billMeta}>x{line.qty}</p>
                          </div>
                          <p class={styles.billP}>{formatPrice(line.dish.price * line.qty)}</p>
                        </div>
                      ))
                    ) : (
                      <p class={styles.billMeta}>Giỏ hàng đang trống.</p>
                    )}
                  </div>
                  <div class={styles.billSep} />
                  <div class={styles.billRows}>
                    <div class={styles.billRow}>
                      <span>Tạm tính ({totalCount} món)</span>
                      <span class={styles.billRowInk}>{formatPrice(subtotal)}</span>
                    </div>
                    <div class={styles.billRow}>
                      <span>Phí giao hàng</span>
                      <span class={styles.billRowInk}>{formatPrice(shipping)}</span>
                    </div>
                    <div class={styles.billRow}>
                      <span>Giảm giá Campus</span>
                      <span class={styles.billRowDanger}>-{formatPrice(discount)}</span>
                    </div>
                  </div>
                  <div class={styles.billSep} />
                  <div class={styles.billSum}>
                    <div>
                      <span class={styles.billSumL}>Tổng cộng</span>
                      <p class={styles.billVat}>Bao gồm thuế VAT</p>
                    </div>
                    <span class={styles.billSumN}>{formatPrice(total)}</span>
                  </div>
                  {confirmError ? (
                    <p class={styles.billErr} role="alert">
                      {confirmError}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    class={styles.billGo}
                    disabled={totalCount === 0 || submitting}
                    onClick={handleConfirmOrder}
                  >
                    <span class="material-symbols-outlined material-symbols-fill">shopping_bag</span>
                    {submitting ? 'Đang xử lý…' : 'Xác nhận đặt hàng'}
                  </button>
                  <p class={styles.billLegal}>
                    Bằng việc nhấn đặt hàng, bạn đã đồng ý với các{' '}
                    <Link class={styles.billLegalLink} to="/thanh-toan">
                      Điều khoản &amp; Chính sách
                    </Link>{' '}
                    của NEUFood.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <footer class={styles.payFoot}>
        <div class={`wrap ${styles.payFootInner}`}>
          <div class={styles.payFootBrand}>NEUFood</div>
          <div class={styles.payFootLinks}>
            <a href="#">Support</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Campus Map</a>
          </div>
          <div class={styles.payFootCopy}>© 2024 NEUFood Campus Dining. All rights reserved.</div>
        </div>
      </footer>
    </>
  )
}
