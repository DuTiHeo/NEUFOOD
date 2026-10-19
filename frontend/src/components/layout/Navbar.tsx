import React, { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  Home,
  UtensilsCrossed,
  ShoppingCart,
  User,
  Search,
  Package,
  Shield,
  MapPin,
  LogIn,
  UserPlus,
  Gamepad2,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { useCart } from '../../contexts/CartContext'
import { useMenuSearch } from '../../contexts/MenuSearchContext'
import styles from './Navbar.module.css'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.topnavLink} ${styles.topnavLinkOn}` : styles.topnavLink

export default function Navbar() {
  const { isAdmin } = useAdminAuth()
  const { totalCount } = useCart()
  const { menuSearch, setMenuSearch } = useMenuSearch()
  const cartCount = totalCount
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { user: userSession, logout } = useAuth()

  const toggleAccountMenu = () => {
    setShowAccountMenu(!showAccountMenu)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleLogout = () => {
    logout()
    setShowAccountMenu(false)
    navigate('/')
  }

  const displayName =
    (userSession && typeof userSession === 'object' && String(userSession.full_name || '').trim()) ||
    (userSession && typeof userSession === 'object' && String(userSession.email || '').trim()) ||
    ''

  return (
    <header className={styles.topnav}>
      <div className={styles.topnavInner}>
        <div className={styles.topnavLeft}>
          <Link to="/" className={styles.topnavLogo}>
            <img
              src="/neu-food.png"
              alt="NEUFood"
              className={styles.logoImg}
            />
            <span>NEUFood</span>
          </Link>
          <nav className={styles.topnavMenu}>
            <NavLink className={linkClass} end to="/">
              <Home className={styles.topnavIcon} strokeWidth={2} aria-hidden />
              Trang chủ
            </NavLink>
            <NavLink className={linkClass} to="/menu">
              <UtensilsCrossed className={styles.topnavIcon} strokeWidth={2} aria-hidden />
              Menu
            </NavLink>
            <NavLink className={linkClass} to="/gan-neu">
              <MapPin className={styles.topnavIcon} strokeWidth={2} aria-hidden />
              Các quán ăn gần NEU
            </NavLink>
            <NavLink className={linkClass} to="/lich-su-don">
              <Package className={styles.topnavIcon} strokeWidth={2} aria-hidden />
              Đơn hàng
            </NavLink>
            {isAdmin ? (
              <NavLink className={linkClass} to="/quan-ly">
                <Shield className={styles.topnavIcon} strokeWidth={2} aria-hidden />
                Quản trị
              </NavLink>
            ) : null}
          </nav>
        </div>
        <div className={styles.topnavRight}>
          <div className={styles.topnavSearch}>
            <Search className={styles.topnavSearchIcon} strokeWidth={2} aria-hidden />
            <input
              className={styles.topnavInput}
              type="search"
              placeholder="Tìm món theo tên hoặc mô tả..."
              value={menuSearch}
              onChange={(e) => setMenuSearch(e.target.value)}
              aria-label="Tìm món"
            />
          </div>
          <div className={styles.topnavActions}>
            <Link className={styles.topnavRound} to="/gio-hang" aria-label={`Giỏ hàng, ${cartCount} món`}>
              <ShoppingCart strokeWidth={2} />
              <span className={styles.topnavBadge}>{cartCount}</span>
            </Link>
            <div className={styles.accountMenu} ref={accountMenuRef}>
              <button
                type="button"
                className={`${styles.topnavRound} ${styles.accountTrigger}`}
                onClick={toggleAccountMenu}
                aria-label={displayName ? `Tài khoản: ${displayName}` : 'Tài khoản'}
              >
                <User strokeWidth={2} />
                {displayName ? <span className={styles.accountName}>{displayName}</span> : null}
              </button>
              {showAccountMenu && (
                <div className={styles.accountDropdown}>
                  {userSession ? (
                    <>
                      <Link
                        to="/tai-khoan"
                        className={styles.accountMenuItem}
                        onClick={() => setShowAccountMenu(false)}
                      >
                        <User className={styles.accountMenuIcon} strokeWidth={2} />
                        Tài khoản
                      </Link>
                      <button
                        type="button"
                        className={styles.accountMenuItemButton}
                        onClick={handleLogout}
                      >
                        <LogIn className={styles.accountMenuIcon} strokeWidth={2} />
                        Đăng xuất
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        to="/dang-nhap"
                        className={styles.accountMenuItem}
                        onClick={() => setShowAccountMenu(false)}
                      >
                        <LogIn className={styles.accountMenuIcon} strokeWidth={2} />
                        Đăng nhập
                      </Link>
                      <Link
                        to="/dang-ky"
                        className={styles.accountMenuItem}
                        onClick={() => setShowAccountMenu(false)}
                      >
                        <UserPlus className={styles.accountMenuIcon} strokeWidth={2} />
                        Đăng ký
                      </Link>
                    </>
                  )}
                  <a
                    href="/RANDOM.html"
                    className={styles.accountMenuItem}
                    onClick={() => setShowAccountMenu(false)}
                  >
                    <Gamepad2 className={styles.accountMenuIcon} strokeWidth={2} />
                    Game ngẫu nhiên
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
