import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, CheckCircle2, CircleAlert, MapPin, MessageSquareWarning, RefreshCw, Settings2, ShieldCheck, Users, UserX } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { managementService, type ManagedComplaint, type ManagedLocation, type ManagedUser } from '../../services/managementService'
import styles from './AdminDashboardPage.module.css'

const roles = [{ key: 'customer', label: 'Khách hàng', color: '#315f91' }, { key: 'staff', label: 'Nhân viên', color: '#eaa052' }, { key: 'manager', label: 'Quản lý', color: '#549b87' }, { key: 'admin', label: 'Quản trị viên', color: '#9b88bf' }]
const statusLabels = { DANG_XU_LY: 'Đang xử lý', YEU_CAU_BO_SUNG: 'Chờ bổ sung', CHAP_NHAN: 'Đã chấp nhận', TU_CHOI: 'Đã từ chối' }
const actions = [
  { to: '/admin/tai-khoan', label: 'Tài khoản & phân quyền', detail: 'Vai trò, trạng thái và blacklist COD', Icon: Users },
  { to: '/admin/dia-diem', label: 'Địa điểm nội khu', detail: 'Quản lý các điểm giao hàng tại NEU', Icon: MapPin },
  { to: '/admin/cau-hinh', label: 'Cấu hình hệ thống', detail: 'Thời gian, mức phí và chính sách', Icon: Settings2 },
]

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<ManagedUser[] | null>(null)
  const [complaints, setComplaints] = useState<ManagedComplaint[] | null>(null)
  const [locations, setLocations] = useState<ManagedLocation[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => setRevision((value) => value + 1), [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    Promise.allSettled([managementService.getUsers(), managementService.getComplaints(), managementService.getLocations()]).then(([u, c, l]) => {
      if (!active) return
      setUsers(u.status === 'fulfilled' ? u.value : null)
      setComplaints(c.status === 'fulfilled' ? c.value : null)
      setLocations(l.status === 'fulfilled' ? l.value : null)
      const failed = [u.status === 'rejected' && 'tài khoản', c.status === 'rejected' && 'khiếu nại', l.status === 'rejected' && 'địa điểm'].filter(Boolean)
      if (failed.length) setError(`Chưa tải được dữ liệu ${failed.join(', ')}. Vui lòng thử làm mới.`)
      setLoading(false)
    })
    return () => { active = false }
  }, [revision])

  const pending = complaints?.filter((item) => ['DANG_XU_LY', 'YEU_CAU_BO_SUNG'].includes(item.status))
  const recent = complaints ? [...complaints].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '') || b.id - a.id).slice(0, 5) : []
  const value = (number?: number | null) => loading || number == null ? '—' : number.toLocaleString('vi-VN')
  const metrics = [
    { label: 'Tổng tài khoản', number: users?.length, note: users ? `${users.filter((item) => item.is_active).length} tài khoản đang hoạt động` : 'Chưa có dữ liệu', Icon: Users, style: styles.blue, to: '/admin/tai-khoan' },
    { label: 'Khiếu nại cần xử lý', number: pending?.length, note: 'Đang xử lý hoặc chờ bổ sung', Icon: MessageSquareWarning, style: styles.orange, to: '/admin/khieu-nai' },
    { label: 'Blacklist COD', number: users?.filter((item) => item.is_blacklisted).length, note: 'Tài khoản bị hạn chế COD', Icon: UserX, style: styles.rose, to: '/admin/tai-khoan' },
    { label: 'Địa điểm phục vụ', number: locations?.filter((item) => item.is_active).length, note: locations ? `Trên ${locations.length} địa điểm nội khu` : 'Chưa có dữ liệu', Icon: MapPin, style: styles.green, to: '/admin/dia-diem' },
  ]

  return <div className={styles.page} aria-busy={loading}>
    <section className={styles.heading}><div><div className={styles.eyebrow}>KHÔNG GIAN QUẢN TRỊ</div><h1>Tổng quan hệ thống</h1><p>Chào {user?.full_name || 'quản trị viên'}, cùng theo dõi hoạt động NEUFood hôm nay.</p></div><div className={styles.headingTools}><span className={styles.date}><CalendarDays size={15} />{new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' })}</span><button onClick={reload} disabled={loading}><RefreshCw size={15} />{loading ? 'Đang tải…' : 'Làm mới'}</button></div></section>
    {error && <div className={styles.error} role="alert"><CircleAlert size={18} />{error}</div>}
    <section className={styles.metrics} aria-label="Số liệu hệ thống">{metrics.map(({ label, number, note, Icon, style, to }) => <Link to={to} className={styles.metric} key={label}><div className={styles.metricTop}><span>{label}</span><span className={`${styles.metricIcon} ${style}`}><Icon size={19} /></span></div><strong>{value(number)}</strong><small>{loading ? 'Đang cập nhật dữ liệu…' : note}</small></Link>)}</section>
    <div className={styles.columns}>
      <section className={styles.panel}><header className={styles.panelHeading}><div><h2>Khiếu nại gần đây</h2><p>Theo dõi và phản hồi các yêu cầu từ khách hàng</p></div><Link to="/admin/khieu-nai">Xem tất cả <ArrowRight size={14} /></Link></header>{loading ? <div className={styles.empty}>Đang tải khiếu nại…</div> : !complaints ? <div className={styles.empty}>Chưa tải được khiếu nại. Vui lòng làm mới.</div> : recent.length ? <div className={styles.tableWrap}><table><thead><tr><th>Khiếu nại / Đơn hàng</th><th>Khách hàng</th><th>Trạng thái</th><th aria-label="Chi tiết" /></tr></thead><tbody>{recent.map((item) => <tr key={item.id}><td><strong>{item.reason}</strong><small>#{item.id} · {item.order_id}</small></td><td><span>{item.user_name || `Khách #${item.user_id}`}</span><small>{item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : '—'}</small></td><td><span className={`${styles.status} ${['DANG_XU_LY', 'YEU_CAU_BO_SUNG'].includes(item.status) ? styles.orange : styles.green}`}>{statusLabels[item.status]}</span></td><td><Link to="/admin/khieu-nai" aria-label={`Xem khiếu nại ${item.id}`}><ArrowRight size={16} /></Link></td></tr>)}</tbody></table></div> : <div className={styles.empty}><CheckCircle2 size={30} /><strong>Chưa có khiếu nại</strong><span>Các yêu cầu mới từ khách hàng sẽ xuất hiện tại đây.</span></div>}<div className={styles.panelFooter}><span className={styles.dot} />{loading ? 'Đang cập nhật' : pending ? `${pending.length} khiếu nại đang chờ xử lý` : 'Chưa có dữ liệu khiếu nại'}<Link to="/admin/khieu-nai">Mở trung tâm xử lý <ArrowRight size={13} /></Link></div></section>
      <section className={styles.panel}><header className={styles.panelHeading}><div><h2>Phân bố tài khoản</h2><p>Theo vai trò trong hệ thống</p></div><Users size={19} /></header><div className={styles.roleTotal}><strong>{value(users?.length)}</strong><span>tài khoản đã đăng ký</span></div><div className={styles.roleBar}>{roles.map(({ key, color }) => <span key={key} style={{ background: color, flex: users?.filter((item) => item.role === key).length || 0 }} />)}</div><div className={styles.roleList}>{roles.map(({ key, label, color }) => <div key={key}><span><i style={{ background: color }} />{label}</span><strong>{value(users?.filter((item) => item.role === key).length)}</strong></div>)}</div><Link className={styles.allAccounts} to="/admin/tai-khoan">Quản lý tài khoản <ArrowRight size={14} /></Link></section>
    </div>
    <section><div className={styles.sectionHeading}><h2>Truy cập nhanh</h2><span>Công cụ quản trị thường dùng</span></div><div className={styles.actions}>{actions.map(({ to, label, detail, Icon }) => <Link key={to} to={to}><span className={styles.actionIcon}><Icon size={22} /></span><div><h3>{label}</h3><p>{detail}</p></div><ArrowRight size={17} /></Link>)}</div></section>
    <section className={styles.banner}><span className={styles.bannerIcon}><ShieldCheck size={25} /></span><div><strong>Quản trị tập trung, vận hành rõ ràng.</strong><p>Kiểm soát tài khoản, địa điểm và chính sách để giữ trải nghiệm đặt món luôn thông suốt.</p></div><Link to="/admin/bao-cao">Xem báo cáo doanh thu <ArrowRight size={15} /></Link></section>
  </div>
}
