// src/pages/ChangePassword.jsx
// Trang đổi mật khẩu — dùng cho student, GVCN, admin (đổi mk của chính mình)
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { changeOwnPassword } from '../lib/passwordUtils';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function ChangePassword() {
  const nav = useNavigate();
  const { profile } = useAuth();
  const [current, setCurrent] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Validate
  const errors = {};
  if (newPwd && newPwd.length < 6) errors.newPwd = 'Tối thiểu 6 ký tự';
  if (confirmPwd && newPwd !== confirmPwd) errors.confirmPwd = 'Mật khẩu xác nhận không khớp';
  if (newPwd && current && newPwd === current) errors.newPwd = 'Mật khẩu mới phải khác mật khẩu cũ';

  const passwordStrength = () => {
    if (!newPwd) return null;
    let score = 0;
    if (newPwd.length >= 6) score++;
    if (newPwd.length >= 10) score++;
    if (/[A-Z]/.test(newPwd)) score++;
    if (/[0-9]/.test(newPwd)) score++;
    if (/[^A-Za-z0-9]/.test(newPwd)) score++;

    if (score <= 2) return { label: 'Yếu', color: 'text-red-600', bg: 'bg-red-500', width: '33%' };
    if (score <= 3) return { label: 'Trung bình', color: 'text-amber-600', bg: 'bg-amber-500', width: '66%' };
    return { label: 'Mạnh', color: 'text-green-600', bg: 'bg-green-500', width: '100%' };
  };

  const strength = passwordStrength();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Object.keys(errors).length > 0) return;
    if (!current || !newPwd || !confirmPwd) {
      toast.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    setSubmitting(true);
    try {
      await changeOwnPassword(current, newPwd);
      toast.success('Đổi mật khẩu thành công!', { duration: 4000 });
      // Xóa form
      setCurrent('');
      setNewPwd('');
      setConfirmPwd('');
      // Chờ 1.5s rồi quay về
      setTimeout(() => nav(-1), 1500);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Đổi mật khẩu thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => nav(-1)}
          className="text-gray-500 hover:text-gray-700 p-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Đổi mật khẩu</h1>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 leading-relaxed">
          <div className="font-semibold mb-1">Bảo mật tài khoản</div>
          <div>
            Mật khẩu cần tối thiểu <strong>6 ký tự</strong>.
            Nên kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt để bảo vệ tài khoản.
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        {/* Email (readonly) */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Email
          </label>
          <input
            type="text"
            value={profile?.email || ''}
            disabled
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-500 cursor-not-allowed"
          />
        </div>

        {/* Mật khẩu hiện tại */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Mật khẩu hiện tại *
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type={showCurrent ? 'text' : 'password'}
              value={current}
              onChange={e => setCurrent(e.target.value)}
              placeholder="Nhập mật khẩu đang dùng"
              autoComplete="current-password"
              autoFocus
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mật khẩu mới */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Mật khẩu mới *
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type={showNew ? 'text' : 'password'}
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              autoComplete="new-password"
              className={`w-full pl-10 pr-10 py-2.5 border rounded-lg focus:outline-none focus:ring-2 text-sm ${
                errors.newPwd
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-brand-500 focus:border-brand-500'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowNew(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.newPwd && (
            <p className="text-xs text-red-600 mt-1">{errors.newPwd}</p>
          )}

          {/* Password strength bar */}
          {strength && !errors.newPwd && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-500">Độ mạnh mật khẩu</span>
                <span className={`font-medium ${strength.color}`}>{strength.label}</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${strength.bg} transition-all duration-300`}
                  style={{ width: strength.width }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Xác nhận mật khẩu */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Xác nhận mật khẩu mới *
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="password"
              value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              autoComplete="new-password"
              className={`w-full pl-10 pr-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 text-sm ${
                errors.confirmPwd
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-brand-500 focus:border-brand-500'
              }`}
            />
          </div>
          {errors.confirmPwd && (
            <p className="text-xs text-red-600 mt-1">{errors.confirmPwd}</p>
          )}
          {confirmPwd && !errors.confirmPwd && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Mật khẩu khớp
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="pt-2 flex gap-3">
          <button
            type="button"
            onClick={() => nav(-1)}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting || Object.keys(errors).length > 0 || !current || !newPwd || !confirmPwd}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Đang đổi...' : 'Đổi mật khẩu'}
          </button>
        </div>
      </form>

      {/* Help */}
      <div className="text-center text-xs text-gray-400">
        Quên mật khẩu? Liên hệ quản trị viên để được cấp lại.
      </div>
    </div>
  );
}