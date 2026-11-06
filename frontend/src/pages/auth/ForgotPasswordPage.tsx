import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  RotateCw,
  AlertCircle,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
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
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [step, setStep] = useState<ResetStep>('request');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Bộ đếm thời gian 60s cho phép gửi lại mã
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const requestCode = async (event?: React.SyntheticEvent) => {
    event?.preventDefault();
    if (!email.trim()) {
      setError('Vui lòng nhập địa chỉ email.');
      return;
    }
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      await authService.requestPasswordReset(email.trim());
      setStep('reset');
      setCountdown(60);
      setSuccessMsg(`Mã xác thực đã được gửi tới ${email.trim()}`);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Không gửi được mã xác nhận. Vui lòng kiểm tra lại email.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0 || loading) return;
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      await authService.requestPasswordReset(email.trim());
      setCountdown(60);
      setSuccessMsg('Đã gửi lại mã xác nhận mới vào email của bạn.');
    } catch (err: any) {
      setError(getErrorMessage(err, 'Không thể gửi lại mã OTP lúc này. Vui lòng thử lại sau.'));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMsg('');

    if (otp.trim().length !== 6) {
      setError('Mã xác nhận OTP phải gồm đúng 6 chữ số.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không trùng khớp.');
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
      setError(getErrorMessage(err, 'Không thể đặt lại mật khẩu. Vui lòng kiểm tra lại mã OTP.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 pt-24 pb-12 bg-gradient-to-b from-[#f0f4fa] to-[#f8fafc]">
      <div className="w-full max-w-[460px] bg-white rounded-3xl shadow-xl shadow-blue-900/5 border border-slate-100 p-8 md:p-9 flex flex-col gap-6 transition-all">
        {/* Logo & Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <Link to="/" className="inline-flex items-center gap-2.5 group mb-1">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 p-1.5 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <img src="/neu-food.png" alt="NEUFood Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-2xl font-extrabold text-[#003f87] tracking-tight">NEUFood</span>
          </Link>

          {step === 'request' && (
            <>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Quên mật khẩu?</h1>
              <p className="text-sm text-slate-500 leading-relaxed max-w-sm">
                Nhập email tài khoản của bạn để nhận mã xác thực OTP khôi phục mật khẩu.
              </p>
            </>
          )}

          {step === 'reset' && (
            <>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Xác thực tài khoản</h1>
              <p className="text-sm text-slate-500 leading-relaxed">
                Nhập mã xác thực 6 số gửi tới email và tạo mật khẩu mới.
              </p>
            </>
          )}

          {step === 'done' && (
            <>
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center my-2 shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Thành công!</h1>
              <p className="text-sm text-slate-500 leading-relaxed">
                Mật khẩu tài khoản của bạn đã được cập nhật an toàn.
              </p>
            </>
          )}
        </div>

        {/* Thông báo Lỗi */}
        {error && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs leading-relaxed animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Thông báo Thành công nhẹ */}
        {successMsg && !error && step === 'reset' && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs leading-relaxed animate-in fade-in duration-200">
            <Mail className="w-4 h-4 shrink-0 mt-0.5 text-[#003f87]" />
            <div className="flex-1">
              {successMsg}. Vui lòng kiểm tra cả mục <strong>Hộp thư đến</strong> và <strong>Thư rác (Spam)</strong>.
            </div>
          </div>
        )}

        {/* BƯỚC 1: YÊU CẦU MÃ */}
        {step === 'request' && (
          <form onSubmit={requestCode} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="forgot-email" className="text-xs font-semibold text-slate-700">
                Địa chỉ Email tài khoản
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="sinhvien@neu.edu.vn"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003f87]/15 focus:border-[#003f87] transition-all bg-slate-50/50 focus:bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-[#003f87] hover:bg-[#002e63] active:bg-[#00224a] text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-blue-900/10 hover:shadow-lg hover:shadow-blue-900/20 disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
            >
              {loading ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Đang gửi mã…</span>
                </>
              ) : (
                <span>Gửi mã xác nhận</span>
              )}
            </button>
          </form>
        )}

        {/* BƯỚC 2: NHẬP OTP & ĐẶT MẬT KHẨU MỚI */}
        {step === 'reset' && (
          <form onSubmit={resetPassword} className="flex flex-col gap-4">
            {/* Thẻ hiển thị email đã gửi */}
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
              <div className="flex items-center gap-2 text-slate-600 truncate">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">Gửi tới: <strong className="text-slate-800">{email}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep('request');
                  setError('');
                  setSuccessMsg('');
                }}
                className="text-[#003f87] hover:underline font-semibold text-[11px] shrink-0 ml-2"
              >
                Đổi email
              </button>
            </div>

            {/* Ô nhập mã OTP */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="forgot-otp" className="text-xs font-semibold text-slate-700">
                  Mã xác thực OTP (6 chữ số)
                </label>
                <span className="text-[11px] text-amber-600 font-medium">Hiệu lực 5 phút</span>
              </div>
              <div className="relative">
                <input
                  id="forgot-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                    if (error) setError('');
                  }}
                  placeholder="• • • • • •"
                  maxLength={6}
                  required
                  className="w-full py-3.5 px-4 rounded-xl border border-slate-200 text-center font-mono text-xl tracking-[0.4em] font-bold text-[#003f87] placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#003f87]/15 focus:border-[#003f87] transition-all bg-slate-50/50 focus:bg-white"
                />
              </div>
            </div>

            {/* Mật khẩu mới */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-password" className="text-xs font-semibold text-slate-700">
                Mật khẩu mới
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Tối thiểu 6 ký tự"
                  minLength={6}
                  required
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003f87]/15 focus:border-[#003f87] transition-all bg-slate-50/50 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Xác nhận mật khẩu mới */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm-password" className="text-xs font-semibold text-slate-700">
                Xác nhận lại mật khẩu
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Nhập lại mật khẩu mới"
                  minLength={6}
                  required
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003f87]/15 focus:border-[#003f87] transition-all bg-slate-50/50 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Nút Đặt lại mật khẩu */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-[#003f87] hover:bg-[#002e63] active:bg-[#00224a] text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-blue-900/10 hover:shadow-lg hover:shadow-blue-900/20 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Đang cập nhật mật khẩu…</span>
                </>
              ) : (
                <span>Đặt lại mật khẩu</span>
              )}
            </button>

            {/* Gửi lại mã với Bộ đếm ngược */}
            <div className="text-center pt-1">
              {countdown > 0 ? (
                <span className="text-xs text-slate-400 font-medium">
                  Chưa nhận được email? Gửi lại sau <strong className="text-slate-600 font-mono">{countdown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 text-xs text-[#003f87] hover:underline font-semibold disabled:opacity-50"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Gửi lại mã OTP mới</span>
                </button>
              )}
            </div>
          </form>
        )}

        {/* BƯỚC 3: HOÀN TẤT */}
        {step === 'done' && (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-800 leading-relaxed text-center">
              Mật khẩu mới đã có hiệu lực ngay lập tức. Toàn bộ phiên đăng nhập cũ trên các thiết bị khác đã được thu hồi để bảo vệ tài khoản của bạn.
            </div>
            <a
              href="/DANGNHAP.html"
              className="w-full py-3.5 px-4 bg-[#003f87] hover:bg-[#002e63] text-white font-semibold rounded-xl text-sm transition-all shadow-md text-center block"
            >
              Đăng nhập ngay
            </a>
          </div>
        )}

        {/* Footer Link */}
        <div className="pt-2 border-t border-slate-100 text-center">
          <a
            href="/DANGNHAP.html"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#003f87] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại trang Đăng nhập</span>
          </a>
        </div>
      </div>
    </main>
  );
}
