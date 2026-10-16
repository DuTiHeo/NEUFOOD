import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const SESSION_KEY = 'neufood_session_v1'

export default function OAuthCallbackPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/'
  const provider = params.get('provider') || ''
  const [msg, setMsg] = useState('Đang hoàn tất đăng nhập...')

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/user', { credentials: 'include' })
        if (!res.ok) {
          const suffix = provider ? ` (${provider})` : ''
          setMsg(`Đăng nhập thất bại${suffix}. Vui lòng thử lại.`)
          setTimeout(() => navigate('/dang-nhap', { replace: true }), 800)
          return
        }
        const data = await res.json()
        const user = data && data.user ? data.user : null
        if (!user) throw new Error('Missing user')

        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({
            email: user.email || '',
            name: user.name || user.displayName || '',
            provider: user.provider || provider || '',
            loginAt: new Date().toISOString(),
          }),
        )

        setMsg('Đăng nhập thành công! Đang chuyển trang...')
        setTimeout(() => navigate(next, { replace: true }), 300)
      } catch {
        setMsg('Đã xảy ra lỗi khi hoàn tất đăng nhập.')
        setTimeout(() => navigate('/dang-nhap', { replace: true }), 800)
      }
    }
    run()
  }, [navigate, next, provider])

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem' }}>
      <section style={{ width: '100%', maxWidth: 520, padding: '2rem', borderRadius: 20, background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.08)' }}>
        <h1 style={{ marginBottom: '0.75rem' }}>NEUFood</h1>
        <p style={{ color: '#475569' }}>{msg}</p>
      </section>
    </main>
  )
}
