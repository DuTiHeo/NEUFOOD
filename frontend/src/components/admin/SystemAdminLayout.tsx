import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, ChevronRight, LayoutDashboard, LogOut, MapPin, Menu, MessageSquareWarning, Settings2, ShieldCheck, Users, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import styles from './SystemAdminLayout.module.css'

const links = [
  { to: '/admin', label: 'Tổng quan', Icon: LayoutDashboard },
  { to: '/admin/tai-khoan', label: 'Tài khoản & phân quyền', Icon: Users },
  { to: '/admin/khieu-nai', label: 'Khiếu nại', Icon: MessageSquareWarning },
  { to: '/admin/dia-diem', label: 'Địa điểm giao hàng', Icon: MapPin },
  { to: '/admin/bao-cao', label: 'Báo cáo doanh thu', Icon: BarChart3 },
  { to: '/admin/cau-hinh', label: 'Cấu hình hệ thống', Icon: Settings2 },
]

export default function SystemAdminLayout() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')
  const current = links.find((item) => item.to === pathname)

  async function signOut() {
    setSigningOut(true)
    setError('')
    try { await logout(); window.location.replace('/DANGNHAP.html') }
    catch { setError('Chưa thể đăng xuất. Vui lòng thử lại.'); setSigningOut(false) }
  }

  return <div className={styles.shell}>
    {open && <button className={styles.scrim} aria-label="Đóng menu" onClick={() => setOpen(false)} />}
    <aside className={`${styles.sidebar} ${open ? styles.open : ''}`} aria-label="Quản trị hệ thống">
      <Link to="/admin" className={styles.brand} onClick={() => setOpen(false)}><img src="/neu-food.png" alt="" /><span>NEU<span>Food</span><small>TRANG QUẢN TRỊ</small></span></Link>
      <div className={styles.workspace}><ShieldCheck size={22} /><div><strong>Quản trị hệ thống</strong><small>NEUFood · Campus delivery</small></div></div>
      <p className={styles.navLabel}>KHÔNG GIAN LÀM VIỆC</p>
      <nav>{links.map(({ to, label, Icon }) => <NavLink key={to} to={to} end={to === '/admin'} onClick={() => setOpen(false)} className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
      <div className={styles.sidebarFoot}><div className={styles.help}><ShieldCheck size={19} /><strong>Quyền quản trị viên</strong><p>Quản lý tài khoản, chính sách và hoạt động toàn hệ thống.</p></div><button onClick={() => void signOut()} disabled={signingOut} className={styles.logout}><LogOut size={18} />{signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}</button>{error && <p role="alert">{error}</p>}</div>
    </aside>
    <div className={styles.content}>
      <header className={styles.header}><div className={styles.breadcrumb}><button className={styles.menuButton} onClick={() => setOpen(!open)} aria-label={open ? 'Đóng menu' : 'Mở menu'} aria-expanded={open}>{open ? <X size={22} /> : <Menu size={22} />}</button><span>Quản trị</span><ChevronRight size={14} /><strong>{current?.label || 'Tổng quan'}</strong></div><div className={styles.headerRight}><div className={styles.account}><span className={styles.avatar}>{user?.full_name?.charAt(0) || 'A'}</span><div><strong>{user?.full_name}</strong><small>Quản trị viên</small></div></div></div></header>
      <main className={styles.main}><Outlet /></main>
      <footer className={styles.footer}><span>NEUFood · Hệ thống đặt món nội khu NEU</span><span>Khu vực quản trị</span></footer>
    </div>
  </div>
}
