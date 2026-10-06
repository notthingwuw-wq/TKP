import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Hook kiểm tra xem student có cần chọn tổ không
 * @param {Object} user - Firebase Auth user
 * @param {Object} profile - User profile từ Firestore
 * @returns {Object} - { needsTeamSelection, loading }
 */
export function useTeamSelection(user, profile) {
  const [needsTeamSelection, setNeedsTeamSelection] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile) {
      setLoading(false);
      setNeedsTeamSelection(false);
      return;
    }

    // Chỉ student mới cần chọn tổ
    if (profile.role !== 'student') {
      setLoading(false);
      setNeedsTeamSelection(false);
      return;
    }

    // Lắng nghe realtime để biết khi nào user cập nhật teamId
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const needs = !data.teamId || data.status === 'pending';
        setNeedsTeamSelection(needs);
        setLoading(false);
      }
    });

    return () => unsub();
  }, [user, profile]);

  return { needsTeamSelection, loading };
}
