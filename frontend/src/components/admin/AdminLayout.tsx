import React from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, UtensilsCrossed, Receipt, LogOut } from 'lucide-react'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import styles from './AdminLayout.module.css'

const navCls = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.navLink} ${styles.navOn}` : styles.navLink

export default function AdminLayout() {
  const { logout } = useAdminAuth()
  const { pathname } = useLocation()

  let topTitle = 'Thống kê & báo cáo'
  if (pathname.includes('/mon')) topTitle = 'Quản lý món'
  else if (pathname.includes('/don')) topTitle = 'Quản lý đơn'

  return (
    <div className={styles.root}>
      <aside className={styles.aside} aria-label="Menu quản trị">
        <div className={styles.brand}>
          <p className={styles.brandTitle}>NEUFood Admin</p>
          <p className={styles.brandSub}>Campus dining</p>
        </div>
        <nav className={styles.nav}>
          <NavLink to="/quan-ly" className={navCls} end>
            <LayoutDashboard size={20} strokeWidth={2} aria-hidden />
            Tổng quan
          </NavLink>
          <NavLink to="/quan-ly/mon" className={navCls}>
            <UtensilsCrossed size={20} strokeWidth={2} aria-hidden />
            Thực đơn
          </NavLink>
          <NavLink to="/quan-ly/don" className={navCls}>
            <Receipt size={20} strokeWidth={2} aria-hidden />
            Đơn hàng
          </NavLink>
        </nav>
        <div className={styles.navFoot}>
          <button type="button" className={styles.out} onClick={() => logout()}>
            <LogOut size={20} strokeWidth={2} aria-hidden />
            Đăng xuất
          </button>
        </div>
      </aside>
      <div className={styles.main}>
        <header className={styles.top}>
          <h1 className={styles.topTitle}>{topTitle}</h1>
          <div className={styles.topTools}>
            <span className={`material-symbols-outlined ${styles.ico}`} aria-hidden>
              notifications
            </span>
            <span className={`material-symbols-outlined ${styles.ico}`} aria-hidden>
              settings
            </span>
          </div>
        </header>
        <div className={styles.body}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
