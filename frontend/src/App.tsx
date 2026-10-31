import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AdminAuthProvider } from './contexts/AdminAuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import AppRoutes from './routes'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AdminAuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AdminAuthProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
