import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { APP_CONFIG } from '../constants';

const api: AxiosInstance = axios.create({
  baseURL: APP_CONFIG.API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Biến quản lý trạng thái refresh đồng thời
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request Interceptor: Tự động đính kèm Bearer token từ localStorage
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('neufood_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Tự động refresh Access Token khi gặp lỗi 401
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!error.response || error.response.status !== 401) {
      return Promise.reject(error);
    }

    // 1. Chống Infinite Loop: Nếu lỗi 401 xảy ra ở chính endpoint refresh hoặc login hoặc đã retry rồi
    const requestUrl = originalRequest.url || '';
    if (
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/auth/login') ||
      originalRequest._retry
    ) {
      localStorage.removeItem('neufood_token');
      localStorage.removeItem('neufood_refresh_token');
      localStorage.removeItem('neufood_user');
      processQueue(error, null);
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem('neufood_refresh_token');
    if (!refreshToken) {
      localStorage.removeItem('neufood_token');
      localStorage.removeItem('neufood_user');
      return Promise.reject(error);
    }

    // 2. Concurrency Control: Đưa các request phụ vào hàng đợi nếu đang có request refresh đang chạy
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Sử dụng axios riêng biệt để không kích hoạt interceptor của instance `api`
      const refreshResponse = await axios.post(
        `${APP_CONFIG.API_BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const responseData = refreshResponse.data?.data;
      const newAccessToken = responseData?.access_token;
      const newRefreshToken = responseData?.refresh_token;

      if (!newAccessToken) {
        throw new Error('No access token returned');
      }

      localStorage.setItem('neufood_token', newAccessToken);
      if (newRefreshToken) {
        localStorage.setItem('neufood_refresh_token', newRefreshToken);
      }

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      processQueue(null, newAccessToken);
      return api(originalRequest);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      localStorage.removeItem('neufood_token');
      localStorage.removeItem('neufood_refresh_token');
      localStorage.removeItem('neufood_user');
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
