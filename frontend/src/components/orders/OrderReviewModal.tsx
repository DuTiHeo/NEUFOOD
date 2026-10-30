import { useCallback, useState } from 'react'
import styles from './OrderReviewModal.module.css'

interface ReviewItem {
  dishId: string;
  name: string;
  qty: number;
}

interface OrderReviewModalProps {
  orderId: string;
  items: ReviewItem[];
  onClose: () => void;
  onSubmitReview: (data: { starsByLine: number[]; comment: string }) => Promise<void> | void;
}

export default function OrderReviewModal({ orderId, items, onClose, onSubmitReview }: OrderReviewModalProps) {
  const [starsByLine, setStarsByLine] = useState(() => items.map(() => 0))
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const setStar = useCallback((lineIndex: number, value: number) => {
    setStarsByLine((previous) => {
      const next = [...previous]
      next[lineIndex] = value
      return next
    })
    setError('')
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (starsByLine.some((stars) => stars < 1)) {
      setError('Vui lòng chọn số sao cho từng món.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onSubmitReview({ starsByLine, comment })
      onClose()
    } catch (submitError: any) {
      setError(submitError?.message || 'Không gửi được đánh giá. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="review-title">
      <div className={styles.panel}>
        <header className={styles.head}>
          <h2 id="review-title" className={styles.title}>Đánh giá món ăn</h2>
          <p className={styles.sub}>Mã đơn #{orderId}</p>
          <button type="button" className={styles.close} onClick={onClose} disabled={submitting} aria-label="Đóng"><span className="material-symbols-outlined">close</span></button>
        </header>
        <form className={styles.form} onSubmit={handleSubmit}>
          <ul className={styles.list}>
            {items.map((item, index) => <li key={`${item.dishId}-${index}`} className={styles.row}>
              <div className={styles.rowInfo}><span className={styles.dishName}>{item.name}</span><span className={styles.dishMeta}>×{item.qty}</span></div>
              <div className={styles.stars} role="group" aria-label={`Đánh giá ${item.name}`}>
                {[1, 2, 3, 4, 5].map((number) => <button key={number} type="button" className={number <= starsByLine[index] ? styles.starOn : styles.starOff} onClick={() => setStar(index, number)} aria-label={`${number} sao`} aria-pressed={starsByLine[index] === number}><span className={`material-symbols-outlined ${styles.starIco}`}>star</span></button>)}
              </div>
            </li>)}
          </ul>
          <label className={styles.lbl}>Nhận xét thêm (tuỳ chọn)
            <textarea className={styles.area} rows={3} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} placeholder="Chia sẻ trải nghiệm của bạn…" />
          </label>
          {error ? <p className={styles.err} role="alert">{error}</p> : null}
          <div className={styles.actions}>
            <button type="button" className={styles.btnGhost} onClick={onClose} disabled={submitting}>Huỷ</button>
            <button type="submit" className={styles.btnPri} disabled={submitting}>{submitting ? 'Đang gửi…' : 'Gửi đánh giá'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
