export type StaffMode = 'counter' | 'shipper'

export interface StaffOutletContext {
  staffMode: StaffMode
}

const storageKey = (userId: number) => `neufood_staff_mode_${userId}`

export function getStaffMode(userId?: number): StaffMode {
  if (!userId) return 'counter'
  try {
    return localStorage.getItem(storageKey(userId)) === 'shipper' ? 'shipper' : 'counter'
  } catch {
    return 'counter'
  }
}

export function saveStaffMode(userId: number | undefined, mode: StaffMode) {
  if (!userId) return
  try {
    localStorage.setItem(storageKey(userId), mode)
  } catch {
    // Keep the current selection for this session if browser storage is unavailable.
  }
}
