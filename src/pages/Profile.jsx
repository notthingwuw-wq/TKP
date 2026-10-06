// src/pages/Profile.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Mail, School, Users, KeyRound, Shield,
  Bell, BellOff, Loader2, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  enableNotifications,
  disableNotifications,
  getNotificationStatus,
  isIOS,
  isPWAInstalled
} from '../lib/messaging';
import toast from 'react-hot-toast';

export default function Profile() {
  const { profile, user, logout, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [notifStatus, setNotifStatus] = useState('default');
  const [notifLoading, setNotifLoading] = useState(false);

  // ===== Check trạng thái quyền khi mount =====
  useEffect(() => {
    setNotifStatus(getNotificationStatus());
  }, []);

  // ===== Thông tin hiển thị =====
  const teamNumber = profile?.teamId?.match(/-team(\d+)/)?.[1] || '—';
  const roleLabel = {
    admin: 'Quản trị viên',
    GVCN: 'Giáo viên chủ nhiệm',
    student: 'Học sinh'
  }[profile?.role] || '—';

  const isNotifOn = profile?.notificationsEnabled && notifStatus === 'granted';

  // ===== Bật/tắt thông báo =====
  const handleToggleNotif = async () => {
    setNotifLoading(true);
    try {
      if (isNotifOn) {
        // Tắt
        await disableNotifications(profile.id);
        await refreshProfile();
        toast.success('Đã tắt thông báo đẩy');
      } else {
        // Bật
        if (isIOS() && !isPWAInstalled()) {
          toast.error('Trên iPhone cần cài app vào màn hình chính trước (xem banner trên trang chủ)');
          setNotifLoading(false);
          return;
        }
        await enableNotifications(profile.id);
        setNotifStatus('granted');
        await refreshProfile();
        toast.success('Đã bật thông báo đẩy!', { duration: 4000 });
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Không thực hiện được');
    } finally {
      setNotifLoading(false);
    }
  };

  // ===== Đăng xuất =====
  const handleLogout = async () => {
    if (!window.confirm('Đăng xuất khỏi hệ thống?')) return;
    await logout();
    toast.success('Đã đăng xuất');
    nav('/login');
  };

  return (
    <div className="space-y-4 max-w-md mx-auto">
      {/* ===== Avatar + Name ===== */}
      <div className="bg-gradient-to-br from-brand-500 to-brand-700 text-white rounded-2xl p-6 text-center shadow-lg">
        <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl font-bold mx-auto mb-3 border-2 border-white/30">
          {profile?.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="text-xl font-bold">{profile?.name || 'Người dùng'}</div>
        <div className="text-xs opacity-90 mt-1">{roleLabel}</div>
      </div>

      {/* ===== Thông tin ===== */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <InfoRow
          icon={<Mail className="w-4 h-4 text-gray-400" />}
          label="Email"
          value={profile?.email || '—'}
        />
        <InfoRow
          icon={<School className="w-4 h-4 text-gray-400" />}
          label="Lớp"
          value={profile?.classId || '—'}
        />
        {profile?.role === 'student' && (
          <InfoRow
            icon={<Users className="w-4 h-4 text-gray-400" />}
            label="Tổ"
            value={teamNumber !== '—' ? `Tổ ${teamNumber}` : '—'}
          />
        )}
        <InfoRow
          icon={<Shield className="w-4 h-4 text-gray-400" />}
          label="Vai trò"
          value={roleLabel}
        />
      </div>

      {/* ===== Trạng thái thông báo (khi đã bật) ===== */}
      {isNotifOn && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-green-900 text-sm">
              Thông báo đẩy đang bật
            </div>
            <div className="text-xs text-green-700 mt-0.5">
              Bạn sẽ nhận thông báo khi có việc cần làm
            </div>
          </div>
        </div>
      )}

      {/* ===== Actions ===== */}
      <div className="space-y-2">
        {/* Nút bật/tắt thông báo */}
        <button
          onClick={handleToggleNotif}
          disabled={notifLoading}
          className={`w-full font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
            isNotifOn
              ? 'bg-green-50 border border-green-200 text-green-700 hover:bg-green-100'
              : 'bg-white border border-gray-200 hover:border-brand-400 hover:bg-brand-50 text-gray-700'
          }`}
        >
          {notifLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Đang xử lý...
            </>
          ) : isNotifOn ? (
            <>
              <Bell className="w-4 h-4" />
              Thông báo đang bật (bấm để tắt)
            </>
          ) : (
            <>
              <BellOff className="w-4 h-4 text-brand-500" />
              Bật thông báo đẩy
            </>
          )}
        </button>

        {/* Nút đổi mật khẩu */}
        <button
          onClick={() => nav('/change-password')}
          className="w-full bg-white border border-gray-200 hover:border-brand-400 hover:bg-brand-50 text-gray-700 font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <KeyRound className="w-4 h-4 text-brand-500" />
          Đổi mật khẩu
        </button>

        {/* Nút đăng xuất */}
        <button
          onClick={handleLogout}
          className="w-full bg-white border border-red-200 text-red-600 font-semibold py-3 rounded-xl hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Đăng xuất
        </button>
      </div>

      {/* ===== Footer ===== */}
      <div className="text-center text-xs text-gray-400 pt-2">
        <p>Thi Đua Lớp v2.0</p>
        <p className="mt-1">THPT Trần Kỳ Phong © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}

// ===== Sub component =====
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