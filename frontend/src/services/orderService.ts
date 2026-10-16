import api from './api';
import { Order } from '../types/order';
import { ApiResponse } from '../types/auth';

export const orderService = {
  async createOrder(payload: any): Promise<Order> {
    const res = await api.post<ApiResponse<Order>>('/orders', payload);
    return res.data.data;
  },

  async getMyOrders(): Promise<Order[]> {
    const res = await api.get<ApiResponse<Order[]>>('/orders');
    return res.data.data;
  },

  async getOrderById(orderId: string): Promise<Order> {
    const res = await api.get<ApiResponse<Order>>(`/orders/${orderId}`);
    return res.data.data;
  },

  async getAllOrdersAdmin(params?: any): Promise<{ items: Order[]; total: number }> {
    const res = await api.get<ApiResponse<{ items: Order[]; total: number }>>('/orders/admin/all', { params });
    return res.data.data;
  },

  async updateOrderStatus(orderId: string, status: string): Promise<Order> {
    const res = await api.patch<ApiResponse<Order>>(`/orders/${orderId}/status`, { status });
    return res.data.data;
  },
};
