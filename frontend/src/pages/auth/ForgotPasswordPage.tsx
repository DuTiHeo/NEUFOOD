import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/authService';

type ResetStep = 'request' | 'reset' | 'done';

function getErrorMessage(error: any, fallback: string) {
  return error?.response?.data?.message || fallback;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<ResetStep>('request');
  const [debugOtp, setDebugOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const requestCode = async (event?: React.SyntheticEvent) => {
    event?.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await authService.requestPasswordReset(email);
      setDebugOtp(import.meta.env.DEV ? response.data?.otp_debug || '' : '');
      setStep('reset');
    } catch (err: any) {
      setError(getErrorMessage(err, 'Không gửi được mã xác nhận. Vui lòng thử lại.'));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({
        email: email.trim(),
        otp: otp.trim(),
        new_password: newPassword,
      });
      setStep('done');
    } catch (err: any) {
      setError(getErrorMessage(err, 'Không thể cập nhật mật khẩu. Vui lòng kiểm tra lại mã OTP.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 pt-28 pb-12 bg-[#f7f7fb]">
      <section className="w-full max-w-[480px] p-8 rounded-2xl bg-white shadow-xl flex flex-col gap-6">
        <div className="flex flex-col items-center text-center gap-2">
          <Link to="/" className="flex items-center gap-2 mb-2">
            <img src="/neu-food.png" alt="NEUFood" className="w-10 h-10 rounded-xl" />
            <span className="text-xl font-bold text-[#003f87]">NEUFood</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {step === 'done' ? 'Đã cập nhật mật khẩu' : 'Quên mật khẩu?'}
          </h1>
          <p className="text-sm text-gray-500">
            {step === 'request'
              ? 'Nhập email tài khoản NEU để nhận mã xác nhận khôi phục.'
              : step === 'reset'
                ? `Nhập mã xác nhận và đặt mật khẩu mới cho ${email}.`
                : 'Bạn có thể đăng nhập bằng mật khẩu mới.'}
          </p>
        </div>

        {error ? (
          <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200" role="alert">
            {error}
          </div>
        ) : null}

        {step === 'request' ? (
          <form onSubmit={requestCode} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="forgot-email" className="text-xs font-semibold text-gray-700 tracking-wider">
                ĐỊA CHỈ EMAIL
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="sinhvien@neu.edu.vn"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003f87]/20 focus:border-[#003f87]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[#003f87] hover:bg-[#002b5e] text-white font-semibold rounded-xl text-sm transition-all shadow-md mt-2 disabled:opacity-50"
            >
              {loading ? 'Đang gửi mã…' : 'Gửi mã xác nhận'}
            </button>
          </form>
        ) : null}

        {step === 'reset' ? (
          <form onSubmit={resetPassword} className="flex flex-col gap-4">
            {debugOtp ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
                Mã OTP môi trường phát triển: <strong className="font-mono">{debugOtp}</strong>
              </p>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="forgot-otp" className="text-xs font-semibold text-gray-700 tracking-wider">
                MÃ XÁC NHẬN OTP
              </label>
              <input
                id="forgot-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Nhập mã 6 chữ số"
                minLength={6}
                maxLength={6}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003f87]/20 focus:border-[#003f87]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-password" className="text-xs font-semibold text-gray-700 tracking-wider">
                MẬT KHẨU MỚI
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                minLength={6}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003f87]/20 focus:border-[#003f87]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm-password" className="text-xs font-semibold text-gray-700 tracking-wider">
                XÁC NHẬN MẬT KHẨU
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                minLength={6}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003f87]/20 focus:border-[#003f87]"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={requestCode}
                disabled={loading}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Gửi lại mã
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 px-4 bg-[#003f87] hover:bg-[#002b5e] text-white font-semibold rounded-xl text-sm transition-all shadow-md disabled:opacity-50"
              >
                {loading ? 'Đang cập nhật…' : 'Đặt lại mật khẩu'}
              </button>
            </div>
          </form>
        ) : null}

        {step === 'done' ? (
          <div className="p-4 bg-green-50 text-green-800 rounded-xl border border-green-200 text-sm text-center" role="status">
            Mật khẩu đã được cập nhật thành công.
            <div className="mt-4">
              <Link to="/dang-nhap" className="font-semibold text-[#003f87] hover:underline">
                Quay lại đăng nhập
              </Link>
            </div>
          </div>
        ) : null}

        <div className="text-center text-sm text-gray-600">
          Nhớ mật khẩu?{' '}
          <Link to="/dang-nhap" className="font-semibold text-[#003f87] hover:underline">
            Đăng nhập
          </Link>
        </div>
      </section>
    </main>
  );
}
