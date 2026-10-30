import { useCallback, useEffect, useMemo, useState } from 'react'
import { orderService } from '../../services/orderService'
import { Order } from '../../types/order'
import styles from './AdminDonPage.module.css'

function formatPrice(value: number) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

const statusLabels: Record<string, string> = {
  CHO_XAC_NHAN: 'Chờ xác nhận', DANG_CHUAN_BI: 'Đang chuẩn bị', DANG_GIAO: 'Đang giao',
  SAN_SANG_LAY: 'Sẵn sàng lấy', DA_GIAO: 'Đã giao', DA_BAN_GIAO: 'Đã bàn giao',
  GIAO_THAT_BAI: 'Giao thất bại', HOAN_THANH: 'Hoàn thành', DA_HUY_KHACH: 'Khách đã hủy',
  TU_CHOI: 'Đã từ chối', TU_DONG_HUY: 'Tự động hủy', BO_DON_BLACKLIST: 'Bỏ đơn / blacklist',
  KHIEU_NAI: 'Đang khiếu nại', DA_GIAI_QUYET: 'Đã giải quyết',
}

export default function AdminDonPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [tab, setTab] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [workingId, setWorkingId] = useState('')
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const firstPage = await orderService.getAllOrdersAdmin({ page: 1, limit: 100 })
      const items = [...firstPage.items]
      const pageCount = Math.ceil(firstPage.total / 100)
      for (let page = 2; page <= pageCount; page += 1) {
        const nextPage = await orderService.getAllOrdersAdmin({ page, limit: 100 })
        items.push(...nextPage.items)
      }
      setOrders(items)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể tải đơn hàng từ máy chủ.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const filtered = useMemo(() => {
    if (tab === 'active') return orders.filter((order) => ['CHO_XAC_NHAN', 'DANG_CHUAN_BI', 'DANG_GIAO', 'SAN_SANG_LAY', 'GIAO_THAT_BAI'].includes(order.status))
    if (tab === 'preparing') return orders.filter((order) => order.status === 'DANG_CHUAN_BI')
    if (tab === 'delivered') return orders.filter((order) => ['DA_GIAO', 'DA_BAN_GIAO', 'HOAN_THANH'].includes(order.status))
    return orders
  }, [orders, tab])

  async function perform(orderId: string, action: () => Promise<Order>) {
    setWorkingId(orderId)
    setError('')
    try {
      const updated = await action()
      setOrders((previous) => previous.map((order) => order.id === orderId ? updated : order))
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể cập nhật đơn hàng.')
      void refresh()
    } finally {
      setWorkingId('')
    }
  }

  async function accept(order: Order) {
    await perform(order.id, () => orderService.processOrder(order.id, { action: 'accept' }))
  }

  async function reject(order: Order) {
    const reason = window.prompt('Nhập lý do từ chối đơn (bắt buộc):')?.trim()
    if (!reason) return
    await perform(order.id, () => orderService.processOrder(order.id, { action: 'reject', reason }))
  }

  async function advance(order: Order) {
    const status = order.order_type === 'pickup' ? 'SAN_SANG_LAY' : 'DANG_GIAO'
    await perform(order.id, () => orderService.updateOrderStatus(order.id, status))
  }

  async function handover(order: Order) {
    const suffix = window.prompt('Nhập đúng 4 số cuối mã đơn khách cung cấp:')?.trim() || ''
    if (!/^\d{4}$/.test(suffix)) {
      setError('Mã bàn giao phải gồm đúng 4 chữ số.')
      return
    }
    await perform(order.id, () => orderService.handoverOrder(order.id, suffix))
  }

  async function reportIssue(order: Order) {
    const isPickupIssue = order.status === 'SAN_SANG_LAY' || order.status === 'GIAO_THAT_BAI'
    let issueType: 'no_answer' | 'refuse_payment' | 'pickup_timeout' = 'pickup_timeout'
    if (!isPickupIssue) {
      const selectedIssue = window.prompt('Nhập loại sự cố: 1 = khách không nghe máy, 2 = từ chối thanh toán')
      if (selectedIssue === null) return
      if (selectedIssue !== '1' && selectedIssue !== '2') {
        setError('Vui lòng chọn 1 hoặc 2 cho loại sự cố.')
        return
      }
      issueType = selectedIssue === '2' ? 'refuse_payment' : 'no_answer'
    }
    const reason = window.prompt('Nhập ghi chú xử lý sự cố:')?.trim()
    if (!reason) return
    await perform(order.id, () => orderService.reportDeliveryIssue(order.id, { issue_type: issueType, reason }))
  }

  return (
    <>
      <section className={styles.top}>
        <div><p className={styles.live}>Đơn hàng từ hệ thống</p><div className={styles.tabs}>
          {[['all', 'Tất cả'], ['active', 'Đang hoạt động'], ['preparing', 'Đang chuẩn bị'], ['delivered', 'Đã bàn giao']].map(([key, label]) => <button key={key} type="button" className={`${styles.tab} ${tab === key ? styles.tabOn : ''}`} onClick={() => setTab(key)}>{label}</button>)}
        </div></div>
        <div className={styles.kpis}><div className={styles.kpi}><p className={styles.kpiLbl}>Đơn đang tải</p><p className={styles.kpiN}>{orders.length}</p></div><button type="button" className={styles.kpi} onClick={() => void refresh()}>Tải lại</button></div>
      </section>

      {error ? <p role="alert">{error}</p> : null}
      <section className={styles.panel}>
        <div className={styles.scroll}><table className={styles.tbl}>
          <thead><tr><th>Mã đơn</th><th>Khách &amp; địa điểm</th><th>Món</th><th>Tổng COD</th><th>Thời gian</th><th>Trạng thái</th><th style={{ textAlign: 'right' }}>Thao tác</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7}>Đang tải đơn hàng…</td></tr> : null}
            {!isLoading && filtered.length === 0 ? <tr><td colSpan={7}>Không có đơn phù hợp.</td></tr> : null}
            {!isLoading ? filtered.map((order) => {
              const itemText = (order.items || []).map((item) => `${item.dish_name} ×${item.quantity}`).join(', ')
              const place = order.order_type === 'pickup' ? 'Nhận tại quầy Canteen A2' : order.delivery_address || 'Trong khuôn viên NEU'
              const isWorking = workingId === order.id
              const awaitingPickup = order.status === 'SAN_SANG_LAY' || order.status === 'GIAO_THAT_BAI'
              const pickupDeadlinePassed = Boolean(order.pickup_deadline && Date.now() >= new Date(order.pickup_deadline).getTime())
              return <tr key={order.id} className={styles.row}>
                <td><span className={styles.oid}>#{order.id}</span><p>Mã nhận: {order.order_code_suffix}</p></td>
                <td><p className={styles.stu}>{order.recipient_name}</p><p>{order.recipient_phone}</p><p className={styles.loc}>{place}{order.room_detail ? ` • ${order.room_detail}` : ''}</p></td>
                <td><p className={styles.items}>{itemText || '—'}</p>{order.delivery_note ? <p className={styles.note}>{order.delivery_note}</p> : null}</td>
                <td className={styles.total}>{formatPrice(order.total_amount || 0)}</td>
                <td><p className={styles.time}>{formatDate(order.created_at)}</p><p className={styles.ago}>{order.payment_status === 'da_thanh_toan' ? 'Đã thu COD' : 'Chưa thu COD'}</p></td>
                <td><span className={`${styles.stSel} ${styles[`st_${order.status}`] || ''}`}>{statusLabels[order.status] || order.status}</span></td>
                <td><div className={styles.act}>
                  {order.status === 'CHO_XAC_NHAN' ? <><button type="button" className={styles.actBtn} disabled={isWorking} onClick={() => void accept(order)} title="Nhận đơn">Nhận</button><button type="button" className={styles.actBtn} disabled={isWorking} onClick={() => void reject(order)} title="Từ chối đơn">Từ chối</button></> : null}
                  {order.status === 'DANG_CHUAN_BI' ? <button type="button" className={styles.actBtn} disabled={isWorking} onClick={() => void advance(order)}>{order.order_type === 'pickup' ? 'Sẵn sàng lấy' : 'Bắt đầu giao'}</button> : null}
                  {order.status === 'DANG_GIAO' || (awaitingPickup && !pickupDeadlinePassed) ? <button type="button" className={styles.actBtn} disabled={isWorking} onClick={() => void handover(order)}>Bàn giao</button> : null}
                  {order.status === 'DANG_GIAO' ? <button type="button" className={styles.actBtn} disabled={isWorking} onClick={() => void reportIssue(order)}>Báo sự cố</button> : null}
                  {awaitingPickup && !pickupDeadlinePassed ? <span>Chờ nhận đến {formatDate(order.pickup_deadline)}</span> : null}
                  {awaitingPickup && pickupDeadlinePassed ? <button type="button" className={styles.actBtn} disabled={isWorking} onClick={() => void reportIssue(order)}>Quá hạn nhận</button> : null}
                  {isWorking ? <span role="status">Đang lưu…</span> : null}
                </div></td>
              </tr>
            }) : null}
          </tbody>
        </table></div>
        <div className={styles.foot}><p className={styles.footTxt}>Hiển thị {filtered.length} / {orders.length} đơn</p></div>
      </section>
    </>
  )
}
