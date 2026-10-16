import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSent(true);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[#f7f7fb]">
      <section className="w-full max-w-[480px] p-8 rounded-2xl bg-white shadow-xl flex flex-col gap-6">
        <div className="flex flex-col items-center text-center gap-2">
          <Link to="/" className="flex items-center gap-2 mb-2">
            <img src="/neu-food.png" alt="NEUFood" className="w-10 h-10 rounded-xl" />
            <span className="text-xl font-bold text-[#003f87]">NEUFood</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Quên mật khẩu?</h1>
          <p className="text-sm text-gray-500">
            Nhập email tài khoản NEU của bạn để nhận liên kết khôi phục.
          </p>
        </div>

        {sent ? (
          <div className="p-4 bg-green-50 text-green-800 rounded-xl border border-green-200 text-sm text-center">
            Đã gửi hướng dẫn khôi phục tới <strong>{email}</strong>. Vui lòng kiểm tra hộp thư của bạn.
            <div className="mt-4">
              <Link to="/dang-nhap" className="font-semibold text-[#003f87] hover:underline">
                Quay lại đăng nhập
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700 tracking-wider">ĐỊA CHỈ EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sinhvien@neu.edu.vn"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003f87]/20 focus:border-[#003f87]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 bg-[#003f87] hover:bg-[#002b5e] text-white font-semibold rounded-xl text-sm transition-all shadow-md mt-2"
            >
              Gửi yêu cầu khôi phục
            </button>
          </form>
        )}

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
