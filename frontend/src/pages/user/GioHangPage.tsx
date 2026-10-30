import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../../contexts/CartContext'
import { formatVnd } from '../../utils/money'
import { getDishImageUrl, handleDishImageError } from '../../utils/dishImages'
import Footer from '../../components/layout/Footer'
import styles from './GioHangPage.module.css'

export default function GioHangPage() {
  const { lines, add, setQuantity, totalCount, subtotal, unavailableLines, maxDishQuantity } = useCart()

  const visibleItems = useMemo(() => lines.map((l) => ({ ...l.dish, qty: l.qty, key: l.dish.id, isMissing: l.isMissing })), [lines])

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
            {visibleItems.length === 0 ? (
              <div className={styles.cartEmptyBox}>
                <span className={`material-symbols-outlined ${styles.cartEmptyIcon}`}>shopping_cart</span>
                <h2 className={styles.cartEmptyTitle}>Giỏ hàng của bạn đang trống</h2>
                <p className={styles.cartEmptyText}>
                  Hãy khám phá thực đơn đa dạng và món ngon chuẩn vị NEU để lấp đầy giỏ hàng nhé!
                </p>
                <Link className={styles.cartEmptyBtn} to="/menu">
                  <span className="material-symbols-outlined">restaurant_menu</span>
                  Khám phá thực đơn ngay
                </Link>
              </div>
            ) : null}
            {visibleItems.map((item) => (
              <div key={item.key} className={styles.line}>
                <div className={styles.lineThumb}>
                  <img src={getDishImageUrl(item)} alt={item.name} onError={handleDishImageError} />
                </div>
                <div className={styles.lineMain}>
                  <h3 className={styles.lineName}>{item.name}</h3>
                  <p className={styles.linePrice}>{item.isMissing ? '—' : formatVnd(item.price)}</p>
                  {item.isMissing ? <p role="alert">{item.name === 'Đang tải thông tin món' ? 'Đang tải chi tiết món từ thực đơn…' : item.name === 'Không tải được thông tin món' ? 'Không tải được dữ liệu món. Hãy thử tải lại trang.' : 'Món này không còn trong thực đơn. Hãy xóa món khỏi giỏ.'}</p> : item.is_available === false ? <p role="alert">Món hiện đã hết, hãy xóa món khỏi giỏ.</p> : null}
                  {item.qty >= maxDishQuantity ? <p>Đã đạt tối đa {maxDishQuantity} phần cho món này.</p> : null}
                  <div className={styles.lineQty}>
                    <div className={styles.stepper}>
                      <button
                        type="button"
                        className={styles.stepperBtn}
                        onClick={() => add(item.id, -1)}
                        aria-label={`Giảm số lượng ${item.name}`}
                      >
                        <span className={`material-symbols-outlined ${styles.stepperIcon}`}>remove</span>
                      </button>
                      <span className={styles.stepperN}>{item.qty}</span>
                      <button
                        type="button"
                        className={styles.stepperBtn}
                        onClick={() => add(item.id, 1)}
                        disabled={item.qty >= maxDishQuantity || item.is_available === false}
                        aria-label={`Tăng số lượng ${item.name}`}
                      >
                        <span className={`material-symbols-outlined ${styles.stepperIcon}`}>add</span>
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.lineDel}
                  onClick={() => setQuantity(item.id, 0)}
                  aria-label={`Xóa ${item.name} khỏi giỏ hàng`}
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
                  <span>Phí giao / nhận</span>
                  <span className={styles.sumRowAccent}>Tính ở bước đặt hàng</span>
                </div>
              </div>
              <div className={styles.sumTotal}>
                <span className={styles.sumTotalLabel}>Tổng cộng</span>
                  <span className={styles.sumTotalValue}>{formatVnd(subtotal)}</span>
              </div>
              <div className={styles.sumActions}>
                {totalCount > 0 ? (
                  <Link className={styles.sumPay} to={unavailableLines.length > 0 ? '#' : '/thanh-toan'} aria-disabled={unavailableLines.length > 0} onClick={(event) => unavailableLines.length > 0 && event.preventDefault()}>
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
                Thanh toán COD bằng tiền mặt hoặc VietQR khi nhận món
              </p>
            </div>
          </aside>
        </div>
      </div>
      <Footer />
    </main>
  )
}
