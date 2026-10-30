import api from './api'
import type { ApiResponse } from '../types/auth'

export interface ManagedUser {
  id: number
  email: string
  full_name: string
  phone_number?: string | null
  student_id?: string | null
  role: 'customer' | 'staff' | 'manager' | 'admin'
  is_active: boolean
  is_blacklisted: boolean
  blacklist_reason?: string | null
  blacklisted_at?: string | null
  created_at?: string | null
}

export interface ManagedLocation {
  id: number
  building_code: string
  building_name: string
  default_room_note?: string | null
  is_active: boolean
  display_order: number
}

export interface ManagedSetting {
  setting_key: string
  setting_value: string
  description?: string | null
  updated_at?: string | null
}

export interface ManagedComplaint {
  id: number
  order_id: string
  user_id: number
  user_name?: string
  reason: string
  description: string
  proof_image_url: string
  status: 'DANG_XU_LY' | 'CHAP_NHAN' | 'TU_CHOI' | 'YEU_CAU_BO_SUNG'
  admin_response?: string | null
  created_at?: string | null
}

export const managementService = {
  async getUsers(params?: { role?: string; is_active?: boolean; is_blacklisted?: boolean; search?: string }) {
    const res = await api.get<ApiResponse<ManagedUser[]>>('/users/admin/all', { params, timeout: 30000 })
    return res.data.data ?? []
  },
  async updateUserStatus(id: number, payload: { is_active?: boolean; role?: ManagedUser['role'] }) {
    const res = await api.patch<ApiResponse<ManagedUser>>(`/users/admin/${id}/status`, payload)
    return res.data.data
  },
  async updateBlacklist(id: number, is_blacklisted: boolean, blacklist_reason?: string) {
    const res = await api.patch<ApiResponse<ManagedUser>>(`/users/admin/${id}/blacklist`, { is_blacklisted, blacklist_reason })
    return res.data.data
  },
  async getLocations(includeInactive = true) {
    const res = await api.get<ApiResponse<ManagedLocation[]>>('/locations', { params: includeInactive ? { all: 'true' } : undefined, timeout: 30000 })
    return res.data.data ?? []
  },
  async createLocation(payload: Omit<ManagedLocation, 'id'>) {
    const res = await api.post<ApiResponse<ManagedLocation>>('/locations', payload)
    return res.data.data
  },
  async updateLocation(id: number, payload: Partial<Omit<ManagedLocation, 'id'>>) {
    const res = await api.put<ApiResponse<ManagedLocation>>(`/locations/${id}`, payload)
    return res.data.data
  },
  async deleteLocation(id: number) {
    const res = await api.delete<ApiResponse<{ id: number; deactivated?: boolean; deleted?: boolean }>>(`/locations/${id}`)
    return res.data.data
  },
  async getSettings() {
    const res = await api.get<ApiResponse<ManagedSetting[]>>('/settings', { timeout: 30000 })
    return res.data.data ?? []
  },
  async updateSettings(settings: Array<Pick<ManagedSetting, 'setting_key' | 'setting_value' | 'description'>>) {
    const res = await api.put<ApiResponse<ManagedSetting[]>>('/settings/bulk', { settings })
    return res.data.data ?? []
  },
  async getComplaints() {
    const res = await api.get<ApiResponse<ManagedComplaint[]>>('/complaints', { timeout: 30000 })
    return res.data.data ?? []
  },
  async resolveComplaint(id: number, status: ManagedComplaint['status'], admin_response: string) {
    const res = await api.patch<ApiResponse<ManagedComplaint>>(`/complaints/${id}/resolve`, { status, admin_response })
    return res.data.data
  },
}
