import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { roleDestination } from './roleDestination'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'user' | 'customer' | 'admin' | 'manager' | 'staff'
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#003f87] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={`/DANGNHAP.html?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`} replace />
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={roleDestination(user.role)} replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
