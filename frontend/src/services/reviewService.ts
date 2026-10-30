import api from './api';
import { ApiResponse } from '../types/auth';
import { DishReview } from '../types/dish';

export const reviewService = {
  async getDishReviews(dishId: string): Promise<DishReview[]> {
    const res = await api.get<ApiResponse<DishReview[]>>(`/reviews/dish/${dishId}`);
    return res.data.data ?? [];
  },

  async createReview(payload: { order_id: string; dish_id: string; rating: number; comment?: string }): Promise<DishReview> {
    const res = await api.post<ApiResponse<DishReview>>('/reviews', payload);
    return res.data.data;
  },
};
