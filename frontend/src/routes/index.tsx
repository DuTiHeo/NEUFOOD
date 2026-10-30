import React from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import MainLayout from '../components/layout/MainLayout'
import ManagerLayout from '../components/manager/ManagerLayout'
import StaffLayout from '../components/staff/StaffLayout'
import ProtectedRoute from './ProtectedRoute'
import { useAuth } from '../contexts/AuthContext'
import { roleDestination } from './roleDestination'
import { CartProvider } from '../contexts/CartContext'
import { OrderHistoryProvider } from '../contexts/OrderHistoryContext'
import { MenuSearchProvider } from '../contexts/MenuSearchContext'
import { DishesProvider } from '../contexts/DishesContext'

// User Pages
import HomePage from '../pages/user/HomePage'
import MenuPage from '../pages/user/MenuPage'
import ChiTietMonPage from '../pages/user/ChiTietMonPage'
import GioHangPage from '../pages/user/GioHangPage'
import ThanhToanPage from '../pages/user/ThanhToanPage'
import DonHangPage from '../pages/user/DonHangPage'
import LichSuDonHangPage from '../pages/user/LichSuDonHangPage'
import TaiKhoanPage from '../pages/user/TaiKhoanPage'
import StoryPage from '../pages/user/StoryPage'
import RecruitPage from '../pages/user/RecruitPage'

// Auth Pages
import AuthRedirect from './AuthRedirect'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage'
import OAuthCallbackPage from '../pages/auth/OAuthCallbackPage'

// Staff and shared manager/admin pages
import SystemAdminLayout from '../components/admin/SystemAdminLayout'
import AdminDashboardPage from '../pages/admin/AdminDashboardPage'
import AdminBaoCaoPage from '../pages/admin/AdminBaoCaoPage'
import AdminSystemPage from '../pages/admin/AdminSystemPage'
import ManagerDashboardPage from '../pages/manager/ManagerDashboardPage'
import ManagerOrdersPage from '../pages/manager/ManagerOrdersPage'
import ManagerMenuPage from '../pages/manager/ManagerMenuPage'
import ManagerDishFormPage from '../pages/manager/ManagerDishFormPage'
import ManagerShiftsPage from '../pages/manager/ManagerShiftsPage'
import ManagerReviewsPage from '../pages/manager/ManagerReviewsPage'
import ManagerReportsPage from '../pages/manager/ManagerReportsPage'
import StaffDashboardPage from '../pages/staff/StaffDashboardPage'
import StaffShiftPage from '../pages/staff/StaffShiftPage'
import StaffMenuPage from '../pages/staff/StaffMenuPage'
import NotFoundPage from '../pages/not-found/NotFoundPage'

function StaffSuite() {
  return <StaffLayout />
}

function CustomerSuite() {
  const { user, isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <div className="min-h-screen flex items-center justify-center" role="status">Đang tải phiên đăng nhập…</div>
  if (isAuthenticated && ['admin', 'manager', 'staff'].includes(user?.role || '')) {
    return <Navigate to={roleDestination(user?.role)} replace />
  }
  return <DishesProvider><CartProvider><OrderHistoryProvider><MenuSearchProvider><MainLayout /></MenuSearchProvider></OrderHistoryProvider></CartProvider></DishesProvider>
}

function StaffAliasRedirect() {
  const { pathname, search } = useLocation()
  const target = pathname.replace(/^\/nhanvien(?=\/|$)/, '/nhan-vien')
  return <Navigate to={`${target}${search}`} replace />
}

export const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/dang-nhap" element={<AuthRedirect />} />
    <Route path="/dang-ky" element={<AuthRedirect register />} />
    <Route path="/DANGNHAP.html" element={<AuthRedirect />} />
    <Route path="/DANGKY.html" element={<AuthRedirect register />} />
    <Route path="/nhan-vien" element={<ProtectedRoute requiredRole="staff"><StaffSuite /></ProtectedRoute>}>
      <Route index element={<StaffDashboardPage />} />
      <Route path="don" element={<ManagerOrdersPage audience="staff" />} />
      <Route path="mon" element={<StaffMenuPage />} />
      <Route path="ca" element={<StaffShiftPage />} />
      <Route path="*" element={<Navigate to="/nhan-vien" replace />} />
    </Route>
    <Route path="/nhanvien/*" element={<StaffAliasRedirect />} />

    {/* Legacy sign-in URLs use the same static authentication screen. */}
    <Route path="/quan-ly/dang-nhap" element={<AuthRedirect />} />
    <Route path="/admin/dang-nhap" element={<AuthRedirect />} />

    <Route path="/quan-ly" element={<ProtectedRoute requiredRole="manager"><ManagerLayout /></ProtectedRoute>}>
      <Route index element={<ManagerDashboardPage />} />
      <Route path="don" element={<ManagerOrdersPage />} />
      <Route path="mon" element={<ManagerMenuPage />} />
      <Route path="mon/them" element={<ManagerDishFormPage />} />
      <Route path="mon/sua/:id" element={<ManagerDishFormPage />} />
      <Route path="bao-cao" element={<ManagerReportsPage />} />
      <Route path="ca" element={<ManagerShiftsPage />} />
      <Route path="danh-gia" element={<ManagerReviewsPage />} />
      <Route path="*" element={<Navigate to="/quan-ly" replace />} />
    </Route>
    <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><SystemAdminLayout /></ProtectedRoute>}>
      <Route index element={<AdminDashboardPage />} />
      <Route path="bao-cao" element={<AdminBaoCaoPage />} />
      <Route path="tai-khoan" element={<AdminSystemPage section="users" />} />
      <Route path="dia-diem" element={<AdminSystemPage section="locations" />} />
      <Route path="cau-hinh" element={<AdminSystemPage section="settings" />} />
      <Route path="khieu-nai" element={<AdminSystemPage section="complaints" />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Route>

    {/* Guest and customer dashboard use the same completed HomePage. */}
    <Route element={<CustomerSuite />}>
      <Route index element={<HomePage />} />
      <Route path="khach-hang" element={<HomePage />} />
      <Route path="menu" element={<MenuPage />} />
      <Route path="story" element={<StoryPage />} />
      <Route path="recruit" element={<RecruitPage />} />
      <Route path="mon/:id" element={<ChiTietMonPage />} />
      <Route path="gio-hang" element={<GioHangPage />} />
      <Route path="thanh-toan" element={<ProtectedRoute requiredRole="customer"><ThanhToanPage /></ProtectedRoute>} />
      <Route path="lich-su-don" element={<ProtectedRoute requiredRole="customer"><LichSuDonHangPage /></ProtectedRoute>} />
      <Route path="don-hang/:orderId" element={<ProtectedRoute requiredRole="customer"><DonHangPage /></ProtectedRoute>} />
      <Route path="don-hang" element={<Navigate to="/lich-su-don" replace />} />
      <Route path="tai-khoan" element={<ProtectedRoute><TaiKhoanPage /></ProtectedRoute>} />
      <Route path="quen-mat-khau" element={<ForgotPasswordPage />} />
      <Route path="oauth/callback" element={<OAuthCallbackPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>
)

export default AppRoutes
