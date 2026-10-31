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

export const FALLBACK_CAMPUS_LOCATIONS: CampusLocation[] = [
  { id: 1, building_code: 'A1', building_name: 'Tòa nhà Thế Kỷ A1', default_room_note: 'Phòng học & Văn phòng từ tầng 2 đến tầng 10', is_active: true, display_order: 1 },
  { id: 2, building_code: 'A2', building_name: 'Khu Canteen & Giảng đường A2', default_room_note: 'Quầy trả món Canteen A2 Tầng 1 hoặc phòng học tầng trên', is_active: true, display_order: 2 },
  { id: 3, building_code: 'B', building_name: 'Giảng đường B', default_room_note: 'Các phòng học khu nhà B', is_active: true, display_order: 3 },
  { id: 4, building_code: 'C', building_name: 'Giảng đường C', default_room_note: 'Các phòng học khu nhà C', is_active: true, display_order: 4 },
  { id: 5, building_code: 'D', building_name: 'Giảng đường D', default_room_note: 'Các phòng học khu nhà D', is_active: true, display_order: 5 },
  { id: 6, building_code: 'KTX', building_name: 'Ký túc xá Sinh viên NEU', default_room_note: 'Sảnh các tòa KTX hoặc phòng ở cụ thể', is_active: true, display_order: 6 },
  { id: 7, building_code: 'THU_VIEN', building_name: 'Thư viện Phạm Văn Đồng', default_room_note: 'Bàn trực sảnh tầng 1 hoặc phòng tự học', is_active: true, display_order: 7 },
  { id: 8, building_code: 'NHA_VAN_HOA', building_name: 'Nhà Văn Hóa NEU', default_room_note: 'Hội trường lớn và khu câu lạc bộ', is_active: true, display_order: 8 },
];

export const locationService = {
  async getLocations(): Promise<CampusLocation[]> {
    try {
      const res = await api.get<ApiResponse<CampusLocation[]>>('/locations');
      const items = res.data.data;
      if (Array.isArray(items) && items.length > 0) {
        return items;
      }
      return FALLBACK_CAMPUS_LOCATIONS;
    } catch (error) {
      console.warn('Could not load campus locations from API, falling back to default locations:', error);
      return FALLBACK_CAMPUS_LOCATIONS;
    }
  },
};
