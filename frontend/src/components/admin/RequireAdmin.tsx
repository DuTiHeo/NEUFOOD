import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from '../../contexts/AdminAuthContext'

interface RequireAdminProps {
  children: React.ReactNode
}

export default function RequireAdmin({ children }: RequireAdminProps) {
  const { isAdmin } = useAdminAuth()
  const { pathname } = useLocation()

  if (!isAdmin) {
    return <Navigate to="/quan-ly/dang-nhap" replace state={{ from: pathname }} />
  }

  return <>{children}</>
}
