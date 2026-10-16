import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from '../components/layout/MainLayout'
import AdminLayout from '../components/admin/AdminLayout'
import RequireAdmin from '../components/admin/RequireAdmin'
import { AdminDishesProvider } from '../contexts/AdminDishesContext'

// User Pages
import HomePage from '../pages/user/HomePage'
import MenuPage from '../pages/user/MenuPage'
import ChiTietMonPage from '../pages/user/ChiTietMonPage'
import GioHangPage from '../pages/user/GioHangPage'
import ThanhToanPage from '../pages/user/ThanhToanPage'
import DonHangPage from '../pages/user/DonHangPage'
import LichSuDonHangPage from '../pages/user/LichSuDonHangPage'
import TaiKhoanPage from '../pages/user/TaiKhoanPage'
import GanNeuPage from '../pages/user/GanNeuPage'
import StoryPage from '../pages/user/StoryPage'
import RecruitPage from '../pages/user/RecruitPage'

// Auth Pages
import LoginPage from '../pages/auth/LoginPage'
import RegisterPage from '../pages/auth/RegisterPage'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage'
import OAuthCallbackPage from '../pages/auth/OAuthCallbackPage'

// Admin Pages
import AdminLoginPage from '../pages/admin/AdminLoginPage'
import AdminBaoCaoPage from '../pages/admin/AdminBaoCaoPage'
import AdminMonPage from '../pages/admin/AdminMonPage'
import AdminThemMonPage from '../pages/admin/AdminThemMonPage'
import AdminSuaMonPage from '../pages/admin/AdminSuaMonPage'
import AdminDonPage from '../pages/admin/AdminDonPage'

// Not Found
import NotFoundPage from '../pages/not-found/NotFoundPage'

function AdminSuite() {
  return (
    <RequireAdmin>
      <AdminDishesProvider>
        <AdminLayout />
      </AdminDishesProvider>
    </RequireAdmin>
  )
}

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Standalone Pages */}
      <Route path="/story" element={<StoryPage />} />
      <Route path="/recruit" element={<RecruitPage />} />
      <Route path="/quan-ly/dang-nhap" element={<AdminLoginPage />} />

      {/* Admin Suite Routes */}
      <Route path="/quan-ly" element={<AdminSuite />}>
        <Route index element={<AdminBaoCaoPage />} />
        <Route path="mon" element={<AdminMonPage />} />
        <Route path="mon/them" element={<AdminThemMonPage />} />
        <Route path="mon/sua/:id" element={<AdminSuaMonPage />} />
        <Route path="don" element={<AdminDonPage />} />
      </Route>

      {/* Main Layout User Routes */}
      <Route element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="gan-neu" element={<GanNeuPage />} />
        <Route path="mon/:id" element={<ChiTietMonPage />} />
        <Route path="gio-hang" element={<GioHangPage />} />
        <Route path="thanh-toan" element={<ThanhToanPage />} />
        <Route path="lich-su-don" element={<LichSuDonHangPage />} />
        <Route path="don-hang/:orderId" element={<DonHangPage />} />
        <Route path="don-hang" element={<Navigate to="/lich-su-don" replace />} />
        <Route path="tai-khoan" element={<TaiKhoanPage />} />
        <Route path="dang-nhap" element={<LoginPage />} />
        <Route path="dang-ky" element={<RegisterPage />} />
        <Route path="quen-mat-khau" element={<ForgotPasswordPage />} />
        <Route path="oauth/callback" element={<OAuthCallbackPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default AppRoutes
