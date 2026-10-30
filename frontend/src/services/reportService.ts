import api from './api'
import { ApiResponse } from '../types/auth'

export interface RevenueReport {
  from_date: string
  to_date: string
  total_orders: number
  completed_orders: number
  cancelled_or_rejected_orders: number
  blacklisted_orders: number
  gross_revenue: number
  canteen_net_revenue: number
  system_fee_total: number
  ship_fee_total: number
  top_dishes: Array<{ dish_id: string; dish_name: string; total_quantity: number; total_revenue: number }>
}

export const reportService = {
  async getRevenueSummary(fromDate: string, toDate: string): Promise<RevenueReport> {
    const res = await api.get<ApiResponse<RevenueReport>>('/shifts/reports/summary', {
      params: { from_date: fromDate, to_date: toDate },
    })
    return res.data.data
  },
}
