import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone_number: '',
    student_id: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authService.register(formData);
      login(data.access_token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Đăng ký thất bại, vui lòng kiểm tra lại thông tin');
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
          <h1 className="text-2xl font-bold text-gray-900">Tạo tài khoản mới</h1>
          <p className="text-sm text-gray-500">Đăng ký để nhận nhiều ưu đãi và tích điểm tại NEU</p>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-700">HỌ VÀ TÊN</label>
            <input
              name="full_name"
              type="text"
              value={formData.full_name}
              onChange={handleChange}
              placeholder="Nguyễn Văn A"
              required
              className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003f87]/20 focus:border-[#003f87]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-700">ĐỊA CHỈ EMAIL</label>
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="sinhvien@neu.edu.vn"
              required
              className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003f87]/20 focus:border-[#003f87]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-700">SỐ ĐIỆN THOẠI</label>
              <input
                name="phone_number"
                type="tel"
                value={formData.phone_number}
                onChange={handleChange}
                placeholder="0912345678"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003f87]/20 focus:border-[#003f87]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-700">MÃ SINH VIÊN (MSV)</label>
              <input
                name="student_id"
                type="text"
                value={formData.student_id}
                onChange={handleChange}
                placeholder="11210001"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003f87]/20 focus:border-[#003f87]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-700">MẬT KHẨU</label>
            <input
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Tối thiểu 6 ký tự"
              required
              minLength={6}
              className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003f87]/20 focus:border-[#003f87]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-[#003f87] hover:bg-[#002b5e] text-white font-semibold rounded-xl text-sm transition-all shadow-md mt-2 disabled:opacity-50"
          >
            {loading ? 'Đang đăng ký...' : 'Đăng ký tài khoản'}
          </button>
        </form>

        <div className="flex flex-col gap-3 text-center text-sm text-gray-600">
          <div>
            Đã có tài khoản?{' '}
            <Link to="/dang-nhap" className="font-semibold text-[#003f87] hover:underline">
              Đăng nhập ngay
            </Link>
          </div>
          <div className="pt-2 border-t border-gray-100 flex justify-center text-xs text-gray-500">
            <a href="/DANGKY.html" className="hover:text-gray-800 underline">
              Giao diện đăng ký tĩnh
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
