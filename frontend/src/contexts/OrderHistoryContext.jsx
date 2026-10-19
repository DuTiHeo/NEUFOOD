import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { orderService } from '../services/orderService'
import { orderError } from '../utils/orders'

const OrderHistoryContext = createContext(null)
export function OrderHistoryProvider({ children }) {
  const { user, token } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const version = useRef(0)
  const eligible = Boolean(token && user?.role === 'customer')
  const refresh = useCallback(async () => {
    if (!eligible) return
    const current = ++version.current
    setLoading(true)
    try {
      const rows = await orderService.getMyOrders()
      if (current === version.current && localStorage.getItem('neufood_token') === token) { setOrders(rows); setError('') }
    } catch (err) {
      if (current === version.current && localStorage.getItem('neufood_token') === token) setError(orderError(err))
    } finally { if (current === version.current && localStorage.getItem('neufood_token') === token) setLoading(false) }
  }, [eligible, token])
  useEffect(() => {
    setOrders([]); setError(''); setLoading(false)
    if (!eligible) return
    refresh()
    window.addEventListener('focus', refresh)
    return () => { version.current++; window.removeEventListener('focus', refresh) }
  }, [eligible, refresh])
  const addOrder = useCallback(async payload => {
    const order = await orderService.createOrder(payload)
    if (localStorage.getItem('neufood_token') === token) {
      version.current++; setLoading(false)
      setOrders(previous => [order, ...previous.filter(row => row.id !== order.id)])
    }
    return order
  }, [token])
  const value = useMemo(() => ({ orders: eligible ? orders : [], loading, error, refresh, addOrder }), [orders, loading, error, refresh, addOrder, eligible])
  return <OrderHistoryContext.Provider value={value}>{children}</OrderHistoryContext.Provider>
}
export function useOrderHistory() {
  const context = useContext(OrderHistoryContext)
  if (!context) throw new Error('useOrderHistory must be used within OrderHistoryProvider')
  return context
}
