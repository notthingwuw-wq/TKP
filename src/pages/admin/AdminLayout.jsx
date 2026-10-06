// src/pages/admin/AdminLayout.jsx
// Layout Admin Panel — navy professional, có tab navigation
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard, Upload, ListChecks, Users, School,
  LogOut, Home as HomeIcon, UserCog, User, Zap
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const NAV = [
  { to: '/admin',             label: 'Dashboard',       Icon: LayoutDashboard, end: true },
  { to: '/admin/import',      label: 'Import học sinh', Icon: Upload },
  { to: '/admin/import-gvcn', label: 'Import GVCN',     Icon: UserCog },
  { to: '/admin/activities',  label: 'Hoạt động',       Icon: Zap },
  { to: '/admin/queue',       label: 'Lịch sử import',  Icon: ListChecks },
  { to: '/admin/users',       label: 'Quản lý users',   Icon: Users },
  { to: '/admin/classes',     label: 'Quản lý lớp',     Icon: School },
  { to: '/admin/profile',     label: 'Tài khoản',       Icon: User }
];

export default function AdminLayout() {
  const { profile, logout } = useAuth();
  const nav = useNavigate();

  const handleLogout = async () => {
    if (!window.confirm('Đăng xuất khỏi Admin Panel?')) return;
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
                Admin Panel
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {profile?.name || 'Admin'} · THPT Trần Kỳ Phong
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

      {/* Tabs navigation */}
      <nav className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="max-w-6xl mx-auto px-4 flex gap-1">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
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