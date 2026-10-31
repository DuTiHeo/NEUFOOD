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
  const first = await orderService.getAllOrdersAdmin({ page: 1, limit: 100 })
  const items = [...first.items]
  for (let page = 2; page <= Math.ceil(first.total / 100); page++) {
    const next = await orderService.getAllOrdersAdmin({ page, limit: 100 })
    items.push(...next.items)
  }
  return [...new Map(items.map((order) => [order.id, order])).values()]
}, () => localStorage.getItem('neufood_token') ?? sessionStorage.getItem('neufood_token') ?? '')
