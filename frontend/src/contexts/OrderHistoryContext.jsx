import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'neufood-order-history-v1'

const OrderHistoryContext = createContext(null)

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function OrderHistoryProvider({ children }) {
  const [orders, setOrders] = useState(readStored)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
  }, [orders])

  const addOrder = useCallback((payload) => {
    const id = `NF${Date.now().toString(36).toUpperCase()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
    const now = new Date()
    const date = now.toLocaleDateString('vi-VN')
    const time = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

    const {
      lines,
      total,
      subtotal: subPayload,
      payment,
      selectedBuilding,
      room,
      note,
      deliveryLocations,
      shipping,
      discount: disc,
    } = payload
    const names = lines.map((l) => l.dish.name)
    const summary =
      names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`

    const itemCount = lines.reduce((s, l) => s + l.qty, 0)
    const buildingLabel = deliveryLocations.find((d) => d.value === selectedBuilding)?.label ?? ''
    const roomTrim = room.trim()
    const noteTrim = note.trim()

    let detail = `${itemCount} món`
    if (buildingLabel) {
      detail += roomTrim ? ` • ${buildingLabel}, ${roomTrim}` : ` • Giao tới ${buildingLabel}`
    } else if (roomTrim) {
      detail += ` • ${roomTrim}`
    } else {
      detail += ' • Giao trong campus'
    }
    if (noteTrim) {
      detail += ` • Ghi chú: ${noteTrim.length > 40 ? `${noteTrim.slice(0, 40)}…` : noteTrim}`
    }

    const payLabel = payment === 'cash' ? 'Tiền mặt' : 'Chuyển khoản QR'
    detail += ` • ${payLabel}`

    const shipFee = shipping ?? 0
    const discount = disc ?? 0
    const subtotalVal = subPayload ?? lines.reduce((s, l) => s + l.dish.price * l.qty, 0)
    const line1 =
      roomTrim && buildingLabel
        ? `${roomTrim}, ${buildingLabel}`
        : buildingLabel
          ? `Giao tới ${buildingLabel}`
          : roomTrim
            ? roomTrim
            : 'Trong khuôn viên NEU'
    const line2 = 'Đại học Kinh tế Quốc dân'
    const placedAt = now
    const etaStart = new Date(placedAt.getTime() + 15 * 60 * 1000)
    const etaEnd = new Date(placedAt.getTime() + 25 * 60 * 1000)
    const timeOpts = { hour: '2-digit', minute: '2-digit' }
    const eta = `${etaStart.toLocaleTimeString('vi-VN', timeOpts)} - ${etaEnd.toLocaleTimeString('vi-VN', timeOpts)}`

    const record = {
      id,
      status: 'preparing',
      date,
      time,
      total,
      subtotal: subtotalVal,
      shipFee,
      discount,
      summary,
      detail,
      image: lines[0]?.dish?.image ?? '',
      payment,
      orderNote: noteTrim,
      address: { line1, line2 },
      eta,
      placedAt: placedAt.toISOString(),
      items: lines.map((l) => ({
        dishId: l.dish.id,
        name: l.dish.name,
        price: l.dish.price,
        qty: l.qty,
        image: l.dish.image,
        note: '',
      })),
    }

    setOrders((prev) => [record, ...prev])
    return id
  }, [])

  const value = useMemo(() => ({ orders, addOrder }), [orders, addOrder])

  return <OrderHistoryContext.Provider value={value}>{children}</OrderHistoryContext.Provider>
}

export function useOrderHistory() {
  const ctx = useContext(OrderHistoryContext)
  if (!ctx) throw new Error('useOrderHistory must be used within OrderHistoryProvider')
  return ctx
}
