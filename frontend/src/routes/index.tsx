import React from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import MainLayout from '../components/layout/MainLayout'
import AdminLayout from '../components/admin/AdminLayout'
import StaffLayout from '../components/staff/StaffLayout'
import { AdminDishesProvider } from '../contexts/AdminDishesContext'
import ProtectedRoute from './ProtectedRoute'

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
import AdminLoginPage from '../pages/admin/AdminLoginPage'
import AdminBaoCaoPage from '../pages/admin/AdminBaoCaoPage'
import AdminMonPage from '../pages/admin/AdminMonPage'
import AdminThemMonPage from '../pages/admin/AdminThemMonPage'
import AdminSuaMonPage from '../pages/admin/AdminSuaMonPage'
import AdminDonPage from '../pages/admin/AdminDonPage'
import AdminSystemPage from '../pages/admin/AdminSystemPage'
import ManagementDashboardPage from '../pages/admin/ManagementDashboardPage'
import StaffDashboardPage from '../pages/staff/StaffDashboardPage'
import StaffShiftPage from '../pages/staff/StaffShiftPage'
import NotFoundPage from '../pages/not-found/NotFoundPage'

function AdminSuite() {
  return <AdminDishesProvider><AdminLayout /></AdminDishesProvider>
}

function StaffSuite() {
  return <AdminDishesProvider><StaffLayout /></AdminDishesProvider>
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
    {/* Staff Canteen: cả hai đường dẫn giữ nguyên màn hình và các mục con */}
    <Route path="/nhan-vien" element={<StaffSuite />}>
      <Route index element={<StaffDashboardPage />} />
      <Route path="don" element={<AdminDonPage />} />
      <Route path="mon" element={<AdminMonPage />} />
      <Route path="ca" element={<StaffShiftPage />} />
    </Route>
    <Route path="/nhanvien/*" element={<StaffAliasRedirect />} />

    {/* Login is optional for viewing FE pages; API responses handle authorization. */}
    <Route path="/quan-ly/dang-nhap" element={<AdminLoginPage />} />
    <Route path="/admin/dang-nhap" element={<AdminLoginPage />} />

    {/* Manager and Admin share every screen and route. */}
    <Route path="/quan-ly" element={<AdminSuite />}>
      <Route index element={<ManagementDashboardPage />} />
      <Route path="don" element={<AdminDonPage />} />
      <Route path="mon" element={<AdminMonPage />} />
      <Route path="mon/them" element={<AdminThemMonPage />} />
      <Route path="mon/sua/:id" element={<AdminSuaMonPage />} />
      <Route path="bao-cao" element={<AdminBaoCaoPage />} />
      <Route path="ca" element={<AdminSystemPage section="shifts" />} />
      <Route path="danh-gia" element={<AdminSystemPage section="reviews" />} />
      <Route path="tai-khoan" element={<AdminSystemPage section="users" />} />
      <Route path="dia-diem" element={<AdminSystemPage section="locations" />} />
      <Route path="cau-hinh" element={<AdminSystemPage section="settings" />} />
      <Route path="khieu-nai" element={<AdminSystemPage section="complaints" />} />
    </Route>
    <Route path="/admin" element={<AdminSuite />}>
      <Route index element={<ManagementDashboardPage />} />
      <Route path="don" element={<AdminDonPage />} />
      <Route path="mon" element={<AdminMonPage />} />
      <Route path="mon/them" element={<AdminThemMonPage />} />
      <Route path="mon/sua/:id" element={<AdminSuaMonPage />} />
      <Route path="bao-cao" element={<AdminBaoCaoPage />} />
      <Route path="ca" element={<AdminSystemPage section="shifts" />} />
      <Route path="danh-gia" element={<AdminSystemPage section="reviews" />} />
      <Route path="tai-khoan" element={<AdminSystemPage section="users" />} />
      <Route path="dia-diem" element={<AdminSystemPage section="locations" />} />
      <Route path="cau-hinh" element={<AdminSystemPage section="settings" />} />
      <Route path="khieu-nai" element={<AdminSystemPage section="complaints" />} />
    </Route>

    {/* Guest and customer dashboard use the same completed HomePage. */}
    <Route element={<MainLayout />}>
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
