import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Home, Compass, ShoppingBag, User } from 'lucide-react'
import { useCart } from '../../contexts/CartContext'
import styles from './BottomNav.module.css'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.dockTab} ${styles.dockTabOn}` : styles.dockTab

export default function BottomNav() {
  const { totalCount } = useCart()
  const { pathname } = useLocation()

  return (
    <nav className={styles.dock} aria-label="Điều hướng chính">
      <NavLink className={({ isActive }) => tabClass({ isActive: isActive || pathname === '/khach-hang' })} end to="/">
        <Home className={styles.dockIcon} strokeWidth={2} aria-hidden />
        <span className={styles.dockText}>Trang chủ</span>
      </NavLink>
      <NavLink className={tabClass} to="/menu">
        <Compass className={styles.dockIcon} strokeWidth={2} aria-hidden />
        <span className={styles.dockText}>Menu</span>
      </NavLink>
      <NavLink className={tabClass} to="/gio-hang">
        <div className={styles.dockIconWrap}>
          <ShoppingBag className={styles.dockIcon} strokeWidth={2} aria-hidden />
          {totalCount > 0 && <span className={styles.dockBadge}>{totalCount}</span>}
        </div>
        <span className={styles.dockText}>Giỏ hàng</span>
      </NavLink>
      <NavLink className={tabClass} to="/tai-khoan">
        <User className={styles.dockIcon} strokeWidth={2} aria-hidden />
        <span className={styles.dockText}>Tài khoản</span>
      </NavLink>
    </nav>
  )
}
