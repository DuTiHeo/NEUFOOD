import api from './api';
import { ApiResponse } from '../types/auth';

export interface SystemSetting {
  setting_key: string;
  setting_value: string;
  description?: string;
}

let cachedSettings: SystemSetting[] | null = null;
let cacheExpiry = 0;
let pendingPromise: Promise<SystemSetting[]> | null = null;

export const settingsService = {
  async getSettings(forceRefresh = false): Promise<SystemSetting[]> {
    const now = Date.now();
    if (!forceRefresh && cachedSettings && now < cacheExpiry) {
      return cachedSettings;
    }

    if (pendingPromise && !forceRefresh) {
      return pendingPromise;
    }

    pendingPromise = (async () => {
      try {
        const res = await api.get<ApiResponse<SystemSetting[]>>('/settings');
        cachedSettings = res.data.data ?? [];
        cacheExpiry = Date.now() + 60 * 1000; // Cache 60 giây
        return cachedSettings;
      } finally {
        pendingPromise = null;
      }
    })();

    return pendingPromise;
  },

  clearCache() {
    cachedSettings = null;
    cacheExpiry = 0;
    pendingPromise = null;
  },
};
