import { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react'
import { useDishes } from './DishesContext'
import { addCartLine, cartQuantity, restoreCart, resolveCartLine } from '../utils/cartLines'

const STORAGE_KEY = 'neufood-cart-v2'
const PENDING_KEY = 'neufood-cart-pending-v1'
const CartContext = createContext(null)

export function CartProvider({ children }) {
  const { dishes, isLoading: menuLoading, error: menuError, maxDishQuantity } = useDishes()
  const [rows, setRows] = useState(() => restoreCart(localStorage.getItem(STORAGE_KEY), localStorage.getItem('neufood-cart-v1')))
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); localStorage.removeItem('neufood-cart-v1') }, [rows])
  useEffect(() => {
    try {
      const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || '{}')
      if (pending.adds) setRows(prev => {
        let next = prev
        for (const [id, qty] of Object.entries(pending.adds)) {
          const dish = dishes.find(d => d.id === id)
          if (dish) next = addCartLine(next, dish, Math.min(maxDishQuantity - cartQuantity(next, id), Math.max(0, Math.floor(Number(qty)))), maxDishQuantity)
        }
        return next
      })
      sessionStorage.removeItem(PENDING_KEY)
    } catch { /* Ignore malformed pending additions. */ }
  }, [])
  const getQty = useCallback(id => cartQuantity(rows, id), [rows])
  const quantities = useMemo(() => Object.fromEntries(rows.map(row => [row.dishId, getQty(row.dishId)])), [rows, getQty])
  const add = useCallback((id, delta = 1, config) => {
    const dish = dishes.find(d => d.id === id)
    if (!dish || (delta > 0 && (menuLoading || menuError))) return false
    try {
      const next = addCartLine(rows, dish, delta, maxDishQuantity, config)
      if (next === rows) return false
      setRows(prev => addCartLine(prev, dish, delta, maxDishQuantity, config))
      return true
    } catch { return false }
  }, [dishes, rows, maxDishQuantity, menuLoading, menuError])
  const setQuantity = useCallback((lineId, qty) => setRows(prev => {
    const row = prev.find(row => row.lineId === lineId)
    if (!row) return prev
    const q = Math.max(0, Math.min(Math.floor(Number(qty)) || 0, maxDishQuantity - cartQuantity(prev.filter(other => other !== row), row.dishId)))
    return q === 0 ? prev.filter(other => other !== row) : prev.map(other => other === row ? { ...row, qty: q } : other)
  }), [maxDishQuantity])
  const clear = useCallback(() => setRows([]), [])
  const lines = useMemo(() => rows.map(row => resolveCartLine(row, dishes.find(d => d.id === row.dishId), menuLoading ? 'Đang tải thực đơn' : menuError)), [rows, dishes, menuLoading, menuError])
  const reviewLine = useCallback(lineId => {
    const line = lines.find(line => line.lineId === lineId)
    if (!line?.canReview) return
    setRows(prev => prev.map(row => row.lineId === lineId ? { ...row, unitPrice: line.currentUnitPrice, snapshot: line.currentSnapshot } : row))
  }, [lines])
  const totalCount = lines.reduce((sum, line) => sum + line.qty, 0)
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0)
  const unavailableLines = lines.filter(line => line.invalidReason)
  return <CartContext.Provider value={{ quantities, add, setQuantity, clear, lines, totalCount, subtotal, getQty, unavailableLines, maxDishQuantity, reviewLine }}>{children}</CartContext.Provider>
}
export function useCart() {
  const cart = useContext(CartContext)
  if (!cart) throw new Error('useCart must be used within CartProvider')
  return cart
}
