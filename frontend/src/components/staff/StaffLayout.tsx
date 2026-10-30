import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronRight, ClipboardList, LayoutDashboard, LogOut, Menu, Store, Utensils, Wallet, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import styles from '../admin/SystemAdminLayout.module.css'
import '../manager/manager.css'

const navItems = [
  { to: '/nhan-vien', label: 'Ca làm hôm nay', icon: LayoutDashboard, end: true },
  { to: '/nhan-vien/don', label: 'Xử lý đơn', icon: ClipboardList },
  { to: '/nhan-vien/mon', label: 'Tình trạng món', icon: Utensils },
  { to: '/nhan-vien/ca', label: 'Chốt ca COD', icon: Wallet },
]

export default function StaffLayout() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const location = useLocation()
  const current = navItems.find((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to))
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [location.pathname])
  async function signOut() {
    setBusy(true)
    try { await logout(); window.location.replace('/DANGNHAP.html') }
    finally { setBusy(false) }
  }
  return <div className={`${styles.shell} staff-workspace`}>
    {open && <button className={styles.scrim} aria-label="Đóng menu điều hướng" onClick={() => setOpen(false)} />}
    <aside className={`${styles.sidebar} ${open ? styles.open : ''}`} aria-label="Menu nhân viên Canteen">
      {open && <button type="button" className={styles.menuButton} style={{ position: 'absolute', right: 8, top: 12, color: '#dce7f0' }} aria-label="Đóng menu nhân viên" onClick={() => setOpen(false)}><X size={18} /></button>}
      <Link className={styles.brand} to="/nhan-vien" onClick={() => setOpen(false)}><img src="/neu-food.png" alt="" /><span>NEU<span>Food</span><small>NHÂN VIÊN CANTEEN</small></span></Link>
      <div className={styles.workspace}><Store size={22} /><div><strong>Canteen A2</strong><small>Chế biến · Giao hàng · Thu COD</small></div></div>
      <p className={styles.navLabel}>CÔNG VIỆC TRONG CA</p>
      <nav aria-label="Chức năng nhân viên">{navItems.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
      <div className={styles.sidebarFoot}><div className={styles.help}><Wallet size={20} /><strong>Đối chiếu trước bàn giao</strong><p>Đúng 4 số cuối mã nhận, thu đủ COD và ghi nhận đúng phương thức thanh toán.</p></div><button className={styles.logout} type="button" onClick={() => void signOut()} disabled={busy}><LogOut size={18} />{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</button></div>
    </aside>
    <div className={styles.content}>
      <header className={styles.header}><div className={styles.breadcrumb}><button className={styles.menuButton} aria-label={open ? 'Đóng menu' : 'Mở menu'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button><span>Canteen A2</span><ChevronRight size={14} /><strong>{current?.label || 'Ca làm hôm nay'}</strong></div><div className={styles.account}><span className={styles.avatar}>{user?.full_name?.slice(0, 1) || 'N'}</span><div><strong>{user?.full_name || 'Nhân viên'}</strong><small>Tài khoản nhân viên</small></div></div></header>
      <main className={`${styles.main} manager-main`}><Outlet /></main>
      <footer className={styles.footer}><span>NEUFood · Canteen A2 · Đại học Kinh tế Quốc dân</span><span>Nhân viên bếp & giao hàng nội khu</span></footer>
    </div>
  </div>
}
