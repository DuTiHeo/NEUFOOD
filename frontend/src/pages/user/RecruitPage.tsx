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
  availability: string[]
  intro: string
}

const INITIAL_FORM: FormData = {
  fullName: '',
  email: '',
  phone: '',
  studentId: '',
  role: '',
  availability: [],
  intro: '',
}

const WORK_DAYS = [
  { id: 'mon', label: 'Thứ Hai' }, { id: 'tue', label: 'Thứ Ba' },
  { id: 'wed', label: 'Thứ Tư' }, { id: 'thu', label: 'Thứ Năm' },
  { id: 'fri', label: 'Thứ Sáu' }, { id: 'sat', label: 'Thứ Bảy' },
]
const WORK_SHIFTS = [
  { id: 'morning', label: 'Ca sáng', hours: '07:00–12:00' },
  { id: 'afternoon', label: 'Ca chiều', hours: '12:00–19:00' },
]
const POSITIONS = [
  { name: 'Shipper Campus', value: 'Shipper Campus (Giao đồ ăn trong NEU)', description: 'Giao món trong khuôn viên NEU, đối chiếu mã nhận hàng và thu COD, cập nhật tình trạng giao hàng.' },
  { name: 'Hỗ trợ đóng gói và điều phối', value: 'Nhân viên hỗ trợ đóng gói & Điều phối', description: 'Kiểm tra món, số lượng và ghi chú; đóng gói và sắp xếp đơn; phối hợp bàn giao cho khách hoặc shipper.' },
  { name: 'Chăm sóc khách hàng', value: 'Hỗ trợ chăm sóc khách hàng (CSKH)', description: 'Giải đáp cách đặt món, tiếp nhận phản hồi và phối hợp chuyển thông tin đến bộ phận phụ trách.' },
  { name: 'Cộng tác viên truyền thông và sự kiện', value: 'Cộng tác viên truyền thông & Marketing', description: 'Viết nội dung, chụp ảnh/quay video và hỗ trợ các hoạt động giới thiệu NEUFood trong trường.' },
]

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

    if (!formData.studentId.trim()) {
      setErrorMsg('Vui lòng nhập mã sinh viên NEU của bạn.')
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

    if (formData.availability.length < 4) {
      setErrorMsg('Vui lòng đăng ký tối thiểu 4 buổi/tuần. Mỗi ca sáng hoặc chiều được tính là 1 buổi.')
      return
    }

    setSubmitting(true)
    // Simulate real submission
    await new Promise((r) => setTimeout(r, 700))
    setSubmitting(false)
    setSubmittedData({ ...formData })
  }

  const toggleAvailability = (slot: string) => {
    setFormData(prev => ({ ...prev, availability: prev.availability.includes(slot)
      ? prev.availability.filter(value => value !== slot)
      : [...prev.availability, slot] }))
    setErrorMsg('')
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
            <h1 className={styles.title}>NEU FOOD ĐANG TUYỂN DỤNG NHÂN SỰ PARTIME</h1>
            <p className={styles.subtitle}>
              Cơ hội việc làm linh hoạt theo lịch học, có thêm thu nhập và môi trường năng động ngay tại trường học.
            </p>
          </header>

          <article className={styles.article} aria-label="Thông tin tuyển dụng NEUFood">
            <section>
              <p>Hiện nay, do nhu cầu đơn hàng tăng cao, NEUFOOD cần tuyển thêm nhân sự để hỗ trợ đóng gói, điều phối, giao món và chăm sóc khách hàng, đồng thời đồng hành trong các hoạt động truyền thông và sự kiện. Đây là cơ hội để các bạn sinh viên vừa có thêm thu nhập, vừa tích lũy kinh nghiệm và rèn luyện kỹ năng làm việc ngay trong khuôn viên trường.</p>
              <p>Chúng mình tìm kiếm những sinh viên NEU chủ động, có trách nhiệm, đúng giờ và thân thiện để cùng mang những bữa ăn chu đáo đến cộng đồng sinh viên. Hãy gia nhập ngay đội ngũ NEUFOOD của chúng tôi!</p>
            </section>
            <section>
              <h2 className={styles.positionsTitle}>4 vị trí, cùng một hành trình</h2>
              <div className={styles.positionGrid}>{POSITIONS.map(position => <section key={position.value} className={styles.positionCard}>
                <h3>{position.name}</h3><p>{position.description}</p><strong>25.000đ/giờ</strong>
                <a href="#recruit-form" className={styles.positionLink} onClick={() => { setFormData(prev => ({ ...prev, role: position.value })); setSubmittedData(null) }}>Chọn vị trí này</a>
              </section>)}</div>
            </section>
            <section>
              <h2 className={styles.positionsTitle}>Chủ động lịch làm, tối thiểu 4 buổi/tuần</h2>
              <p><strong>Thu nhập 25.000đ/giờ</strong>, áp dụng cho cả 4 vị trí. Làm việc trong khuôn viên NEU, được hướng dẫn công việc, rèn luyện kỹ năng giao tiếp và làm việc nhóm.</p>
              <p>Bạn được chọn từng ngày và ca phù hợp với lịch học từ <strong>thứ Hai đến thứ Bảy</strong>; <strong>nghỉ Chủ nhật</strong>.</p>
              <ul><li>Ca sáng: <strong>07:00–12:00</strong>.</li><li>Ca chiều: <strong>12:00–19:00</strong>.</li></ul>
              <p>Đăng ký <strong>tối thiểu 4 buổi/tuần</strong>. Mỗi ca tính 1 buổi; chọn cả sáng và chiều cùng ngày tính 2 buổi. Ví dụ: sáng và chiều thứ Hai, sáng thứ Tư, chiều thứ Sáu là 4 buổi.</p>
              <p>Liên hệ để giải đáp thắc mắc: anh <strong>Hoàng Văn Quản Lý</strong> – SĐT: <a href="tel:0812852613" className={styles.positionLink}>0812 852 613</a></p>
              <a href="#recruit-form" className={styles.homeBtn}>Ứng tuyển ngay</a>
            </section>
          </article>

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
                  <span className={styles.summaryLabel}>Lịch đăng ký ({submittedData.availability.length} buổi/tuần):</span>
                  <div className={styles.summaryValue}>{WORK_DAYS.flatMap(day => WORK_SHIFTS.filter(shift => submittedData.availability.includes(`${day.id}-${shift.id}`)).map(shift => <div key={`${day.id}-${shift.id}`}>{day.label} – {shift.label} ({shift.hours})</div>))}</div>
                </div>
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
            <div className={styles.formCard} id="recruit-form">
              <h2>Sẵn sàng gia nhập NEUFood?</h2>
              <p>Điền thông tin, chọn vị trí và đăng ký tối thiểu 4 buổi làm mỗi tuần.</p>
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
                      Mã sinh viên NEU <span className={styles.req}>*</span>
                    </label>
                    <input
                      id="studentId"
                      name="studentId"
                      type="text"
                      required
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
                    {POSITIONS.map(position => <option key={position.value} value={position.value}>{position.name}</option>)}
                  </select>
                </div>

                <fieldset className={styles.availability} aria-describedby="schedule-help schedule-count">
                  <legend className={styles.label}>Lịch có thể làm việc <span className={styles.req}>*</span></legend>
                  <p id="schedule-help" className={styles.scheduleHelp}>Chọn ngày và ca phù hợp từ thứ Hai đến thứ Bảy. Tối thiểu 4 buổi/tuần; mỗi ca là 1 buổi, chọn hai ca cùng ngày tính 2 buổi. Chủ nhật nghỉ.</p>
                  <div className={styles.scheduleGrid}>
                    {WORK_DAYS.map(day => <div key={day.id} className={styles.scheduleDay}>
                      <h3>{day.label}</h3>
                      {WORK_SHIFTS.map(shift => {
                        const slot = `${day.id}-${shift.id}`
                        return <label key={slot} className={styles.scheduleOption}>
                          <input type="checkbox" name="availability" value={slot} checked={formData.availability.includes(slot)} onChange={() => toggleAvailability(slot)} disabled={submitting} aria-label={`${day.label} – ${shift.label} (${shift.hours})`} />
                          <span>{shift.label}<small>{shift.hours}</small></span>
                        </label>
                      })}
                    </div>)}
                  </div>
                  <p id="schedule-count" className={styles.scheduleCount} role="status">Đã chọn {formData.availability.length} buổi/tuần{formData.availability.length < 4 ? ` · Cần thêm ${4 - formData.availability.length} buổi` : ' · Đã đủ tối thiểu 4 buổi'}</p>
                </fieldset>

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
                    onClick={handleReset}
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
