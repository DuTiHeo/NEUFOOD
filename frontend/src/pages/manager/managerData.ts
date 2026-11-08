import { orderService } from '../../services/orderService'
import { dishService } from '../../services/dishService'
import { singleFlight } from '../../utils/singleFlight'
export const loadCanteenDishes = singleFlight(async () => {
  const first = await dishService.getDishes({ page: 1, limit: 100 })
  const items = [...first.items]
  for (let page = 2; page <= Math.ceil(first.total / 100); page++) {
    items.push(...(await dishService.getDishes({ page, limit: 100 })).items)
  }
  return items
})
export const loadCanteenOrders = singleFlight(async () => {
  const [active, waiting] = await Promise.all([
    orderService.getAllOrdersAdmin({ status: 'active', page: 1, limit: 100 }),
    orderService.getAllOrdersAdmin({ status: 'CHO_XAC_NHAN', page: 1, limit: 1 }),
  ])
  return { items: active.items, total: active.total, waitingTotal: waiting.total }
}, () => localStorage.getItem('neufood_token') ?? sessionStorage.getItem('neufood_token') ?? '')
