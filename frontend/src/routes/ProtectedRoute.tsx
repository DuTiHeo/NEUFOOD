import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
export default function ProtectedRoute({ children }) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <p role="status">Đang kiểm tra phiên đăng nhập…</p>
  if (!isAuthenticated) return <Navigate to="/dang-nhap" replace state={{ from: location }} />
  if (user?.role !== 'customer') return <Navigate to="/quan-ly/don" replace />
  return children
}
