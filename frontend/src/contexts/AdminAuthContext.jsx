import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const STORAGE_KEY = 'neufood_admin_auth'

const ADMIN_EMAIL = 'admin@gmail.com'
const ADMIN_PASSWORD = 'admin123'

const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  const login = useCallback((email, password) => {
    const ok =
      email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD
    if (ok) {
      try {
        localStorage.setItem(STORAGE_KEY, '1')
      } catch {
        /* ignore */
      }
      setToken(true)
    }
    return ok
  }, [])

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    setToken(false)
  }, [])

  const value = useMemo(
    () => ({
      isAdmin: Boolean(token),
      login,
      logout,
    }),
    [token, login, logout],
  )

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider')
  return ctx
}
