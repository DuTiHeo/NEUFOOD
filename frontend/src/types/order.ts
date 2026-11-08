export interface BulkPricing {
  eligible_servings: number; discount_rate: number; discount_amount: string | number;
  shipping_fee: string | number; total_amount: string | number; deposit_amount: string | number;
  cod_due: string | number; deposit_status?: string; phone_confirmed?: boolean;
}
export interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  image?: string;
  note?: string;
}

export interface OrderItem {
  portions?: any[];
  id?: number;
  dish_id?: string;
  name?: string;
  dish_name?: string;
  price?: number;
  unit_price?: number;
  qty?: number;
  quantity?: number;
  note?: string;
  image?: string;
  subtotal?: number;
}

export type OrderType = 'delivery' | 'pickup';
export type PaymentMethod = 'cod_cash' | 'cod_vietqr';
export type OrderStatus =
  | 'CHO_XAC_NHAN'
  | 'DANG_CHUAN_BI'
  | 'DANG_GIAO'
  | 'SAN_SANG_LAY'
  | 'DA_GIAO'
  | 'DA_BAN_GIAO'
  | 'GIAO_THAT_BAI'
  | 'HOAN_THANH'
  | 'DA_HUY_KHACH'
  | 'TU_CHOI'
  | 'TU_DONG_HUY'
  | 'BO_DON_BLACKLIST'
  | 'KHIEU_NAI'
  | 'DA_GIAI_QUYET';

export interface CreateOrderPayload {
  deposit_token?: string | null;
  expected_pricing?: BulkPricing;
  order_type: OrderType;
  recipient_name: string;
  recipient_phone: string;
  campus_location_id?: number | null;
  room_detail?: string | null;
  delivery_address?: string | null;
  delivery_note?: string | null;
  is_preorder: boolean;
  scheduled_at?: string | null;
  payment_method: PaymentMethod;
  items: Array<{ dish_id: string; quantity: number; note?: string | null; portions?: any[]; expected_unit_price?: number }>;
}

export interface OrderListParams {
  status?: string;
  order_type?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface OrderProcessPayload {
  action: 'accept' | 'reject';
  phone_confirmed?: boolean;
  reason?: string;
}

export interface OrderIssuePayload {
  issue_type: 'no_answer' | 'refuse_payment' | 'pickup_timeout';
  reason: string;
}

export interface Order {
  bulk_pricing?: BulkPricing;
  deposit_token?: string | null;
  cod_due?: number;
  id: string;
  status: OrderStatus;
  order_code_suffix: string;
  order_type: OrderType;
  recipient_name?: string;
  recipient_phone?: string;
  delivery_address?: string;
  delivery_note?: string;
  campus_location_id?: number | null;
  room_detail?: string | null;
  is_preorder?: boolean;
  scheduled_at?: string | null;
  sunday_schedule_warning?: boolean;
  subtotal_amount?: number;
  total?: number;
  total_amount?: number;
  ship_fee?: number;
  payment_method?: PaymentMethod;
  payment_status?: string;
  eta?: string;
  pickup_deadline?: string | null;
  delivered_at?: string | null;
  completed_at?: string | null;
  auto_complete_at?: string | null;
  cancelled_reason?: string | null;
  user_id?: number;
  staff_id?: number | null;
  shipper_id?: number | null;
  items?: OrderItem[];
  created_at?: string;
  date?: string;
  time?: string;
  summary?: string;
  detail?: string;
  image?: string;
}
