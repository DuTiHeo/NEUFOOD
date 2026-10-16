import { useCallback, useState } from 'react'
import styles from './OrderReviewModal.module.css'

export default function OrderReviewModal({ orderId, items, onClose, onSubmitReview }) {
  const [starsByLine, setStarsByLine] = useState(() => items.map(() => 0))
  const [photosByLine, setPhotosByLine] = useState(() => items.map(() => ''))
  const [comment, setComment] = useState('')
  const [err, setErr] = useState('')

  const setStar = useCallback((lineIdx, value) => {
    setStarsByLine((prev) => {
      const next = [...prev]
      next[lineIdx] = value
      return next
    })
    setErr('')
  }, [])

  const handlePickPhoto = useCallback((lineIdx, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErr('Vui lòng chọn file ảnh hợp lệ.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setErr('Ảnh tối đa 2MB để đảm bảo tải nhanh.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      setPhotosByLine((prev) => {
        const next = [...prev]
        next[lineIdx] = dataUrl
        return next
      })
      setErr('')
    }
    reader.readAsDataURL(file)
  }, [])

  const removePhoto = useCallback((lineIdx) => {
    setPhotosByLine((prev) => {
      const next = [...prev]
      next[lineIdx] = ''
      return next
    })
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    const missing = starsByLine.findIndex((s) => s < 1)
    if (missing !== -1) {
      setErr('Vui lòng chọn số sao cho từng món.')
      return
    }
    onSubmitReview({ starsByLine, photosByLine, comment })
    onClose()
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="review-title">
      <div className={styles.panel}>
        <header className={styles.head}>
          <h2 id="review-title" className={styles.title}>
            Đánh giá món ăn
          </h2>
          <p className={styles.sub}>Mã đơn #{orderId}</p>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Đóng">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <ul className={styles.list}>
            {items.map((item, idx) => (
              <li key={`${item.name}-${idx}`} className={styles.row}>
                <div className={styles.rowInfo}>
                  <span className={styles.dishName}>{item.name}</span>
                  <span className={styles.dishMeta}>x{item.qty}</span>
                </div>
                <div className={styles.stars} role="group" aria-label={`Đánh giá ${item.name}`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={n <= starsByLine[idx] ? styles.starOn : styles.starOff}
                      onClick={() => setStar(idx, n)}
                      aria-label={`${n} sao`}
                    >
                      <span className={`material-symbols-outlined ${styles.starIco}`}>star</span>
                    </button>
                  ))}
                </div>
                <div className={styles.photoRow}>
                  <label className={styles.photoBtn} htmlFor={`photo-${idx}`}>
                    <span className="material-symbols-outlined">add_a_photo</span>
                    Thêm ảnh món ăn
                  </label>
                  <input
                    id={`photo-${idx}`}
                    className={styles.photoInp}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePickPhoto(idx, e)}
                  />
                  {photosByLine[idx] ? (
                    <button type="button" className={styles.photoRemove} onClick={() => removePhoto(idx)}>
                      Bỏ ảnh
                    </button>
                  ) : null}
                </div>
                {photosByLine[idx] ? (
                  <img className={styles.photoPreview} src={photosByLine[idx]} alt={`Ảnh đánh giá ${item.name}`} />
                ) : null}
              </li>
            ))}
          </ul>

          <label className={styles.lbl}>
            Nhận xét thêm (tuỳ chọn)
            <textarea
              className={styles.area}
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ví dụ: Giao nhanh, đóng gói cẩn thận…"
            />
          </label>

          {err ? (
            <p className={styles.err} role="alert">
              {err}
            </p>
          ) : null}

          <div className={styles.actions}>
            <button type="button" className={styles.btnGhost} onClick={onClose}>
              Huỷ
            </button>
            <button type="submit" className={styles.btnPri}>
              Gửi đánh giá
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
