import api from './api'
import type { Order, OrderCreateRequest, OrderStatus, DeliveryIssue, CampusLocation } from '../types/order'
import type { ApiResponse } from '../types/auth'

export const orderService = {
  async createOrder(payload: OrderCreateRequest): Promise<Order> {
    return (await api.post<ApiResponse<Order>>('/orders', payload)).data.data
  },
  async getMyOrders(): Promise<Order[]> {
    return (await api.get<ApiResponse<Order[]>>('/orders')).data.data
  },
  async getOrderById(id: string): Promise<Order> {
    return (await api.get<ApiResponse<Order>>(`/orders/${encodeURIComponent(id)}`)).data.data
  },
  async getAllOrdersAdmin(params: { status?: string; page?: number; limit?: number } = {}) {
    return (await api.get<ApiResponse<{ items: Order[]; total: number }>>('/orders/admin/all', { params })).data.data
  },
  async cancelOrder(id: string): Promise<Order> {
    return (await api.post<ApiResponse<Order>>(`/orders/${encodeURIComponent(id)}/cancel`)).data.data
  },
  async confirmReceipt(id: string): Promise<Order> {
    return (await api.post<ApiResponse<Order>>(`/orders/${encodeURIComponent(id)}/confirm-receipt`)).data.data
  },
  async processOrder(id: string, action: 'accept' | 'reject', reason?: string): Promise<Order> {
    return (await api.patch<ApiResponse<Order>>(`/orders/${encodeURIComponent(id)}/process`, { action, reason })).data.data
  },
  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    return (await api.patch<ApiResponse<Order>>(`/orders/${encodeURIComponent(id)}/status`, { status })).data.data
  },
  async handover(id: string, order_code_suffix: string): Promise<Order> {
    return (await api.post<ApiResponse<Order>>(`/orders/${encodeURIComponent(id)}/handover`, { order_code_suffix })).data.data
  },
  async reportIssue(id: string, issue_type: DeliveryIssue, reason: string): Promise<Order> {
    return (await api.post<ApiResponse<Order>>(`/orders/${encodeURIComponent(id)}/delivery-issue`, { issue_type, reason })).data.data
  },
  async getLocations(): Promise<CampusLocation[]> {
    return (await api.get<ApiResponse<CampusLocation[]>>('/locations')).data.data.filter(location => location.is_active)
  },
  async getSettings(): Promise<Record<string, string>> {
    const response = await api.get<ApiResponse<{ setting_key: string; setting_value: string }[]>>('/settings')
    return Object.fromEntries(response.data.data.map(setting => [setting.setting_key, setting.setting_value]))
  },
}
