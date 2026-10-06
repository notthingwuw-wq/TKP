// src/hooks/useStudentTodos.js
// Đếm việc cần làm cho học sinh
// - Requests pending chưa vote
// - Reports pending chưa vote
// - Reports verified nhắm vào mình chưa kháng nghị

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export function useStudentTodos() {
  const { profile } = useAuth();
  const [todos, setTodos] = useState({
    requestsToVote: 0,
    reportsToVote: 0,
    reportsToAppeal: 0,
    total: 0
  });

  const compute = async () => {
    if (!profile?.id) {
      setTodos({ requestsToVote: 0, reportsToVote: 0, reportsToAppeal: 0, total: 0 });
      return;
    }

    try {
      const [requestsSnap, reportsSnap] = await Promise.all([
        getDocs(collection(db, 'requests')),
        getDocs(collection(db, 'reports'))
      ]);

      // Requests pending chưa vote
      const requestsToVote = requestsSnap.docs
        .map(d => d.data())
        .filter(r =>
          r.status === 'pending' &&
          r.creatorId !== profile.id &&
          !(r.voterIds || []).includes(profile.id)
        ).length;

      // Reports pending chưa vote
      const reportsToVote = reportsSnap.docs
        .map(d => d.data())
        .filter(r =>
          r.status === 'pending' &&
          r.reporterId !== profile.id &&
          r.targetUserId !== profile.id &&
          !(r.voterIds || []).includes(profile.id)
        ).length;

      // Reports verified nhắm vào mình chưa kháng nghị
      const reportsToAppeal = reportsSnap.docs
        .map(d => d.data())
        .filter(r =>
          r.status === 'verified' &&
          r.targetUserId === profile.id &&
          !r.appealSubmittedAt
        ).length;

      setTodos({
        requestsToVote,
        reportsToVote,
        reportsToAppeal,
        total: requestsToVote + reportsToVote + reportsToAppeal
      });
    } catch (err) {
      console.warn('useStudentTodos error:', err);
    }
  };

  useEffect(() => {
    compute();

    const handler = () => compute();
    window.addEventListener('student-todos-refresh', handler);
    return () => window.removeEventListener('student-todos-refresh', handler);
  }, [profile?.id]);

  return todos;
}