import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../../contexts/CartContext'
import { formatVnd } from '../../utils/money'
import styles from './GioHangPage.module.css'

export default function GioHangPage() {
  const { lines, add, setQuantity, totalCount, subtotal } = useCart()

  const shipping = totalCount > 0 ? 10000 : 0
  const discount = totalCount > 0 ? 5000 : 0
  const total = Math.max(0, subtotal + shipping - discount)

  const visibleItems = useMemo(() => lines.map((l) => ({ ...l.dish, qty: l.qty, key: l.dish.id })), [lines])

  return (
    <main className={styles.cart}>
      <div className={`wrap ${styles.cartWrap}`}>
        <header className={styles.cartHead}>
          <h1 className={styles.cartTitle}>Giỏ hàng của bạn</h1>
          <p className={styles.cartSub}>
            Bạn đang có <span className={styles.cartHl}>{totalCount} món ăn</span> trong giỏ hàng NEUFood
          </p>
        </header>

        <div className={styles.cartGrid}>
          <div className={styles.cartList}>
            {visibleItems.length === 0 ? <p className={styles.cartEmpty}>Giỏ hàng trống.</p> : null}
            {visibleItems.map((item) => (
              <div key={item.key} className={styles.line}>
                <div className={styles.lineThumb}>
                  <img src={item.image} alt={item.name} />
                </div>
                <div className={styles.lineMain}>
                  <h3 className={styles.lineName}>{item.name}</h3>
                  <p className={styles.linePrice}>{formatVnd(item.price)}</p>
                  <div className={styles.lineQty}>
                    <div className={styles.stepper}>
                      <button type="button" className={styles.stepperBtn} onClick={() => add(item.id, -1)} aria-label="Giảm">
                        <span className={`material-symbols-outlined ${styles.stepperIcon}`}>remove</span>
                      </button>
                      <span className={styles.stepperN}>{item.qty}</span>
                      <button type="button" className={styles.stepperBtn} onClick={() => add(item.id, 1)} aria-label="Tăng">
                        <span className={`material-symbols-outlined ${styles.stepperIcon}`}>add</span>
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.lineDel}
                  onClick={() => setQuantity(item.id, 0)}
                  aria-label={`Xóa ${item.name}`}
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            ))}

          </div>

          <aside className={styles.sum}>
            <div className={styles.sumBox}>
              <h2 className={styles.sumTitle}>Tóm tắt đơn hàng</h2>
              <div className={styles.sumRows}>
                <div className={styles.sumRow}>
                  <span>Tạm tính ({totalCount} món)</span>
                  <span>{formatVnd(subtotal)}</span>
                </div>
                <div className={styles.sumRow}>
                  <span>Phí vận chuyển</span>
                  <span className={styles.sumRowAccent}>{formatVnd(shipping)}</span>
                </div>
                <div className={styles.sumRow}>
                  <span>Giảm giá Campus</span>
                  <span className={styles.sumRowBrand}>-{formatVnd(discount)}</span>
                </div>
              </div>
              <div className={styles.sumTotal}>
                <span className={styles.sumTotalLabel}>Tổng cộng</span>
                <span className={styles.sumTotalValue}>{formatVnd(total)}</span>
              </div>
              <div className={styles.sumActions}>
                {totalCount > 0 ? (
                  <Link className={styles.sumPay} to="/thanh-toan">
                    Thanh toán ngay
                  </Link>
                ) : (
                  <span className={styles.sumNoop}>Thêm món để thanh toán</span>
                )}
                <Link className={styles.sumMore} to="/menu">
                  Tiếp tục đặt món
                </Link>
              </div>
              <p className={styles.sumNote}>
                <span className={`material-symbols-outlined ${styles.sumNoteIcon}`}>verified_user</span>
                Thanh toán an toàn qua VNPAY hoặc Tiền mặt
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
