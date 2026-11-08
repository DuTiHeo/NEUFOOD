export const BULK_PROMOTION = 'Với số lượng từ 5 suất ăn trở lên sẽ được freeship, từ 10 suất trở lên được giảm giá 6% giá trị đơn hàng, từ 20 suất trở lên được giảm giá 8% giá trị đơn hàng, từ 30 suất trở lên được giảm giá 12% giá trị đơn hàng.'
export const DEPOSIT_NOTICE = 'Với đơn hàng từ 500.000đ quý khách sẽ phải đặt cọc 50% với số tài khoản 0866451723, ngân hàng MB Bank và chờ nhân viên căn tin gọi điện thoại xác nhận lại'
export function calculateBulk(subtotal, servings, shipping = 0) {
  const rate = servings >= 30 ? 12 : servings >= 20 ? 8 : servings >= 10 ? 6 : 0
  const discount = Math.floor((Math.round(subtotal * 100) * rate + 5000) / 10000)
  const ship = servings >= 5 ? 0 : shipping
  const total = Math.round((subtotal - discount + ship) * 100) / 100
  const deposit = total >= 500000 ? Math.ceil(total / 2) : 0
  return { eligible_servings: servings, discount_rate: rate, discount_amount: discount, shipping_fee: ship, total_amount: total, deposit_amount: deposit, cod_due: total - deposit }
}
