import React, { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import ChatbotWidget from '../chatbot/ChatbotWidget'
import Navbar from './Navbar'
import BottomNav from './BottomNav'

const BOTTOM_NAV_PATHS = ['/', '/khach-hang', '/menu', '/gio-hang', '/tai-khoan', '/lich-su-don']

export default function MainLayout() {
  const { pathname } = useLocation()
  const showBottomNav = BOTTOM_NAV_PATHS.includes(pathname) || pathname === '/story' || pathname === '/recruit' || pathname.startsWith('/bai-viet')
  const isHomeRoute = pathname === '/' || pathname === '/khach-hang'

  useEffect(() => {
    const body = document.body
    if (showBottomNav) body.classList.add('has-bottom-nav')
    else body.classList.remove('has-bottom-nav')

    return () => {
      body.classList.remove('has-bottom-nav')
    }
  }, [showBottomNav])

  return (
    <>
      <Navbar />
      <Outlet />
      {showBottomNav ? <BottomNav /> : null}
      <ChatbotWidget />
    </>
  )
}
