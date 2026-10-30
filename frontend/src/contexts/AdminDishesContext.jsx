import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { dishService } from '../services/dishService'

const AdminDishesContext = createContext(null)
const KNOWN_INACTIVE_KEY = 'neufood-manager-inactive-dish-ids-v1'

function readKnownInactiveIds() {
  try {
    const stored = JSON.parse(localStorage.getItem(KNOWN_INACTIVE_KEY) || '[]')
    return Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

function writeKnownInactiveIds(ids) {
  localStorage.setItem(KNOWN_INACTIVE_KEY, JSON.stringify([...new Set(ids)]))
}

function normalizeForAdmin(dish, categories) {
  const categoryIds = dish.categoryIds || dish.category_ids || []
  const labels = categoryIds.map((id) => categories.find((category) => category.id === id)?.label || id)
  return {
    ...dish,
    categoryIds,
    category: labels.join(', '),
    basePrice: Number(dish.basePrice ?? dish.base_price ?? 0),
    active: dish.is_active !== false,
    available: dish.is_available !== false,
    stock: dish.is_available === false ? 'out' : 'in',
    signature: (dish.badges || []).includes('signature'),
  }
}

function createDishId(name) {
  const slug = name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug || 'mon-moi'}-${Date.now().toString(36)}`
}

function getMessage(error) {
  return error?.response?.data?.message || error?.message || 'Không tải được dữ liệu thực đơn.'
}

export function AdminDishesProvider({ children }) {
  const { user } = useAuth()
  const [list, setList] = useState([])
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const [categoryList, firstPage] = await Promise.all([
        dishService.getCategories(),
        dishService.getDishes({ page: 1, limit: 100 }),
      ])
      const allDishes = [...firstPage.items]
      for (let page = 2; allDishes.length < firstPage.total; page += 1) {
        const nextPage = await dishService.getDishes({ page, limit: 100 })
        allDishes.push(...nextPage.items)
      }
      let inactiveDishes = []
      if (user?.role === 'manager') {
        const activeIds = new Set(allDishes.map((dish) => dish.id))
        const knownIds = readKnownInactiveIds().filter((id) => !activeIds.has(id))
        const knownResults = await Promise.all(knownIds.map((id) => dishService.getDishById(id).catch(() => null)))
        inactiveDishes = knownResults.filter((dish) => dish && dish.is_active === false)
        writeKnownInactiveIds(inactiveDishes.map((dish) => dish.id))
      }
      setCategories(categoryList)
      setList([...allDishes, ...inactiveDishes].map((dish) => normalizeForAdmin(dish, categoryList)))
    } catch (loadError) {
      setError(getMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [user?.role])

  useEffect(() => { void refresh() }, [refresh])

  const addDish = useCallback(async (payload) => {
    const name = String(payload.name || '').trim()
    const created = await dishService.createDish({
      id: payload.id || createDishId(name),
      name,
      short_description: payload.shortDescription?.trim() || '',
      description: payload.description?.trim() || '',
      base_price: Number(payload.basePrice),
      image_url: payload.image?.trim() || undefined,
      category_ids: payload.categoryIds || [],
      badges: payload.badges || (payload.signature ? ['signature'] : []),
      is_available: payload.available !== false,
    })
    await refresh()
    return created.id
  }, [refresh])

  const updateDish = useCallback(async (id, patch) => {
    const payload = {}
    if (patch.name !== undefined) payload.name = patch.name
    if (patch.shortDescription !== undefined) payload.short_description = patch.shortDescription
    if (patch.description !== undefined) payload.description = patch.description
    if (patch.basePrice !== undefined) payload.base_price = Number(patch.basePrice)
    if (patch.image !== undefined) payload.image_url = patch.image
    if (patch.categoryIds !== undefined) payload.category_ids = patch.categoryIds
    if (patch.active !== undefined) payload.is_active = Boolean(patch.active)
    if (patch.available !== undefined) payload.is_available = Boolean(patch.available)
    if (patch.signature !== undefined) {
      const current = list.find((dish) => dish.id === id)
      const badges = (current?.badges || []).filter((badge) => badge !== 'signature')
      payload.badges = patch.signature ? [...badges, 'signature'] : badges
    }
    const updated = await dishService.updateDish(id, payload)
    if (patch.active === false) writeKnownInactiveIds([...readKnownInactiveIds(), id])
    if (patch.active === true) writeKnownInactiveIds(readKnownInactiveIds().filter((knownId) => knownId !== id))
    setList((current) => current.map((dish) => dish.id === id ? normalizeForAdmin(updated, categories) : dish))
    return updated
  }, [categories, list])

  const updateAvailability = useCallback(async (id, available) => {
    const updated = await dishService.updateAvailability(id, available)
    setList((current) => current.map((dish) => dish.id === id ? normalizeForAdmin(updated, categories) : dish))
    return updated
  }, [categories])

  const removeDish = useCallback(async (id) => {
    const result = await dishService.deleteDish(id)
    await refresh()
    return result
  }, [refresh])

  const getById = useCallback((id) => list.find((dish) => dish.id === id), [list])
  const value = useMemo(
    () => ({ list, categories, isLoading, error, refresh, addDish, updateDish, updateAvailability, removeDish, getById }),
    [list, categories, isLoading, error, refresh, addDish, updateDish, updateAvailability, removeDish, getById],
  )

  return <AdminDishesContext.Provider value={value}>{children}</AdminDishesContext.Provider>
}

export function useAdminDishes() {
  const context = useContext(AdminDishesContext)
  if (!context) throw new Error('useAdminDishes must be used within AdminDishesProvider')
  return context
}
