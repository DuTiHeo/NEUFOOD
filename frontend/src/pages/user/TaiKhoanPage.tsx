import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { useAuth } from '../../contexts/AuthContext'
import { authService } from '../../services/authService'
import { UserProfileUpdate } from '../../types/user'
import Footer from '../../components/layout/Footer'
import styles from './TaiKhoanPage.module.css'

export default function TaiKhoanPage() {
  const { isAdmin } = useAdminAuth()
  const { user, refreshUser, logout } = useAuth()
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [phone, setPhone] = useState(user?.phone_number || '')
  const [studentId, setStudentId] = useState(user?.student_id || '')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setFullName(user?.full_name || '')
    setPhone(user?.phone_number || '')
    setStudentId(user?.student_id || '')
  }, [user])

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
      setMessage('Thông tin hồ sơ đã được lưu.')
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể cập nhật hồ sơ. Vui lòng kiểm tra thông tin và thử lại.')
    } finally {
      setIsSaving(false)
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

          <form className={styles.profileForm} onSubmit={saveProfile}>
            <h2 className={styles.profileTitle}>Thông tin cá nhân</h2>
            <label className={styles.profileField} htmlFor="profile-name">Họ và tên
              <input id="profile-name" value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} maxLength={150} autoComplete="name" required />
            </label>
            <label className={styles.profileField} htmlFor="profile-phone">Số điện thoại
              <input id="profile-phone" type="tel" inputMode="numeric" value={phone} onChange={(event) => setPhone(event.target.value)} pattern="0[0-9]{9}" maxLength={10} autoComplete="tel" placeholder="0912345678" />
            </label>
            <label className={styles.profileField} htmlFor="profile-student-id">Mã sinh viên
              <input id="profile-student-id" value={studentId} onChange={(event) => setStudentId(event.target.value)} maxLength={30} />
            </label>
            {error ? <p className={styles.profileError} role="alert">{error}</p> : null}
            {message ? <p className={styles.profileSuccess} role="status">{message}</p> : null}
            <button className={styles.profileSave} type="submit" disabled={isSaving}>{isSaving ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
          </form>

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
            <button type="button" className={styles.signOut} onClick={() => void signOut()}>Đăng xuất</button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
