import React, { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Home,
  UtensilsCrossed,
  ShoppingCart,
  User,
  Search,
  Package,
  Shield,
  LogIn,
  UserPlus,
  Gamepad2,
} from 'lucide-react'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'
import { useMenuSearch } from '../../contexts/MenuSearchContext'
import { useDishes } from '../../contexts/DishesContext'
import { getDishImageUrl, handleDishImageError } from '../../utils/dishImages'
import { formatVnd } from '../../utils/money'
import styles from './Navbar.module.css'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.topnavLink} ${styles.topnavLinkOn}` : styles.topnavLink

export default function Navbar() {
  const { isAdmin } = useAdminAuth()
  const { user, isAuthenticated, logout } = useAuth()
  const { totalCount } = useCart()
  const { menuSearch, setMenuSearch } = useMenuSearch()
  const { dishes } = useDishes()
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)
  const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').trim()
  const suggestions = menuSearch.trim() ? dishes.filter((dish) => normalize(dish.name).includes(normalize(menuSearch))).slice(0, 8) : []
  const { pathname } = useLocation()
  const cartCount = totalCount
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const toggleAccountMenu = () => {
    setShowAccountMenu(!showAccountMenu)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false)
      }
      if (!searchRef.current?.contains(event.target as Node)) setShowSuggestions(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleLogout = async () => {
    if (isAuthenticated) await logout()
    setShowAccountMenu(false)
    navigate('/')
  }

  const hasSession = isAuthenticated
  const displayName =
    String(user?.full_name || '').trim() ||
    String(user?.email || '').trim() ||
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
            <NavLink className={({ isActive }) => linkClass({ isActive: isActive || pathname === '/khach-hang' })} end to="/">
              <Home className={styles.topnavIcon} strokeWidth={2} aria-hidden />
              Trang chủ
            </NavLink>
            <NavLink className={linkClass} to="/menu">
              <UtensilsCrossed className={styles.topnavIcon} strokeWidth={2} aria-hidden />
              Menu
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
          <div className={styles.topnavSearch} ref={searchRef}>
            <Search className={styles.topnavSearchIcon} strokeWidth={2} aria-hidden />
            <input
              className={styles.topnavInput}
              type="search"
              placeholder="Tìm món theo tên hoặc mô tả..."
              value={menuSearch}
              onChange={(e) => { setMenuSearch(e.target.value); setShowSuggestions(true); setActiveSuggestion(-1) }}
              onFocus={() => { setShowSuggestions(true); setActiveSuggestion(-1) }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') { setShowSuggestions(false); setActiveSuggestion(-1) }
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  setShowSuggestions(true)
                  setActiveSuggestion((index) => event.key === 'ArrowDown' ? Math.min(index + 1, suggestions.length - 1) : Math.max(index - 1, -1))
                }
                if (event.key === 'Enter') {
                  event.preventDefault()
                  const selected = showSuggestions && activeSuggestion >= 0 ? suggestions[activeSuggestion] : undefined
                  setShowSuggestions(false)
                  setActiveSuggestion(-1)
                  navigate(selected ? `/mon/${selected.id}` : `/menu?q=${encodeURIComponent(menuSearch.trim())}`)
                }
              }}
              onBlur={(event) => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setShowSuggestions(false) }}
              aria-label="Tìm món"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showSuggestions && Boolean(menuSearch.trim())}
              aria-controls={showSuggestions && menuSearch.trim() ? 'dish-suggestions' : undefined}
              aria-activedescendant={showSuggestions && activeSuggestion >= 0 ? `dish-suggestion-${activeSuggestion}` : undefined}
            />
            {showSuggestions && menuSearch.trim() && <div id="dish-suggestions" className={styles.searchDropdown} role="listbox" aria-label="Món ăn gợi ý">
              {suggestions.map((dish, index) => <button
                type="button" key={dish.id} id={`dish-suggestion-${index}`} role="option" aria-selected={activeSuggestion === index}
                className={`${styles.searchOption} ${activeSuggestion === index ? styles.searchOptionActive : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { setShowSuggestions(false); setActiveSuggestion(-1); navigate(`/mon/${dish.id}`) }}
              >
                <img src={getDishImageUrl(dish)} alt="" onError={handleDishImageError} />
                <span>{dish.name}<small>{formatVnd(dish.price)}</small></span>
              </button>)}
              {!suggestions.length && <p className={styles.searchEmpty}>Không tìm thấy món. Hãy thử tên món khác.</p>}
            </div>}
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
                aria-expanded={showAccountMenu}
                aria-haspopup="menu"
                aria-label={displayName ? `Tài khoản: ${displayName}` : 'Tài khoản'}
              >
                <User strokeWidth={2} />
                {displayName ? <span className={styles.accountName}>{displayName}</span> : null}
              </button>
              {showAccountMenu && (
                <div className={styles.accountDropdown}>
                  {hasSession ? (
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
                      <a
                        href={`/DANGNHAP.html?next=${encodeURIComponent(pathname + window.location.search)}`}
                        className={styles.accountMenuItem}
                        onClick={() => setShowAccountMenu(false)}
                      >
                        <LogIn className={styles.accountMenuIcon} strokeWidth={2} />
                        Đăng nhập
                      </a>
                      <a
                        href={`/DANGKY.html?next=${encodeURIComponent(pathname + window.location.search)}`}
                        className={styles.accountMenuItem}
                        onClick={() => setShowAccountMenu(false)}
                      >
                        <UserPlus className={styles.accountMenuIcon} strokeWidth={2} />
                        Đăng ký
                      </a>
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
