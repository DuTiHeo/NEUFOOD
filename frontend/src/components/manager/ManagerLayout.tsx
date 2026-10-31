import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, ChevronRight, ClipboardList, LayoutDashboard, LogOut, Menu, Star, Store, UtensilsCrossed, Wallet, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import styles from '../admin/SystemAdminLayout.module.css'
import './manager.css'

const links = [
  { to: '/quan-ly', label: 'Tổng quan Canteen', Icon: LayoutDashboard },
  { to: '/quan-ly/don', label: 'Đơn hàng', Icon: ClipboardList },
  { to: '/quan-ly/mon', label: 'Quản lý thực đơn', Icon: UtensilsCrossed },
  { to: '/quan-ly/bao-cao', label: 'Báo cáo doanh thu', Icon: BarChart3 },
  { to: '/quan-ly/ca', label: 'Đối soát ca COD', Icon: Wallet },
  { to: '/quan-ly/danh-gia', label: 'Đánh giá món ăn', Icon: Star },
]
export default function ManagerLayout() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const title = pathname.includes('/mon/them') ? 'Thêm món mới' : pathname.includes('/mon/sua/') ? 'Chỉnh sửa món' : links.find((link) => link.to === pathname)?.label || 'Canteen A2'
  async function signOut() {
    setBusy(true)
    try { await logout(); window.location.replace('/DANGNHAP.html') }
    finally { setBusy(false) }
  }
  return <div className={`${styles.shell} manager-workspace`}>
    {open && <button className={styles.scrim} aria-label="Đóng menu điều hướng" onClick={() => setOpen(false)} />}
    <aside className={`${styles.sidebar} ${open ? styles.open : ''}`} aria-label="Menu quản lý Canteen">
      <Link className={styles.brand} to="/quan-ly" onClick={() => setOpen(false)}><img src="/neu-food.png" alt="" /><span>NEU<span>Food</span><small>QUẢN LÝ CANTEEN</small></span></Link>
      <div className={styles.workspace}><Store size={22} /><div><strong>Canteen A2</strong><small>Đại học Kinh tế Quốc dân</small></div></div>
      <p className={styles.navLabel}>ĐIỀU HÀNH CANTEEN</p>
      <nav>{links.map(({ to, label, Icon }) => <NavLink key={to} to={to} end={to === '/quan-ly'} onClick={() => setOpen(false)} className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
      <div className={styles.sidebarFoot}><div className={styles.help}><Wallet size={19} /><strong>Đối soát cuối ca</strong><p>Kiểm đếm riêng tiền mặt và sao kê VietQR trước khi duyệt bàn giao.</p></div><button type="button" className={styles.logout} onClick={() => void signOut()} disabled={busy}><LogOut size={18} />{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</button></div>
    </aside>
    <div className={styles.content}><header className={styles.header}><div className={styles.breadcrumb}><button className={styles.menuButton} aria-label={open ? 'Đóng menu' : 'Mở menu'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button><span>Canteen A2</span><ChevronRight size={14} /><strong>{title}</strong></div><div className={styles.headerRight}><div className={styles.account}><span className={styles.avatar}>{user?.full_name?.charAt(0) || 'Q'}</span><div><strong>{user?.full_name}</strong><small>Quản lý Canteen</small></div></div></div></header><main className={`${styles.main} manager-main`}><Outlet /></main><footer className={styles.footer}><span>NEUFood · Canteen A2 · Đại học Kinh tế Quốc dân</span><span>Thanh toán COD · Tiền mặt / VietQR</span></footer></div>
  </div>
}
