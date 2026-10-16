import React from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Compass, ShoppingBag, User } from 'lucide-react'
import styles from './BottomNav.module.css'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.dockTab} ${styles.dockTabOn}` : styles.dockTab

export default function BottomNav() {
  return (
    <nav className={styles.dock} aria-label="Điều hướng chính">
      <NavLink className={tabClass} end to="/">
        <Home className={styles.dockIcon} strokeWidth={2} aria-hidden />
        <span className={styles.dockText}>Trang chủ</span>
      </NavLink>
      <NavLink className={tabClass} to="/menu">
        <Compass className={styles.dockIcon} strokeWidth={2} aria-hidden />
        <span className={styles.dockText}>Menu</span>
      </NavLink>
      <NavLink className={tabClass} to="/gio-hang">
        <ShoppingBag className={styles.dockIcon} strokeWidth={2} aria-hidden />
        <span className={styles.dockText}>Giỏ hàng</span>
      </NavLink>
      <NavLink className={tabClass} to="/tai-khoan">
        <User className={styles.dockIcon} strokeWidth={2} aria-hidden />
        <span className={styles.dockText}>Tài khoản</span>
      </NavLink>
    </nav>
  )
}
