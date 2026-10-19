import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Star, Minus, Plus, ShoppingBag, SlidersHorizontal, ChevronDown } from 'lucide-react'
import { MENU_CATEGORIES } from '../../data/dishes'
import { useCart } from '../../contexts/CartContext'
import { useMenuSearch } from '../../contexts/MenuSearchContext'
import { formatVnd } from '../../utils/money'
import styles from './MenuPage.module.css'

const BADGE_LABELS = {
  bestSeller: 'Bán chạy',
  new: 'Mới',
  hot: 'Hot',
}

const SORT_OPTIONS = [
  { id: 'popular', label: 'Phổ biến' },
  { id: 'price_low', label: 'Giá thấp → cao' },
  { id: 'price_high', label: 'Giá cao → thấp' },
]

const PRICE_FILTERS = [
  { id: 'all', label: 'Mọi mức giá' },
  { id: 'lt30', label: 'Dưới 30.000đ' },
  { id: '30_50', label: '30.000 – 50.000đ' },
  { id: 'gt50', label: 'Trên 50.000đ' },
]

const RATING_FILTERS = [
  { id: 'all', label: 'Mọi đánh giá' },
  { id: 'r45', label: 'Từ 4.5★' },
  { id: 'r47', label: 'Từ 4.7★' },
]

function matchesPrice(dish, priceFilter) {
  if (priceFilter === 'all') return true
  if (priceFilter === 'lt30') return dish.price < 30000
  if (priceFilter === '30_50') return dish.price >= 30000 && dish.price <= 50000
  if (priceFilter === 'gt50') return dish.price > 50000
  return true
}

function matchesRating(dish, ratingFilter) {
  if (ratingFilter === 'all') return true
  if (ratingFilter === 'r45') return dish.rating >= 4.5
  if (ratingFilter === 'r47') return dish.rating >= 4.7
  return true
}

function categoryChipClass(c, selectedCategoryIds) {
  const on =
    c.id === 'all'
      ? selectedCategoryIds.length === 0
      : selectedCategoryIds.includes(c.id)
  return on ? styles.catChipOn : styles.catChip
}

function StarRow({ value }) {
  const n = Math.min(5, Math.max(0, Math.round(value)))
  return (
    <div className={styles.stars} aria-label={`${value} trên 5 sao`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          size={14}
          strokeWidth={2}
          fill={i < n ? 'currentColor' : 'none'}
          className={i < n ? styles.starFull : styles.starEmpty}
          aria-hidden
        />
      ))}
    </div>
  )
}

function DishCard({ dish }) {
  const { add } = useCart()
  const [draft, setDraft] = useState(1)

  function bump(delta) {
    setDraft((d) => Math.min(10, Math.max(1, d + delta)))
  }

  function addToCart() {
    add(dish.id, draft)
    setDraft(1)
  }

  return (
    <article className={styles.card}>
      <Link to={`/mon/${dish.id}`} className={styles.cardImageLink}>
        <div className={styles.cardImageWrap}>
          <img className={styles.cardImage} src={dish.image} alt="" />
          <div className={styles.badges}>
            {(dish.badges ?? []).map((b) => (
              <span
                key={b}
                className={
                  b === 'new' ? styles.badgeNew : b === 'hot' ? styles.badgeHot : styles.badgeBest
                }
              >
                {BADGE_LABELS[b] ?? b}
              </span>
            ))}
          </div>
        </div>
      </Link>
      <div className={styles.cardBody}>
        <Link to={`/mon/${dish.id}`} className={styles.cardTitleLink}>
          <h2 className={styles.cardTitle}>{dish.name}</h2>
        </Link>
        <p className={styles.cardDesc}>{dish.shortDescription}</p>
        <div className={styles.cardMeta}>
          <div className={styles.ratingRow}>
            <StarRow value={dish.rating} />
            <span className={styles.ratingNum}>{dish.rating.toFixed(1)}</span>
            <span className={styles.reviewCount}>({dish.reviewCount ?? 0})</span>
          </div>
          <p className={styles.price}>{formatVnd(dish.price)}</p>
        </div>
        <div className={styles.cardActionsRow}>
          <div className={styles.qtyStepper}>
            <button
              type="button"
              className={styles.qtyStepBtn}
              disabled={draft <= 1}
              onClick={() => bump(-1)}
              aria-label="Giảm số lượng"
            >
              <Minus size={18} strokeWidth={2} />
            </button>
            <span className={styles.qtyStepVal}>{draft}</span>
            <button type="button" className={styles.qtyStepBtn} disabled={draft >= 10} onClick={() => bump(1)} aria-label="Tăng số lượng">
              <Plus size={18} strokeWidth={2} />
            </button>
          </div>
          <button type="button" className={styles.addToCartBtn} disabled={!dish.is_available} onClick={addToCart}>
            Thêm vào giỏ
          </button>
        </div>
      </div>
    </article>
  )
}

function MenuFilteredResults({ filtered, selectedCategoryLabels }) {
  const PAGE_SIZE = 9
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pagedDishes = filtered.slice(pageStart, pageStart + PAGE_SIZE)
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <>
      <p className={styles.resultCount}>
        {filtered.length} món
        {selectedCategoryLabels.length > 0 ? ` · ${selectedCategoryLabels.join(', ')}` : ''}
      </p>

      <div className={styles.grid}>
        {pagedDishes.map((dish) => (
          <DishCard key={dish.id} dish={dish} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className={styles.empty}>Không có món phù hợp. Thử đổi bộ lọc hoặc từ khóa.</p>
      ) : null}

      {filtered.length > 0 ? (
        <div className={styles.pagination} aria-label="Chuyển trang món ăn">
          <button
            type="button"
            className={styles.pageBtn}
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            {'‹'}
          </button>
          {pageNumbers.map((p) => (
            <button
              key={p}
              type="button"
              className={p === currentPage ? styles.pageBtnOn : styles.pageBtn}
              onClick={() => setCurrentPage(p)}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            className={styles.pageBtn}
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            {'›'}
          </button>
        </div>
      ) : null}
    </>
  )
}

const DOCK_FULL_TOP_PX = 72
const SCROLL_DELTA_PX = 8

export default function MenuPage() {
  const { add, lines, totalCount, catalog: dishes, catalogLoading, catalogError, cartError } = useCart()
  const { menuSearch: search } = useMenuSearch()

  const lastScrollY = useRef(
    typeof window !== 'undefined' ? window.scrollY : 0,
  )

  const [dockMode, setDockMode] = useState(() => {
    if (typeof window === 'undefined') return 'full'
    return window.scrollY >= DOCK_FULL_TOP_PX ? 'hidden' : 'full'
  })
  const [compactMobilePanelOpen, setCompactMobilePanelOpen] = useState(false)

  const [selectedCategoryIds, setSelectedCategoryIds] = useState([])
  const [sort, setSort] = useState('popular')
  const [priceFilter, setPriceFilter] = useState('all')
  const [ratingFilter, setRatingFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => {
    let list = [...dishes]

    if (selectedCategoryIds.length > 0) {
      list = list.filter((d) => {
        const dishCategoryIds = d.categoryIds ?? (d.categoryId ? [d.categoryId] : [])
        return dishCategoryIds.some((id) => selectedCategoryIds.includes(id))
      })
    }

    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.shortDescription && d.shortDescription.toLowerCase().includes(q)),
      )
    }

    list = list.filter((d) => matchesPrice(d, priceFilter) && matchesRating(d, ratingFilter))

    if (sort === 'popular') {
      list.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0))
    } else if (sort === 'price_low') {
      list.sort((a, b) => a.price - b.price)
    } else if (sort === 'price_high') {
      list.sort((a, b) => b.price - a.price)
    }

    return list
  }, [dishes, selectedCategoryIds, search, sort, priceFilter, ratingFilter])

  const filterKey = useMemo(
    () =>
      [
        [...selectedCategoryIds].sort().join(','),
        search,
        sort,
        priceFilter,
        ratingFilter,
      ].join('\u0001'),
    [selectedCategoryIds, search, sort, priceFilter, ratingFilter],
  )

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY
      const dy = y - lastScrollY.current
      lastScrollY.current = y

      if (y < DOCK_FULL_TOP_PX) {
        setDockMode('full')
        setCompactMobilePanelOpen(false)
        return
      }
      if (dy > SCROLL_DELTA_PX) {
        setDockMode('hidden')
        setCompactMobilePanelOpen(false)
      } else if (dy < -SCROLL_DELTA_PX) {
        setDockMode('compact')
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const selectedCategoryLabels = selectedCategoryIds
    .map((id) => MENU_CATEGORIES.find((c) => c.id === id)?.label)
    .filter(Boolean)

  function toggleCategory(id) {
    if (id === 'all') {
      setSelectedCategoryIds([])
      return
    }
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const stickyDockClass = [
    styles.stickyDock,
    dockMode === 'full' && styles.stickyDockFull,
    dockMode === 'compact' && styles.stickyDockCompact,
    dockMode === 'compact' && compactMobilePanelOpen && styles.stickyDockCompactExpanded,
    dockMode === 'hidden' && styles.stickyDockHidden,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <main className={styles.menu}>
      <div className={styles.wrapOuter}>
        {catalogLoading && <p role="status">Đang tải thực đơn…</p>}
        {(catalogError || cartError) && <p role="alert">{catalogError || cartError} <Link to="/dang-nhap">Đăng nhập</Link></p>}
        <div className={stickyDockClass}>
          <div className={`wrap ${styles.stickyDockInner}`}>
            <header className={styles.pageHead}>
              <div className={styles.pageHeadText}>
                <h1 className={styles.pageTitle}>Thực đơn</h1>
                <p className={styles.pageSub}>Chọn món, thêm vào giỏ — giao tận phòng học.</p>
              </div>
            </header>

            <div className={styles.stickyRow2}>
              <select
                className={styles.select}
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Sắp xếp"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={styles.filterToggle}
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
                aria-controls="menu-filters"
              >
                <SlidersHorizontal size={18} strokeWidth={2} aria-hidden />
                Lọc
              </button>
              <div
                id="menu-filters"
                className={`${styles.filtersInline} ${showFilters ? '' : styles.filtersCollapsed}`}
              >
                <select
                  className={styles.select}
                  value={priceFilter}
                  onChange={(e) => setPriceFilter(e.target.value)}
                  aria-label="Lọc theo giá"
                >
                  {PRICE_FILTERS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <select
                  className={styles.select}
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value)}
                  aria-label="Lọc theo đánh giá"
                >
                  {RATING_FILTERS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <nav className={styles.stickyCats} aria-label="Danh mục món">
              {MENU_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={categoryChipClass(c, selectedCategoryIds)}
                  onClick={() => toggleCategory(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </nav>

            <div className={styles.compactMobileBar}>
              <button
                type="button"
                className={styles.compactMobileBtn}
                onClick={() => setCompactMobilePanelOpen((v) => !v)}
                aria-expanded={compactMobilePanelOpen}
                aria-controls="menu-compact-mobile-panel"
              >
                <SlidersHorizontal size={18} strokeWidth={2} aria-hidden />
                <span>Lọc & danh mục</span>
                <ChevronDown
                  className={compactMobilePanelOpen ? styles.compactMobileChevronOpen : styles.compactMobileChevron}
                  size={18}
                  strokeWidth={2}
                  aria-hidden
                />
              </button>
            </div>

            <div
              id="menu-compact-mobile-panel"
              className={
                compactMobilePanelOpen
                  ? `${styles.compactMobilePanel} ${styles.compactMobilePanelOpen}`
                  : styles.compactMobilePanel
              }
              hidden={!compactMobilePanelOpen}
            >
              <div className={styles.compactMobilePanelInner}>
                <div className={styles.compactMobileFilters}>
                  <select
                    className={styles.select}
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    aria-label="Sắp xếp"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className={styles.select}
                    value={priceFilter}
                    onChange={(e) => setPriceFilter(e.target.value)}
                    aria-label="Lọc theo giá"
                  >
                    {PRICE_FILTERS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className={styles.select}
                    value={ratingFilter}
                    onChange={(e) => setRatingFilter(e.target.value)}
                    aria-label="Lọc theo đánh giá"
                  >
                    {RATING_FILTERS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.compactPanelCats} role="group" aria-label="Danh mục món">
                  {MENU_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={categoryChipClass(c, selectedCategoryIds)}
                      onClick={() => {
                        toggleCategory(c.id)
                        setCompactMobilePanelOpen(false)
                      }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`wrap ${styles.wrap}`}>
          <div className={styles.shell}>
            <section className={styles.main} aria-label="Danh sách món">
              <MenuFilteredResults
                key={filterKey}
                filtered={filtered}
                selectedCategoryLabels={selectedCategoryLabels}
              />
            </section>

            <aside className={styles.cartPanel} aria-label="Giỏ hàng">
              <div className={styles.cartSticky}>
                <div className={styles.cartHead}>
                  <ShoppingBag size={22} strokeWidth={2} aria-hidden />
                  <h2 className={styles.cartTitle}>Giỏ của bạn</h2>
                  <span className={styles.cartBadge}>{totalCount}</span>
                </div>

                {lines.length === 0 ? (
                  <p className={styles.cartEmpty}>Chưa có món. Chọn số lượng và bấm &quot;Thêm vào giỏ&quot;.</p>
                ) : (
                  <ul className={styles.cartList}>
                    {lines.map(({ dish, qty }) => (
                      <li key={dish.id} className={styles.cartLine}>
                        <div className={styles.cartLineThumb}>
                          <img src={dish.image} alt="" />
                        </div>
                        <div className={styles.cartLineMain}>
                          <p className={styles.cartLineName}>{dish.name}</p>
                          <p className={styles.cartLinePrice}>{formatVnd(dish.price)}</p>
                          <div className={styles.cartLineQty}>
                            <button
                              type="button"
                              className={styles.qtyBtnSm}
                              onClick={() => add(dish.id, -1)}
                              aria-label="Giảm"
                            >
                              <span className={`material-symbols-outlined ${styles.qtyBtnSmMs}`}>remove</span>
                            </button>
                            <span className={styles.qtyValSm}>{qty}</span>
                            <button
                              type="button"
                              className={styles.qtyBtnSm}
                              onClick={() => add(dish.id, 1)}
                              aria-label="Tăng"
                            >
                              <span className={`material-symbols-outlined ${styles.qtyBtnSmMs}`}>add</span>
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className={styles.cartFooter}>
                  <Link
                    className={totalCount > 0 ? styles.checkoutBtn : styles.checkoutBtnDisabled}
                    to={totalCount > 0 ? '/gio-hang' : '#'}
                    onClick={(e) => totalCount === 0 && e.preventDefault()}
                  >
                    Xem giỏ & thanh toán
                  </Link>
                  <p className={styles.cartHint}>Phí giao hàng được tính theo hình thức nhận món ở bước tiếp theo.</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  )
}
