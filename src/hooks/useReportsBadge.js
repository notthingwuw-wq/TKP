// src/hooks/useReportsBadge.js
// Đếm số "việc cần làm" cho badge tab Tố cáo
// - Report pending cần user vote
// - Report verified nhắm vào user chưa kháng nghị
// Tự xóa khi user đã vào xem (lưu localStorage)

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

const SEEN_KEY = 'reportsSeenIds';

/** Đánh dấu các report đã xem */
export function markReportsSeen(reportIds) {
  if (!reportIds || reportIds.length === 0) return;
  try {
    const existing = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    const merged = new Set([...existing, ...reportIds]);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...merged]));
    window.dispatchEvent(new Event('reports-badge-refresh'));
  } catch (err) {
    console.warn('markReportsSeen error:', err);
  }
}

/** Xóa cache đã xem — dùng khi logout */
export function clearReportsSeen() {
  localStorage.removeItem(SEEN_KEY);
}

/** Hook đếm số việc cần làm với reports */
export function useReportsBadge() {
  const { profile } = useAuth();
  const [count, setCount] = useState(0);

  const compute = async () => {
    if (!profile?.id) {
      setCount(0);
      return;
    }

    try {
      const seenIds = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
      const snap = await getDocs(collection(db, 'reports'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      let cnt = 0;

      list.forEach(r => {
        // Đã đánh dấu xem → không đếm
        if (seenIds.has(r.id)) return;

        // Case 1: Report pending cần user vote
        // (không phải report của mình, không phải nhắm vào mình, chưa vote)
        if (
          r.status === 'pending' &&
          r.reporterId !== profile.id &&
          r.targetUserId !== profile.id &&
          !(r.voterIds || []).includes(profile.id)
        ) {
          cnt++;
          return;
        }

        // Case 2: Report verified nhắm vào mình, chưa kháng nghị
        if (
          r.status === 'verified' &&
          r.targetUserId === profile.id &&
          !r.appealSubmittedAt
        ) {
          cnt++;
        }
      });

      setCount(cnt);
    } catch (err) {
      console.warn('useReportsBadge compute error:', err);
      setCount(0);
    }
  };

  useEffect(() => {
    compute();

    const handler = () => compute();
    window.addEventListener('reports-badge-refresh', handler);
    return () => window.removeEventListener('reports-badge-refresh', handler);
  }, [profile?.id]);

  return count;
}