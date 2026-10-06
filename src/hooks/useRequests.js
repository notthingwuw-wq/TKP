import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { createRequest, voteRequest, getPendingRequests, getMyRequests } from '../lib/firestore';

export function useRequests(userId, teamId) {
  const [myRequests, setMyRequests] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    // My requests
    const myQ = query(
      collection(db, 'requests'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const unsubMy = onSnapshot(myQ, (snap) => {
      setMyRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Pending requests (exclude my team)
    const pendingQ = query(
      collection(db, 'requests'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const unsubPending = onSnapshot(pendingQ, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Filter out same team in client side
      setPendingRequests(items.filter(r => r.teamId !== teamId));
      setLoading(false);
    });

    return () => {
      unsubMy();
      unsubPending();
    };
  }, [userId, teamId]);

  return { myRequests, pendingRequests, loading, createRequest, voteRequest };
}
