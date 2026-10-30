import React, { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import ChatbotWidget from '../chatbot/ChatbotWidget'
import Navbar from './Navbar'
import BottomNav from './BottomNav'

const BOTTOM_NAV_PATHS = ['/', '/khach-hang', '/menu', '/gio-hang', '/tai-khoan', '/lich-su-don']

export default function MainLayout() {
  const { pathname } = useLocation()
  const showBottomNav = BOTTOM_NAV_PATHS.includes(pathname)
  const isHomeRoute = pathname === '/' || pathname === '/khach-hang'

  useEffect(() => {
    const body = document.body
    if (!isHomeRoute) {
      body.classList.add('page-background')
    } else {
      body.classList.remove('page-background')
    }

    return () => {
      body.classList.remove('page-background')
    }
  }, [isHomeRoute, pathname])

  return (
    <>
      <Navbar />
      <Outlet />
      {showBottomNav ? <BottomNav /> : null}
      <ChatbotWidget />
    </>
  )
}
