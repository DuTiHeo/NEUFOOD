import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import styles from './AdminLoginPage.module.css'
import { orderError } from '../../utils/orders'

export default function AdminLoginPage() {
  const { isAdmin, login } = useAdminAuth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  if (isAdmin) {
    return <Navigate to="/quan-ly/don" replace />
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (busy) return
    setErr('')
    setBusy(true)
    try {
      if (await login(email, password)) {
        const to = state?.from && state.from.startsWith('/quan-ly/') && state.from !== '/quan-ly/dang-nhap' ? state.from : '/quan-ly/don'
        navigate(to, { replace: true })
      } else {
        setErr('Tài khoản không có quyền truy cập khu vực quản lý.')
      }
    } catch (error) { setErr(orderError(error)) }
    finally { setBusy(false) }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div>
          <h1 className={styles.title}>Đăng nhập quản trị</h1>
          <p className={styles.hint}>Dành cho nhân viên, quản lý và quản trị viên.</p>
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
          <button type="submit" className={styles.btn} disabled={busy}>
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>
        <Link className={styles.back} to="/">
          ← Về trang chủ
        </Link>
      </div>
    </main>
  )
}
