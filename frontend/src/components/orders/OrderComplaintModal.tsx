import React, { useState, useRef } from 'react'
import { complaintService, ComplaintCreatePayload, Complaint } from '../../services/complaintService'
import styles from './OrderComplaintModal.module.css'

interface OrderComplaintModalProps {
  orderId: string
  onClose: () => void
  onSuccess: (complaint: Complaint) => void
}

const DEFAULT_REASONS = [
  'Món bị nguội / không đảm bảo nhiệt độ',
  'Giao nhầm món / sai món so với đơn',
  'Thiếu món / thiếu phần ăn',
  'Món ăn không hợp vệ sinh an toàn thực phẩm',
  'Giao hàng quá trễ / thời gian chờ đợi lâu',
  'Lý do khác',
]

export default function OrderComplaintModal({ orderId, onClose, onSuccess }: OrderComplaintModalProps) {
  const [selectedReason, setSelectedReason] = useState(DEFAULT_REASONS[0])
  const [customReason, setCustomReason] = useState('')
  const [description, setDescription] = useState('')
  const [proofImageUrl, setProofImageUrl] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const finalReason = selectedReason === 'Lý do khác' ? customReason.trim() : selectedReason

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    // Kiểm tra định dạng ảnh
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      setError('Định dạng ảnh không được hỗ trợ (chỉ nhận PNG, JPG, JPEG, WEBP, GIF).')
      return
    }

    // Tạo preview blob tạm thời
    const localUrl = URL.createObjectURL(file)
    setPreviewUrl(localUrl)
    setError('')
    setUploadingImage(true)

    try {
      const uploadedUrl = await complaintService.uploadComplaintProof(file)
      setProofImageUrl(uploadedUrl)
    } catch (uploadErr: any) {
      setError(uploadErr?.response?.data?.message || 'Không thể tải ảnh minh chứng lên máy chủ. Hãy thử lại.')
      setPreviewUrl('')
      setProofImageUrl('')
    } finally {
      setUploadingImage(false)
      // Reset input value để cho phép chọn lại cùng 1 file nếu cần
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  function handleUrlChange(event: React.ChangeEvent<HTMLInputElement>) {
    const url = event.target.value
    setProofImageUrl(url)
    setPreviewUrl(url)
    setError('')
  }

  function handleRemoveImage() {
    setPreviewUrl('')
    setProofImageUrl('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')

    if (!finalReason) {
      setError('Vui lòng chọn hoặc nhập lý do khiếu nại.')
      return
    }

    const trimmedDesc = description.trim()
    if (trimmedDesc.length < 10) {
      setError('Mô tả chi tiết nội dung khiếu nại cần tối thiểu 10 ký tự.')
      return
    }

    if (!proofImageUrl.trim()) {
      setError('Vui lòng cung cấp hình ảnh minh chứng (tải ảnh lên hoặc nhập URL).')
      return
    }

    setSubmitting(true)
    try {
      const payload: ComplaintCreatePayload = {
        order_id: orderId,
        reason: finalReason,
        description: trimmedDesc,
        proof_image_url: proofImageUrl.trim(),
      }
      const complaint = await complaintService.createComplaint(payload)
      onSuccess(complaint)
      onClose()
    } catch (submitErr: any) {
      const msg = submitErr?.response?.data?.message || submitErr?.message || 'Không thể gửi khiếu nại. Vui lòng thử lại.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="complaint-modal-title">
      <div className={styles.panel}>
        <header className={styles.head}>
          <h2 id="complaint-modal-title" className={styles.title}>
            <span className={`material-symbols-outlined ${styles.titleIcon}`}>report_problem</span>
            Khiếu nại đơn hàng
          </h2>
          <p className={styles.sub}>Mã đơn #{orderId} · Đơn đã giao trong vòng 24 giờ</p>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            disabled={submitting || uploadingImage}
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          {/* 1. Chọn lý do khiếu nại */}
          <div className={styles.field}>
            <label htmlFor="complaint-reason-select" className={styles.label}>
              Lý do khiếu nại <span className={styles.required}>*</span>
            </label>
            <select
              id="complaint-reason-select"
              className={styles.select}
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              disabled={submitting}
            >
              {DEFAULT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {selectedReason === 'Lý do khác' && (
            <div className={styles.field}>
              <label htmlFor="custom-reason-input" className={styles.label}>
                Nhập lý do cụ thể <span className={styles.required}>*</span>
              </label>
              <input
                id="custom-reason-input"
                type="text"
                className={styles.input}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Nhập lý do ngắn gọn..."
                maxLength={255}
                required
                disabled={submitting}
              />
            </div>
          )}

          {/* 2. Mô tả chi tiết */}
          <div className={styles.field}>
            <label htmlFor="complaint-description" className={styles.label}>
              <span>
                Mô tả chi tiết <span className={styles.required}>*</span>
              </span>
              <span className={styles.charCount}>{description.length}/2000 (tối thiểu 10)</span>
            </label>
            <textarea
              id="complaint-description"
              className={styles.textarea}
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Vui lòng mô tả chi tiết vấn đề bạn gặp phải với đơn hàng (món ăn, tình trạng, thiếu sót...)..."
              minLength={10}
              maxLength={2000}
              required
              disabled={submitting}
            />
            <p className={styles.hint}>Mô tả càng chi tiết sẽ giúp Ban Quản lý giải quyết đơn nhanh chóng hơn.</p>
          </div>

          {/* 3. Ảnh minh chứng */}
          <div className={styles.field}>
            <label className={styles.label}>
              Ảnh minh chứng <span className={styles.required}>*</span>
            </label>

            {previewUrl ? (
              <div className={styles.previewContainer}>
                <img
                  src={previewUrl}
                  alt="Ảnh minh chứng"
                  className={styles.previewImg}
                  onError={() => setError('Không thể hiển thị ảnh từ URL đã nhập. Vui lòng kiểm tra lại.')}
                />
                <button
                  type="button"
                  className={styles.removeImgBtn}
                  onClick={handleRemoveImage}
                  disabled={submitting || uploadingImage}
                  title="Xóa ảnh này"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                </button>
              </div>
            ) : (
              <div className={styles.uploadBox}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  className={styles.fileInput}
                  onChange={handleFileChange}
                  disabled={submitting || uploadingImage}
                />
                <button
                  type="button"
                  className={styles.uploadBtn}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting || uploadingImage}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add_photo_alternate</span>
                  {uploadingImage ? 'Đang tải ảnh...' : 'Chọn ảnh từ thiết bị'}
                </button>
                <p className={styles.hint}>Hỗ trợ JPG, PNG, WEBP, GIF tối đa 10MB</p>

                <div className={styles.divider}>HOẶC</div>

                <input
                  type="url"
                  className={styles.input}
                  placeholder="Dán đường dẫn (URL) ảnh minh chứng..."
                  value={proofImageUrl}
                  onChange={handleUrlChange}
                  disabled={submitting || uploadingImage}
                />
              </div>
            )}
          </div>

          {/* Báo lỗi nếu có */}
          {error && (
            <div className={styles.errorBox} role="alert">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Các nút hành động */}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnCancel}
              onClick={onClose}
              disabled={submitting || uploadingImage}
            >
              Hủy
            </button>
            <button
              type="submit"
              className={styles.btnSubmit}
              disabled={submitting || uploadingImage}
            >
              {submitting ? (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>sync</span>
                  Đang gửi...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>
                  Gửi khiếu nại
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
