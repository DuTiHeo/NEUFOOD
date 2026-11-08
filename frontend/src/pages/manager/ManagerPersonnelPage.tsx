import { useEffect, useState, type FormEvent } from 'react'
import ManagerDialog from '../../components/manager/ManagerDialog'
import { recruitmentService, recruitmentPositions, employeePositions, applicationStatuses, applicationTransitions, positionLabel, scheduleLabel, type Application, type ApplicationStatus, type Employee, type EmployeePayload, type AuditEntry, type PersonnelFilters } from '../../services/recruitmentService'
import { dateTime, requestMessage } from './managerRules'
import styles from './Personnel.module.css'

const employmentLabels = { active: 'Đang làm việc', on_leave: 'Tạm nghỉ', resigned: 'Đã nghỉ việc' }
const emptyEmployee: EmployeePayload = { full_name: '', phone: '', email: '', student_id: '', position: 'shipper', employment_status: 'active', start_date: null, weekly_schedule: [], notes: '' }
const slots = ['mon','tue','wed','thu','fri','sat'].flatMap(day => ['morning','afternoon'].map(shift => `${day}-${shift}`))

function EmployeeChanges({ entry }: { entry: AuditEntry }) {
  const before = (entry.details.before || {}) as Partial<Employee>
  const after = (entry.details.after || {}) as Partial<Employee>
  const fields: (keyof EmployeePayload)[] = ['full_name','student_id','email','phone','position','start_date','employment_status','weekly_schedule','notes']
  const labels: Record<string,string> = { full_name: 'Họ tên', student_id: 'Mã sinh viên', email: 'Email', phone: 'SĐT', position: 'Vị trí', start_date: 'Ngày bắt đầu', employment_status: 'Trạng thái', weekly_schedule: 'Phân ca', notes: 'Ghi chú' }
  const display = (key: keyof EmployeePayload, value: unknown) => key === 'weekly_schedule' ? (value as string[] || []).map(scheduleLabel).join('; ') || 'Chưa phân ca' : key === 'employment_status' ? employmentLabels[value as keyof typeof employmentLabels] || 'Chưa có' : key === 'position' ? positionLabel(String(value || '')) || 'Chưa có' : String(value || 'Chưa có')
  return <ul>{fields.filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key])).map(key => <li key={key}><strong>{labels[key]}:</strong> {display(key,before[key])} → {display(key,after[key])}</li>)}</ul>
}

function EmployeeEditor({ employee, application, onClose, onSaved }: { employee?: Employee; application?: Application; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState<EmployeePayload>(employee ? { full_name: employee.full_name, phone: employee.phone, email: employee.email, student_id: employee.student_id, position: employee.position, employment_status: employee.employment_status, start_date: employee.start_date, weekly_schedule: [...employee.weekly_schedule], notes: employee.notes } : (application ? { ...emptyEmployee, full_name: application.full_name, phone: application.phone, email: application.email, student_id: application.student_id, position: application.position } : emptyEmployee))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<AuditEntry[]>([])
  const [historyError, setHistoryError] = useState('')
  useEffect(() => {
    if (!employee) return
    let active = true
    recruitmentService.history('employee', employee.id).then(items => { if (active) setHistory(items) }).catch(() => { if (active) setHistoryError('Không tải được lịch sử thay đổi.') })
    return () => { active = false }
  }, [employee?.id])
  const update = (key: keyof EmployeePayload, value: string | string[] | null) => setData(prev => ({ ...prev, [key]: value }))
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return
    if (application && !data.start_date) { setError('Vui lòng chọn ngày bắt đầu làm việc.'); return }
    setBusy(true); setError('')
    try {
      if (application) await recruitmentService.employ(application, data)
      else await recruitmentService.saveEmployee(data, employee)
      onSaved()
    } catch (e) { setError(requestMessage(e, 'Không lưu được hồ sơ nhân viên.')) }
    finally { setBusy(false) }
  }
  return <ManagerDialog title={application ? 'Tiếp nhận ứng viên thành nhân viên' : employee ? 'Hồ sơ nhân viên' : 'Thêm hồ sơ nhân viên'} busy={busy} onClose={onClose}>
    <form className="manager-dialog-body manager-form" onSubmit={save}>
      <p className="manager-hint">Hồ sơ nhân sự độc lập với tài khoản đăng nhập. Việc cấp và liên kết tài khoản thuộc Admin, chưa thực hiện ở đây.</p>
      {employee && <p>Mã nhân viên: <strong>{employee.id}</strong> · Chưa liên kết tài khoản</p>}
      <fieldset disabled={busy} className={styles.fields}>
        <label className="manager-field">Họ và tên<input className="manager-input" value={data.full_name} maxLength={150} minLength={2} required onChange={e => update('full_name', e.target.value)} /></label>
        <label className="manager-field">Mã sinh viên<input className="manager-input" value={data.student_id} maxLength={30} required={Boolean(application)} readOnly={Boolean(application)} onChange={e => update('student_id', e.target.value)} /></label>
        <label className="manager-field">Email<input type="email" className="manager-input" value={data.email} maxLength={255} onChange={e => update('email', e.target.value)} /></label>
        <label className="manager-field">Số điện thoại<input type="tel" className="manager-input" value={data.phone} maxLength={20} onChange={e => update('phone', e.target.value)} /></label>
        <label className="manager-field">Vị trí công việc<select className="manager-select" value={data.position} onChange={e => update('position', e.target.value)}>{employeePositions.map(position => <option key={position.value} value={position.value}>{position.name}</option>)}</select></label>
        <label className="manager-field">Ngày bắt đầu làm việc<input type="date" className="manager-input" value={data.start_date || ''} required={Boolean(application)} onChange={e => update('start_date', e.target.value || null)} /></label>
        <label className="manager-field">Trạng thái làm việc<select aria-label="Trạng thái làm việc" className="manager-select" value={data.employment_status} onChange={e => update('employment_status', e.target.value)}>{Object.entries(employmentLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {data.employment_status !== 'active' && <p className="manager-alert">Áp dụng ngay khi lưu. Lịch phân công tuần sẽ được gỡ và lưu lại trong lịch sử thay đổi. Không thay đổi quyền tài khoản đăng nhập.</p>}
        <fieldset className={styles.schedule} disabled={data.employment_status !== 'active'}><legend>Lịch phân công hằng tuần</legend><p>Chọn từng ca từ thứ Hai đến thứ Bảy. Đây là lịch chính thức, không tự lấy từ lịch ứng viên đăng ký.</p><div className={styles.slots}>{slots.map(slot => <label key={slot}><input type="checkbox" checked={data.weekly_schedule.includes(slot)} onChange={() => update('weekly_schedule', data.weekly_schedule.includes(slot) ? data.weekly_schedule.filter(value => value !== slot) : [...data.weekly_schedule, slot])} />{scheduleLabel(slot)}</label>)}</div></fieldset>
        <label className="manager-field">Ghi chú nhân sự<textarea className="manager-input" value={data.notes} maxLength={2000} onChange={e => update('notes', e.target.value)} /></label>
      </fieldset>
      {error && <p role="alert" className="manager-alert error">{error}</p>}
      <div className="manager-tools"><button className="manager-button primary" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : application ? 'Xác nhận tạo nhân viên' : 'Lưu hồ sơ nhân viên'}</button><button className="manager-button" type="button" disabled={busy} onClick={onClose}>Đóng</button></div>
      {historyError && <p role="alert">{historyError}</p>}
      {history.length > 0 && <section><h3>Lịch sử thay đổi</h3>{history.map(item => <details key={item.id}><summary>{dateTime(item.created_at)} · Quản lý #{item.actor_id} · {item.action === 'update' ? 'Cập nhật' : 'Tạo hồ sơ'}</summary><EmployeeChanges entry={item} /></details>)}</section>}
    </form>
  </ManagerDialog>
}

function ApplicationReview({ application, onClose, onSaved, onEmploy }: { application: Application; onClose: () => void; onSaved: () => void; onEmploy: () => void }) {
  const [status, setStatus] = useState<ApplicationStatus>(application.status)
  const [note, setNote] = useState(application.internal_note)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<AuditEntry[]>([])
  useEffect(() => { let active = true; recruitmentService.history('application', application.id).then(items => { if (active) setHistory(items) }).catch(() => { if (active) setError('Không tải được lịch sử xử lý.') }); return () => { active = false } }, [application.id])
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return
    if (status === 'rejected' && !note.trim()) { setError('Vui lòng ghi lý do từ chối hồ sơ.'); return }
    setBusy(true); setError('')
    try { await recruitmentService.updateApplication(application, status, note); onSaved() }
    catch (e) { setError(requestMessage(e, 'Không lưu được kết quả xử lý.')) }
    finally { setBusy(false) }
  }
  return <ManagerDialog title="Chi tiết hồ sơ ứng tuyển" busy={busy} onClose={onClose}><form className="manager-dialog-body manager-form" onSubmit={save}>
    {application.employee_id && <p className="manager-alert">Đã tạo hồ sơ nhân viên: {application.employee_id}</p>}
    <h3>{application.full_name} · {application.student_id}</h3><p>{positionLabel(application.position)} · Gửi {dateTime(application.created_at)}</p>
    <p>Email: <a href={`mailto:${application.email}`}>{application.email}</a> · Điện thoại: <a href={`tel:${application.phone}`}>{application.phone}</a></p>
    <h3>Lịch ứng viên có thể làm ({application.availability.length} buổi/tuần)</h3><ul>{application.availability.map(slot => <li key={slot}>{scheduleLabel(slot)}</li>)}</ul>
    <h3>Giới thiệu và kinh nghiệm</h3><p className={styles.multiline}>{application.intro || 'Không có'}</p>
    <label className="manager-field">Trạng thái hồ sơ<select aria-label="Trạng thái hồ sơ" className="manager-select" value={status} disabled={busy} onChange={e => setStatus(e.target.value as ApplicationStatus)}>{[application.status, ...applicationTransitions[application.status]].map(value => <option key={value} value={value}>{applicationStatuses[value]}</option>)}</select></label>
    <label className="manager-field">Ghi chú nội bộ / lý do từ chối<textarea className="manager-input" value={note} maxLength={2000} required={status === 'rejected'} disabled={busy} onChange={e => setNote(e.target.value)} /></label>
    {error && <p role="alert" className="manager-alert error">{error}</p>}
    <div className="manager-tools"><button type="submit" className="manager-button primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu kết quả'}</button>{application.status === 'hired' && !application.employee_id && <button type="button" className="manager-button" disabled={busy} onClick={onEmploy}>Tạo hồ sơ nhân viên</button>}<button type="button" className="manager-button" disabled={busy} onClick={onClose}>Đóng</button></div>
    {history.length > 0 && <section><h3>Lịch sử xử lý</h3>{history.map(item => <p key={item.id}>{dateTime(item.created_at)} · Quản lý #{item.actor_id} · {applicationStatuses[(item.details.after as Application)?.status] || item.action}</p>)}</section>}
  </form></ManagerDialog>
}

export default function ManagerPersonnelPage() {
  const [tab, setTab] = useState<'employees' | 'applications'>('employees')
  const [employment, setEmployment] = useState('active')
  const [status, setStatus] = useState('')
  const [filters, setFilters] = useState<PersonnelFilters>({})
  const [draftFilters, setDraftFilters] = useState<PersonnelFilters>({})
  const [employees, setEmployees] = useState<Employee[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<Application | null>(null)
  const [employeeEditor, setEmployeeEditor] = useState<{ employee?: Employee; application?: Application } | null>(null)
  useEffect(() => {
    let active = true; setLoading(true); setError('')
    const load = async () => {
      try {
        if (tab === 'employees') { const result = await recruitmentService.employees(employment, filters); if (active) setEmployees(result) }
        else { const result = await recruitmentService.listApplications(status, page, filters); if (active) { setApplications(result.items); setTotal(result.total) } }
      } catch (e) { if (active) setError(requestMessage(e, 'Không tải được dữ liệu nhân sự.')) }
      finally { if (active) setLoading(false) }
    }
    void load(); return () => { active = false }
  }, [tab, employment, status, filters, page, revision])
  function saved() { setSelected(null); setEmployeeEditor(null); setNotice('Đã lưu thay đổi.'); setRevision(value => value + 1) }
  async function openApplication(id: string) { setError(''); try { setSelected(await recruitmentService.application(id)) } catch (e) { setError(requestMessage(e, 'Không tải được hồ sơ.')) } }
  return <div className="manager-page">
    <section className="manager-heading"><div><span className="manager-eyebrow">CANTEEN A2</span><h1>Quản lý nhân sự</h1><p>Hồ sơ nhân viên, lịch phân công hằng tuần và hồ sơ ứng tuyển.</p></div><div className="manager-tools"><button className="manager-button" disabled={loading} onClick={() => setRevision(value => value + 1)}>Làm mới</button>{tab === 'employees' && <button className="manager-button primary" onClick={() => setEmployeeEditor({})}>Thêm nhân viên</button>}</div></section>
    <div className="manager-tools" aria-label="Các mục nhân sự"><button className={`manager-button ${tab === 'employees' ? 'primary' : ''}`} aria-pressed={tab === 'employees'} onClick={() => { setTab('employees'); setPage(1) }}>Nhân viên hiện tại</button><button className={`manager-button ${tab === 'applications' ? 'primary' : ''}`} aria-pressed={tab === 'applications'} onClick={() => { setTab('applications'); setPage(1) }}>Hồ sơ ứng tuyển</button></div>
    <form className={styles.filters} onSubmit={event => { event.preventDefault(); setFilters(draftFilters); setPage(1) }}>
      <label>Tìm kiếm<input className="manager-input" placeholder="Tên, email, số điện thoại" maxLength={150} value={draftFilters.q || ''} onChange={e => setDraftFilters({ ...draftFilters, q: e.target.value })} /></label>
      <label>Vị trí<select className="manager-select" value={draftFilters.position || ''} onChange={e => setDraftFilters({ ...draftFilters, position: e.target.value })}><option value="">Tất cả vị trí</option>{(tab === 'employees' ? employeePositions : recruitmentPositions).map(position => <option key={position.value} value={position.value}>{position.name}</option>)}</select></label>
      <label>Ca làm<select className="manager-select" value={draftFilters.shift || ''} onChange={e => setDraftFilters({ ...draftFilters, shift: e.target.value })}><option value="">Tất cả ca</option><option value="morning">Ca sáng</option><option value="afternoon">Ca chiều</option></select></label>
      <label>Trạng thái<select aria-label="Trạng thái" className="manager-select" value={tab === 'employees' ? employment : status} onChange={e => { if (tab === 'employees') setEmployment(e.target.value); else setStatus(e.target.value); setPage(1) }}><option value="">Tất cả trạng thái</option>{Object.entries(tab === 'employees' ? employmentLabels : applicationStatuses).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {tab === 'applications' && <><label>Từ ngày<input type="date" className="manager-input" value={draftFilters.from || ''} onChange={e => setDraftFilters({ ...draftFilters, from: e.target.value })} /></label><label>Đến ngày<input type="date" className="manager-input" value={draftFilters.to || ''} onChange={e => setDraftFilters({ ...draftFilters, to: e.target.value })} /></label></>}
      <button className="manager-button primary" type="submit" disabled={loading}>Áp dụng bộ lọc</button>
    </form>
    {notice && <p className="manager-alert" role="status">{notice}</p>}{error && <p className="manager-alert error" role="alert">{error}</p>}
    <section className="manager-card">{loading ? <p className="manager-state" role="status">Đang tải dữ liệu…</p> : error ? <p className="manager-state">Hãy thử làm mới dữ liệu.</p> : tab === 'employees' ? <><header className="manager-card-header"><h2>{employees.length} hồ sơ nhân viên</h2></header><div className="manager-table-wrap"><table className="manager-table"><thead><tr><th>Mã / Họ tên</th><th>Liên hệ</th><th>Vị trí / Ngày vào làm</th><th>Ca phân công</th><th>Trạng thái / Tài khoản</th><th>Thao tác</th></tr></thead><tbody>{employees.map(employee => <tr key={employee.id}><td><strong>{employee.full_name}</strong><small>{employee.id}<br />MSV: {employee.student_id || '—'}</small></td><td>{employee.phone || 'Chưa có SĐT'}<small>{employee.email || 'Chưa có email'}</small></td><td>{positionLabel(employee.position)}<small>{employee.start_date || 'Chưa ghi nhận'}</small></td><td>{employee.weekly_schedule.length ? <details><summary>{employee.weekly_schedule.length} buổi/tuần</summary>{employee.weekly_schedule.map(slot => <div key={slot}>{scheduleLabel(slot)}</div>)}</details> : 'Chưa phân ca'}</td><td>{employmentLabels[employee.employment_status]}<small>Chưa liên kết tài khoản</small></td><td><button className="manager-button" onClick={() => setEmployeeEditor({ employee })}>Xem / chỉnh sửa</button></td></tr>)}</tbody></table></div>{!employees.length && <p className="manager-state">Không có nhân viên phù hợp.</p>}</> : <><header className="manager-card-header"><h2>{total} hồ sơ ứng tuyển</h2></header><div className="manager-table-wrap"><table className="manager-table"><thead><tr><th>Ứng viên / MSV</th><th>Liên hệ</th><th>Vị trí / Số buổi</th><th>Ngày gửi</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{applications.map(application => <tr key={application.id}><td><strong>{application.full_name}</strong><small>{application.student_id}</small></td><td>{application.phone}<small>{application.email}</small></td><td>{positionLabel(application.position)}<small>{application.availability.length} buổi/tuần</small></td><td>{dateTime(application.created_at)}</td><td>{applicationStatuses[application.status]}</td><td><button className="manager-button" onClick={() => void openApplication(application.id)}>Xem hồ sơ</button></td></tr>)}</tbody></table></div>{!applications.length && <p className="manager-state">Chưa có hồ sơ phù hợp.</p>}<div className="manager-card-header"><span>Trang {page} / {Math.max(1, Math.ceil(total / 20))}</span><div className="manager-tools"><button className="manager-button" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Trước</button><button className="manager-button" disabled={page * 20 >= total} onClick={() => setPage(value => value + 1)}>Sau</button></div></div></>}</section>
    {selected && !employeeEditor && <ApplicationReview application={selected} onClose={() => setSelected(null)} onSaved={saved} onEmploy={() => setEmployeeEditor({ application: selected })} />}
    {employeeEditor && <EmployeeEditor {...employeeEditor} onClose={() => setEmployeeEditor(null)} onSaved={saved} />}
  </div>
}
