import { createContext, useContext, useMemo, useState } from 'react'

const MenuSearchContext = createContext(null)

export function MenuSearchProvider({ children }) {
  const [menuSearch, setMenuSearch] = useState('')

  const value = useMemo(() => ({ menuSearch, setMenuSearch }), [menuSearch])

  return <MenuSearchContext.Provider value={value}>{children}</MenuSearchContext.Provider>
}

export function useMenuSearch() {
  const ctx = useContext(MenuSearchContext)
  if (!ctx) {
    throw new Error('useMenuSearch must be used within MenuSearchProvider')
  }
  return ctx
}
