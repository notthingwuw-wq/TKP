// src/pages/Login.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const { login, profile, loading, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // ⚡ Tự động navigate khi profile sẵn sàng (fix lag)
  useEffect(() => {
    if (loading) return;
    if (!user) return;         // chưa login
    if (!profile) return;      // đang load profile

    const target =
      profile.role === 'admin' ? '/admin' :
      profile.role === 'GVCN' ? '/gvcn' :
      '/';

    nav(target, { replace: true });
  }, [profile, loading, user, nav]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      await login(email.trim(), password);
      toast.success('Đăng nhập thành công');
      // KHÔNG nav ở đây — để useEffect xử lý khi profile sẵn sàng
    } catch (err) {
      console.error(err);
      let msg = 'Đăng nhập thất bại';
      if (err.code === 'auth/user-not-found') msg = 'Tài khoản không tồn tại';
      else if (err.code === 'auth/wrong-password') msg = 'Mật khẩu không đúng';
      else if (err.code === 'auth/invalid-credential') msg = 'Email hoặc mật khẩu không đúng';
      else if (err.code === 'auth/too-many-requests') msg = 'Quá nhiều lần thử. Vui lòng đợi vài phút';
      else if (err.code === 'auth/invalid-email') msg = 'Email không hợp lệ';
      setError(msg);
      toast.error(msg);
      setBusy(false);   // chỉ tắt busy khi lỗi — khi thành công để useEffect chuyển trang
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-50 flex flex-col">
      <header className="pt-10 pb-6 px-4 text-center">
        <div className="inline-flex items-center justify-center mb-4">
          <img
            src="/icons/icon-192.png"
            alt="Logo THPT Trần Kỳ Phong"
            className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
          />
        </div>
        <h1 className="text-2xl font-bold text-brand-700 tracking-tight">
          THPT TRẦN KỲ PHONG
        </h1>
        <div className="text-xs font-medium text-gray-500 tracking-widest uppercase mt-1">
          Hệ thống thi đua lớp học
        </div>
        <div className="flex items-center justify-center gap-2 mt-4">
          <div className="h-px w-12 bg-brand-200"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-brand-400"></div>
          <div className="h-px w-12 bg-brand-200"></div>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 pb-8">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-900">Đăng nhập</h2>
              <p className="text-xs text-gray-500 mt-1">
                Sử dụng tài khoản được nhà trường cấp
              </p>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-red-700 font-medium">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="hs01@truong.edu.vn"
                    required
                    autoComplete="email"
                    autoFocus
                    className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
              >
                {busy ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Đang đăng nhập...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Đăng nhập
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center leading-relaxed">
                Tài khoản do nhà trường cấp.
                <br />
                Liên hệ GVCN nếu quên mật khẩu.
              </p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">
              © {new Date().getFullYear()} THPT Trần Kỳ Phong
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              Hệ thống Thi Đua Lớp v2.0
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}