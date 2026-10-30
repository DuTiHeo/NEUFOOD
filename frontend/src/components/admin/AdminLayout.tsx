import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  LogIn,
  LogOut,
  MapPin,
  MessageSquareText,
  Settings2,
  ShieldCheck,
  UtensilsCrossed,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { useAuth } from '../../contexts/AuthContext'
import styles from './AdminLayout.module.css'

type NavItem = { to: string; label: string; Icon: LucideIcon; end?: boolean }

const navItems: NavItem[] = [
  { to: '/quan-ly', label: 'Tổng quan', Icon: LayoutDashboard, end: true },
  { to: '/quan-ly/don', label: 'Giám sát đơn hàng', Icon: ClipboardList },
  { to: '/quan-ly/mon', label: 'Quản lý thực đơn', Icon: UtensilsCrossed },
  { to: '/quan-ly/bao-cao', label: 'Doanh thu hệ thống', Icon: BarChart3 },
  { to: '/quan-ly/ca', label: 'Đối soát ca COD', Icon: Wallet },
  { to: '/quan-ly/danh-gia', label: 'Đánh giá món', Icon: MessageSquareText },
  { to: '/quan-ly/tai-khoan', label: 'Tài khoản & blacklist', Icon: Users },
  { to: '/quan-ly/dia-diem', label: 'Địa điểm nội khu', Icon: MapPin },
  { to: '/quan-ly/cau-hinh', label: 'Cấu hình hệ thống', Icon: Settings2 },
  { to: '/quan-ly/khieu-nai', label: 'Khiếu nại', Icon: ShieldCheck },
]

const titles: Record<string, string> = {
  '/quan-ly': 'Tổng quan',
  '/quan-ly/don': 'Giám sát đơn hàng',
  '/quan-ly/mon': 'Quản lý thực đơn',
  '/quan-ly/mon/them': 'Thêm món mới',
  '/quan-ly/bao-cao': 'Báo cáo doanh thu',
  '/quan-ly/ca': 'Đối soát ca COD',
  '/quan-ly/danh-gia': 'Đánh giá món ăn',
  '/quan-ly/tai-khoan': 'Tài khoản & blacklist',
  '/quan-ly/dia-diem': 'Địa điểm giao hàng',
  '/quan-ly/cau-hinh': 'Cấu hình hệ thống',
  '/quan-ly/khieu-nai': 'Phân xử khiếu nại',
}

export default function AdminLayout() {
  const { logout } = useAdminAuth()
  const { user, isAuthenticated } = useAuth()
  const { pathname } = useLocation()
  const preview = !isAuthenticated
  const isAdmin = user?.role === 'admin'
  const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/')
  const basePath = isAdminPath ? '/admin' : '/quan-ly'
  const canonicalPath = pathname.replace(/^\/admin(?=\/|$)/, '/quan-ly')
  const topTitle = titles[canonicalPath] || (canonicalPath.startsWith('/quan-ly/mon/sua/') ? 'Chỉnh sửa món ăn' : 'Khu vực quản trị')
  const routeForBase = (path: string) => path.replace(/^\/quan-ly/, basePath)
  const roleLabel = preview ? 'Quản lý & Admin' : isAdmin ? 'Quản trị viên' : user?.role === 'manager' ? 'Quản lý Canteen' : user?.role === 'staff' ? 'Nhân viên' : 'Giao diện quản trị'

  return (
    <div className={styles.root}>
      <aside className={styles.aside} aria-label="Menu quản trị NEUFood">
        <Link to={basePath} className={styles.brand}>
          <img className={styles.brandLogo} src="/neu-food.png" alt="NEUFood" />
          <span className={styles.brandCopy}><strong>NEUFood</strong><small>{preview ? 'MANAGEMENT PREVIEW' : isAdmin ? 'SYSTEM ADMIN' : 'CANTEEN A2'}</small></span>
        </Link>
        <div className={styles.roleCard}>
          <span className={styles.roleDot} />
          <span><strong>{roleLabel}</strong><small>{user?.full_name || 'Bản xem trước giao diện'}</small></span>
        </div>
        <nav className={styles.nav} aria-label="Các phân hệ">
          <p className={styles.navLabel}>ĐIỀU HÀNH</p>
          {navItems.slice(0, 6).map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={routeForBase(to)} end={end} className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navOn : ''}`}>
              <Icon size={18} /><span>{label}</span>
            </NavLink>
          ))}
          <p className={styles.navLabel}>QUẢN TRỊ HỆ THỐNG</p>
          {navItems.slice(6).map(({ to, label, Icon }) => (
            <NavLink key={to} to={routeForBase(to)} className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navOn : ''}`}>
              <Icon size={18} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={styles.navFoot}>
          {preview ? <Link to={`${basePath}/dang-nhap`} className={`${styles.out} ${styles.loginLink}`}><LogIn size={18} />Đăng nhập để bắt đầu</Link> : <button type="button" className={styles.out} onClick={() => void logout()}><LogOut size={18} />Đăng xuất</button>}
        </div>
      </aside>
      <div className={styles.main}>
        <header className={styles.top}>
          <div><span className={styles.topEyebrow}>{preview ? 'MANAGEMENT PORTAL PREVIEW' : isAdmin ? 'ADMINISTRATOR PORTAL' : user?.role === 'manager' ? 'CANTEEN MANAGEMENT' : 'NEUFOOD MANAGEMENT PORTAL'}</span><h1 className={styles.topTitle}>{topTitle}</h1></div>
          <div className={styles.topTools}>
            <span className={styles.accountChip}><span className={styles.accountAvatar}>{user?.full_name?.slice(0, 1) || (preview ? 'QL' : isAdmin ? 'A' : 'Q')}</span><span><strong>{user?.full_name || (preview ? 'Bản xem trước' : isAdmin ? 'Admin' : 'Quản lý')}</strong><small>{preview ? 'Chưa đăng nhập' : isAdmin ? 'Admin hệ thống' : 'Quản lý Canteen A2'}</small></span></span>
          </div>
        </header>
        <main className={styles.body}><Outlet /></main>
      </div>
    </div>
  )
}
