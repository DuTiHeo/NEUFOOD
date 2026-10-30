import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, CircleAlert, Eye, Pencil, Plus, RefreshCw, Save, Search, ShieldCheck, Star, Trash2, X } from 'lucide-react'
import { dishService } from '../../services/dishService'
import { managementService, type ManagedComplaint, type ManagedLocation, type ManagedSetting, type ManagedUser } from '../../services/managementService'
import { reviewService } from '../../services/reviewService'
import { shiftService, type StaffShift } from '../../services/shiftService'
import { useAuth } from '../../contexts/AuthContext'
import styles from './AdminSystemPage.module.css'

type SystemSection = 'users' | 'locations' | 'settings' | 'complaints' | 'reviews' | 'shifts'
const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'
const roleLabels: Record<ManagedUser['role'], string> = { customer: 'Khách hàng', staff: 'Nhân viên', manager: 'Quản lý', admin: 'Admin' }
const shiftLabels = { CHO_DUYET: 'Chờ duyệt', CAN_GIAI_TRINH: 'Cần giải trình', DA_CHOT: 'Đã chốt' }
const complaintLabels: Record<ManagedComplaint['status'], string> = { DANG_XU_LY: 'Đang xử lý', CHAP_NHAN: 'Chấp nhận', TU_CHOI: 'Từ chối', YEU_CAU_BO_SUNG: 'Yêu cầu bổ sung' }

function ErrorLine({ children }: { children: string }) { return <p className={styles.error} role="alert"><CircleAlert size={16} />{children}</p> }
function NoticeLine({ children }: { children: string }) { return <p className={styles.notice} role="status"><Check size={16} />{children}</p> }

function UsersPanel() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function refresh() {
    setLoading(true); setError('')
    try { setUsers(await managementService.getUsers({ search: query || undefined, role: role || undefined })) }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Không tải được tài khoản.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [role])

  async function updateUser(id: number, task: () => Promise<ManagedUser>, success: string) {
    setWorking(id); setError(''); setNotice('')
    try { const updated = await task(); setUsers((items) => items.map((item) => item.id === id ? updated : item)); setNotice(success) }
    catch (requestError: any) { setError(requestError?.response?.data?.message || 'Không cập nhật được tài khoản.') }
    finally { setWorking(0) }
  }

  return <section className={styles.page}>
    <header className={styles.heading}><div><span className={styles.eyebrow}>QUẢN TRỊ HỆ THỐNG</span><h2>Tài khoản &amp; blacklist COD</h2><p>Tìm người dùng, điều chỉnh vai trò hoặc trạng thái và quản lý giới hạn thanh toán COD.</p></div></header>
    <div className={styles.toolbar}><form className={styles.search} onSubmit={(event) => { event.preventDefault(); void refresh() }}><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên, email, mã sinh viên…" /><button type="submit">Tìm</button></form><select className={styles.select} value={role} onChange={(event) => setRole(event.target.value)}><option value="">Tất cả vai trò</option>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className={styles.secondaryButton} type="button" onClick={() => void refresh()}><RefreshCw size={15} /> Tải lại</button></div>
    {error ? <ErrorLine>{error}</ErrorLine> : null}{notice ? <NoticeLine>{notice}</NoticeLine> : null}
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Tài khoản</th><th>Vai trò</th><th>Trạng thái</th><th>Blacklist COD</th><th>Ngày tạo</th><th>Quản trị</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={6}>Đang tải người dùng…</td></tr> : users.map((item) => <tr key={item.id}><td><strong>{item.full_name}</strong><small>{item.email}</small><small>{item.student_id || item.phone_number || `ID ${item.id}`}</small></td><td><span className={styles.pill}>{roleLabels[item.role]}</span></td><td><span className={`${styles.pill} ${item.is_active ? styles.good : styles.bad}`}>{item.is_active ? 'Đang hoạt động' : 'Đã khóa'}</span></td><td><span className={`${styles.pill} ${item.is_blacklisted ? styles.bad : styles.good}`}>{item.is_blacklisted ? 'Đang blacklist' : 'Bình thường'}</span>{item.blacklist_reason ? <small>{item.blacklist_reason}</small> : null}</td><td>{dateLabel(item.created_at)}</td><td><div className={styles.actions}>{item.id !== currentUser?.id ? <>
        <select aria-label={`Đổi vai trò ${item.full_name}`} className={styles.miniSelect} value={item.role} disabled={working === item.id} onChange={(event) => void updateUser(item.id, () => managementService.updateUserStatus(item.id, { role: event.target.value as ManagedUser['role'] }), 'Đã cập nhật vai trò.')} >{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <button type="button" className={styles.smallButton} disabled={working === item.id} onClick={() => void updateUser(item.id, () => managementService.updateUserStatus(item.id, { is_active: !item.is_active }), item.is_active ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.')}>{item.is_active ? 'Khóa' : 'Mở khóa'}</button>
        <button type="button" className={`${styles.smallButton} ${item.is_blacklisted ? '' : styles.danger}`} disabled={working === item.id} onClick={() => { const reason = item.is_blacklisted ? undefined : window.prompt('Lý do đưa vào blacklist COD:')?.trim(); if (!item.is_blacklisted && !reason) return; void updateUser(item.id, () => managementService.updateBlacklist(item.id, !item.is_blacklisted, reason), item.is_blacklisted ? 'Đã gỡ blacklist COD.' : 'Đã đưa tài khoản vào blacklist COD.') }}>{item.is_blacklisted ? 'Gỡ blacklist' : 'Blacklist'}</button>
      </> : <span className={styles.muted}>Tài khoản đang đăng nhập</span>}</div></td></tr>)}
      {!loading && !users.length ? <tr><td colSpan={6}>Không có tài khoản phù hợp.</td></tr> : null}
    </tbody></table></div>
  </section>
}

function LocationsPanel() {
  const [locations, setLocations] = useState<ManagedLocation[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [form, setForm] = useState({ building_code: '', building_name: '', default_room_note: '', display_order: '0', is_active: true })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function refresh() { setLoading(true); try { setLocations(await managementService.getLocations()) } catch (e: any) { setError(e?.response?.data?.message || 'Không tải được địa điểm.') } finally { setLoading(false) } }
  useEffect(() => { void refresh() }, [])
  function startEdit(location?: ManagedLocation) { setEditing(location?.id ?? null); setForm(location ? { building_code: location.building_code, building_name: location.building_name, default_room_note: location.default_room_note || '', display_order: String(location.display_order), is_active: location.is_active } : { building_code: '', building_name: '', default_room_note: '', display_order: '0', is_active: true }) }
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(''); setNotice(''); const payload = { ...form, building_code: form.building_code.trim().toUpperCase(), building_name: form.building_name.trim(), display_order: Number(form.display_order) }; try { if (editing) await managementService.updateLocation(editing, payload); else await managementService.createLocation(payload); setNotice(editing ? 'Đã cập nhật địa điểm.' : 'Đã thêm địa điểm.'); startEdit(); await refresh() } catch (e: any) { setError(e?.response?.data?.message || 'Không lưu được địa điểm.') } }
  async function remove(location: ManagedLocation) { if (!window.confirm(`Xóa hoặc tạm ngưng ${location.building_code} · ${location.building_name}?`)) return; try { const result = await managementService.deleteLocation(location.id); setNotice(result.deactivated ? 'Địa điểm đang được đơn sử dụng nên đã tạm ngưng.' : 'Đã xóa địa điểm.'); await refresh() } catch (e: any) { setError(e?.response?.data?.message || 'Không xóa được địa điểm.') } }
  return <section className={styles.page}>
    <header className={styles.heading}><div><span className={styles.eyebrow}>QUẢN TRỊ HỆ THỐNG</span><h2>Địa điểm giao hàng nội khu</h2><p>Quản lý mã tòa, tên địa điểm, ghi chú phòng nhận và trạng thái phục vụ.</p></div></header>
    {error ? <ErrorLine>{error}</ErrorLine> : null}{notice ? <NoticeLine>{notice}</NoticeLine> : null}
    <div className={styles.split}><form className={styles.formPanel} onSubmit={save}><div className={styles.panelHead}><h3>{editing ? 'Sửa địa điểm' : 'Thêm địa điểm'}</h3>{editing ? <button className={styles.iconButton} type="button" onClick={() => startEdit()} aria-label="Hủy sửa"><X size={16} /></button> : <Plus size={17} />}</div><label className={styles.field}>Mã tòa<input value={form.building_code} onChange={(event) => setForm({ ...form, building_code: event.target.value })} maxLength={30} required /></label><label className={styles.field}>Tên địa điểm<input value={form.building_name} onChange={(event) => setForm({ ...form, building_name: event.target.value })} minLength={2} maxLength={150} required /></label><label className={styles.field}>Ghi chú mặc định<textarea rows={3} value={form.default_room_note} onChange={(event) => setForm({ ...form, default_room_note: event.target.value })} /></label><label className={styles.field}>Thứ tự hiển thị<input type="number" min="0" value={form.display_order} onChange={(event) => setForm({ ...form, display_order: event.target.value })} /></label><label className={styles.checkbox}><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Đang phục vụ</label><button className={styles.primaryButton} type="submit"><Save size={15} /> Lưu địa điểm</button></form>
      <div className={styles.locationList}>{loading ? <p>Đang tải địa điểm…</p> : locations.map((location) => <article key={location.id} className={styles.locationCard}><div><span className={`${styles.pill} ${location.is_active ? styles.good : styles.bad}`}>{location.building_code}</span><strong>{location.building_name}</strong><small>{location.default_room_note || 'Chưa có ghi chú mặc định'}</small><small>Thứ tự {location.display_order} · {location.is_active ? 'Đang phục vụ' : 'Đang tạm ngưng'}</small></div><div className={styles.actions}><button className={styles.iconButton} type="button" onClick={() => startEdit(location)} aria-label={`Sửa ${location.building_code}`}><Pencil size={16} /></button><button className={`${styles.iconButton} ${styles.danger}`} type="button" onClick={() => void remove(location)} aria-label={`Xóa ${location.building_code}`}><Trash2 size={16} /></button></div></article>)}</div>
    </div>
  </section>
}

function SettingsPanel() {
  const [settings, setSettings] = useState<ManagedSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function refresh() { setLoading(true); setError(''); try { setSettings(await managementService.getSettings()) } catch (e: any) { setError(e?.response?.data?.message || 'Không tải được cấu hình.') } finally { setLoading(false) } }
  useEffect(() => { void refresh() }, [])
  function edit(key: string, value: string) { setSettings((items) => items.map((item) => item.setting_key === key ? { ...item, setting_value: value } : item)) }
  async function save() { setSaving(true); setError(''); setNotice(''); try { setSettings(await managementService.updateSettings(settings.map(({ setting_key, setting_value, description }) => ({ setting_key, setting_value, description: description || undefined })))); setNotice('Đã lưu các tham số cấu hình hệ thống.') } catch (e: any) { setError(e?.response?.data?.message || 'Cấu hình chưa được lưu. Kiểm tra lại giá trị và thời gian mở/đóng.') } finally { setSaving(false) } }
  const groups = useMemo(() => settings.reduce<Record<string, ManagedSetting[]>>((result, setting) => { const group = setting.setting_key.includes('time') || setting.setting_key.includes('minutes') || setting.setting_key.includes('hours') ? 'Thời gian & SLA' : setting.setting_key.includes('fee') || setting.setting_key.includes('amount') ? 'Mức phí & hạn mức' : 'Vận hành Canteen'; (result[group] ||= []).push(setting); return result }, {}), [settings])
  return <section className={styles.page}><header className={styles.heading}><div><span className={styles.eyebrow}>QUẢN TRỊ HỆ THỐNG</span><h2>Tham số vận hành</h2><p>Các giá trị ảnh hưởng trực tiếp tới thời gian xử lý đơn, phí giao hàng và giới hạn COD.</p></div><button className={styles.secondaryButton} type="button" onClick={() => void refresh()}><RefreshCw size={15} /> Làm mới</button></header>
    {error ? <ErrorLine>{error}</ErrorLine> : null}{notice ? <NoticeLine>{notice}</NoticeLine> : null}
    {loading ? <div className={styles.state}>Đang tải tham số hệ thống…</div> : <>{Object.entries(groups).map(([group, items]) => <section className={styles.settingGroup} key={group}><h3>{group}</h3><div className={styles.settingGrid}>{items.map((item) => <label className={styles.settingCard} key={item.setting_key}><span>{item.description || item.setting_key}</span><input value={item.setting_value} onChange={(event) => edit(item.setting_key, event.target.value)} aria-label={item.setting_key} /><small>{item.setting_key}</small></label>)}</div></section>)}<button className={styles.primaryButton} type="button" disabled={saving} onClick={() => void save()}><Save size={15} />{saving ? 'Đang lưu…' : 'Lưu tất cả tham số'}</button></>}
  </section>
}

function ComplaintsPanel() {
  const [complaints, setComplaints] = useState<ManagedComplaint[]>([])
  const [responses, setResponses] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function refresh() { setLoading(true); try { setComplaints(await managementService.getComplaints()) } catch (e: any) { setError(e?.response?.data?.message || 'Không tải được khiếu nại.') } finally { setLoading(false) } }
  useEffect(() => { void refresh() }, [])
  async function resolve(item: ManagedComplaint, status: ManagedComplaint['status']) { const admin_response = responses[item.id]?.trim() || item.admin_response || ''; if (admin_response.length < 3) { setError('Nhập phản hồi tối thiểu 3 ký tự trước khi phân xử.'); return } setBusy(item.id); setError(''); try { const updated = await managementService.resolveComplaint(item.id, status, admin_response); setComplaints((items) => items.map((entry) => entry.id === item.id ? updated : entry)); setNotice(`Đã cập nhật khiếu nại #${item.id}.`) } catch (e: any) { setError(e?.response?.data?.message || 'Không phân xử được khiếu nại.') } finally { setBusy(0) } }
  return <section className={styles.page}><header className={styles.heading}><div><span className={styles.eyebrow}>ADMIN · UC25</span><h2>Tiếp nhận &amp; phân xử khiếu nại</h2><p>Admin là vai trò duy nhất được xem toàn bộ ticket và cập nhật kết quả xử lý.</p></div><button className={styles.secondaryButton} type="button" onClick={() => void refresh()}><RefreshCw size={15} /> Tải lại</button></header>
    {error ? <ErrorLine>{error}</ErrorLine> : null}{notice ? <NoticeLine>{notice}</NoticeLine> : null}{loading ? <div className={styles.state}>Đang tải khiếu nại…</div> : <div className={styles.complaintList}>{complaints.map((item) => <article className={styles.complaintCard} key={item.id}><header><div><span className={styles.pill}>#{item.id} · {item.order_id}</span><h3>{item.reason}</h3><small>{item.user_name || `Khách ${item.user_id}`} · {dateLabel(item.created_at)}</small></div><span className={`${styles.pill} ${item.status === 'DANG_XU_LY' ? styles.warn : styles.good}`}>{complaintLabels[item.status]}</span></header><p>{item.description}</p><a className={styles.proof} href={item.proof_image_url} target="_blank" rel="noreferrer"><Eye size={15} /> Mở ảnh minh chứng</a>{item.admin_response ? <blockquote>Phản hồi hiện tại: {item.admin_response}</blockquote> : null}
      {item.status === 'DANG_XU_LY' || item.status === 'YEU_CAU_BO_SUNG' ? <><label className={styles.field}>Phản hồi phân xử<textarea rows={3} maxLength={2000} value={responses[item.id] ?? item.admin_response ?? ''} onChange={(event) => setResponses((value) => ({ ...value, [item.id]: event.target.value }))} placeholder="Nhập kết luận hoặc yêu cầu bổ sung…" /></label><div className={styles.actions}><button className={styles.smallButton} disabled={busy === item.id} onClick={() => void resolve(item, 'YEU_CAU_BO_SUNG')}>Yêu cầu bổ sung</button><button className={styles.smallButton} disabled={busy === item.id} onClick={() => void resolve(item, 'TU_CHOI')}>Từ chối</button><button className={styles.primaryButton} disabled={busy === item.id} onClick={() => void resolve(item, 'CHAP_NHAN')}><ShieldCheck size={15} /> Chấp nhận</button></div></> : null}</article>)}{!complaints.length ? <div className={styles.state}>Chưa có ticket khiếu nại.</div> : null}</div>}</section>
}

interface ReviewItem { id: number; order_id: string; dish_id: string; user_id: number; user_name?: string; rating: number; comment?: string | null; created_at?: string | null }
function ReviewsPanel() {
  const [dishes, setDishes] = useState<Array<{ id: string; name: string }>>([])
  const [selected, setSelected] = useState('')
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { let mounted = true; dishService.getDishes({ limit: 100 }).then((result) => { if (!mounted) return; const items = result.items.map(({ id, name }) => ({ id, name })); setDishes(items); setSelected(items[0]?.id || '') }).catch((e: any) => { if (mounted) setError(e?.response?.data?.message || 'Không tải được thực đơn.') }).finally(() => { if (mounted) setLoading(false) }); return () => { mounted = false } }, [])
  useEffect(() => { if (!selected) return; let mounted = true; setLoading(true); reviewService.getDishReviews(selected).then((items) => { if (mounted) setReviews(items as ReviewItem[]) }).catch((e: any) => { if (mounted) setError(e?.response?.data?.message || 'Không tải được đánh giá món.') }).finally(() => { if (mounted) setLoading(false) }); return () => { mounted = false } }, [selected])
  const selectedDish = dishes.find((dish) => dish.id === selected)
  const average = reviews.length ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length : 0
  return <section className={styles.page}><header className={styles.heading}><div><span className={styles.eyebrow}>QUẢN LÝ CANTEEN</span><h2>Đánh giá món ăn</h2><p>Đánh giá được lấy theo từng món từ endpoint công khai reviews/dish.</p></div><select className={styles.select} value={selected} onChange={(event) => setSelected(event.target.value)} disabled={!dishes.length}><option value="">Chọn món ăn</option>{dishes.map((dish) => <option key={dish.id} value={dish.id}>{dish.name}</option>)}</select></header>
    {error ? <ErrorLine>{error}</ErrorLine> : null}<div className={styles.reviewSummary}><Star size={20} fill="currentColor" /><strong>{average ? average.toFixed(1) : '—'}</strong><span>{selectedDish?.name || 'Chưa chọn món'} · {reviews.length} đánh giá</span></div>
    {loading ? <div className={styles.state}>Đang tải đánh giá…</div> : reviews.map((item) => <article className={styles.reviewCard} key={item.id}><header><div><strong>{item.user_name || `Khách ${item.user_id}`}</strong><small>{dateLabel(item.created_at)} · Đơn {item.order_id}</small></div><span className={styles.rating}><Star size={14} fill="currentColor" /> {item.rating}/5</span></header><p>{item.comment || 'Khách không để lại bình luận.'}</p></article>)}
    {!loading && !reviews.length ? <div className={styles.state}>Món này chưa có đánh giá.</div> : null}</section>
}

function ShiftsPanel() {
  const [shifts, setShifts] = useState<StaffShift[]>([])
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function refresh() { setLoading(true); try { setShifts(await shiftService.getShifts()) } catch (e: any) { setError(e?.response?.data?.message || 'Không tải được danh sách ca.') } finally { setLoading(false) } }
  useEffect(() => { void refresh() }, [])
  async function close(shift: StaffShift, status: 'DA_CHOT' | 'CAN_GIAI_TRINH') { setBusy(shift.id); setError(''); try { const result = await shiftService.closeShift(shift.id, status, notes[shift.id]?.trim() || undefined); setShifts((items) => items.map((item) => item.id === shift.id ? result : item)); setNotice(status === 'DA_CHOT' ? `Đã chốt ca ${shift.staff_name || shift.staff_id}.` : `Đã yêu cầu nhân viên giải trình ca.`) } catch (e: any) { setError(e?.response?.data?.message || 'Không cập nhật được trạng thái ca.') } finally { setBusy(0) } }
  return <section className={styles.page}><header className={styles.heading}><div><span className={styles.eyebrow}>ĐỐI SOÁT COD · UC20</span><h2>Ca làm việc &amp; đối soát COD</h2><p>Đối chiếu tiền mặt, VietQR theo từng nhân viên và ngày làm việc.</p></div><button className={styles.secondaryButton} type="button" onClick={() => void refresh()}><RefreshCw size={15} /> Tải lại</button></header>
    {error ? <ErrorLine>{error}</ErrorLine> : null}{notice ? <NoticeLine>{notice}</NoticeLine> : null}<div className={styles.shiftList}>{loading ? <div className={styles.state}>Đang tải ca làm việc…</div> : shifts.map((shift) => { const difference = shift.discrepancy_amount; return <article className={styles.shiftCard} key={shift.id}><header><div><h3>{shift.staff_name || `Nhân viên #${shift.staff_id}`}</h3><small>{shift.shift_date} · {shift.total_orders_handled} đơn đã bàn giao</small></div><span className={`${styles.pill} ${shift.status === 'DA_CHOT' ? styles.good : shift.status === 'CAN_GIAI_TRINH' ? styles.bad : styles.warn}`}>{shiftLabels[shift.status]}</span></header><div className={styles.cashGrid}><div><small>Tiền mặt dự kiến</small><strong>{money(shift.expected_cash)}</strong></div><div><small>Tiền mặt kiểm đếm</small><strong>{money(shift.actual_cash)}</strong></div><div><small>VietQR dự kiến</small><strong>{money(shift.expected_qr)}</strong></div><div><small>VietQR sao kê</small><strong>{money(shift.actual_qr)}</strong></div><div><small>Chênh lệch</small><strong className={difference ? styles.dangerText : styles.goodText}>{money(difference)}</strong></div></div><p className={styles.noteBlock}><b>Ghi chú nhân viên</b><br />{shift.discrepancy_note || 'Không có ghi chú.'}</p>{shift.status !== 'DA_CHOT' ? <><label className={styles.field}>Phản hồi quản lý / admin<textarea rows={2} maxLength={1000} value={notes[shift.id] ?? ''} onChange={(event) => setNotes((value) => ({ ...value, [shift.id]: event.target.value }))} placeholder="Ghi kết quả kiểm đếm hoặc yêu cầu giải trình…" /></label><div className={styles.actions}><button className={styles.smallButton} disabled={busy === shift.id} onClick={() => void close(shift, 'CAN_GIAI_TRINH')}>Yêu cầu giải trình</button><button className={styles.primaryButton} disabled={busy === shift.id} onClick={() => void close(shift, 'DA_CHOT')}><Check size={15} /> Duyệt chốt ca</button></div></> : <p className={styles.muted}>Đã chốt {dateLabel(shift.closed_at)}</p>}</article> })}{!loading && !shifts.length ? <div className={styles.state}>Chưa có ca được nộp.</div> : null}</div></section>
}

export default function AdminSystemPage({ section }: { section: SystemSection }) {
  if (section === 'users') return <UsersPanel />
  if (section === 'locations') return <LocationsPanel />
  if (section === 'settings') return <SettingsPanel />
  if (section === 'complaints') return <ComplaintsPanel />
  if (section === 'reviews') return <ReviewsPanel />
  return <ShiftsPanel />
}
