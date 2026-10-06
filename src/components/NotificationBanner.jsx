// src/components/NotificationBanner.jsx
import { useEffect, useState } from 'react';
import {
  Bell, X, Smartphone, Share, AlertCircle, Loader2, Wifi
} from 'lucide-react';
import {
  enableNotifications, getNotificationStatus, isIOS, isPWAInstalled,
  getUnsupportedReason, isSecureContext, isInAppBrowser
} from '../lib/messaging';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const DISMISS_KEY = 'notifBannerDismissed';
const ENABLED_KEY = 'notifBannerEnabled';
const DISMISS_DAYS = 7;

export default function NotificationBanner() {
  const { profile, refreshProfile } = useAuth();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideMode, setGuideMode] = useState(null);

  useEffect(() => {
    if (!profile?.id) return;

    // 🚫 Đã bật rồi → không hiện nữa
    if (localStorage.getItem(ENABLED_KEY) === 'true') return;

    // 🚫 Đã dismiss → không hiện
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - parseInt(dismissed) < DISMISS_DAYS * 86400000) return;

    // 🚫 Permission denied → không hiện
    if (getNotificationStatus() === 'denied') return;

    // 🚫 Đã có trong DB → không hiện
    if (profile.notificationsEnabled && getNotificationStatus() === 'granted') {
      localStorage.setItem(ENABLED_KEY, 'true');
      return;
    }

    const timer = setTimeout(() => setShow(true), 4000);
    return () => clearTimeout(timer);
  }, [profile?.id, profile?.notificationsEnabled]);

  const handleEnable = async () => {
    const reason = getUnsupportedReason();

    if (reason) {
      if (!isSecureContext()) setGuideMode('https');
      else if (isInAppBrowser()) setGuideMode('inapp');
      else if (isIOS()) setGuideMode('ios');
      else {
        toast.error(reason, { duration: 6000, id: 'notif-unsupported' });
        return;
      }
      setShowGuide(true);
      return;
    }

    setLoading(true);
    try {
      await enableNotifications(profile.id);
      await refreshProfile();
      // ⚡ Đánh dấu đã bật → KHÔNG hiện lại
      localStorage.setItem(ENABLED_KEY, 'true');
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
      toast.success('Đã bật thông báo đẩy!', { duration: 4000 });
      setShow(false);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Không bật được thông báo', {
        duration: 5000,
        id: 'notif-error'
      });
      // Nếu fail không phải iOS guide → cũng dismiss
      if (!err.message?.includes('iOS')) {
        localStorage.setItem(DISMISS_KEY, Date.now().toString());
        setShow(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  };

  if (!show) return null;

  return (
    <>
      <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto bg-white border border-brand-200 rounded-2xl shadow-2xl p-4 z-40 animate-slide-up">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 p-1"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 mb-3 pr-6">
          <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0 relative">
            <Bell className="w-5 h-5 text-brand-600" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-sm">Bật thông báo đẩy</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Nhận thông báo khi có yêu cầu, tố cáo hoặc điểm mới
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleDismiss}
            disabled={loading}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm py-2.5 rounded-lg disabled:opacity-50"
          >
            Để sau
          </button>
          <button
            onClick={handleEnable}
            disabled={loading}
            className="flex-1 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Đang bật...</>
            ) : (
              <><Bell className="w-4 h-4" /> Bật ngay</>
            )}
          </button>
        </div>
      </div>

      {showGuide && guideMode === 'ios' && <IOSGuideModal onClose={() => setShowGuide(false)} />}
      {showGuide && guideMode === 'https' && <HTTPSGuideModal onClose={() => setShowGuide(false)} />}
      {showGuide && guideMode === 'inapp' && <InAppGuideModal onClose={() => setShowGuide(false)} />}

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>
    </>
  );
}

// ===== Guide modals =====
function IOSGuideModal({ onClose }) {
  return (
    <GuideWrapper onClose={onClose} title="Cài app trên iPhone/iPad">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2 text-xs text-blue-900">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>Bắt buộc dùng <strong>Safari</strong>, cài app vào màn hình chính, rồi mở lại từ icon</span>
      </div>
      <ol className="space-y-3">
        {[
          'Mở trang này bằng Safari',
          'Nhấn nút "Chia sẻ" (ô vuông có mũi tên) ở thanh dưới',
          'Chọn "Thêm vào màn hình chính"',
          'Nhấn "Thêm" ở góc trên phải',
          'Mở app từ màn hình chính → Bật thông báo'
        ].map((text, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{i + 1}</div>
            <p className="text-sm text-gray-700 pt-0.5">{text}</p>
          </li>
        ))}
      </ol>
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-3">
        <Share className="w-6 h-6 text-blue-500 flex-shrink-0" />
        <div className="text-xs text-gray-600">Nút chia sẻ có hình ô vuông với mũi tên hướng lên, ở giữa thanh Safari</div>
      </div>
    </GuideWrapper>
  );
}

function HTTPSGuideModal({ onClose }) {
  return (
    <GuideWrapper onClose={onClose} title="Cần truy cập qua HTTPS">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Wifi className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <div className="font-semibold mb-1">Bạn đang truy cập qua HTTP</div>
          <div className="text-xs leading-relaxed">Push notification chỉ hoạt động qua HTTPS.</div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="text-sm text-gray-700"><strong>Cách khắc phục:</strong></div>
        <ol className="space-y-3">
          {[
            'Deploy lên Firebase Hosting (miễn phí, có HTTPS)',
            'Hoặc dùng Cloudflare Tunnel',
            'Hoặc dùng ngrok: ngrok http 5173'
          ].map((text, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{i + 1}</div>
              <p className="text-sm text-gray-700 pt-0.5">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </GuideWrapper>
  );
}

function InAppGuideModal({ onClose }) {
  return (
    <GuideWrapper onClose={onClose} title="Mở bằng trình duyệt chính">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-red-900">
          <div className="font-semibold mb-1">Đang mở trong app khác</div>
          <div className="text-xs leading-relaxed">Facebook / Zalo / Messenger không hỗ trợ push.</div>
        </div>
      </div>
      <ol className="space-y-3">
        {[
          'Trên iPhone: "..." → "Mở bằng Safari"',
          'Trên Android: "..." → "Mở bằng Chrome"',
          'Hoặc copy link, dán vào Chrome/Safari',
          'Sau đó bấm "Bật ngay" lại'
        ].map((text, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{i + 1}</div>
            <p className="text-sm text-gray-700 pt-0.5">{text}</p>
          </li>
        ))}
      </ol>
    </GuideWrapper>
  );
}

function GuideWrapper({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
        <button
          onClick={onClose}
          className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3 rounded-lg"
        >
          Đã hiểu
        </button>
      </div>
    </div>
  );
}