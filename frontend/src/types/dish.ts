export interface Category {
  id: string;
  label?: string;
  name?: string;
  description?: string;
  display_order?: number;
  is_active?: boolean;
}

export interface Dish {
  id: string;
  name: string;
  basePrice?: number;
  base_price?: number;
  systemFee?: number;
  system_fee?: number;
  shortDescription?: string;
  short_description?: string;
  description?: string;
  price: number;
  rating?: number;
  reviewCount?: number;
  review_count?: number;
  image?: string;
  image_url?: string;
  categoryIds?: string[];
  category_ids?: string[];
  badges?: string[];
  is_available?: boolean;
  is_active?: boolean;
  reviews?: DishReview[];
}

export interface DishReview {
  id: number | string;
  order_id: string;
  dish_id: string;
  user_id?: number;
  user_name?: string;
  rating: number;
  comment?: string | null;
  created_at?: string | null;
}

export interface DishWritePayload {
  id?: string;
  name: string;
  short_description?: string;
  description?: string;
  base_price: number;
  image_url?: string;
  category_ids: string[];
  badges?: string[];
  is_available?: boolean;
  is_active?: boolean;
}

export interface DishFilterParams {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}
