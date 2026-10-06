import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { createReport, voteReport, getMyReports } from '../lib/firestore';

export function useReports(userId) {
  const [myReports, setMyReports] = useState([]);
  const [pendingReports, setPendingReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    // Reports about me
    const myQ = query(
      collection(db, 'reports'),
      where('targetUserId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const unsubMy = onSnapshot(myQ, (snap) => {
      setMyReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Pending reports (can vote)
    const pendingQ = query(
      collection(db, 'reports'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const unsubPending = onSnapshot(pendingQ, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Filter out reports about me and reports I created
      setPendingReports(items.filter(r =>
        r.targetUserId !== userId &&
        r.createdBy !== userId &&
        !r.votes?.some(v => v.userId === userId)
      ));
      setLoading(false);
    });

    return () => {
      unsubMy();
      unsubPending();
    };
  }, [userId]);

  return { myReports, pendingReports, loading, createReport, voteReport };
}
