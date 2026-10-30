import { createContext, useCallback, useContext, useMemo } from 'react'
import { authService } from '../services/authService'
import { useAuth } from './AuthContext'

const MANAGEMENT_ROLES = new Set(['staff', 'manager', 'admin'])
const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const { user, isAuthenticated, isLoading, login: setAuth, logout } = useAuth()
  const isAdmin = isAuthenticated && MANAGEMENT_ROLES.has(user?.role)

  const login = useCallback(async (email, password) => {
    const data = await authService.login({ email: email.trim(), password })
    if (!MANAGEMENT_ROLES.has(data?.user?.role)) {
      throw new Error('Tài khoản này không có quyền truy cập khu vực Canteen.')
    }

    setAuth(data.access_token, data.user, data.refresh_token)
    return data.user
  }, [setAuth])

  const value = useMemo(
    () => ({ isAdmin, isLoading, login, logout }),
    [isAdmin, isLoading, login, logout],
  )

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider')
  return ctx
}
