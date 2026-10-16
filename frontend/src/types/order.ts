export interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  image?: string;
  note?: string;
}

export interface OrderItem {
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

export interface Order {
  id: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'delivering' | 'delivered' | 'cancelled';
  recipient_name?: string;
  recipient_phone?: string;
  delivery_address?: string;
  delivery_note?: string;
  total?: number;
  total_amount?: number;
  ship_fee?: number;
  payment_method?: string;
  payment_status?: string;
  eta?: string;
  items?: OrderItem[];
  created_at?: string;
  date?: string;
  time?: string;
  summary?: string;
  detail?: string;
  image?: string;
}
