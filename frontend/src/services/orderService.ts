import api from './api';
import { CreateOrderPayload, Order, OrderIssuePayload, OrderListParams, OrderProcessPayload, OrderStatus } from '../types/order';
import { ApiResponse } from '../types/auth';

export interface OrderingPolicy {
  server_now: string;
  open_time: string;
  order_cutoff_time: string;
  close_time: string;
  min_lead_minutes: number;
  max_days: number;
  closed_weekdays: number[];
  exempt_hours: boolean;
}

export const orderService = {
  async quoteOrder(payload: CreateOrderPayload): Promise<Order> {
    const res = await api.post<ApiResponse<Order>>('/orders/quote', payload);
    return res.data.data;
  },
  async getPolicy(): Promise<OrderingPolicy> {
    const res = await api.get<ApiResponse<OrderingPolicy>>('/orders/policy');
    return res.data.data;
  },
  async getShipperOrders(scope: 'available' | 'mine' | 'history', page = 1, limit = 100): Promise<{ items: Order[]; total: number }> {
    const res = await api.get<ApiResponse<{ items: Order[]; total: number }>>('/orders/delivery/queue', { params: { scope, page, limit }, timeout: 30000 });
    return res.data.data;
  },

  async claimDeliveryOrder(orderId: string): Promise<Order> {
    const res = await api.post<ApiResponse<Order>>(`/orders/${orderId}/claim-delivery`);
    return res.data.data;
  },

  async createOrder(payload: CreateOrderPayload): Promise<Order> {
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

  async getAllOrdersAdmin(params?: OrderListParams): Promise<{ items: Order[]; total: number }> {
    const res = await api.get<ApiResponse<{ items: Order[]; total: number }>>('/orders/admin/all', { params, timeout: 30000 });
    return res.data.data;
  },

  async cancelOrder(orderId: string): Promise<Order> {
    const res = await api.post<ApiResponse<Order>>(`/orders/${orderId}/cancel`);
    return res.data.data;
  },

  async confirmReceipt(orderId: string): Promise<Order> {
    const res = await api.post<ApiResponse<Order>>(`/orders/${orderId}/confirm-receipt`);
    return res.data.data;
  },

  async processOrder(orderId: string, payload: OrderProcessPayload): Promise<Order> {
    const res = await api.patch<ApiResponse<Order>>(`/orders/${orderId}/process`, payload);
    return res.data.data;
  },

  async updateOrderStatus(orderId: string, status: OrderStatus, cancelledReason?: string): Promise<Order> {
    const res = await api.patch<ApiResponse<Order>>(`/orders/${orderId}/status`, {
      status,
      ...(cancelledReason ? { cancelled_reason: cancelledReason } : {}),
    });
    return res.data.data;
  },

  async handoverOrder(orderId: string, orderCodeSuffix: string): Promise<Order> {
    const res = await api.post<ApiResponse<Order>>(`/orders/${orderId}/handover`, {
      order_code_suffix: orderCodeSuffix,
    });
    return res.data.data;
  },

  async reportDeliveryIssue(orderId: string, payload: OrderIssuePayload): Promise<Order> {
    const res = await api.post<ApiResponse<Order>>(`/orders/${orderId}/delivery-issue`, payload);
    return res.data.data;
  },
};
