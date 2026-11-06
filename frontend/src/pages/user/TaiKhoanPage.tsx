import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, Mail, ShieldCheck, AlertCircle } from 'lucide-react'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { useAuth } from '../../contexts/AuthContext'
import { authService } from '../../services/authService'
import { UserProfileUpdate } from '../../types/user'
import Footer from '../../components/layout/Footer'
import styles from './TaiKhoanPage.module.css'

export default function TaiKhoanPage() {
  const { isAdmin } = useAdminAuth()
  const { user, refreshUser, logout } = useAuth()

  // State thông tin cá nhân
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [phone, setPhone] = useState(user?.phone_number || '')
  const [studentId, setStudentId] = useState(user?.student_id || '')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // State đổi mật khẩu qua OTP
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [changePwdError, setChangePwdError] = useState('')
  const [changePwdSuccess, setChangePwdSuccess] = useState('')
  const [debugOtp, setDebugOtp] = useState<string | null>(null)

  useEffect(() => {
    setFullName(user?.full_name || '')
    setPhone(user?.phone_number || '')
    setStudentId(user?.student_id || '')
  }, [user])

  // Cooldown đếm ngược 60 giây khi gửi mã OTP
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    setError('')
    setMessage('')
    setIsSaving(true)
    try {
      const payload: UserProfileUpdate = {
        full_name: fullName.trim(),
        ...(phone.trim() ? { phone_number: phone.trim() } : {}),
        student_id: studentId.trim() || null,
      }
      await authService.updateProfile(payload)
      await refreshUser()
      setMessage('Thông tin hồ sơ đã được lưu thành công.')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể cập nhật hồ sơ. Vui lòng kiểm tra thông tin và thử lại.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSendOtp() {
    if (cooldown > 0 || isSendingOtp) return
    setChangePwdError('')
    setChangePwdSuccess('')
    setDebugOtp(null)
    setIsSendingOtp(true)

    try {
      const res = await authService.requestChangePasswordOtp()
      setOtpSent(true)
      setCooldown(60)
      setChangePwdSuccess(res.message || 'Mã xác thực OTP 6 số đã được gửi tới email của bạn.')
      if (res.data?.otp_debug) {
        setDebugOtp(res.data.otp_debug)
      }
    } catch (reqError: any) {
      setChangePwdError(
        reqError?.response?.data?.message || 'Không thể gửi mã xác thực OTP. Vui lòng thử lại sau.'
      )
    } finally {
      setIsSendingOtp(false)
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setChangePwdError('')
    setChangePwdSuccess('')

    const cleanOtp = otp.trim()
    if (!cleanOtp) {
      setChangePwdError('Vui lòng gửi và nhập mã xác thực OTP 6 số từ email.')
      return
    }

    if (!/^\d{6}$/.test(cleanOtp)) {
      setChangePwdError('Mã xác thực OTP phải gồm đúng 6 chữ số.')
      return
    }

    if (newPassword.length < 6) {
      setChangePwdError('Mật khẩu mới phải có độ dài tối thiểu 6 ký tự.')
      return
    }

    if (newPassword !== confirmPassword) {
      setChangePwdError('Mật khẩu xác nhận không khớp với mật khẩu mới.')
      return
    }

    setIsChangingPassword(true)

    try {
      const res = await authService.changePassword({
        otp: cleanOtp,
        new_password: newPassword,
      })
      setChangePwdSuccess(res.message || 'Đổi mật khẩu thành công! Tài khoản của bạn đã được cập nhật an toàn.')
      // Reset form đổi mật khẩu
      setOtp('')
      setNewPassword('')
      setConfirmPassword('')
      setOtpSent(false)
      setDebugOtp(null)
    } catch (reqError: any) {
      setChangePwdError(
        reqError?.response?.data?.message || 'Đổi mật khẩu không thành công. Vui lòng kiểm tra lại mã OTP.'
      )
    } finally {
      setIsChangingPassword(false)
    }
  }

  async function signOut() {
    await logout()
  }

  return (
    <>
      <main className={styles.acct}>
        <div className={styles.acctBox}>
          <div className={styles.avatarWrap}>
            <span className={`material-symbols-outlined ${styles.avatarIcon}`}>account_circle</span>
          </div>
          <h1 className={styles.acctTitle}>Tài khoản sinh viên NEU</h1>
          <p className={styles.acctDesc}>
            {user?.email || 'Tài khoản NEUFood'} · Quản lý hồ sơ và đơn hàng của bạn.
          </p>

          {/* Form 1: Thông tin cá nhân */}
          <form className={styles.profileForm} onSubmit={saveProfile}>
            <h2 className={styles.profileTitle}>Thông tin cá nhân</h2>

            <label className={styles.profileField} htmlFor="profile-email">
              Địa chỉ Email
              <div className={styles.inputWithIcon}>
                <Mail className={styles.fieldIcon} size={18} />
                <input
                  id="profile-email"
                  type="email"
                  value={user?.email || ''}
                  readOnly
                  disabled
                  className={styles.inputDisabled}
                  title="Địa chỉ email đăng ký tài khoản (cố định để nhận thông báo và mã OTP)"
                />
              </div>
              <span className={styles.fieldHint}>
                Email liên kết tài khoản dùng để nhận thông báo đơn hàng và mã xác thực OTP bảo mật.
              </span>
            </label>

            <label className={styles.profileField} htmlFor="profile-name">
              Họ và tên
              <input
                id="profile-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                minLength={2}
                maxLength={150}
                autoComplete="name"
                required
              />
            </label>

            <label className={styles.profileField} htmlFor="profile-phone">
              Số điện thoại
              <input
                id="profile-phone"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                pattern="0[0-9]{9}"
                maxLength={10}
                autoComplete="tel"
                placeholder="0912345678"
              />
            </label>

            <label className={styles.profileField} htmlFor="profile-student-id">
              Mã sinh viên
              <input
                id="profile-student-id"
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                maxLength={30}
              />
            </label>

            {error ? <p className={styles.profileError} role="alert">{error}</p> : null}
            {message ? <p className={styles.profileSuccess} role="status">{message}</p> : null}

            <button className={styles.profileSave} type="submit" disabled={isSaving}>
              {isSaving ? 'Đang lưu…' : 'Lưu hồ sơ'}
            </button>
          </form>

          {/* Form 2: Đổi mật khẩu tài khoản qua OTP */}
          <form className={styles.passwordForm} onSubmit={handleChangePassword}>
            <div className={styles.formHeader}>
              <KeyRound className={styles.formHeaderIcon} size={22} />
              <h2 className={styles.formTitle}>Đổi mật khẩu tài khoản</h2>
            </div>
            <p className={styles.formSubtitle}>
              Xác thực mã OTP gửi về email <strong>{user?.email}</strong> để đổi mật khẩu an toàn theo quy chuẩn bảo mật.
            </p>

            {changePwdSuccess ? (
              <div className={styles.bannerSuccess} role="status">
                <ShieldCheck className={styles.bannerIcon} size={18} />
                <span>{changePwdSuccess}</span>
              </div>
            ) : null}

            {changePwdError ? (
              <div className={styles.bannerError} role="alert">
                <AlertCircle className={styles.bannerIcon} size={18} />
                <span>{changePwdError}</span>
              </div>
            ) : null}

            {debugOtp ? (
              <div
                style={{
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fef3c7',
                  borderRadius: '0.65rem',
                  padding: '0.6rem 0.8rem',
                  marginBottom: '1rem',
                  fontSize: '0.8125rem',
                  color: '#92400e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span>🛠️ <strong>Môi trường phát triển:</strong> Mã OTP vừa gửi là <strong>{debugOtp}</strong></span>
              </div>
            ) : null}

            {/* Hàng OTP */}
            <div className={styles.profileField}>
              <label htmlFor="change-pwd-otp">Mã xác thực OTP (6 chữ số)</label>
              <div className={styles.otpRow}>
                <input
                  id="change-pwd-otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="------"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  autoComplete="one-time-code"
                />
                <button
                  type="button"
                  className={styles.otpBtn}
                  onClick={handleSendOtp}
                  disabled={cooldown > 0 || isSendingOtp}
                >
                  {isSendingOtp
                    ? 'Đang gửi…'
                    : cooldown > 0
                    ? `Gửi lại mã (${cooldown}s)`
                    : otpSent
                    ? 'Gửi lại mã OTP'
                    : 'Nhận mã OTP'}
                </button>
              </div>
              <span className={styles.fieldHint}>
                Bấm "Nhận mã OTP" để hệ thống gửi mã xác nhận 6 số về hộp thư Gmail của bạn.
              </span>
            </div>

            {/* Mật khẩu mới */}
            <label className={styles.profileField} htmlFor="change-pwd-new">
              Mật khẩu mới (tối thiểu 6 ký tự)
              <div className={styles.passwordInputWrap}>
                <input
                  id="change-pwd-new"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  maxLength={128}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className={styles.toggleEyeBtn}
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {/* Xác nhận mật khẩu mới */}
            <label className={styles.profileField} htmlFor="change-pwd-confirm">
              Xác nhận mật khẩu mới
              <div className={styles.passwordInputWrap}>
                <input
                  id="change-pwd-confirm"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  maxLength={128}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className={styles.toggleEyeBtn}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <button
              className={styles.changePwdBtn}
              type="submit"
              disabled={isChangingPassword}
            >
              {isChangingPassword ? 'Đang cập nhật mật khẩu…' : 'Xác nhận đổi mật khẩu'}
            </button>
          </form>

          {/* Menu liên kết */}
          <div className={styles.menuLinks}>
            <Link to="/lich-su-don" className={styles.menuItem}>
              <div className={styles.menuItemLeft}>
                <span className={`material-symbols-outlined ${styles.menuIcon}`}>receipt_long</span>
                <div>
                  <span className={styles.menuTitle}>Lịch sử đơn hàng</span>
                  <span className={styles.menuSub}>Xem lại các đơn đã đặt và hóa đơn</span>
                </div>
              </div>
              <span className={`material-symbols-outlined ${styles.menuArrow}`}>chevron_right</span>
            </Link>

            <Link to="/gio-hang" className={styles.menuItem}>
              <div className={styles.menuItemLeft}>
                <span className={`material-symbols-outlined ${styles.menuIcon}`}>shopping_bag</span>
                <div>
                  <span className={styles.menuTitle}>Giỏ hàng của bạn</span>
                  <span className={styles.menuSub}>Kiểm tra món ăn đã chọn</span>
                </div>
              </div>
              <span className={`material-symbols-outlined ${styles.menuArrow}`}>chevron_right</span>
            </Link>

            <Link to="/menu" className={styles.menuItem}>
              <div className={styles.menuItemLeft}>
                <span className={`material-symbols-outlined ${styles.menuIcon}`}>restaurant_menu</span>
                <div>
                  <span className={styles.menuTitle}>Thực đơn NEUFood</span>
                  <span className={styles.menuSub}>Thực đơn được cập nhật từ Canteen NEU</span>
                </div>
              </div>
              <span className={`material-symbols-outlined ${styles.menuArrow}`}>chevron_right</span>
            </Link>

            <Link to="/recruit" className={styles.menuItem}>
              <div className={styles.menuItemLeft}>
                <span className={`material-symbols-outlined ${styles.menuIcon}`}>badge</span>
                <div>
                  <span className={styles.menuTitle}>Tuyển dụng nhân sự</span>
                  <span className={styles.menuSub}>Trở thành Shipper hoặc cộng tác viên</span>
                </div>
              </div>
              <span className={`material-symbols-outlined ${styles.menuArrow}`}>chevron_right</span>
            </Link>
          </div>

          <div className={styles.adminSection}>
            {isAdmin ? (
              <Link className={styles.adminLink} to="/quan-ly">
                <span className="material-symbols-outlined">dashboard</span>
                Vào trang quản trị NEUFood
              </Link>
            ) : (
              <Link className={styles.adminLinkMuted} to="/quan-ly/dang-nhap">
                <span className="material-symbols-outlined">admin_panel_settings</span>
                Đăng nhập quản trị viên
              </Link>
            )}
            <button type="button" className={styles.signOut} onClick={() => void signOut()}>
              Đăng xuất
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
