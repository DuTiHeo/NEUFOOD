import { useState } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../../components/layout/Footer'
import styles from './Recruit.module.css'

interface FormData {
  fullName: string
  email: string
  phone: string
  studentId: string
  role: string
  shift: string
  intro: string
}

const INITIAL_FORM: FormData = {
  fullName: '',
  email: '',
  phone: '',
  studentId: '',
  role: '',
  shift: 'part_time_lunch',
  intro: '',
}

export default function RecruitPage() {
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submittedData, setSubmittedData] = useState<FormData | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errorMsg) setErrorMsg('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!formData.fullName.trim()) {
      setErrorMsg('Vui lòng nhập họ và tên của bạn.')
      return
    }

    if (!formData.email.trim() || !formData.email.includes('@')) {
      setErrorMsg('Vui lòng nhập địa chỉ email hợp lệ.')
      return
    }

    const cleanPhone = formData.phone.replace(/\D/g, '')
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      setErrorMsg('Vui lòng nhập số điện thoại hợp lệ (10-11 chữ số).')
      return
    }

    if (!formData.role) {
      setErrorMsg('Vui lòng chọn vị trí bạn muốn ứng tuyển.')
      return
    }

    setSubmitting(true)
    // Simulate real submission
    await new Promise((r) => setTimeout(r, 700))
    setSubmitting(false)
    setSubmittedData({ ...formData })
  }

  const handleReset = () => {
    setFormData(INITIAL_FORM)
    setSubmittedData(null)
    setErrorMsg('')
  }

  return (
    <>
      <main className={styles.recruitPage}>
        <div className={`wrap ${styles.container}`}>
          <nav className={styles.crumb} aria-label="Breadcrumb">
            <Link to="/" className={styles.crumbLink}>
              ← Trang chủ
            </Link>
            <span className={styles.crumbSep}>/</span>
            <span className={styles.crumbCurrent}>Tuyển dụng nhân sự</span>
          </nav>

          <header className={styles.header}>
            <div className={styles.badgeWrap}>
              <span className={styles.badge}>Gia nhập đội ngũ NEUFood</span>
            </div>
            <h1 className={styles.title}>Cùng NEUFood phục vụ Campus</h1>
            <p className={styles.subtitle}>
              Cơ hội việc làm linh hoạt theo lịch học, thu nhập hấp dẫn và môi trường năng động ngay tại trường.
            </p>
          </header>

          {submittedData ? (
            <div className={styles.successCard} role="status">
              <div className={styles.successIconBox}>
                <span className={`material-symbols-outlined ${styles.successIcon}`}>check_circle</span>
              </div>
              <h2 className={styles.successTitle}>Hồ sơ ứng tuyển đã được tiếp nhận!</h2>
              <p className={styles.successLead}>
                Cảm ơn bạn <strong>{submittedData.fullName}</strong> đã quan tâm đến NEUFood. Chúng mình sẽ liên hệ với bạn qua số điện thoại <strong>{submittedData.phone}</strong> trong vòng 24–48h tới.
              </p>

              <div className={styles.summaryBox}>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>Vị trí ứng tuyển:</span>
                  <span className={styles.summaryValue}>{submittedData.role}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>Email liên hệ:</span>
                  <span className={styles.summaryValue}>{submittedData.email}</span>
                </div>
                {submittedData.studentId ? (
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Mã sinh viên:</span>
                    <span className={styles.summaryValue}>{submittedData.studentId}</span>
                  </div>
                ) : null}
              </div>

              <div className={styles.successActions}>
                <button type="button" className={styles.resetBtn} onClick={handleReset}>
                  Nộp hồ sơ khác
                </button>
                <Link to="/" className={styles.homeBtn}>
                  Về trang chủ
                </Link>
              </div>
            </div>
          ) : (
            <div className={styles.formCard}>
              <form onSubmit={handleSubmit} noValidate>
                {errorMsg ? (
                  <div className={styles.errorAlert} role="alert">
                    <span className={`material-symbols-outlined ${styles.errorIcon}`}>error</span>
                    <span>{errorMsg}</span>
                  </div>
                ) : null}

                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label htmlFor="fullName" className={styles.label}>
                      Họ và tên <span className={styles.req}>*</span>
                    </label>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      className={styles.input}
                      placeholder="Nguyễn Văn A"
                      value={formData.fullName}
                      onChange={handleChange}
                      required
                      autoComplete="name"
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="studentId" className={styles.label}>
                      Mã sinh viên NEU (nếu có)
                    </label>
                    <input
                      id="studentId"
                      name="studentId"
                      type="text"
                      className={styles.input}
                      placeholder="Ví dụ: 11210001"
                      value={formData.studentId}
                      onChange={handleChange}
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label htmlFor="email" className={styles.label}>
                      Địa chỉ Email <span className={styles.req}>*</span>
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      className={styles.input}
                      placeholder="ten@neu.edu.vn"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      autoComplete="email"
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="phone" className={styles.label}>
                      Số điện thoại liên hệ <span className={styles.req}>*</span>
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      inputMode="numeric"
                      className={styles.input}
                      placeholder="0912 345 678"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      autoComplete="tel"
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="role" className={styles.label}>
                    Vị trí ứng tuyển <span className={styles.req}>*</span>
                  </label>
                  <select
                    id="role"
                    name="role"
                    className={styles.select}
                    value={formData.role}
                    onChange={handleChange}
                    required
                  >
                    <option value="">-- Chọn vị trí ứng tuyển --</option>
                    <option value="Shipper Campus (Giao đồ ăn trong NEU)">
                      Shipper Campus (Giao đồ ăn trong NEU - Ưu tiên sinh viên)
                    </option>
                    <option value="Nhân viên hỗ trợ đóng gói & Điều phối">
                      Nhân viên hỗ trợ đóng gói &amp; Điều phối đơn tại Canteen
                    </option>
                    <option value="Hỗ trợ chăm sóc khách hàng (CSKH)">
                      Hỗ trợ chăm sóc khách hàng (CSKH &amp; Tiếp nhận phản hồi)
                    </option>
                    <option value="Cộng tác viên truyền thông & Marketing">
                      Cộng tác viên truyền thông &amp; Sự kiện NEUFood
                    </option>
                  </select>
                </div>

                <div className={styles.field}>
                  <span className={styles.label}>Thời gian có thể làm việc</span>
                  <div className={styles.radioGroup}>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="shift"
                        value="part_time_lunch"
                        checked={formData.shift === 'part_time_lunch'}
                        onChange={handleChange}
                        className={styles.radioInput}
                      />
                      <span>Ca trưa (10:30 – 13:30)</span>
                    </label>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="shift"
                        value="part_time_afternoon"
                        checked={formData.shift === 'part_time_afternoon'}
                        onChange={handleChange}
                        className={styles.radioInput}
                      />
                      <span>Ca chiều (16:30 – 19:30)</span>
                    </label>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="shift"
                        value="flexible"
                        checked={formData.shift === 'flexible'}
                        onChange={handleChange}
                        className={styles.radioInput}
                      />
                      <span>Linh hoạt theo lịch học</span>
                    </label>
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="intro" className={styles.label}>
                    Giới thiệu ngắn &amp; Kinh nghiệm bản thân
                  </label>
                  <textarea
                    id="intro"
                    name="intro"
                    className={styles.textarea}
                    rows={4}
                    placeholder="Chia sẻ về sở thích, kinh nghiệm làm thêm hoặc lý do bạn muốn đồng hành cùng NEUFood..."
                    value={formData.intro}
                    onChange={handleChange}
                  />
                </div>

                <div className={styles.formActions}>
                  <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className={styles.btnSpinner} aria-hidden />
                        Đang gửi hồ sơ…
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">send</span>
                        Gửi hồ sơ ứng tuyển
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className={styles.clearBtn}
                    onClick={() => setFormData(INITIAL_FORM)}
                    disabled={submitting}
                  >
                    Nhập lại
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  )
}
