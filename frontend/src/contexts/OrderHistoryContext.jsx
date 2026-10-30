import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { orderService } from '../services/orderService'

const OrderHistoryContext = createContext(null)

export function OrderHistoryProvider({ children }) {
  const { isAuthenticated, token } = useAuth()
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setOrders([])
      setError('')
      setIsLoading(false)
      return []
    }

    setIsLoading(true)
    setError('')
    try {
      const result = await orderService.getMyOrders()
      setOrders(result)
      return result
    } catch (requestError) {
      const message = requestError?.response?.data?.message || 'Không thể tải đơn hàng. Vui lòng thử lại.'
      setError(message)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    void refresh()
  }, [refresh, token])

  const value = useMemo(
    () => ({ orders, isLoading, error, refresh, setOrders }),
    [orders, isLoading, error, refresh],
  )

  return <OrderHistoryContext.Provider value={value}>{children}</OrderHistoryContext.Provider>
}

export function useOrderHistory() {
  const context = useContext(OrderHistoryContext)
  if (!context) throw new Error('useOrderHistory must be used within OrderHistoryProvider')
  return context
}
