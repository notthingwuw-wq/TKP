// src/components/InstallGuard.jsx
// Chặn truy cập nếu chưa cài PWA
import { useEffect, useState } from 'react';
import { isPWAInstalled } from '../lib/messaging';
import InstallScreen from './InstallScreen';

const BYPASS_KEY = 'pwaBypass';

export default function InstallGuard({ children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'ok' | 'need-install'

  useEffect(() => {
    // 1. Đang ở localhost → cho qua (để dev)
    const host = window.location.hostname;
    const isLocalhost =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host.endsWith('.local');

    if (isLocalhost) {
      setStatus('ok');
      return;
    }

    // 2. Bypass qua URL param ?bypass=1 (chỉ admin biết)
    const url = new URL(window.location.href);
    if (url.searchParams.get('bypass') === '1') {
      localStorage.setItem(BYPASS_KEY, 'true');
      setStatus('ok');
      return;
    }

    // 3. Đã bypass trước đó
    if (localStorage.getItem(BYPASS_KEY) === 'true') {
      setStatus('ok');
      return;
    }

    // 4. Kiểm tra PWA installed
    if (isPWAInstalled()) {
      setStatus('ok');
      return;
    }

    // 5. Chưa cài → chặn
    setStatus('need-install');
  }, []);

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-500">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
      </div>
    );
  }

  if (status === 'need-install') {
    return <InstallScreen />;
  }

  return children;
}