import { createContext, useContext } from 'react'
import { useAuth } from './AuthContext'
import { authService } from '../services/authService'

const AdminAuthContext = createContext(null)
export function AdminAuthProvider({ children }) {
  const auth = useAuth()
  async function login(email, password) {
    const response = await authService.login({ email, password })
    if (!['staff', 'manager', 'admin'].includes(response.user.role)) return false
    auth.login(response.access_token, response.user)
    return true
  }
  return <AdminAuthContext.Provider value={{ isAdmin: Boolean(auth.token && ['staff', 'manager', 'admin'].includes(auth.user?.role)), user: auth.user, login, logout: auth.logout }}>{children}</AdminAuthContext.Provider>
}
export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (!context) throw new Error('useAdminAuth must be used within AdminAuthProvider')
  return context
}
