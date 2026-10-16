export interface Category {
  id: string;
  label?: string;
  name?: string;
  description?: string;
}

export interface Dish {
  id: string;
  name: string;
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
}

export interface DishFilterParams {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}
