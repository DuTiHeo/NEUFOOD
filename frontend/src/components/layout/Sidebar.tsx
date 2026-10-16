import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, UtensilsCrossed, ShoppingCart, User, Clock, MapPin, X } from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const navItems = [
    { label: 'Trang chủ', path: '/', icon: Home },
    { label: 'Thực đơn', path: '/menu', icon: UtensilsCrossed },
    { label: 'Gần NEU', path: '/gan-neu', icon: MapPin },
    { label: 'Giỏ hàng', path: '/gio-hang', icon: ShoppingCart },
    { label: 'Lịch sử đơn', path: '/lich-su-don', icon: Clock },
    { label: 'Tài khoản', path: '/tai-khoan', icon: User },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-64 max-w-[80vw] bg-white h-full shadow-2xl flex flex-col p-6 animate-slideIn">
        <div className="flex items-center justify-between pb-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <img src="/neu-food.png" alt="NEUFood" className="w-8 h-8 rounded-lg" />
            <span className="font-bold text-lg text-[#003f87]">NEUFood</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 py-6 flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#003f87]/10 text-[#003f87] font-semibold'
                    : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
};
export default Sidebar;
