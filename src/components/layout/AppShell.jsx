// src/components/layout/AppShell.jsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, ClipboardList, AlertTriangle, Trophy, User, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useReportsBadge } from '../../hooks/useReportsBadge';
import toast from 'react-hot-toast';

const TABS = [
  { to: '/',            label: 'Trang chủ', Icon: Home,          end: true },
  { to: '/requests',    label: 'Yêu cầu',   Icon: ClipboardList },
  { to: '/reports',     label: 'Tố cáo',    Icon: AlertTriangle },
  { to: '/score',       label: 'Điểm',      Icon: Trophy },
  { to: '/profile',     label: 'Tôi',       Icon: User }
];

export default function AppShell() {
  const { profile, logout } = useAuth();
  const reportsBadge = useReportsBadge();
  const nav = useNavigate();

  const teamNumber = profile?.teamId?.match(/-team(\d+)/)?.[1] || '?';

  const handleLogout = async () => {
    if (!window.confirm('Đăng xuất khỏi hệ thống?')) return;
    try {
      await logout();
      toast.success('Đã đăng xuất');
      nav('/login');
    } catch (err) {
      toast.error('Lỗi đăng xuất');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/icons/icon-192.png"
              alt="Logo trường"
              className="w-10 h-10 rounded-full object-cover border border-gray-200"
            />
            <div>
              <div className="font-semibold text-sm text-gray-900 leading-tight">
                {profile?.name || 'Học sinh'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Lớp {profile?.classId || '?'} · Tổ {teamNumber}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto px-4 py-5">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-2xl mx-auto flex justify-around">
          {TABS.map(({ to, label, Icon, end }) => {
            const showBadge = to === '/reports' && reportsBadge > 0;
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `relative flex-1 flex flex-col items-center justify-center py-2.5 transition-colors ${
                    isActive ? 'text-brand-500' : 'text-gray-500 hover:text-gray-700'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative">
                      <Icon
                        className="w-5 h-5 mb-0.5"
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                      {showBadge && (
                        <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] rounded-full min-w-[16px] h-4 flex items-center justify-center font-bold px-1">
                          {reportsBadge > 9 ? '9+' : reportsBadge}
                        </span>
                      )}
                    </div>
                    <span className={`text-[11px] ${isActive ? 'font-semibold' : 'font-normal'}`}>
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}