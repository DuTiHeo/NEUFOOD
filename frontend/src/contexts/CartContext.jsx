import { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { dishService } from '../services/dishService'
import { orderError } from '../utils/orders'

const STORAGE_KEY = 'neufood-cart-v1'
const CartContext = createContext(null)
export function CartProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const [quantities, setQuantities] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      return Object.fromEntries(Object.entries(stored).filter(([, quantity]) => Number.isInteger(quantity) && quantity > 0).map(([id, quantity]) => [id, Math.min(10, Number(quantity))]))
    } catch { return {} }
  })
  const [catalog, setCatalog] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [cartError, setCartError] = useState('')
  useEffect(() => {
    let ignore = false
    async function load() {
      try {
        const first = await dishService.getDishes({ page: 1, limit: 100 })
        const rows = [...first.items]
        for (let page = 2; rows.length < first.total; page++) {
          const next = await dishService.getDishes({ page, limit: 100 })
          if (!next.items.length) break
          rows.push(...next.items)
        }
        if (!ignore) setCatalog(rows.map(dish => ({ ...dish, image: dish.image_url || dish.image,
          shortDescription: dish.short_description || dish.shortDescription, categoryIds: dish.category_ids || dish.categoryIds || [],
          rating: Number(dish.rating || 0), reviewCount: dish.review_count || 0 })))
      } catch (err) { if (!ignore) setCatalogError(orderError(err)) }
      finally { if (!ignore) setCatalogLoading(false) }
    }
    load()
    return () => { ignore = true }
  }, [])
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(quantities)) }, [quantities])
  const add = useCallback((id, delta = 1) => {
    if (delta > 0 && (!isAuthenticated || user?.role !== 'customer')) { setCartError('Vui lòng đăng nhập bằng tài khoản khách hàng để thêm món.'); return }
    if (delta > 0 && !catalog.find(dish => dish.id === id && dish.is_available)) { setCartError('Món đã hết hoặc không còn được phục vụ.'); return }
    setCartError('')
    setQuantities(previous => {
      const quantity = Math.min(10, Math.max(0, (previous[id] || 0) + delta))
      const next = { ...previous, [id]: quantity }
      if (!quantity) delete next[id]
      return next
    })
  }, [isAuthenticated, user?.role, catalog])
  const setQuantity = useCallback((id, quantity) => {
    if (!Number.isFinite(Number(quantity))) return
    const next = Math.min(10, Math.max(0, Math.floor(Number(quantity))))
    setQuantities(previous => { const rows = { ...previous, [id]: next }; if (!next) delete rows[id]; return rows })
  }, [])
  const clear = useCallback(() => setQuantities({}), [])
  const lines = useMemo(() => Object.entries(quantities).flatMap(([id, qty]) => {
    const dish = catalog.find(row => row.id === id)
    return dish ? [{ dish, qty }] : []
  }), [quantities, catalog])
  const totalCount = lines.reduce((sum, line) => sum + line.qty, 0)
  const subtotal = lines.reduce((sum, line) => sum + line.dish.price * line.qty, 0)
  const getQty = useCallback(id => quantities[id] || 0, [quantities])
  const value = { quantities, add, setQuantity, clear, lines, totalCount, subtotal, getQty, catalog, catalogLoading, catalogError, cartError }
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used within CartProvider')
  return context
}
