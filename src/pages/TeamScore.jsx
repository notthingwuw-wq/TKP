import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function TeamScore() {
  const { profile } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    (async () => {
      const teamIds = ['team1', 'team2', 'team3', 'team4'];
      const periodId = profile.activePeriodId || 'current';

      const results = [];
      for (const tid of teamIds) {
        const q = query(
          collection(db, 'score_ledger'),
          where('teamId', '==', tid),
          where('periodId', '==', periodId)
        );
        const snap = await getDocs(q);
        let sum = 0;
        let plus = 0;
        let minus = 0;
        snap.forEach(d => {
          const pts = d.data().points || 0;
          sum += pts;
          if (pts > 0) plus += pts;
          else minus += pts;
        });
        results.push({ id: tid, name: `Tổ ${tid.replace('team', '')}`, total: sum, plus, minus, count: snap.size });
      }

      results.sort((a, b) => b.total - a.total);
      setTeams(results);
      setLoading(false);
    })();
  }, [profile]);

  if (loading) return <div className="text-center py-8">Đang tải...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Điểm thi đua 4 tổ</h1>

      <div className="space-y-3">
        {teams.map((team, idx) => (
          <div
            key={team.id}
            className={`bg-white rounded-xl p-4 shadow ${
              team.id === profile?.teamId ? 'border-2 border-brand-500' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                  idx === 0 ? 'bg-yellow-500' :
                  idx === 1 ? 'bg-gray-400' :
                  idx === 2 ? 'bg-orange-600' :
                  'bg-gray-300'
                }`}>
                  {idx + 1}
                </div>
                <div>
                  <div className="font-bold text-lg">{team.name}</div>
                  {team.id === profile?.teamId && (
                    <div className="text-xs text-brand-600">Tổ của bạn</div>
                  )}
                </div>
              </div>
              <div className="text-2xl font-bold text-brand-700">{team.total}</div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-green-50 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-600">Điểm cộng</div>
                <div className="font-semibold text-green-700">+{team.plus}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-600">Điểm trừ</div>
                <div className="font-semibold text-red-700">{team.minus}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-600">Hoạt động</div>
                <div className="font-semibold text-blue-700">{team.count}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
