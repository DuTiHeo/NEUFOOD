import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authService.login({ email, password });
      login(data.access_token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Đăng nhập không thành công, vui lòng kiểm tra lại');
    } finally {
      setLoading(false);
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
          <h1 className="text-2xl font-bold text-gray-900">Chào mừng trở lại!</h1>
          <p className="text-sm text-gray-500">Đăng nhập tài khoản đặt đồ ăn tại NEU</p>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200">
            {error}
          </div>
        )}

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

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700 tracking-wider">MẬT KHẨU</label>
              <Link to="/quen-mat-khau" className="text-xs font-medium text-[#003f87] hover:underline">
                Quên mật khẩu?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003f87]/20 focus:border-[#003f87]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-[#003f87] hover:bg-[#002b5e] text-white font-semibold rounded-xl text-sm transition-all shadow-md mt-2 disabled:opacity-50"
          >
            {loading ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
        </form>

        <div className="flex flex-col gap-3 text-center text-sm text-gray-600">
          <div>
            Chưa có tài khoản?{' '}
            <Link to="/dang-ky" className="font-semibold text-[#003f87] hover:underline">
              Đăng ký ngay
            </Link>
          </div>
          <div className="pt-3 border-t border-gray-100 flex justify-center gap-4 text-xs text-gray-500">
            <a href="/DANGNHAP.html" className="hover:text-gray-800 underline">
              Giao diện đăng nhập tĩnh
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
