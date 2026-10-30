import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function AuthRedirect({ register = false }: { register?: boolean }) {
  const location = useLocation()
  useEffect(() => {
    const query = new URLSearchParams(location.search)
    const from = location.state?.from
    if (from) query.set('next', `${from.pathname}${from.search || ''}${from.hash || ''}`)
    window.location.replace(`/${register ? 'DANGKY' : 'DANGNHAP'}.html${query.size ? `?${query}` : ''}`)
  }, [location, register])
  return null
}
