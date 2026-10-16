import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import styles from './AdminLoginPage.module.css'

export default function AdminLoginPage() {
  const { isAdmin, login } = useAdminAuth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  if (isAdmin) {
    return <Navigate to="/quan-ly" replace />
  }

  function onSubmit(e) {
    e.preventDefault()
    setErr('')
    if (login(email, password)) {
      const to = state?.from && state.from.startsWith('/quan-ly') ? state.from : '/quan-ly'
      navigate(to, { replace: true })
    } else {
      setErr('Email hoặc mật khẩu không đúng.')
    }
  }

  return (
    <main class={styles.page}>
      <div class={styles.card}>
        <div>
          <h1 class={styles.title}>Đăng nhập quản trị</h1>
          <p class={styles.hint}>Chỉ tài khoản quản lý được phép vào khu vực này.</p>
        </div>
        <form class={styles.form} onSubmit={onSubmit}>
          <div class={styles.field}>
            <label class={styles.lbl} htmlFor="adm-email">
              Email
            </label>
            <input
              id="adm-email"
              class={styles.inp}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div class={styles.field}>
            <label class={styles.lbl} htmlFor="adm-pass">
              Mật khẩu
            </label>
            <input
              id="adm-pass"
              class={styles.inp}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {err ? <p class={styles.err}>{err}</p> : null}
          <button type="submit" class={styles.btn}>
            Đăng nhập
          </button>
        </form>
        <Link class={styles.back} to="/">
          ← Về trang chủ
        </Link>
      </div>
    </main>
  )
}
