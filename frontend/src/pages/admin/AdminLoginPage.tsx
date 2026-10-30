import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { useAuth } from '../../contexts/AuthContext'
import styles from './AdminLoginPage.module.css'

export default function AdminLoginPage() {
  const { isAdmin, isLoading: authLoading, login } = useAdminAuth()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#003f87] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isAdmin) {
    return <Navigate to={user?.role === 'staff' ? '/nhan-vien' : '/quan-ly'} replace />
  }

  async function onSubmit(e) {
    e.preventDefault()
    setErr('')
    setSubmitting(true)
    try {
      const signedInUser = await login(email, password)
      const roleHome = signedInUser.role === 'staff' ? '/nhan-vien' : '/quan-ly'
      const to = state?.from && state.from.startsWith(roleHome) ? state.from : roleHome
      navigate(to, { replace: true })
    } catch (error: any) {
      setErr(error?.response?.data?.message || error?.message || 'Đăng nhập không thành công.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div>
          <h1 className={styles.title}>Đăng nhập khu vực Canteen</h1>
          <p className={styles.hint}>Đăng nhập bằng tài khoản nhân viên, quản lý hoặc admin để vào đúng khu vực nghiệp vụ.</p>
        </div>
        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.lbl} htmlFor="adm-email">
              Email
            </label>
            <input
              id="adm-email"
              className={styles.inp}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.lbl} htmlFor="adm-pass">
              Mật khẩu
            </label>
            <input
              id="adm-pass"
              className={styles.inp}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {err ? <p className={styles.err}>{err}</p> : null}
          <button type="submit" className={styles.btn} disabled={submitting}>
            {submitting ? 'Đang xác thực…' : 'Đăng nhập'}
          </button>
        </form>
        <Link className={styles.back} to="/">
          ← Về trang chủ
        </Link>
      </div>
    </main>
  )
}
