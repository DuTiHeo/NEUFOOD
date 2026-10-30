import React from 'react';
import { Link } from 'react-router-dom';
import { Utensils } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-[#003f87]/10 text-[#003f87] rounded-3xl flex items-center justify-center mb-6">
        <Utensils className="w-10 h-10" />
      </div>
      <h1 className="text-4xl font-extrabold text-gray-900 mb-2">404</h1>
      <h2 className="text-xl font-bold text-gray-800 mb-3">Không tìm thấy trang yêu cầu</h2>
      <p className="text-gray-500 max-w-md mb-8 text-sm">
        Địa chỉ bạn truy cập có thể đã bị di chuyển, xóa hoặc không tồn tại trong hệ thống NEUFood.
      </p>
      <Link
        to="/"
        className="px-6 py-3 bg-[#003f87] hover:bg-[#002b5e] text-white font-semibold rounded-xl text-sm transition-all shadow-md"
      >
        Về trang chủ
      </Link>
    </main>
  );
}
