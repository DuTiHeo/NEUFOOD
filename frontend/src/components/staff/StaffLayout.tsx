import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ClipboardList, LayoutDashboard, LogIn, LogOut, Utensils, Wallet } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import styles from './StaffLayout.module.css'

const navItems = [
  { to: '/nhan-vien', label: 'Ca làm hôm nay', icon: LayoutDashboard, end: true },
  { to: '/nhan-vien/don', label: 'Xử lý đơn', icon: ClipboardList },
  { to: '/nhan-vien/mon', label: 'Tình trạng món', icon: Utensils },
  { to: '/nhan-vien/ca', label: 'Chốt ca COD', icon: Wallet },
]

export default function StaffLayout() {
  const { user, isAuthenticated, logout } = useAuth()
  const location = useLocation()
  const current = navItems.find((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to))
  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link className={styles.brand} to="/nhan-vien"><img className={styles.logoImage} src="/neu-food.png" alt="NEUFood" /><span><strong>NEUFood</strong><small>Trung tâm vận hành</small></span></Link>
      <div className={styles.shiftLabel}>CANTEEN A2 <i /> ĐANG HOẠT ĐỘNG</div>
      <nav className={styles.nav} aria-label="Chức năng nhân viên">{navItems.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
      <div className={styles.sidebarFoot}>{isAuthenticated ? <button type="button" onClick={() => void logout()}><LogOut size={18} /> Đăng xuất</button> : <Link to="/quan-ly/dang-nhap"><LogIn size={18} /> Đăng nhập tài khoản</Link>}</div>
    </aside>
    <div className={styles.main}>
      <header className={styles.topbar}><div><span className={styles.overline}>KHÔNG GIAN NHÂN VIÊN</span><h1>{current?.label || 'Vận hành Canteen'}</h1></div><div className={styles.user}><span className={styles.avatar}>{user?.full_name?.slice(0, 1) || 'N'}</span><span><strong>{user?.full_name || 'Nhân viên'}</strong><small>Nhân viên Canteen</small></span></div></header>
      <main className={styles.content}><Outlet /></main>
    </div>
  </div>
}
