import api from './api'
import type { ApiResponse } from '../types/auth'

export interface ComplaintCreatePayload {
  order_id: string
  reason: string
  description: string
  proof_image_url: string
}

export interface Complaint {
  id: number
  order_id: string
  user_id: number
  user_name?: string
  reason: string
  description: string
  proof_image_url: string
  status: 'DANG_XU_LY' | 'CHAP_NHAN' | 'TU_CHOI' | 'YEU_CAU_BO_SUNG'
  admin_response?: string | null
  resolved_by?: number | null
  resolved_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export const complaintService = {
  /**
   * UC15, BR-23, EX-14: Gửi khiếu nại đơn hàng.
   */
  async createComplaint(payload: ComplaintCreatePayload): Promise<Complaint> {
    const res = await api.post<ApiResponse<Complaint>>('/complaints', payload)
    return res.data.data
  },

  /**
   * Upload hình ảnh minh chứng khiếu nại lên server.
   */
  async uploadComplaintProof(file: File): Promise<string> {
    const body = new FormData()
    body.append('file', file)
    const res = await api.post<ApiResponse<{ proof_image_url: string; filename: string }>>(
      '/complaints/upload-proof',
      body,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      }
    )
    return res.data.data.proof_image_url
  },

  /**
   * Lấy chi tiết khiếu nại theo mã đơn hàng. Trả về null nếu đơn chưa có khiếu nại.
   */
  async getComplaintByOrderId(orderId: string): Promise<Complaint | null> {
    try {
      const res = await api.get<ApiResponse<Complaint>>(`/complaints/by-order/${encodeURIComponent(orderId)}`)
      return res.data.data ?? null
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return null
      }
      throw error
    }
  },

  /**
   * Lấy danh sách khiếu nại của khách hàng hiện tại (UC15).
   */
  async getMyComplaints(): Promise<Complaint[]> {
    const res = await api.get<ApiResponse<Complaint[]>>('/complaints')
    return res.data.data ?? []
  },
}
