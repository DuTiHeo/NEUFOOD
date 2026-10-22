import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
export default function RequireAdmin({ children }) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const { pathname } = useLocation()
  if (isLoading) return <p role="status">Đang kiểm tra phiên đăng nhập…</p>
  if (!isAuthenticated) return <Navigate to="/quan-ly/dang-nhap" replace state={{ from: pathname }} />
  if (!['staff', 'manager', 'admin'].includes(user?.role)) return <Navigate to="/" replace />
  if (user.role === 'staff' && pathname !== '/quan-ly/don') return <Navigate to="/quan-ly/don" replace />
  return children
}
