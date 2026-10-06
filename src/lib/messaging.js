// src/lib/messaging.js
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { app, db } from './firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
let _messaging = null;

// ===== Detect iOS =====
export function isIOS() {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// ===== Detect iOS version =====
export function getIOSVersion() {
  if (!isIOS()) return null;
  const m = navigator.userAgent.match(/OS (\d+)_(\d+)/);
  if (!m) return null;
  return { major: parseInt(m[1]), minor: parseInt(m[2]) };
}

// ===== Detect đã cài PWA chưa =====
export function isPWAInstalled() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

// ===== Detect in-app browser (Facebook, Zalo, Instagram, ...) =====
export function isInAppBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|FB_IAB|Zalo|Instagram|Line\/|Twitter|MicroMessenger|WebView|wv\)/i.test(ua);
}

// ===== Detect HTTPS / secure context =====
export function isSecureContext() {
  if (typeof window === 'undefined') return false;
  // localhost cũng được coi là secure
  return (
    window.isSecureContext ||
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
}

// ===== Lấy lý do tại sao không hỗ trợ =====
export function getUnsupportedReason() {
  if (typeof window === 'undefined') return 'Không phải môi trường browser';

  // 1. Không có Notification API
  if (!('Notification' in window)) {
    return 'Trình duyệt không hỗ trợ Notification API';
  }

  // 2. Không có Service Worker
  if (!('serviceWorker' in navigator)) {
    return 'Trình duyệt không hỗ trợ Service Worker';
  }

  // 3. Không phải HTTPS
  if (!isSecureContext()) {
    return 'Cần HTTPS — vui lòng truy cập qua https:// (hoặc localhost)';
  }

  // 4. In-app browser
  if (isInAppBrowser()) {
    return 'Đang mở trong ứng dụng khác (Facebook/Zalo/...). Vui lòng mở bằng Chrome hoặc Safari';
  }

  // 5. iOS < 16.4
  if (isIOS()) {
    const ver = getIOSVersion();
    if (ver && (ver.major < 16 || (ver.major === 16 && ver.minor < 4))) {
      return `iOS ${ver.major}.${ver.minor} chưa hỗ trợ Web Push. Cần iOS 16.4 trở lên`;
    }
    if (!isPWAInstalled()) {
      return 'Trên iPhone cần cài app vào màn hình chính trước';
    }
  }

  return null;  // OK, hỗ trợ
}

// ===== Check support (async vì có isSupported) =====
export async function isMessagingSupported() {
  if (typeof window === 'undefined') return false;
  if (getUnsupportedReason()) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

// ===== Trạng thái quyền =====
export function getNotificationStatus() {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;   // 'granted' | 'denied' | 'default'
}

// ===== Init messaging instance =====
async function getMsgInstance() {
  if (_messaging) return _messaging;
  if (!(await isMessagingSupported())) return null;
  try {
    _messaging = getMessaging(app);
    return _messaging;
  } catch (err) {
    console.warn('Cannot init messaging:', err);
    return null;
  }
}

// ===== Đăng ký SW =====
async function registerSW() {
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });
    return reg;
  } catch (err) {
    console.error('[SW] Register failed:', err);
    return null;
  }
}

// ===== Bật thông báo =====
export async function enableNotifications(userId) {
  // Check lý do cụ thể trước
  const reason = getUnsupportedReason();
  if (reason) throw new Error(reason);

  if (!VAPID_KEY) {
    throw new Error('Thiếu VAPID key — kiểm tra .env.local');
  }

  // Xin quyền
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Bạn chưa cho phép nhận thông báo');
  }

  // Đăng ký SW
  await registerSW();
  const swReg = await navigator.serviceWorker.ready;

  // Lấy token
  const messaging = await getMsgInstance();
  if (!messaging) throw new Error('Không khởi tạo được FCM');

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: swReg
  });

  if (!token) throw new Error('Không lấy được FCM token');

  // Lưu vào Firestore
  await updateDoc(doc(db, 'users', userId), {
    fcmToken: token,
    notificationsEnabled: true,
    fcmUpdatedAt: serverTimestamp()
  });

  return token;
}

// ===== Tắt thông báo =====
export async function disableNotifications(userId) {
  await updateDoc(doc(db, 'users', userId), {
    fcmToken: null,
    notificationsEnabled: false,
    fcmUpdatedAt: serverTimestamp()
  });
}

// ===== Foreground listener =====
export async function listenForeground(onReceive) {
  const messaging = await getMsgInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, onReceive);
}