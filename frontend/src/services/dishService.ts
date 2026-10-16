import api from './api';
import { Dish, Category, DishFilterParams } from '../types/dish';
import { ApiResponse } from '../types/auth';

export const dishService = {
  async getCategories(): Promise<Category[]> {
    const res = await api.get<ApiResponse<Category[]>>('/dishes/categories');
    return res.data.data;
  },

  async getDishes(params?: DishFilterParams): Promise<{ items: Dish[]; total: number }> {
    const res = await api.get<ApiResponse<{ items: Dish[]; total: number }>>('/dishes', { params });
    return res.data.data;
  },

  async getDishById(id: string): Promise<Dish> {
    const res = await api.get<ApiResponse<Dish>>(`/dishes/${id}`);
    return res.data.data;
  },

  async createDish(data: Partial<Dish>): Promise<Dish> {
    const res = await api.post<ApiResponse<Dish>>('/dishes', data);
    return res.data.data;
  },

  async updateDish(id: string, data: Partial<Dish>): Promise<Dish> {
    const res = await api.put<ApiResponse<Dish>>(`/dishes/${id}`, data);
    return res.data.data;
  },

  async deleteDish(id: string): Promise<void> {
    await api.delete(`/dishes/${id}`);
  },
};
