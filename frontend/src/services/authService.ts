import api from './api';
import { LoginPayload, RegisterPayload, AuthResponse, ApiResponse } from '../types/auth';
import { User, UserProfileUpdate } from '../types/user';

export const authService = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const res = await api.post<ApiResponse<AuthResponse>>('/auth/login', payload);
    if (res.data.data?.access_token) {
      localStorage.setItem('neufood_token', res.data.data.access_token);
    }
    return res.data.data;
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const res = await api.post<ApiResponse<AuthResponse>>('/auth/register', payload);
    if (res.data.data?.access_token) {
      localStorage.setItem('neufood_token', res.data.data.access_token);
    }
    return res.data.data;
  },

  async getMe(): Promise<User> {
    const res = await api.get<ApiResponse<User>>('/auth/me');
    return res.data.data;
  },

  async updateProfile(payload: UserProfileUpdate): Promise<User> {
    const res = await api.put<ApiResponse<User>>('/users/profile', payload);
    return res.data.data;
  },

  logout(): void {
    localStorage.removeItem('neufood_token');
  },
};
