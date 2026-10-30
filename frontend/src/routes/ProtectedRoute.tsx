import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useAdminAuth } from '../contexts/AdminAuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'user' | 'customer' | 'admin'
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth()
  const { isAdmin } = useAdminAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#003f87] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (requiredRole === 'customer') {
    if (!isAuthenticated) {
      return <Navigate to={`/DANGNHAP.html?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`} replace />
    }
    if (user?.role !== 'customer') {
      return <Navigate to="/quan-ly" replace />
    }
    return <>{children}</>
  }

  if (requiredRole === 'admin') {
    if (!isAdmin && user?.role !== 'admin') {
      return <Navigate to="/quan-ly/dang-nhap" replace state={{ from: location }} />
    }
    return <>{children}</>
  }

  if (!isAuthenticated && !isAdmin) {
    return <Navigate to={`/DANGNHAP.html?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`} replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
