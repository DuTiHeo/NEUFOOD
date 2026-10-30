import api from './api';
import { ApiResponse } from '../types/auth';

export interface SystemSetting {
  setting_key: string;
  setting_value: string;
  description?: string;
}

export const settingsService = {
  async getSettings(): Promise<SystemSetting[]> {
    const res = await api.get<ApiResponse<SystemSetting[]>>('/settings');
    return res.data.data ?? [];
  },
};
