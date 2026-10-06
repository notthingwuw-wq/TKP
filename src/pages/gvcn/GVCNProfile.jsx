// src/pages/gvcn/GVCNProfile.jsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, Mail, School, KeyRound, UserCog } from 'lucide-react';
import toast from 'react-hot-toast';

export default function GVCNProfile() {
  const { profile, logout } = useAuth();
  const nav = useNavigate();

  const handleLogout = async () => {
    if (!window.confirm('Đăng xuất khỏi trang GVCN?')) return;
    await logout();
    toast.success('Đã đăng xuất');
    nav('/login');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tài khoản của tôi</h1>
        <p className="text-sm text-gray-500 mt-1">
          Quản lý thông tin và bảo mật tài khoản giáo viên
        </p>
      </div>

      {/* Avatar */}
      <div className="bg-gradient-to-br from-brand-500 to-brand-700 text-white rounded-2xl p-6 text-center shadow-lg">
        <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl font-bold mx-auto mb-3 border-2 border-white/30">
          {profile?.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="text-xl font-bold">{profile?.name || 'GVCN'}</div>
        <div className="text-xs opacity-90 mt-1">
          Giáo viên chủ nhiệm · Lớp {profile?.classId || '—'}
        </div>
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <InfoRow
          icon={<Mail className="w-4 h-4 text-gray-400" />}
          label="Email"
          value={profile?.email || '—'}
        />
        <InfoRow
          icon={<UserCog className="w-4 h-4 text-gray-400" />}
          label="Họ tên"
          value={profile?.name || '—'}
        />
        <InfoRow
          icon={<School className="w-4 h-4 text-gray-400" />}
          label="Lớp chủ nhiệm"
          value={profile?.classId || '—'}
        />
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={() => nav('/change-password')}
          className="w-full bg-white border border-gray-200 hover:border-brand-400 hover:bg-brand-50 text-gray-700 font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <KeyRound className="w-4 h-4 text-brand-500" />
          Đổi mật khẩu
        </button>

        <button
          onClick={handleLogout}
          className="w-full bg-white border border-red-200 text-red-600 font-semibold py-3 rounded-xl hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Đăng xuất
        </button>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm font-medium text-gray-900 truncate">{value}</div>
      </div>
    </div>
  );
}