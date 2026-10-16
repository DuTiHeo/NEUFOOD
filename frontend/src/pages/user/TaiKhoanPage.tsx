import { Link } from 'react-router-dom'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import styles from './TaiKhoanPage.module.css'

export default function TaiKhoanPage() {
  const { isAdmin } = useAdminAuth()

  return (
    <main class={styles.acct}>
      <div class={styles.acctBox}>
        <h1 class={styles.acctTitle}>Tài khoản</h1>
        <p class={styles.acctDesc}>
          Khu vực quản lý tài khoản sinh viên (demo). Đăng nhập và lịch sử đơn sẽ được bổ sung sau.
        </p>
        {isAdmin ? (
          <Link class={styles.adminLink} to="/quan-ly">
            Vào trang quản trị
          </Link>
        ) : (
          <Link class={styles.adminLinkMuted} to="/quan-ly/dang-nhap">
            Đăng nhập quản trị viên
          </Link>
        )}
      </div>
    </main>
  )
}
