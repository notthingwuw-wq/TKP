// src/pages/gvcn/GVCNLayout.jsx
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard, AlertTriangle, MessageSquare, Trophy,
  ShieldAlert, History, LogOut, Home as HomeIcon, User
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useGVCNBadge } from '../../hooks/useGVCNBadge';
import toast from 'react-hot-toast';

export default function GVCNLayout() {
  const { profile, logout } = useAuth();
  const badge = useGVCNBadge();
  const nav = useNavigate();

  // NAV có thể tính badge động
  const NAV = [
    { to: '/gvcn',           label: 'Tổng quan',   Icon: LayoutDashboard, end: true },
    { to: '/gvcn/reports',   label: 'Tố cáo',      Icon: AlertTriangle, badge: badge.reports },
    { to: '/gvcn/appeals',   label: 'Kháng nghị',  Icon: MessageSquare, badge: badge.appeals },
    { to: '/gvcn/class',     label: 'Điểm lớp',    Icon: Trophy },
    { to: '/gvcn/warnings',  label: 'Cảnh báo',    Icon: ShieldAlert },
    { to: '/gvcn/audit',     label: 'Lịch sử',     Icon: History },
    { to: '/gvcn/profile',   label: 'Tài khoản',   Icon: User }
  ];

  const handleLogout = async () => {
    if (!window.confirm('Đăng xuất khỏi trang GVCN?')) return;
    await logout();
    toast.success('Đã đăng xuất');
    nav('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/icons/icon-192.png"
              alt="Logo"
              className="w-10 h-10 rounded-full border border-gray-200 object-cover"
            />
            <div>
              <div className="font-bold text-gray-900 text-sm leading-tight">
                Trang Giáo viên Chủ nhiệm
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {profile?.name} · Lớp {profile?.classId || '—'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-brand-600 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <HomeIcon className="w-3.5 h-3.5" />
              Về trang chính
            </Link>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="max-w-6xl mx-auto px-4 flex gap-1">
          {NAV.map(({ to, label, Icon, end, badge: badgeCount }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
              {badgeCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold bg-red-500 text-white rounded-full px-1">
                  {badgeCount > 9 ? '9+' : badgeCount}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}