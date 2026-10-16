import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { dishes as seedDishes } from '../data/dishes'

const STORAGE_VERSION = 'v2'
const STORAGE_KEY = `neufood_admin_dishes_${STORAGE_VERSION}`

const AdminDishesContext = createContext(null)

function guessCategory(d) {
  const id = d.id.toLowerCase()
  const n = d.name.toLowerCase()
  if (id.includes('tra') || id.includes('sua') || n.includes('trà')) return 'Đồ uống'
  if (id.includes('salad') || n.includes('salad')) return 'Healthy'
  if (id.includes('combo') || id.includes('vat') || n.includes('combo')) return 'Ăn vặt'
  if (id.includes('pho') || n.includes('phở')) return 'Món khác'
  return 'Cơm'
}

function normalizeSeed() {
  return seedDishes.map((d) => ({
    ...d,
    category: guessCategory(d),
    active: true,
    signature: (d.rating ?? 0) >= 4.8,
    stock: 'in',
  }))
}

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function saveStored(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

function slugId(name) {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${base || 'mon'}-${Date.now().toString(36)}`
}

export function AdminDishesProvider({ children }) {
  const [list, setList] = useState(() => loadStored() ?? normalizeSeed())

  useEffect(() => {
    saveStored(list)
  }, [list])

  const addDish = useCallback((payload) => {
    const id = slugId(payload.name)
    const row = {
      id,
      name: payload.name,
      shortDescription: payload.shortDescription || '',
      description: payload.description || payload.shortDescription || '',
      price: Number(payload.price) || 0,
      image: payload.image || '',
      category: payload.category || 'Cơm',
      active: payload.active !== false,
      signature: Boolean(payload.signature),
      stock: payload.stock || 'in',
      rating: 4.5,
      reviewCount: 0,
    }
    setList((prev) => [...prev, row])
    return id
  }, [])

  const updateDish = useCallback((id, patch) => {
    setList((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }, [])

  const removeDish = useCallback((id) => {
    setList((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const getById = useCallback((id) => list.find((d) => d.id === id), [list])

  const value = useMemo(
    () => ({ list, addDish, updateDish, removeDish, getById }),
    [list, addDish, updateDish, removeDish, getById],
  )

  return <AdminDishesContext.Provider value={value}>{children}</AdminDishesContext.Provider>
}

export function useAdminDishes() {
  const ctx = useContext(AdminDishesContext)
  if (!ctx) throw new Error('useAdminDishes must be used within AdminDishesProvider')
  return ctx
}
