import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Star, Minus, Plus, ShoppingBag, SlidersHorizontal, ChevronDown, Check, Trash2 } from 'lucide-react'
import { useCart } from '../../contexts/CartContext'
import { useDishes } from '../../contexts/DishesContext'
import { useMenuSearch } from '../../contexts/MenuSearchContext'
import Footer from '../../components/layout/Footer'
import { formatVnd } from '../../utils/money'
import { getDishImageUrl, handleDishImageError } from '../../utils/dishImages'
import styles from './MenuPage.module.css'

const BADGE_LABELS: Record<string, string> = {
  bestSeller: 'Bán chạy',
  new: 'Mới',
  hot: 'Hot 🔥',
}

const SORT_OPTIONS = [
  { id: 'popular', label: 'Phổ biến nhất' },
  { id: 'price_low', label: 'Giá: Thấp → Cao' },
  { id: 'price_high', label: 'Giá: Cao → Thấp' },
]

const PRICE_FILTERS = [
  { id: 'all', label: 'Mọi mức giá' },
  { id: 'lt30', label: 'Dưới 30.000đ' },
  { id: '30_50', label: '30.000 – 50.000đ' },
  { id: 'gt50', label: 'Trên 50.000đ' },
]

const RATING_FILTERS = [
  { id: 'all', label: 'Mọi đánh giá' },
  { id: 'r45', label: 'Từ 4.5★ trở lên' },
  { id: 'r47', label: 'Từ 4.7★ trở lên' },
]

function matchesPrice(dish: any, priceFilter: string) {
  if (priceFilter === 'all') return true
  if (priceFilter === 'lt30') return dish.price < 30000
  if (priceFilter === '30_50') return dish.price >= 30000 && dish.price <= 50000
  if (priceFilter === 'gt50') return dish.price > 50000
  return true
}

function matchesRating(dish: any, ratingFilter: string) {
  if (ratingFilter === 'all') return true
  if (Number(dish.reviewCount ?? dish.review_count ?? 0) < 1) return false
  if (ratingFilter === 'r45') return dish.rating >= 4.5
  if (ratingFilter === 'r47') return dish.rating >= 4.7
  return true
}

function categoryChipClass(c: any, selectedCategoryIds: string[]) {
  const on =
    c.id === 'all'
      ? selectedCategoryIds.length === 0
      : selectedCategoryIds.includes(c.id)
  return on ? styles.catChipOn : styles.catChip
}

function StarRow({ value }: { value: number }) {
  const n = Math.min(5, Math.max(0, Math.round(value)))
  return (
    <div className={styles.stars} aria-label={`${value} trên 5 sao`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          size={13}
          strokeWidth={0}
          fill={i < n ? '#F59E0B' : '#E2E8F0'}
          aria-hidden
        />
      ))}
    </div>
  )
}

function DishCard({ dish }: { dish: any }) {
  const { add, getQty, maxDishQuantity } = useCart()
  const [draft, setDraft] = useState(1)
  const [added, setAdded] = useState(false)
  const reachedLimit = getQty(dish.id) >= maxDishQuantity

  function bump(delta: number) {
    setDraft((d) => Math.min(maxDishQuantity, Math.max(1, d + delta)))
  }

  function addToCart() {
    const remaining = Math.max(0, maxDishQuantity - getQty(dish.id))
    const quantityToAdd = Math.min(draft, remaining)
    if (!quantityToAdd || !add(dish.id, quantityToAdd)) return
    setAdded(true)
    setTimeout(() => setAdded(false), 1200)
    setDraft(1)
  }

  return (
    <article className={styles.card}>
      <Link to={`/mon/${dish.id}`} className={styles.cardImageLink} aria-label={`Xem ${dish.name}`}>
        <div className={styles.cardImageWrap}>
          <img className={styles.cardImage} src={getDishImageUrl(dish)} alt={dish.name} loading="lazy" onError={handleDishImageError} />
          <div className={styles.badges}>
            {(dish.badges ?? []).map((b: string) => (
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
        <div className={styles.cardHeader}>
          <Link to={`/mon/${dish.id}`} className={styles.cardTitleLink}>
            <h2 className={styles.cardTitle}>{dish.name}</h2>
          </Link>
          {Number(dish.reviewCount ?? dish.review_count ?? 0) > 0 ? <div className={styles.ratingRow}>
            <StarRow value={Number(dish.rating || 0)} />
            <span className={styles.ratingNum}>{Number(dish.rating || 0).toFixed(1)}</span>
            <span className={styles.reviewCount}>({dish.reviewCount ?? dish.review_count ?? 0})</span>
          </div> : <p className={styles.reviewCount}>Chưa có đánh giá</p>}
        </div>

        <p className={styles.cardDesc}>{dish.shortDescription}</p>

        <div className={styles.cardFooter}>
          <p className={styles.price}>{formatVnd(dish.price)}</p>

          <div className={styles.cardActionsRow}>
            <div className={styles.qtyStepper}>
              <button
                type="button"
                className={styles.qtyStepBtn}
                disabled={draft <= 1}
                onClick={() => bump(-1)}
                aria-label="Giảm số lượng"
              >
                <Minus size={15} strokeWidth={2.5} />
              </button>
              <span className={styles.qtyStepVal}>{draft}</span>
              <button
                type="button"
                className={styles.qtyStepBtn}
                disabled={draft >= maxDishQuantity}
                onClick={() => bump(1)}
                aria-label="Tăng số lượng"
              >
                <Plus size={15} strokeWidth={2.5} />
              </button>
            </div>
            <button
              type="button"
              className={`${styles.addToCartBtn} ${added ? styles.addToCartBtnSuccess : ''}`}
              onClick={addToCart}
              disabled={dish.is_available === false || reachedLimit}
              aria-label={`Thêm ${draft} ${dish.name} vào giỏ hàng`}
            >
              {dish.is_available === false ? (
                <span>Hết món</span>
              ) : reachedLimit ? (
                <span>Đủ số lượng</span>
              ) : added ? (
                <>
                  <Check size={16} strokeWidth={2.5} />
                  <span>Đã thêm</span>
                </>
              ) : (
                <>
                  <Plus size={16} strokeWidth={2.5} />
                  <span>Thêm</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

function MenuFilteredResults({ filtered, selectedCategoryLabels }: { filtered: any[]; selectedCategoryLabels: string[] }) {
  const PAGE_SIZE = 12
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pagedDishes = filtered.slice(pageStart, pageStart + PAGE_SIZE)
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <>
      <div className={styles.resultBar}>
        <p className={styles.resultCount}>
          Tìm thấy <strong>{filtered.length}</strong> món
          {selectedCategoryLabels.length > 0 ? ` trong ${selectedCategoryLabels.join(', ')}` : ''}
        </p>
      </div>

      <div className={styles.grid}>
        {pagedDishes.map((dish) => (
          <DishCard key={dish.id} dish={dish} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🍽️</div>
          <p className={styles.empty}>Không có món phù hợp với tiêu chí lọc.</p>
          <span className={styles.emptyHint}>Hãy thử đổi bộ lọc giá, đánh giá hoặc từ khóa tìm kiếm.</span>
        </div>
      ) : null}

      {totalPages > 1 ? (
        <div className={styles.pagination} aria-label="Chuyển trang món ăn">
          <button
            type="button"
            className={styles.pageBtn}
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            aria-label="Trang trước"
          >
            ‹
          </button>
          {pageNumbers.map((p) => (
            <button
              key={p}
              type="button"
              className={p === currentPage ? styles.pageBtnOn : styles.pageBtn}
              onClick={() => setCurrentPage(p)}
              aria-current={p === currentPage ? 'page' : undefined}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            className={styles.pageBtn}
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Trang tiếp"
          >
            ›
          </button>
        </div>
      ) : null}
    </>
  )
}

const DOCK_FULL_TOP_PX = 68
const SCROLL_DELTA_PX = 10

export default function MenuPage() {
  const { add, lines, totalCount, subtotal } = useCart()
  const { dishes, categories, isLoading, error, refresh } = useDishes()
  const { menuSearch: search } = useMenuSearch()
  const menuCategories = useMemo(
    () => [
      { id: 'all', label: 'Tất cả' },
      ...categories.map((category) => ({ id: category.id, label: category.label || category.name || category.id })),
    ],
    [categories],
  )

  const lastScrollY = useRef(typeof window !== 'undefined' ? window.scrollY : 0)
  const [dockMode, setDockMode] = useState<'full' | 'compact' | 'hidden'>(() => {
    if (typeof window === 'undefined') return 'full'
    return window.scrollY >= DOCK_FULL_TOP_PX ? 'compact' : 'full'
  })
  const [compactMobilePanelOpen, setCompactMobilePanelOpen] = useState(false)

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [sort, setSort] = useState('popular')
  const [priceFilter, setPriceFilter] = useState('all')
  const [ratingFilter, setRatingFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => {
    let list = [...dishes]

    if (selectedCategoryIds.length > 0) {
      list = list.filter((d: any) => {
        const dishCategoryIds = d.categoryIds ?? d.category_ids ?? []
        return dishCategoryIds.some((id: string) => selectedCategoryIds.includes(id))
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
      const delta = y - lastScrollY.current
      lastScrollY.current = y

      if (y < DOCK_FULL_TOP_PX) {
        setDockMode('full')
        setCompactMobilePanelOpen(false)
        return
      }
      if (delta > SCROLL_DELTA_PX) {
        setDockMode('hidden')
        setCompactMobilePanelOpen(false)
      } else if (delta < -SCROLL_DELTA_PX) {
        setDockMode('compact')
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const selectedCategoryLabels = selectedCategoryIds
    .map((id) => menuCategories.find((c) => c.id === id)?.label)
    .filter((l): l is string => Boolean(l))

  function toggleCategory(id: string) {
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
        <div className={stickyDockClass}>
          <div className={`wrap ${styles.stickyDockInner}`}>
            <div className={styles.pageHeadRow}>
              <div className={styles.pageHeadText}>
                <h1 className={styles.pageTitle}>Thực đơn NEUFood</h1>
                <p className={styles.pageSub}>Chọn món ngon, đặt nhanh — giao tận giảng đường & KTX NEU.</p>
              </div>

              <div className={styles.controlsRow}>
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
                  className={`${styles.filterToggle} ${showFilters ? styles.filterToggleActive : ''}`}
                  onClick={() => setShowFilters((v) => !v)}
                  aria-expanded={showFilters}
                  aria-controls="menu-filters"
                >
                  <SlidersHorizontal size={16} strokeWidth={2} aria-hidden />
                  <span>Bộ lọc</span>
                </button>
              </div>
            </div>

            <div
              id="menu-filters"
              className={`${styles.filtersInline} ${showFilters ? '' : styles.filtersCollapsed}`}
            >
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Mức giá:</span>
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
              </div>
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Đánh giá:</span>
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
              {menuCategories.map((c) => (
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
                <SlidersHorizontal size={16} strokeWidth={2} aria-hidden />
                <span>Lọc & danh mục ({selectedCategoryIds.length || 'Tất cả'})</span>
                <ChevronDown
                  className={compactMobilePanelOpen ? styles.compactMobileChevronOpen : styles.compactMobileChevron}
                  size={16}
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
                  {menuCategories.map((c) => (
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
              {isLoading ? <p role="status">Đang tải thực đơn…</p> : null}
              {error ? (
                <div role="alert">
                  <p>Chưa tải được thực đơn từ máy chủ: {error}</p>
                  <button type="button" onClick={() => void refresh()}>Thử lại</button>
                </div>
              ) : null}
              {!isLoading && !error ? (
                <MenuFilteredResults
                  key={filterKey}
                  filtered={filtered}
                  selectedCategoryLabels={selectedCategoryLabels}
                />
              ) : null}
            </section>

            <aside className={styles.cartPanel} aria-label="Giỏ hàng">
              <div className={styles.cartSticky}>
                <div className={styles.cartHead}>
                  <div className={styles.cartHeadLeft}>
                    <ShoppingBag size={20} strokeWidth={2} className={styles.cartHeadIcon} aria-hidden />
                    <h2 className={styles.cartTitle}>Giỏ hàng</h2>
                  </div>
                  <span className={styles.cartBadge}>{totalCount} món</span>
                </div>

                {lines.length === 0 ? (
                  <div className={styles.cartEmptyWrap}>
                    <div className={styles.cartEmptyIcon}>🛍️</div>
                    <p className={styles.cartEmpty}>Giỏ hàng đang trống.</p>
                    <span className={styles.cartEmptyHint}>Hãy chọn món ăn yêu thích từ thực đơn bên cạnh.</span>
                  </div>
                ) : (
                  <ul className={styles.cartList}>
                    {lines.map(({ dish, qty }: any) => (
                      <li key={dish.id} className={styles.cartLine}>
                        <div className={styles.cartLineThumb}>
                          <img src={getDishImageUrl(dish)} alt={dish.name} onError={handleDishImageError} />
                        </div>
                        <div className={styles.cartLineMain}>
                          <p className={styles.cartLineName}>{dish.name}</p>
                          <p className={styles.cartLinePrice}>{formatVnd(dish.price)}</p>
                          <div className={styles.cartLineQty}>
                            <button
                              type="button"
                              className={styles.qtyBtnSm}
                              onClick={() => add(dish.id, -1)}
                              aria-label={`Giảm số lượng ${dish.name}`}
                            >
                              <Minus size={13} strokeWidth={2.5} />
                            </button>
                            <span className={styles.qtyValSm}>{qty}</span>
                            <button
                              type="button"
                              className={styles.qtyBtnSm}
                              onClick={() => add(dish.id, 1)}
                              aria-label={`Tăng số lượng ${dish.name}`}
                            >
                              <Plus size={13} strokeWidth={2.5} />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className={styles.cartFooter}>
                  {totalCount > 0 && (
                    <div className={styles.cartSubtotalRow}>
                      <span className={styles.cartSubtotalLabel}>Tạm tính:</span>
                      <span className={styles.cartSubtotalVal}>{formatVnd(subtotal)}</span>
                    </div>
                  )}
                  <Link
                    className={totalCount > 0 ? styles.checkoutBtn : styles.checkoutBtnDisabled}
                    to={totalCount > 0 ? '/gio-hang' : '#'}
                    onClick={(e) => totalCount === 0 && e.preventDefault()}
                  >
                    <ShoppingBag size={18} />
                    <span>Xem giỏ & thanh toán</span>
                  </Link>
                  <p className={styles.cartHint}>⚡ Giao nhanh 15–20p tại khuôn viên NEU</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  )
}
