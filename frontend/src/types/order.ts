export type OrderStatus = 'CHO_XAC_NHAN' | 'DANG_CHUAN_BI' | 'DANG_GIAO' | 'SAN_SANG_LAY'
  | 'DA_GIAO' | 'DA_BAN_GIAO' | 'GIAO_THAT_BAI' | 'HOAN_THANH' | 'DA_HUY_KHACH'
  | 'TU_CHOI' | 'TU_DONG_HUY' | 'BO_DON_BLACKLIST' | 'KHIEU_NAI' | 'DA_GIAI_QUYET'
export type OrderType = 'delivery' | 'pickup'
export type DeliveryIssue = 'no_answer' | 'refuse_payment' | 'pickup_timeout'
export interface CartItem { id: string; name: string; price: number; qty: number; image?: string; note?: string }
export interface OrderItem {
  id: number; dish_id: string | null; dish_name: string; unit_price: number; base_price: number
  quantity: number; subtotal: number; note: string | null
}
export interface Order {
  id: string; order_code_suffix: string; user_id: number | null; staff_id: number | null
  order_type: OrderType; status: OrderStatus; recipient_name: string; recipient_phone: string
  campus_location_id: number | null; room_detail: string | null; delivery_address: string
  delivery_note: string | null; is_preorder: boolean; scheduled_at: string | null
  subtotal_amount: number; ship_fee: number; total_amount: number
  payment_method: 'cod_cash' | 'cod_vietqr'; payment_status: 'chua_thanh_toan' | 'da_thanh_toan'
  eta: string | null; cancelled_reason: string | null; created_at: string
  pickup_deadline: string | null; delivered_at: string | null; auto_complete_at: string | null
  completed_at: string | null; items: OrderItem[]
}
export interface OrderCreateRequest {
  order_type: OrderType; recipient_name: string; recipient_phone: string
  campus_location_id: number | null; room_detail: string | null; delivery_note: string | null
  is_preorder: boolean; scheduled_at: string | null; payment_method: Order['payment_method']
  items: { dish_id: string; quantity: number; note?: string }[]
}
export interface CampusLocation { id: number; building_name: string; is_active: boolean }
