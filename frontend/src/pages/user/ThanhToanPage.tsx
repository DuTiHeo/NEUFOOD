import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../../contexts/CartContext'
import { useAuth } from '../../contexts/AuthContext'
import { useOrderHistory } from '../../contexts/OrderHistoryContext'
import { locationService, CampusLocation } from '../../services/locationService'
import { settingsService } from '../../services/settingsService'
import { dishService } from '../../services/dishService'
import { orderService } from '../../services/orderService'
import { getDishImageUrl, handleDishImageError } from '../../utils/dishImages'
import { CreateOrderPayload, OrderType, PaymentMethod } from '../../types/order'
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

function toLocalDateTimeValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export default function ThanhToanPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { refresh: refreshOrders } = useOrderHistory()
  const { lines, totalCount, subtotal, clear, unavailableLines } = useCart()
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
  const [deliveryFee, setDeliveryFee] = useState(5000)
  const [maxCodAmount, setMaxCodAmount] = useState(500000)
  const [maxDishQuantity, setMaxDishQuantity] = useState(10)
  const [minLeadMinutes, setMinLeadMinutes] = useState(30)
  const [canteenOpenTime, setCanteenOpenTime] = useState('06:30')
  const [canteenCloseTime, setCanteenCloseTime] = useState('19:30')
  const [loadingLocations, setLoadingLocations] = useState(true)
  const [locationError, setLocationError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmError, setConfirmError] = useState('')

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
        const codLimit = Number(config.max_cod_amount)
        const quantityLimit = Number(config.max_dish_quantity_per_order)
        const leadTime = Number(config.min_preorder_lead_minutes)
        setDeliveryFee(Number.isFinite(fee) && fee >= 0 ? fee : 5000)
        setMaxCodAmount(Math.min(500000, Number.isFinite(codLimit) && codLimit >= 0 ? codLimit : 500000))
        setMaxDishQuantity(Math.min(10, Number.isFinite(quantityLimit) && quantityLimit > 0 ? quantityLimit : 10))
        setMinLeadMinutes(Math.max(30, Number.isFinite(leadTime) && leadTime > 0 ? leadTime : 30))
        if (config.canteen_open_time) setCanteenOpenTime(config.canteen_open_time)
        if (config.canteen_close_time) setCanteenCloseTime(config.canteen_close_time)
      }
      setLoadingLocations(false)
    })
    return () => { active = false }
  }, [])

  const selectedLocation = locations.find((location) => String(location.id) === selectedLocationId)
  const shipping = orderType === 'delivery' && totalCount > 0 ? deliveryFee : 0
  const total = subtotal + shipping
  const minimumSchedule = useMemo(() => toLocalDateTimeValue(new Date(Date.now() + minLeadMinutes * 60_000)), [minLeadMinutes])
  const phoneIsValid = /^0[35789]\d{8}$/.test(recipientPhone.trim())
  const overCodLimit = total > maxCodAmount
  const overDishQuantityLimit = lines.some((line) => line.qty > maxDishQuantity)

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
      setConfirmError('Số điện thoại nhận hàng cần có 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09.')
      return
    }
    if (orderType === 'delivery' && !selectedLocation) {
      setConfirmError('Vui lòng chọn một địa điểm đang phục vụ trong khuôn viên NEU.')
      return
    }
    if (isPreorder && (!scheduledAt || new Date(scheduledAt).getTime() < Date.now() + minLeadMinutes * 60_000)) {
      setConfirmError(`Đơn hẹn trước cần cách thời điểm hiện tại ít nhất ${minLeadMinutes} phút.`)
      return
    }
    if (overCodLimit) {
      setConfirmError(`Đơn COD không được vượt quá ${formatPrice(maxCodAmount)}. Vui lòng giảm số lượng món.`)
      return
    }
    if (overDishQuantityLimit) {
      setConfirmError(`Mỗi món chỉ được đặt tối đa ${maxDishQuantity} phần theo cấu hình hiện tại.`)
      return
    }
    if (isPreorder) {
      const selectedDate = new Date(scheduledAt)
      const selectedMinutes = selectedDate.getHours() * 60 + selectedDate.getMinutes()
      const [openHour, openMinute] = canteenOpenTime.split(':').map(Number)
      const [closeHour, closeMinute] = canteenCloseTime.split(':').map(Number)
      const openMinutes = openHour * 60 + openMinute
      const closeMinutes = closeHour * 60 + closeMinute
      const isWithinOpeningHours = openMinutes < closeMinutes
        ? selectedMinutes >= openMinutes && selectedMinutes < closeMinutes
        : openMinutes !== closeMinutes && (selectedMinutes >= openMinutes || selectedMinutes < closeMinutes)
      if (!isWithinOpeningHours) {
        setConfirmError(`Thời gian hẹn phải nằm trong giờ mở cửa Canteen (${canteenOpenTime}–${canteenCloseTime}).`)
        return
      }
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
        scheduled_at: isPreorder ? new Date(scheduledAt).toISOString() : null,
        payment_method: paymentMethod,
        items: lines.map(({ dish, qty }) => ({ dish_id: dish.id, quantity: qty })),
      }
      const order = await orderService.createOrder(payload)
      clear()
      void refreshOrders()
      navigate(`/don-hang/${order.id}`, { state: { orderPlaced: true } })
    } catch (error) {
      setConfirmError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  if (totalCount === 0) {
    return (
      <main className={styles.pay}>
        <div className="wrap">
          <h1 className={styles.billTitle}>Giỏ hàng đang trống</h1>
          <Link to="/menu" className={styles.billGo}>Quay lại thực đơn</Link>
        </div>
        <Footer />
      </main>
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
                    <input id="recipientPhone" className={styles.fieldInput} type="tel" inputMode="numeric" autoComplete="tel" pattern="0[35789][0-9]{8}" maxLength={10} value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value)} placeholder="0912345678" required />
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
                    Hẹn trước thời gian nhận (tối thiểu {minLeadMinutes} phút)
                  </label>
                  {isPreorder ? <div className={styles.field}><label htmlFor="scheduledAt" className={styles.fieldLbl}>Thời gian nhận</label><input id="scheduledAt" className={styles.fieldInput} type="datetime-local" min={minimumSchedule} value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required /></div> : null}
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
                    {lines.map(({ dish, qty }) => <div className={styles.billLine} key={dish.id}><div className={styles.billThumb}><img alt="" src={getDishImageUrl(dish)} onError={handleDishImageError} /></div><div className={styles.billMid}><h4 className={styles.billName}>{dish.name}</h4><p className={styles.billMeta}>x{qty}</p></div><p className={styles.billP}>{formatPrice(dish.price * qty)}</p></div>)}
                  </div>
                  <div className={styles.billSep} />
                  <div className={styles.billRows}>
                    <div className={styles.billRow}><span>Tạm tính ({totalCount} phần)</span><span className={styles.billRowInk}>{formatPrice(subtotal)}</span></div>
                    <div className={styles.billRow}><span>Phí giao hàng</span><span className={styles.billRowInk}>{formatPrice(shipping)}</span></div>
                  </div>
                  <div className={styles.billSep} />
                  <div className={styles.billSum}><div><span className={styles.billSumL}>Tổng thanh toán</span><p className={styles.billVat}>COD, thanh toán khi bàn giao</p></div><span className={styles.billSumN}>{formatPrice(total)}</span></div>
                  {overCodLimit ? <p className={styles.billErr} role="alert">Đơn COD tối đa {formatPrice(maxCodAmount)}.</p> : null}
                  {overDishQuantityLimit ? <p className={styles.billErr} role="alert">Mỗi món tối đa {maxDishQuantity} phần theo cấu hình hiện tại.</p> : null}
                  {confirmError ? <p className={styles.billErr} role="alert">{confirmError}</p> : null}
                  <button type="submit" className={styles.billGo} disabled={submitting || unavailableLines.length > 0 || overCodLimit || overDishQuantityLimit || (orderType === 'delivery' && (loadingLocations || Boolean(locationError)))}>
                    <span className="material-symbols-outlined material-symbols-fill">shopping_bag</span>{submitting ? 'Đang gửi đơn…' : 'Xác nhận đặt hàng'}
                  </button>
                  <Link to="/gio-hang" className={styles.billLegalLink}>Quay lại giỏ hàng</Link>
                </div>
              </section>
            </aside>
          </form>
        </div>
      </main>
      <Footer />
    </>
  )
}
