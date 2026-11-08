import api from './api'

export const recruitmentPositions = [
  { value: 'shipper', name: 'Shipper Campus', description: 'Giao món trong khuôn viên NEU, đối chiếu mã nhận hàng và thu COD, cập nhật tình trạng giao hàng.' },
  { value: 'packing', name: 'Hỗ trợ đóng gói và điều phối', description: 'Kiểm tra món, số lượng và ghi chú; đóng gói và sắp xếp đơn; phối hợp bàn giao cho khách hoặc shipper.' },
  { value: 'customer_support', name: 'Chăm sóc khách hàng', description: 'Giải đáp cách đặt món, tiếp nhận phản hồi và phối hợp chuyển thông tin đến bộ phận phụ trách.' },
  { value: 'communications', name: 'Cộng tác viên truyền thông và sự kiện', description: 'Viết nội dung, chụp ảnh/quay video và hỗ trợ các hoạt động giới thiệu NEUFood trong trường.' },
] as const
export const employeePositions = [...recruitmentPositions, { value: 'kitchen_assistant', name: 'Phụ bếp' }, { value: 'chef', name: 'Đầu bếp' }, { value: 'cashier', name: 'Thu ngân' }]
export const applicationStatuses = { pending: 'Chờ xem xét', contacting: 'Đang xem xét', hired: 'Chấp nhận', rejected: 'Từ chối' }
export const applicationTransitions = { pending: ['contacting'], contacting: ['hired', 'rejected'], hired: [], rejected: [] } as const
export type ApplicationStatus = keyof typeof applicationStatuses
export interface RecruitmentPayload {
  full_name: string; email: string; phone: string; student_id: string
  position: string; availability: string[]; intro: string
}
export interface Application extends RecruitmentPayload {
  id: string; status: ApplicationStatus; internal_note: string; version: number
  reviewed_by: number | null; employee_id?: string | null; created_at: string; updated_at: string
}
export interface EmployeePayload {
  full_name: string; phone: string; email: string; position: string
  employment_status: 'active' | 'on_leave' | 'resigned'; notes: string
  student_id: string; start_date: string | null; weekly_schedule: string[]
}
export interface Employee extends EmployeePayload { id: string; version: number; source_application_id: string | null; account_link_status: 'not_linked' }
export interface PersonnelFilters { q?: string; position?: string; shift?: string; from?: string; to?: string }
export interface AuditEntry { id: number; actor_id: number | null; action: string; created_at: string; details: { before: unknown; after: unknown } }
export const scheduleLabel = (slot: string) => {
  const [day, shift] = slot.split('-')
  return `${({ mon: 'Thứ Hai', tue: 'Thứ Ba', wed: 'Thứ Tư', thu: 'Thứ Năm', fri: 'Thứ Sáu', sat: 'Thứ Bảy' } as Record<string,string>)[day] || day} – ${shift === 'morning' ? 'Sáng 07:00–12:00' : 'Chiều 12:00–19:00'}`
}
export const isFulltime = (position: string) => ['chef', 'kitchen_assistant'].includes(position)
export const positionLabel = (value: string) => employeePositions.find(position => position.value === value)?.name || value
const base = '/recruitment'
export const recruitmentService = {
  async submit(payload: RecruitmentPayload): Promise<{ id: string; created_at: string }> { return (await api.post(`${base}/applications`, payload)).data.data },
  async listApplications(status = '', page = 1, filters: PersonnelFilters = {}): Promise<{ items: Application[]; total: number; page: number; limit: number }> { return (await api.get(`${base}/applications`, { params: { status, page, limit: 20, ...filters } })).data.data },
  async application(id: string): Promise<Application> { return (await api.get(`${base}/applications/${id}`)).data.data },
  async updateApplication(application: Application, status: ApplicationStatus, internal_note: string): Promise<Application> { return (await api.patch(`${base}/applications/${application.id}`, { status, internal_note, expected_version: application.version })).data.data },
  async employees(status = '', filters: PersonnelFilters = {}): Promise<Employee[]> { return (await api.get(`${base}/employees`, { params: { status, ...filters } })).data.data },
  async history(type: 'employee' | 'application', id: string): Promise<AuditEntry[]> { return (await api.get(`${base}/audit/${type}/${id}`)).data.data },
  async employ(application: Application, data: EmployeePayload): Promise<Employee> { return (await api.post(`${base}/applications/${application.id}/employee`, { ...data, expected_application_version: application.version })).data.data },
  async saveEmployee(data: EmployeePayload, employee?: Employee): Promise<Employee> {
    return (employee ? await api.patch(`${base}/employees/${employee.id}`, { ...data, expected_version: employee.version }) : await api.post(`${base}/employees`, data)).data.data
  },
}
