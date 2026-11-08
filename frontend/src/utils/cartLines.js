import { defaultPortions, resolvePortions } from './portions.js'

export const cartQuantity = (rows, dishId) => rows.filter(row => row.dishId === dishId).reduce((sum, row) => sum + row.qty, 0)
export const cartKey = (dishId, portions = [], note = '') => JSON.stringify([dishId, portions.map(p => [p.slot_id, p.choice_id, [...p.addon_ids].sort()]).sort((a, b) => a[0].localeCompare(b[0])), note.trim()])

export function restoreCart(raw, legacy) {
  try {
    if (raw) {
      const rows = JSON.parse(raw)
      if (Array.isArray(rows)) return rows.filter(row => typeof row.dishId === 'string' && Number.isInteger(row.qty) && row.qty > 0 && Array.isArray(row.portions)).map(row => ({ ...row, lineId: cartKey(row.dishId, row.portions, row.note || '') }))
    }
    const old = JSON.parse(legacy || '{}')
    return Object.entries(old).filter(([, q]) => Number.isInteger(q) && q > 0).map(([dishId, qty]) => ({ dishId, qty, portions: [], note: '', lineId: cartKey(dishId) }))
  } catch { return [] }
}

export function addCartLine(rows, dish, delta, max, config) {
  if (!Number.isInteger(delta) || delta === 0) return rows
  const portions = config?.portions ?? defaultPortions(dish.portion_groups)
  const note = (config?.note || '').trim()
  const lineId = cartKey(dish.id, portions, note)
  const index = rows.findIndex(row => row.lineId === lineId || (!config && !row.note && row.dishId === dish.id && row.portions.length === 0))
  // Menu minus changes only default configurations; customize rows in the cart.
  if (delta < 0 && index < 0) return rows
  if (delta > 0 && (dish.is_available === false || cartQuantity(rows, dish.id) + delta > max)) return rows
  const qty = Math.max(0, (rows[index]?.qty || 0) + delta)
  if (!qty) return rows.filter((_, i) => i !== index)
  const { snapshot, extraPrice } = resolvePortions(dish.portion_groups, portions)
  const row = { dishId: dish.id, lineId, portions, note, qty, snapshot, unitPrice: Number(dish.price) + extraPrice }
  return index < 0 ? [...rows, row] : rows.map((old, i) => i === index ? row : old)
}

export function resolveCartLine(row, dish, menuError = '') {
  let invalidReason = menuError || (!dish ? 'Món không còn trong thực đơn' : dish.is_available === false ? 'Món hiện đã hết' : '')
  let currentUnitPrice = Number(dish?.price || 0), snapshot = row.snapshot || [], canReview = false
  try {
    const resolved = resolvePortions(dish?.portion_groups, row.portions)
    currentUnitPrice += resolved.extraPrice
    snapshot = resolved.snapshot
    if (!invalidReason && row.unitPrice !== undefined && (row.unitPrice !== currentUnitPrice || JSON.stringify(row.snapshot) !== JSON.stringify(snapshot))) {
      invalidReason = 'Giá hoặc cấu hình món đã thay đổi. Vui lòng kiểm tra và xác nhận lại.'
      canReview = true
    }
  } catch (error) { invalidReason = error.message }
  return { ...row, dish: dish || { id: row.dishId, name: 'Món không còn trong thực đơn', price: 0, is_available: false }, unitPrice: row.unitPrice ?? currentUnitPrice, snapshot: row.snapshot ?? snapshot, currentSnapshot: snapshot, currentUnitPrice, invalidReason, canReview, isMissing: !dish }
}
