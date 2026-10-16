import React, { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import ChatbotWidget from '../chatbot/ChatbotWidget'
import Navbar from './Navbar'
import BottomNav from './BottomNav'

const BOTTOM_NAV_PATHS = ['/', '/menu', '/gio-hang']

export default function MainLayout() {
  const { pathname } = useLocation()
  const showBottomNav = BOTTOM_NAV_PATHS.includes(pathname)

  useEffect(() => {
    const body = document.body
    if (pathname !== '/') {
      body.classList.add('page-background')
    } else {
      body.classList.remove('page-background')
    }

    return () => {
      body.classList.remove('page-background')
    }
  }, [pathname])

  return (
    <>
      <Navbar />
      <Outlet />
      {showBottomNav ? <BottomNav /> : null}
      <ChatbotWidget />
    </>
  )
}
