const DAY = 86400000
const VIETNAM_OFFSET = 7 * 3600000
export const vietnamDateTime = ms => new Date(ms + VIETNAM_OFFSET).toISOString().slice(0, 19)
export const scheduleInstant = value => Date.parse(`${value}+07:00`)
export const isClosedDay = (policy, ms) => (policy.closed_weekdays || [7]).includes(new Date(ms + VIETNAM_OFFSET).getUTCDay() || 7)

export function scheduleBounds(policy, now) {
  let minimum = Math.ceil((now + policy.min_lead_minutes * 60000) / 60000) * 60000
  if (!policy.exempt_hours) {
    const day = vietnamDateTime(minimum).slice(0, 10)
    if (minimum > scheduleInstant(`${day}T${policy.close_time}:00`)) minimum = scheduleInstant(`${vietnamDateTime(minimum + DAY).slice(0,10)}T${policy.open_time}:00`)
    else minimum = Math.max(minimum, scheduleInstant(`${day}T${policy.open_time}:00`))
    while (isClosedDay(policy, minimum)) minimum = scheduleInstant(`${vietnamDateTime(minimum + DAY).slice(0,10)}T${policy.open_time}:00`)
  }
  const lastDay = vietnamDateTime(now + policy.max_days * DAY).slice(0, 10)
  return { min: vietnamDateTime(minimum).slice(0,16), max: `${lastDay}T${policy.exempt_hours ? '23:59' : policy.close_time}` }
}

export function orderingTimeError(policy, now, isPreorder, value) {
  if (!policy) return 'Đang tải khung giờ đặt đơn. Vui lòng thử lại.'
  if (isPreorder) {
    const scheduled = scheduleInstant(value)
    if (!Number.isFinite(scheduled) || scheduled < now + policy.min_lead_minutes * 60000) return `Giờ hẹn phải cách lúc đặt ít nhất ${policy.min_lead_minutes} phút.`
    const day = vietnamDateTime(scheduled).slice(0,10)
    const lastDay = vietnamDateTime(now + policy.max_days * DAY).slice(0,10)
    if (day < vietnamDateTime(now).slice(0,10) || day > lastDay) return 'Chỉ được hẹn nhận trong hôm nay và 7 ngày tiếp theo (giờ Việt Nam).'
    if (!policy.exempt_hours && isClosedDay(policy, scheduled)) return 'Canteen nghỉ Chủ nhật. Vui lòng hẹn nhận từ thứ Hai đến thứ Bảy trong khung giờ phục vụ.'
    if (!policy.exempt_hours && (scheduled < scheduleInstant(`${day}T${policy.open_time}:00`) || scheduled > scheduleInstant(`${day}T${policy.close_time}:00`))) return `Giờ hẹn nhận phải trong ${policy.open_time}–${policy.close_time} (giờ Việt Nam).`
  } else {
    if (!policy.exempt_hours && isClosedDay(policy, now)) return 'Canteen nghỉ Chủ nhật nên không nhận đơn đặt ngay. Bạn có thể chọn đặt hẹn nhận từ thứ Hai đến thứ Bảy.'
    const day = vietnamDateTime(now).slice(0,10)
    if (!policy.exempt_hours && (now < scheduleInstant(`${day}T${policy.open_time}:00`) || now > scheduleInstant(`${day}T${policy.order_cutoff_time}:00`))) return `Đã ngoài giờ đặt ngay (${policy.open_time}–${policy.order_cutoff_time}). Bạn có thể chọn đặt hẹn giờ.`
  }
  return ''
}
