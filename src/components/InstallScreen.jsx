// src/components/InstallScreen.jsx
// Màn hình bắt buộc cài đặt PWA
import { useEffect, useState } from 'react';
import {
  Download, Share, Smartphone, MoreVertical,
  CheckCircle2, Sparkles, Bell, Zap, Lock, Monitor
} from 'lucide-react';
import { isIOS, isInAppBrowser } from '../lib/messaging';

export default function InstallScreen() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInstalling(false);
    }
  };

  const isAndroid = /android/i.test(navigator.userAgent);
  const isDesktop = !isIOS() && !isAndroid;
  const inApp = isInAppBrowser();

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 flex flex-col">
      {/* Header */}
      <header className="pt-10 pb-5 px-4 text-center">
        <img
          src="/icons/icon-192.png"
          alt="Logo"
          className="w-20 h-20 rounded-3xl mx-auto shadow-2xl border-4 border-white/30"
        />
        <h1 className="text-xl font-bold text-white mt-3">THPT TRẦN KỲ PHONG</h1>
        <p className="text-xs text-white/80 mt-1 uppercase tracking-widest">
          Hệ thống thi đua lớp học
        </p>
      </header>

      {/* Card */}
      <main className="flex-1 flex items-start justify-center px-4 pb-8">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
          {/* Title */}
          <div className="text-center mb-5">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 mx-auto mb-3 flex items-center justify-center">
              <Lock className="w-6 h-6 text-amber-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              Cài đặt ứng dụng để tiếp tục
            </h2>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              Ứng dụng yêu cầu cài đặt vào màn hình chính trước khi sử dụng
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[
              { icon: Zap, label: 'Nhanh hơn' },
              { icon: Bell, label: 'Thông báo' },
              { icon: Sparkles, label: 'Toàn màn hình' }
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="text-center p-2 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center mx-auto mb-1">
                  <Icon className="w-4 h-4 text-brand-600" />
                </div>
                <div className="text-[10px] font-medium text-gray-700">{label}</div>
              </div>
            ))}
          </div>

          {/* In-app browser */}
          {inApp && <InAppInstructions />}

          {/* iOS */}
          {!inApp && isIOS() && <IOSInstructions />}

          {/* Android/Desktop with install event */}
          {!inApp && !isIOS() && deferredPrompt && (
            <button
              onClick={handleInstall}
              disabled={installing}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {installing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Đang cài đặt...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Cài đặt ngay
                </>
              )}
            </button>
          )}

          {/* Android/Desktop without event */}
          {!inApp && !isIOS() && !deferredPrompt && (
            <ManualInstructions isAndroid={isAndroid} isDesktop={isDesktop} />
          )}

          {/* Success message */}
          {installed && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              <p className="text-xs text-green-900 font-medium">
                Cài đặt thành công! Đang mở app...
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-5 pt-4 border-t border-gray-100 text-center">
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Sau khi cài đặt, mở app từ <strong>màn hình chính</strong> để đăng nhập
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

// ============ SUB-COMPONENTS ============

function IOSInstructions() {
  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2 text-xs text-blue-900">
        <Smartphone className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Cần dùng <strong>Safari</strong> để cài. Chỉ 2 bước!
        </span>
      </div>

      <ol className="space-y-3">
        <li className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
            1
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">
              Bấm nút <strong>Chia sẻ</strong> ở thanh dưới Safari
            </div>
            <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-2 relative">
              <div className="flex items-center justify-around">
                <div className="w-6 h-6 rounded bg-gray-100"></div>
                <div className="w-6 h-6 rounded bg-gray-100"></div>
                <div className="relative">
                  <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow-lg">
                    <Share className="w-4 h-4 text-white" />
                  </div>
                  <div className="absolute -inset-1 border-2 border-brand-500 rounded-lg animate-ping"></div>
                </div>
                <div className="w-6 h-6 rounded bg-gray-100"></div>
              </div>
            </div>
          </div>
        </li>

        <li className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
            2
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">
              Chọn <strong>"Thêm vào màn hình chính"</strong>
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded bg-gray-50 text-gray-500">
                <span>📋</span> Sao chép
              </div>
              <div className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded bg-brand-500 text-white font-semibold animate-pulse">
                <span>➕</span> Thêm vào màn hình chính
              </div>
              <div className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded bg-gray-50 text-gray-500">
                <span>🔖</span> Thêm vào dấu trang
              </div>
            </div>
          </div>
        </li>
      </ol>
    </div>
  );
}

function InAppInstructions() {
  return (
    <div className="space-y-3">
      <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 text-xs text-red-900">
        <MoreVertical className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Đang mở trong <strong>Facebook / Zalo / Messenger</strong> — không cài được từ đây
        </span>
      </div>

      <ol className="space-y-2.5">
        {[
          'Bấm nút "..." ở góc trên phải màn hình',
          'Chọn "Mở bằng Safari" (iOS) hoặc "Mở bằng Chrome" (Android)',
          'Quay lại và cài đặt như bình thường'
        ].map((text, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
              {i + 1}
            </div>
            <p className="text-xs text-gray-700 pt-0.5">{text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ManualInstructions({ isAndroid, isDesktop }) {
  return (
    <div className="space-y-3">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-900">
        <Monitor className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Nút cài đặt không hiện — hãy thao tác thủ công
        </span>
      </div>

      <ol className="space-y-2.5">
        <li className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
            1
          </div>
          <p className="text-xs text-gray-700 pt-0.5">
            Bấm menu <MoreVertical className="w-3.5 h-3.5 inline" /> ở góc trên phải browser
          </p>
        </li>
        <li className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
            2
          </div>
          <p className="text-xs text-gray-700 pt-0.5">
            Chọn <strong>"Cài đặt ứng dụng"</strong> hoặc <strong>"Thêm vào màn hình chính"</strong>
          </p>
        </li>
        <li className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
            3
          </div>
          <p className="text-xs text-gray-700 pt-0.5">
            Bấm <strong>Cài đặt / Thêm</strong> để hoàn tất
          </p>
        </li>
      </ol>
    </div>
  );
}