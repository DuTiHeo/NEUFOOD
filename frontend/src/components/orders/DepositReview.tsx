import { useEffect, useRef } from 'react'
import { Order } from '../../types/order'
import { formatVnd } from '../../utils/money'
import styles from './DepositReview.module.css'

export default function DepositReview({ quote, busy, error, onClose, onConfirm }: {quote:Order;busy:boolean;error:string;onClose:()=>void;onConfirm:()=>void}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const node=dialog.current!;node.showModal();return()=>node.close() }, [])
  const p=quote.bulk_pricing!
  const deposit=Number(p.deposit_amount)
  return <dialog ref={dialog} onCancel={onClose} className={styles.dialog} aria-labelledby="deposit-title">
    <h2 id="deposit-title">{deposit ? 'Đặt cọc mô phỏng 50%' : 'Xác nhận báo giá mới'}</h2>
    <p>Tổng thanh toán: <strong>{formatVnd(quote.total_amount || 0)}</strong></p>
    <p>Giảm {p.discount_rate}%: {formatVnd(Number(p.discount_amount))} · Phí giao: {formatVnd(quote.ship_fee || 0)}</p>
    {deposit > 0 && <>
      <p><strong>MÔ PHỎNG — KHÔNG CHUYỂN TIỀN THẬT</strong></p>
      <svg className={styles.qr} viewBox="0 0 25 25" role="img" aria-label="QR minh họa mô phỏng, không có dữ liệu chuyển khoản">
        <rect width="25" height="25" fill="white"/>
        {[0,1,2].map(i=><g key={i} transform={`translate(${i===1?17:1} ${i===2?17:1})`}><rect width="7" height="7" fill="#102b43"/><rect x="1" y="1" width="5" height="5" fill="white"/><rect x="2" y="2" width="3" height="3" fill="#102b43"/></g>)}
        {Array.from({length:25},(_,i)=><rect key={i} x={9+(i*3)%15} y={9+(i*7)%15} width="1" height="1" fill="#102b43"/>)}
        <rect x="0" y="10" width="25" height="5" fill="#fef3c7"/><text x="12.5" y="13.3" textAnchor="middle" fontSize="2.5" fill="#92400e">MÔ PHỎNG</text>
      </svg>
      <p>Ngân hàng: <strong>MB Bank</strong> · Số tài khoản: <strong>0866451723</strong> (thông tin giả lập)</p>
      <p>Cọc mô phỏng cần xác nhận: <strong>{formatVnd(deposit)}</strong></p>
      <p>50% còn lại (sau làm tròn): <strong>{formatVnd(Number(p.cod_due))}</strong> thanh toán COD khi nhận món. Nhân viên căn tin sẽ gọi điện xác nhận đơn.</p>
      <p>QR chỉ để minh họa, không dùng trong ứng dụng ngân hàng. Chưa tạo đơn khi mới mở cửa sổ này.</p>
    </>}
    {error && <p role="alert">{error}</p>}
    <div className={styles.actions}><button type="button" disabled={busy} onClick={onClose}>Đóng</button><button type="button" disabled={busy} onClick={onConfirm}>{busy?'Đang gửi đơn…':deposit?'Xác nhận đặt cọc mô phỏng và gửi đơn':'Đồng ý báo giá và gửi đơn'}</button></div>
  </dialog>
}
