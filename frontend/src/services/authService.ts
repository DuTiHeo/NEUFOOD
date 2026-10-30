import api from './api';
import {
  LoginPayload,
  RegisterPayload,
  AuthResponse,
  ApiResponse,
  ForgotPasswordData,
  ResetPasswordPayload,
} from '../types/auth';
import { User, UserProfileUpdate } from '../types/user';

export const authService = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const res = await api.post<ApiResponse<AuthResponse>>('/auth/login', payload);
    return res.data.data;
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const res = await api.post<ApiResponse<AuthResponse>>('/auth/register', payload);
    return res.data.data;
  },

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const res = await api.post<ApiResponse<AuthResponse>>('/auth/refresh', {
      refresh_token: refreshToken,
    });
    const authData = res.data.data;
    if (authData?.access_token) {
      const storage = localStorage.getItem('neufood_refresh_token') ? localStorage : sessionStorage;
      storage.setItem('neufood_token', authData.access_token);
      if (authData.refresh_token) {
        storage.setItem('neufood_refresh_token', authData.refresh_token);
      }
    }
    return authData;
  },

  async getMe(): Promise<User> {
    const res = await api.get<ApiResponse<User>>('/auth/me');
    return res.data.data;
  },

  async requestPasswordReset(email: string): Promise<ApiResponse<ForgotPasswordData>> {
    const res = await api.post<ApiResponse<ForgotPasswordData>>('/auth/forgot-password', {
      email: email.trim(),
    });
    return res.data;
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<ApiResponse<null>> {
    const res = await api.post<ApiResponse<null>>('/auth/reset-password', payload);
    return res.data;
  },

  async updateProfile(payload: UserProfileUpdate): Promise<User> {
    const res = await api.put<ApiResponse<User>>('/users/profile', payload);
    return res.data.data;
  },

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem('neufood_refresh_token')
      ?? sessionStorage.getItem('neufood_refresh_token');
    try {
      await api.post('/auth/logout', { refresh_token: refreshToken });
    } catch (err) {
      // Ngay cả khi request lỗi mạng, client vẫn dọn dẹp sạch token
      console.warn('Backend logout warning:', err);
    } finally {
      ['neufood_token', 'neufood_refresh_token', 'neufood_user'].forEach((key) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
    }
  },
};

