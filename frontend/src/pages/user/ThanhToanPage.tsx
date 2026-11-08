import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../../contexts/CartContext'
import { useAuth } from '../../contexts/AuthContext'
import { useOrderHistory } from '../../contexts/OrderHistoryContext'
import { locationService, CampusLocation } from '../../services/locationService'
import { settingsService } from '../../services/settingsService'
import { dishService } from '../../services/dishService'
import { OrderingPolicy, orderService } from '../../services/orderService'
import { getDishImageUrl, handleDishImageError } from '../../utils/dishImages'
import { CreateOrderPayload, OrderType, PaymentMethod, Order } from '../../types/order'
import { orderingTimeError, scheduleBounds, scheduleInstant, vietnamDateTime } from '../../utils/orderingTime'
import { portionSummary } from '../../utils/portions'
import DepositReview from '../../components/orders/DepositReview'
import { calculateBulk, DEPOSIT_NOTICE } from '../../utils/bulkPricing'
import Footer from '../../components/layout/Footer'
import styles from './ThanhToanPage.module.css'

function formatPrice(value: number) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`
}

function getErrorMessage(error: any) {
  const response = error?.response?.data
  const code = Array.isArray(response?.errors)
    ? response.errors.find((item: any) => item?.code)?.code
    : undefined
  return [response?.message || error?.message || 'Không thể tạo đơn hàng.', code ? `(${code})` : '']
    .filter(Boolean)
    .join(' ')
}


export default function ThanhToanPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { refresh: refreshOrders } = useOrderHistory()
  const { lines, totalCount, subtotal, clear, unavailableLines, getQty } = useCart()
  const [orderType, setOrderType] = useState<OrderType>('delivery')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod_cash')
  const [recipientName, setRecipientName] = useState(user?.full_name || '')
  const [recipientPhone, setRecipientPhone] = useState(user?.phone_number || '')
  const [locations, setLocations] = useState<CampusLocation[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [roomDetail, setRoomDetail] = useState('')
  const [deliveryNote, setDeliveryNote] = useState('')
  const [isPreorder, setIsPreorder] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  useEffect(() => {
    try {
      const saved=JSON.parse(sessionStorage.getItem('neufood-checkout-from-chat') || 'null')
      sessionStorage.removeItem('neufood-checkout-from-chat')
      if(saved?.owner !== user?.id || !saved?.summary) return
      const s=saved.summary
      setOrderType(s.order_type === 'pickup' ? 'pickup' : 'delivery');setPaymentMethod(s.payment_method === 'cod_vietqr' ? 'cod_vietqr' : 'cod_cash')
      setRecipientName(s.recipient_name || '');setRecipientPhone(s.recipient_phone || '');setSelectedLocationId(String(s.campus_location_id || ''));setRoomDetail(s.room_detail || '');setDeliveryNote(s.delivery_note || '')
      setIsPreorder(Boolean(s.is_preorder));setScheduledAt(s.scheduled_at ? vietnamDateTime(Date.parse(s.scheduled_at)).slice(0,16) : '')
    } catch { /* Invalid handoff data is ignored; the server validates checkout. */ }
  }, [user?.id])
  const [deliveryFee, setDeliveryFee] = useState(5000)
  const [maxDishQuantity, setMaxDishQuantity] = useState(50)
  const [policy, setPolicy] = useState<OrderingPolicy | null>(null)
  const [clock, setClock] = useState({ epoch: 0, monotonic: 0 })
  const [, setTick] = useState(0)
  const [policyError, setPolicyError] = useState('')
  useEffect(() => {
    let active = true
    async function loadPolicy() {
      try {
        const loaded = await orderService.getPolicy()
        if (active) {
          setPolicy(loaded)
          setClock({ epoch: Date.parse(loaded.server_now), monotonic: performance.now() })
          setPolicyError('')
        }
      } catch {
        if (active) setPolicyError('Không tải được khung giờ đặt đơn. Vui lòng tải lại trang.')
      }
    }
    void loadPolicy()
    const timer = window.setInterval(() => setTick(value => value + 1), 1000)
    const refreshTimer = window.setInterval(loadPolicy, 60000)
    window.addEventListener('focus', loadPolicy)
    return () => { active = false; window.clearInterval(timer); window.clearInterval(refreshTimer); window.removeEventListener('focus', loadPolicy) }
  }, [])
  const [loadingLocations, setLoadingLocations] = useState(true)
  const [locationError, setLocationError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmError, setConfirmError] = useState('')
  const [review, setReview] = useState<{ quote: Order; payload: CreateOrderPayload } | null>(null)
  const fingerprint = JSON.stringify([lines, orderType, recipientName, recipientPhone, selectedLocationId, roomDetail, deliveryNote, isPreorder, scheduledAt, paymentMethod])
  useEffect(() => { setReview(null) }, [fingerprint])

  useEffect(() => {
    if (!recipientName && user?.full_name) setRecipientName(user.full_name)
    if (!recipientPhone && user?.phone_number) setRecipientPhone(user.phone_number)
  }, [user, recipientName, recipientPhone])

  useEffect(() => {
    let active = true
    setLoadingLocations(true)
    Promise.allSettled([locationService.getLocations(), settingsService.getSettings()]).then(([locationsResult, settingsResult]) => {
      if (!active) return
      if (locationsResult.status === 'fulfilled') {
        setLocations(locationsResult.value.filter((location) => location.is_active))
        setLocationError('')
      } else {
        setLocationError('Không tải được danh sách địa điểm. Hãy thử tải lại trước khi đặt giao tận nơi.')
      }
      if (settingsResult.status === 'fulfilled') {
        const config = Object.fromEntries(settingsResult.value.map((setting) => [setting.setting_key, setting.setting_value]))
        const fee = Number(config.delivery_fee)
        const quantityLimit = Number(config.max_dish_quantity_per_order)
        setDeliveryFee(Number.isFinite(fee) && fee >= 0 ? fee : 5000)
        setMaxDishQuantity(Math.min(50, Number.isFinite(quantityLimit) && quantityLimit > 0 ? quantityLimit : 50))

      }
      setLoadingLocations(false)
    })
    return () => { active = false }
  }, [])

  const selectedLocation = locations.find((location) => String(location.id) === selectedLocationId)
  const pricing = calculateBulk(subtotal, lines.reduce((n,l)=>n+Number(l.dish.eligible_servings || 0)*l.qty,0), orderType === 'delivery' && totalCount > 0 ? deliveryFee : 0)
  const shipping = pricing.shipping_fee
  const total = pricing.total_amount
  const serverNow = clock.epoch + performance.now() - clock.monotonic
  const bounds = policy ? scheduleBounds(policy, serverNow) : { min: '', max: '' }
  const timeError = policyError || orderingTimeError(policy, serverNow, isPreorder, scheduledAt)
  const phoneIsValid = /^0[35789]\d{8}$/.test(recipientPhone.trim())
  const overDishQuantityLimit = lines.some((line) => getQty(line.dish.id) > maxDishQuantity)

  async function handleConfirmOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (totalCount === 0 || submitting) return
    setConfirmError('')

    if (unavailableLines.length > 0) {
      setConfirmError('Giỏ hàng có món đã hết. Hãy xóa món đó rồi thử lại.')
      return
    }
    if (!recipientName.trim() || recipientName.trim().length < 2) {
      setConfirmError('Vui lòng nhập họ tên người nhận.')
      return
    }
    if (!phoneIsValid) {
      setConfirmError('Số điện thoại nhận hàng cần có 10 chữ số và bắt đầu bằng số 0.')
      return
    }
    if (orderType === 'delivery' && !selectedLocation) {
      setConfirmError('Vui lòng chọn một địa điểm đang phục vụ trong khuôn viên NEU.')
      return
    }
    const currentTimeError = policyError || orderingTimeError(policy, clock.epoch + performance.now() - clock.monotonic, isPreorder, scheduledAt)
    if (currentTimeError) { setConfirmError(currentTimeError); return }
    if (overDishQuantityLimit) {
      setConfirmError(`Mỗi món chỉ được đặt tối đa ${maxDishQuantity} phần theo cấu hình hiện tại.`)
      return
    }
    setSubmitting(true)
    try {
      const cartCheck = await dishService.validateCart(lines.map((line) => line.dish.id))
      if (!cartCheck.is_valid) {
        const unavailableNames = cartCheck.unavailable_dishes.map((dish) => dish.name).join(', ')
        setConfirmError(unavailableNames ? `Món vừa hết hàng: ${unavailableNames}. Hãy cập nhật giỏ hàng.` : 'Một số món trong giỏ không còn khả dụng.')
        return
      }

      const payload: CreateOrderPayload = {
        order_type: orderType,
        recipient_name: recipientName.trim(),
        recipient_phone: recipientPhone.trim(),
        campus_location_id: orderType === 'delivery' ? Number(selectedLocationId) : null,
        room_detail: orderType === 'delivery' ? roomDetail.trim() || null : null,
        delivery_note: deliveryNote.trim() || null,
        is_preorder: isPreorder,
        scheduled_at: isPreorder ? new Date(scheduleInstant(scheduledAt)).toISOString() : null,
        payment_method: paymentMethod,
        items: lines.map(({ dish, qty, note, portions, unitPrice }) => ({ dish_id: dish.id, quantity: qty, note, portions, expected_unit_price: unitPrice })),
      }
      const quote = await orderService.quoteOrder(payload)
      if (Number(quote.bulk_pricing?.deposit_amount) > 0 || Number(quote.total_amount) !== total) {
        setReview({ quote, payload }); return
      }
      await finishOrder({ ...payload, expected_pricing: quote.bulk_pricing })
    } catch (error) {
      setConfirmError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function finishOrder(payload: CreateOrderPayload) {
    const order = await orderService.createOrder(payload)
    clear(); void refreshOrders()
    navigate(`/don-hang/${order.id}`, { state: { orderPlaced: true } })
  }
  async function confirmReview() {
    if (!review || submitting) return
    setSubmitting(true); setConfirmError('')
    try { await finishOrder({ ...review.payload, expected_pricing: review.quote.bulk_pricing, deposit_token: review.quote.deposit_token }) }
    catch (error) { setConfirmError(getErrorMessage(error)); setReview(null) }
    finally { setSubmitting(false) }
  }

  if (totalCount === 0) {
    return (
      <>
        <main className={styles.pay}>
          <div className="wrap">
            <h1 className={styles.billTitle}>Giỏ hàng đang trống</h1>
            <Link to="/menu" className={styles.billGo}>Quay lại thực đơn</Link>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <main className={styles.pay}>
        <div className="wrap">
          <section className={styles.paySteps}>
            <div className={styles.steps}>
              <div className={styles.stepsItem}><span className={`${styles.stepsDot} ${styles.stepsDotOk}`}>1</span><span className={styles.stepsLbl}>Giỏ hàng</span></div>
              <div className={`${styles.stepsBar} ${styles.stepsBarOn}`} />
              <div className={styles.stepsItem}><span className={`${styles.stepsDot} ${styles.stepsDotHere}`}>2</span><span className={styles.stepsLbl}>Thông tin đặt hàng</span></div>
              <div className={styles.stepsBar} />
              <div className={styles.stepsItem}><span className={styles.stepsDot}>3</span><span className={styles.stepsLbl}>Hoàn tất</span></div>
            </div>
          </section>

          <form className={styles.payGrid} onSubmit={handleConfirmOrder}>
            <div className={styles.payLeft}>
              <section className={styles.card}>
                <div className={styles.cardHead}><span className={`material-symbols-outlined ${styles.cardIcon}`}>person</span><h2 className={styles.cardH}>Thông tin người nhận</h2></div>
                <div className={styles.cardBody}>
                  <div className={styles.field}>
                    <label htmlFor="recipientName" className={styles.fieldLbl}>Họ và tên <span className="text-red-500">*</span></label>
                    <input id="recipientName" className={styles.fieldInput} value={recipientName} onChange={(event) => setRecipientName(event.target.value)} autoComplete="name" minLength={2} maxLength={150} required />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="recipientPhone" className={styles.fieldLbl}>Số điện thoại <span className="text-red-500">*</span></label>
                    <input id="recipientPhone" className={styles.fieldInput} type="tel" inputMode="numeric" autoComplete="tel" pattern="0[0-9]{9}" maxLength={10} value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value)} placeholder="0912345678" required />
                  </div>
                </div>
              </section>

              <section className={styles.card}>
                <div className={styles.cardHead}><span className={`material-symbols-outlined ${styles.cardIcon}`}>location_on</span><h2 className={styles.cardH}>Hình thức nhận món</h2></div>
                <div className={styles.payOpts} role="radiogroup" aria-label="Hình thức nhận món">
                  <label className={orderType === 'delivery' ? `${styles.payOpt} ${styles.payOptOn}` : styles.payOpt}>
                    <input className="sr-only" type="radio" name="orderType" checked={orderType === 'delivery'} onChange={() => setOrderType('delivery')} />
                    <span className="material-symbols-outlined">delivery_dining</span><span><strong>Giao tận nơi</strong><br />Giao tới tòa nhà/phòng trong NEU</span>
                  </label>
                  <label className={orderType === 'pickup' ? `${styles.payOpt} ${styles.payOptOn}` : styles.payOpt}>
                    <input className="sr-only" type="radio" name="orderType" checked={orderType === 'pickup'} onChange={() => setOrderType('pickup')} />
                    <span className="material-symbols-outlined">storefront</span><span><strong>Nhận tại quầy</strong><br />Canteen A2, phí giao hàng 0đ</span>
                  </label>
                </div>
                {orderType === 'delivery' ? (
                  <div className={styles.cardBody}>
                    <div className={styles.field}>
                      <label htmlFor="campusLocation" className={styles.fieldLbl}>Tòa nhà <span className="text-red-500">*</span></label>
                      <select id="campusLocation" className={styles.fieldInput} value={selectedLocationId} onChange={(event) => setSelectedLocationId(event.target.value)} required disabled={loadingLocations || Boolean(locationError)}>
                        <option value="">{loadingLocations ? 'Đang tải địa điểm…' : 'Chọn địa điểm đang phục vụ'}</option>
                        {locations.map((location) => <option key={location.id} value={location.id}>{location.building_name} ({location.building_code})</option>)}
                      </select>
                      {locationError ? <p role="alert">{locationError}</p> : null}
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="roomDetail" className={styles.fieldLbl}>Phòng / vị trí cụ thể</label>
                      <input id="roomDetail" className={styles.fieldInput} value={roomDetail} onChange={(event) => setRoomDetail(event.target.value)} maxLength={100} placeholder={selectedLocation?.default_room_note || 'Ví dụ: phòng 502, tầng 5'} />
                    </div>
                  </div>
                ) : null}
                <div className={styles.cardBody}>
                  <label className={styles.fieldLbl}>
                    <input type="checkbox" checked={isPreorder} onChange={(event) => setIsPreorder(event.target.checked)} />{' '}
                    Hẹn trước thời gian nhận (tối thiểu {policy?.min_lead_minutes || 30} phút)
                  </label>
                  <p>Canteen phục vụ thứ Hai–thứ Bảy, nghỉ Chủ nhật. Thời gian theo giờ Việt Nam (UTC+7). {policy && `Đặt ngay: ${policy.open_time}–${policy.order_cutoff_time}; phục vụ/hẹn nhận: ${policy.open_time}–${policy.close_time}.`}</p>
                  {policy?.exempt_hours && <p>Tài khoản kiểm thử được miễn khung giờ và ngày nghỉ Chủ nhật; vẫn áp dụng thời gian hẹn tối thiểu và giới hạn ngày.</p>}
                  {timeError && <p role="status">{timeError}</p>}
                  {isPreorder ? <div className={styles.field}><label htmlFor="scheduledAt" className={styles.fieldLbl}>Thời gian nhận</label><input id="scheduledAt" className={styles.fieldInput} type="datetime-local" min={bounds.min} max={bounds.max} value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required /></div> : null}
                  <div className={styles.field}>
                    <label htmlFor="deliveryNote" className={styles.fieldLbl}>Ghi chú cho Canteen</label>
                    <textarea className={styles.fieldArea} id="deliveryNote" value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} placeholder="Ví dụ: gọi trước khi giao, ít cay…" rows={3} />
                  </div>
                </div>
              </section>

              <section className={styles.card}>
                <div className={styles.cardHead}><span className={`material-symbols-outlined ${styles.cardIcon}`}>payments</span><h2 className={styles.cardH}>Thanh toán khi nhận hàng (COD)</h2></div>
                <div className={styles.payOpts} role="radiogroup" aria-label="Phương thức thanh toán COD">
                  <label className={paymentMethod === 'cod_cash' ? `${styles.payOpt} ${styles.payOptOn}` : styles.payOpt}>
                    <input className="sr-only" type="radio" name="paymentMethod" checked={paymentMethod === 'cod_cash'} onChange={() => setPaymentMethod('cod_cash')} />
                    <span className="material-symbols-outlined">payments</span><span><strong>Tiền mặt</strong><br />Thanh toán cho nhân viên khi nhận</span>
                  </label>
                  <label className={paymentMethod === 'cod_vietqr' ? `${styles.payOpt} ${styles.payOptOn}` : styles.payOpt}>
                    <input className="sr-only" type="radio" name="paymentMethod" checked={paymentMethod === 'cod_vietqr'} onChange={() => setPaymentMethod('cod_vietqr')} />
                    <span className="material-symbols-outlined">qr_code_2</span><span><strong>VietQR</strong><br />Quét mã với nhân viên khi nhận món</span>
                  </label>
                </div>
              </section>
            </div>

            <aside className={styles.paySide}>
              <section className={styles.bill}>
                <div className={styles.billHead}><h2 className={styles.billTitle}>Chi tiết đơn hàng</h2><p className={styles.billHint}>{orderType === 'pickup' ? 'Nhận tại quầy Canteen A2' : 'Giao trong khuôn viên NEU'}</p></div>
                <div className={styles.billBody}>
                  <div className={styles.billLines}>
                    {lines.map(({ dish, qty, lineId, unitPrice, snapshot, note }) => <div className={styles.billLine} key={lineId}><div className={styles.billThumb}><img alt="" src={getDishImageUrl(dish)} onError={handleDishImageError} /></div><div className={styles.billMid}><h4 className={styles.billName}>{dish.name}</h4><p className={styles.billMeta}>x{qty}</p><p className={styles.billMeta}>{portionSummary(snapshot)}{note ? ` · ${note}` : ''}</p></div><p className={styles.billP}>{formatPrice(unitPrice * qty)}</p></div>)}
                  </div>
                  <div className={styles.billSep} />
                  <div className={styles.billRows}>
                    <div className={styles.billRow}><span>Giá gốc ({totalCount} phần)</span><span className={styles.billRowInk}>{formatPrice(subtotal)}</span></div>
                    <div className={styles.billRow}><span>Giảm giá{pricing.discount_rate > 0 ? ` (${pricing.discount_rate}%)` : ''}</span><span className={styles.billRowInk}>{pricing.discount_amount > 0 ? '−' : ''}{formatPrice(pricing.discount_amount)}</span></div>
                    <div className={styles.billRow}><span>Phí ship</span><span className={styles.billRowInk}>{orderType === 'delivery' && pricing.eligible_servings >= 5 ? 'Miễn phí' : formatPrice(shipping)}</span></div>
                  </div>
                  <div className={styles.billSep} />
                  {pricing.eligible_servings >= 5 && (orderType === 'delivery' || pricing.discount_rate > 0) && (
                    <p>{pricing.discount_rate > 0 ? `Đơn hàng được giảm giá ${pricing.discount_rate}%` : 'Đơn hàng được freeship'}{pricing.discount_rate > 0 && orderType === 'delivery' ? ' + freeship' : ''}</p>
                  )}
                  {pricing.deposit_amount > 0 && <><p><em>{DEPOSIT_NOTICE}</em></p><p>Cọc mô phỏng 50%: {formatPrice(pricing.deposit_amount)} · Còn {formatPrice(pricing.cod_due)} thanh toán COD khi nhận.</p></>}
                  <div className={styles.billSum}><div><span className={styles.billSumL}>Tổng thanh toán</span><p className={styles.billVat}>COD, thanh toán khi bàn giao</p></div><span className={styles.billSumN}>{formatPrice(total)}</span></div>
                  {overDishQuantityLimit ? <p className={styles.billErr} role="alert">Mỗi món tối đa {maxDishQuantity} phần theo cấu hình hiện tại.</p> : null}
                  {confirmError ? <p className={styles.billErr} role="alert">{confirmError}</p> : null}
                  <button type="submit" className={styles.billGo} disabled={submitting || Boolean(timeError) || unavailableLines.length > 0 || overDishQuantityLimit || (orderType === 'delivery' && (loadingLocations || Boolean(locationError)))}>
                    <span className="material-symbols-outlined material-symbols-fill">shopping_bag</span>{submitting ? 'Đang gửi đơn…' : pricing.deposit_amount > 0 ? 'Đặt cọc' : 'Xác nhận đặt hàng'}
                  </button>
                  <Link to="/gio-hang" className={styles.billLegalLink}>Quay lại giỏ hàng</Link>
                </div>
              </section>
            </aside>
          </form>
        </div>
      </main>
      {review && <DepositReview quote={review.quote} busy={submitting} error={confirmError} onClose={()=>setReview(null)} onConfirm={()=>void confirmReview()} />}
      <Footer />
    </>
  )
}
