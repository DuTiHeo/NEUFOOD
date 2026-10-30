import api from './api'
import type { ApiResponse } from '../types/auth'

export type ShiftState = 'CHO_DUYET' | 'CAN_GIAI_TRINH' | 'DA_CHOT'

export interface StaffShift {
  id: number
  staff_id: number
  staff_name?: string | null
  shift_date: string
  total_orders_handled: number
  expected_cash: number
  expected_qr: number
  actual_cash: number
  actual_qr: number
  discrepancy_amount: number
  discrepancy_note?: string | null
  status: ShiftState
  closed_by?: number | null
  closed_at?: string | null
}

export interface CurrentShiftSummary {
  staff_id: number
  staff_name?: string
  shift_date: string
  total_orders_handled: number
  expected_cash: number
  expected_qr: number
  actual_cash: number
  actual_qr: number
  discrepancy_amount: number
  discrepancy_note?: string | null
  status?: ShiftState | null
  shift_id?: number | null
}

export const shiftService = {
  async getCurrentShift() {
    const res = await api.get<ApiResponse<CurrentShiftSummary>>('/shifts/my-current-shift')
    return res.data.data
  },
  async submitShift(payload: { actual_cash: number; actual_qr: number; discrepancy_note?: string }) {
    const res = await api.post<ApiResponse<StaffShift>>('/shifts/submit', payload)
    return res.data.data
  },
  async getShifts() {
    const res = await api.get<ApiResponse<StaffShift[]>>('/shifts')
    return res.data.data ?? []
  },
  async closeShift(id: number, status: ShiftState, discrepancy_note?: string) {
    const res = await api.patch<ApiResponse<StaffShift>>(`/shifts/${id}/close`, { status, discrepancy_note })
    return res.data.data
  },
}
