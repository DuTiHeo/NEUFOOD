import { useEffect, useState } from 'react'
import { ArrowUpRight, BarChart3, ClipboardList, MapPin, MessageSquareWarning, Settings2, ShieldCheck, Store, Users, Utensils, Wallet } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { reportService, type RevenueReport } from '../../services/reportService'
import { managementService } from '../../services/managementService'
import { orderService } from '../../services/orderService'
import { shiftService } from '../../services/shiftService'
import styles from './ManagementDashboardPage.module.css'

const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const day = (date: Date) => { const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000); return local.toISOString().slice(0, 10) }

const features = [
  { to: '/quan-ly/don', label: 'Giám sát đơn hàng', detail: 'Theo dõi tiến độ đơn và các bước xử lý nghiệp vụ.', Icon: ClipboardList },
  { to: '/quan-ly/mon', label: 'Quản lý thực đơn', detail: 'Giá gốc, mô tả, trạng thái kinh doanh và ảnh món.', Icon: Utensils },
  { to: '/quan-ly/bao-cao', label: 'Báo cáo doanh thu', detail: 'Doanh thu COD theo ngày giao hàng thực tế.', Icon: BarChart3 },
  { to: '/quan-ly/ca', label: 'Đối soát ca COD', detail: 'So sánh số hệ thống với tiền mặt và sao kê QR.', Icon: Wallet },
  { to: '/quan-ly/danh-gia', label: 'Phản hồi khách hàng', detail: 'Xem đánh giá theo từng món ăn.', Icon: MessageSquareWarning },
  { to: '/quan-ly/tai-khoan', label: 'Tài khoản & blacklist', detail: 'Phân quyền, khóa tài khoản và xử lý COD.', Icon: Users },
  { to: '/quan-ly/dia-diem', label: 'Địa điểm nội khu', detail: 'Tòa nhà, giảng đường, thư viện và KTX.', Icon: MapPin },
  { to: '/quan-ly/cau-hinh', label: 'Cấu hình hệ thống', detail: 'Thời gian xử lý, phí, giới hạn và giờ hoạt động.', Icon: Settings2 },
  { to: '/quan-ly/khieu-nai', label: 'Phân xử khiếu nại', detail: 'Tiếp nhận ticket và cập nhật kết luận cho khách.', Icon: ShieldCheck },
]

export default function ManagementDashboardPage() {
  const { user, isAuthenticated } = useAuth()
  const { pathname } = useLocation()
  const basePath = pathname.startsWith('/admin') ? '/admin' : '/quan-ly'
  const isManager = user?.role === 'manager'
  const preview = !isAuthenticated
  const [report, setReport] = useState<RevenueReport | null>(null)
  const [orderCount, setOrderCount] = useState<number | null>(null)
  const [shiftsCount, setShiftsCount] = useState<number | null>(null)
  const [adminCount, setAdminCount] = useState<number | null>(null)
  const [complaintCount, setComplaintCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setLoading(false)
      return
    }
    setLoading(true)
    const today = new Date()
    const from = new Date(today)
    from.setDate(from.getDate() - 6)
    const requests: Array<Promise<unknown>> = [reportService.getRevenueSummary(day(from), day(today))]
    if (isManager) requests.push(orderService.getAllOrdersAdmin({ page: 1, limit: 100 }).then((result) => ({ _orderCount: result.total }) as any))
    else requests.push(managementService.getUsers().then((users) => ({ _adminCount: users.length }) as any), managementService.getComplaints().then((items) => ({ _complaintCount: items.filter((item) => ['DANG_XU_LY', 'YEU_CAU_BO_SUNG'].includes(item.status)).length }) as any))
    if (isManager) requests.push(shiftService.getShifts().then((items) => ({ _shiftsCount: items.filter((item) => item.status !== 'DA_CHOT').length }) as any))
    Promise.allSettled(requests).then((results) => {
      results.forEach((result) => { if (result.status !== 'fulfilled') return; const data: any = result.value; if (data?.gross_revenue !== undefined) setReport(data); if (data?._orderCount !== undefined) setOrderCount(data._orderCount); if (data?._shiftsCount !== undefined) setShiftsCount(data._shiftsCount); if (data?._adminCount !== undefined) setAdminCount(data._adminCount); if (data?._complaintCount !== undefined) setComplaintCount(data._complaintCount) })
      setLoading(false)
    })
  }, [isAuthenticated, isManager, user])

  const visibleFeatures = features.map((feature) => ({ ...feature, to: feature.to.replace('/quan-ly', basePath) }))
  return <div className={styles.page}>
    <section className={styles.hero}><div><span className={styles.eyebrow}>{preview ? 'BẢN XEM TRƯỚC · QUẢN LÝ & ADMIN' : isManager ? 'ĐIỀU HÀNH CANTEEN A2' : 'QUẢN TRỊ HỆ THỐNG NEUFOOD'}</span><h2>{preview ? 'Trung tâm quản lý và quản trị NEUFood' : isManager ? 'Trung tâm vận hành Canteen' : 'Trung tâm quản trị NEUFood'}</h2><p>{preview ? 'Tổng quan các phân hệ dành cho quản lý Canteen và admin. Đăng nhập để xem dữ liệu và dùng chức năng theo quyền tài khoản.' : isManager ? 'Theo dõi hoạt động bán hàng, đơn hàng, menu và đối soát nhân viên.' : 'Quản lý tài khoản, cấu hình, địa điểm và giải quyết các ticket toàn hệ thống.'}</p></div><div className={styles.heroBadge}><Store size={21} /><span>{preview ? 'Giao diện dùng chung' : isManager ? 'Quản lý Canteen' : 'Quản trị viên'}</span></div></section>
    <section className={styles.metrics}><article><span>Tổng COD đã thu · 7 ngày</span><strong>{loading || preview ? '—' : money(report?.gross_revenue || 0)}</strong><small>{preview ? 'Đăng nhập để nạp số liệu API' : 'Theo ngày bàn giao thực tế'}</small></article><article><span>Đơn phát sinh · 7 ngày</span><strong>{loading || preview ? '—' : report?.total_orders ?? 0}</strong><small>{preview ? 'Báo cáo toàn hệ thống' : `${report?.completed_orders ?? 0} đơn giao thành công`}</small></article>{isManager ? <><article><span>Đơn hàng đang theo dõi</span><strong>{loading ? '—' : orderCount ?? 0}</strong><small>Danh sách đơn của Canteen A2</small></article><article><span>Ca chưa chốt</span><strong>{loading ? '—' : shiftsCount ?? 0}</strong><small>Chờ quản lý xử lý</small></article></> : <><article><span>Tài khoản hệ thống</span><strong>{loading || preview ? '—' : adminCount ?? 0}</strong><small>{preview ? 'Phân hệ chỉ mở sau khi đăng nhập' : 'Customer, staff, manager và admin'}</small></article><article><span>Ticket cần xử lý</span><strong>{loading || preview ? '—' : complaintCount ?? 0}</strong><small>{preview ? 'Phân hệ chỉ mở sau khi đăng nhập' : 'Khiếu nại đang mở hoặc cần bổ sung'}</small></article></>}</section>
    <header className={styles.sectionHeading}><div><span className={styles.eyebrow}>DANH MỤC CHỨC NĂNG</span><h2>Chọn phân hệ</h2></div><span className={styles.accessHint}>{preview ? 'Màn hình mở để xem; API có thể yêu cầu xác thực' : 'Backend kiểm tra quyền trên từng yêu cầu API'}</span></header>
    <section className={styles.featureGrid}>{visibleFeatures.map(({ to, label, detail, Icon }) => <Link className={styles.feature} to={to} key={to}><span className={styles.featureIcon}><Icon size={19} /></span><span className={styles.featureCopy}><strong>{label}</strong><small>{detail}</small><em>{preview ? 'Mở giao diện · API có thể yêu cầu tài khoản' : 'Mở giao diện · quyền thao tác do API kiểm tra'}</em></span><ArrowUpRight size={17} className={styles.arrow} /></Link>)}</section>
    <p className={styles.footerNote}>{preview ? 'Đây là màn hình xem giao diện. Các yêu cầu nghiệp vụ được gửi tới API; xác thực và quyền thao tác do backend quyết định.' : 'Frontend mở các phân hệ để bạn xem và thao tác. Backend là nơi xác thực người dùng và quyết định quyền cuối cùng.'}</p>
  </div>
}
