import api from './api';
import { APP_CONFIG } from '../constants';
import { Dish, Category, DishFilterParams, DishWritePayload } from '../types/dish';
import { ApiResponse } from '../types/auth';

function normalizeImageUrl(image?: string | null) {
  if (!image) return ''
  if (/^(https?:|data:|blob:)/i.test(image)) return image
  try {
    return new URL(image, APP_CONFIG.API_BASE_URL).toString()
  } catch {
    return image
  }
}

function normalizeDish(dish: Dish): Dish {
  const image = normalizeImageUrl(dish.image ?? dish.image_url)
  return {
    ...dish,
    shortDescription: dish.shortDescription ?? dish.short_description ?? '',
    short_description: dish.short_description ?? dish.shortDescription ?? '',
    basePrice: Number(dish.basePrice ?? dish.base_price ?? 0),
    base_price: Number(dish.base_price ?? dish.basePrice ?? 0),
    systemFee: Number(dish.systemFee ?? dish.system_fee ?? 0),
    system_fee: Number(dish.system_fee ?? dish.systemFee ?? 0),
    price: Number(dish.price ?? 0),
    rating: Number(dish.rating ?? 0),
    reviewCount: Number(dish.reviewCount ?? dish.review_count ?? 0),
    review_count: Number(dish.review_count ?? dish.reviewCount ?? 0),
    image,
    image_url: image,
    categoryIds: dish.categoryIds ?? dish.category_ids ?? [],
    category_ids: dish.category_ids ?? dish.categoryIds ?? [],
  };
}

export const dishService = {
  async getCategories(): Promise<Category[]> {
    const res = await api.get<ApiResponse<Category[]>>('/dishes/categories');
    return (res.data.data ?? []).map((category) => ({
      ...category,
      label: category.label ?? category.name ?? category.id,
    }));
  },

  async getDishes(params?: DishFilterParams): Promise<{ items: Dish[]; total: number }> {
    const res = await api.get<ApiResponse<{ items: Dish[]; total: number }>>('/dishes', { params });
    const data = res.data.data;
    return { ...data, items: (data?.items ?? []).map(normalizeDish), total: Number(data?.total ?? 0) };
  },

  async getDishById(id: string): Promise<Dish> {
    const res = await api.get<ApiResponse<Dish>>(`/dishes/${id}`);
    return normalizeDish(res.data.data);
  },

  async validateCart(dishIds: string[]): Promise<{ is_valid: boolean; unavailable_dishes: Array<{ id: string; name: string; reason: string }> }> {
    const res = await api.post<ApiResponse<{ is_valid: boolean; unavailable_dishes: Array<{ id: string; name: string; reason: string }> }>>('/dishes/validate-cart', { dish_ids: dishIds });
    return res.data.data;
  },

  async createDish(data: DishWritePayload): Promise<Dish> {
    const res = await api.post<ApiResponse<Dish>>('/dishes', data);
    return normalizeDish(res.data.data);
  },

  async updateDish(id: string, data: Partial<DishWritePayload>): Promise<Dish> {
    const res = await api.put<ApiResponse<Dish>>(`/dishes/${id}`, data);
    return normalizeDish(res.data.data);
  },

  async updateAvailability(id: string, isAvailable: boolean): Promise<Dish> {
    const res = await api.patch<ApiResponse<Dish>>(`/dishes/${id}/availability`, { is_available: isAvailable });
    return normalizeDish(res.data.data);
  },

  async deleteDish(id: string): Promise<{ soft_deleted: boolean }> {
    const res = await api.delete<ApiResponse<{ id: string; soft_deleted: boolean }>>(`/dishes/${id}`);
    return { soft_deleted: Boolean(res.data.data?.soft_deleted) };
  },
};
