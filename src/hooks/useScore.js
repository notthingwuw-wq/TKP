import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useScore(userId, teamId, periodId = 'current') {
  const [myScore, setMyScore] = useState(0);
  const [teamScore, setTeamScore] = useState(0);
  const [myHistory, setMyHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    // My score ledger
    const myQ = query(
      collection(db, 'score_ledger'),
      where('userId', '==', userId),
      where('periodId', '==', periodId)
    );
    const unsubMy = onSnapshot(myQ, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMyHistory(items);
      const sum = items.reduce((acc, item) => acc + (item.points || 0), 0);
      setMyScore(sum);
    });

    // Team score ledger
    const teamQ = query(
      collection(db, 'score_ledger'),
      where('teamId', '==', teamId),
      where('periodId', '==', periodId)
    );
    const unsubTeam = onSnapshot(teamQ, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const sum = items.reduce((acc, item) => acc + (item.points || 0), 0);
      setTeamScore(sum);
      setLoading(false);
    });

    return () => {
      unsubMy();
      unsubTeam();
    };
  }, [userId, teamId, periodId]);

  return { myScore, teamScore, myHistory, loading };
}
