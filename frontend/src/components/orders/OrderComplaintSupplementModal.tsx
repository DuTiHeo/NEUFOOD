import React, { useState, useRef } from 'react'
import { complaintService, Complaint } from '../../services/complaintService'
import styles from './OrderComplaintSupplementModal.module.css'

interface OrderComplaintSupplementModalProps {
  complaint: Complaint
  onClose: () => void
  onSuccess: () => void
}

export default function OrderComplaintSupplementModal({
  complaint,
  onClose,
  onSuccess,
}: OrderComplaintSupplementModalProps) {
  const [description, setDescription] = useState('')
  const [proofImageUrl, setProofImageUrl] = useState(complaint.proof_image_url || '')
  const [previewUrl, setPreviewUrl] = useState(complaint.proof_image_url || '')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      setError('Định dạng ảnh không được hỗ trợ (chỉ nhận PNG, JPG, JPEG, WEBP, GIF).')
      return
    }

    const localUrl = URL.createObjectURL(file)
    setPreviewUrl(localUrl)
    setError('')
    setUploadingImage(true)

    try {
      const uploadedUrl = await complaintService.uploadComplaintProof(file)
      setProofImageUrl(uploadedUrl)
    } catch (uploadErr: any) {
      setError(uploadErr?.response?.data?.message || 'Không thể tải ảnh minh chứng lên máy chủ. Hãy thử lại.')
      setPreviewUrl(complaint.proof_image_url || '')
      setProofImageUrl(complaint.proof_image_url || '')
    } finally {
      setUploadingImage(false)
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

    const trimmedDesc = description.trim()
    const trimmedImg = proofImageUrl.trim()

    if (!trimmedImg && !trimmedDesc) {
      setError('Vui lòng tải lên ảnh minh chứng hoặc nhập nội dung giải trình bổ sung.')
      return
    }

    setSubmitting(true)
    try {
      await complaintService.supplementComplaint(complaint.id, {
        proof_image_url: trimmedImg || undefined,
        description: trimmedDesc || undefined,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Không thể gửi bổ sung khiếu nại. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <h2 className={styles.title}>
            <span className={`material-symbols-outlined ${styles.titleIcon}`}>add_photo_alternate</span>
            Bổ sung minh chứng khiếu nại
          </h2>
          <p className={styles.sub}>
            Mã đơn hàng: <strong>#{complaint.order_id}</strong>
          </p>
        </div>

        <button type="button" className={styles.close} onClick={onClose} aria-label="Đóng cửa sổ">
          <span className="material-symbols-outlined">close</span>
        </button>

        {complaint.admin_response ? (
          <div className={styles.adminReqBox}>
            <p className={styles.adminReqTitle}>
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>info</span>
              Yêu cầu từ Ban Quản lý NEUFood:
            </p>
            <p className={styles.adminReqTxt}>{complaint.admin_response}</p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className={styles.form}>
          {error ? (
            <div className={styles.errorAlert} role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          <div className={styles.field}>
            <label className={styles.label}>
              <span>Hình ảnh minh chứng bổ sung</span>
              {uploadingImage ? <span className={styles.charCount}>Đang tải ảnh…</span> : null}
            </label>

            <div className={styles.uploadBox}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="supplement-file-input"
              />

              <button
                type="button"
                className={styles.uploadBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage || submitting}
              >
                <span className="material-symbols-outlined">cloud_upload</span>
                <span>{uploadingImage ? 'Đang tải ảnh lên…' : 'Chọn ảnh mới từ thiết bị'}</span>
              </button>

              {previewUrl ? (
                <div className={styles.previewContainer}>
                  <img
                    src={previewUrl}
                    alt="Minh chứng khiếu nại"
                    className={styles.previewThumb}
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src = '/assets/default-dish.jpg'
                    }}
                  />
                  <div className={styles.previewInfo}>
                    <p className={styles.previewLbl}>Ảnh minh chứng</p>
                    <p className={styles.previewTxt}>{proofImageUrl}</p>
                  </div>
                  <button
                    type="button"
                    className={styles.removeThumbBtn}
                    onClick={handleRemoveImage}
                    title="Xóa ảnh này"
                  >
                    Gỡ ảnh
                  </button>
                </div>
              ) : null}

              <input
                type="text"
                placeholder="Hoặc nhập đường dẫn URL ảnh (https://...)"
                value={proofImageUrl}
                onChange={handleUrlChange}
                className={styles.urlInput}
                disabled={submitting}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              <span>Nội dung giải trình bổ sung</span>
              <span className={styles.charCount}>{description.length}/2000</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Nhập nội dung giải trình hoặc phản hồi thêm theo yêu cầu của Ban Quản lý..."
              className={styles.textarea}
              maxLength={2000}
              disabled={submitting}
            />
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={submitting}>
              Hủy
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting || uploadingImage}
            >
              <span className="material-symbols-outlined">send</span>
              <span>{submitting ? 'Đang gửi…' : 'Gửi minh chứng bổ sung'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
