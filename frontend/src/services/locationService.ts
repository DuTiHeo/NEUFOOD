import api from './api';
import { ApiResponse } from '../types/auth';

export interface CampusLocation {
  id: number;
  building_code: string;
  building_name: string;
  default_room_note?: string | null;
  is_active: boolean;
  display_order: number;
}

export const locationService = {
  async getLocations(): Promise<CampusLocation[]> {
    const res = await api.get<ApiResponse<CampusLocation[]>>('/locations');
    return res.data.data ?? [];
  },
};
