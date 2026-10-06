import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useScore } from '../hooks/useScore';

export default function History() {
  const { profile } = useAuth();
  const { myHistory, loading } = useScore(profile?.id, profile?.teamId);
  const [filter, setFilter] = useState('all');

  const filtered = myHistory.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'plus') return (item.points || 0) > 0;
    if (filter === 'minus') return (item.points || 0) < 0;
    return true;
  });

  if (loading) return <div className="text-center py-8">Đang tải...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Lịch sử điểm</h1>

      <div className="flex gap-2">
        {['all', 'plus', 'minus'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg ${
              filter === f
                ? 'bg-brand-600 text-white'
                : 'bg-white text-gray-700 border'
            }`}
          >
            {f === 'all' ? 'Tất cả' : f === 'plus' ? 'Điểm cộng' : 'Điểm trừ'}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-500">
            Chưa có hoạt động nào
          </div>
        ) : (
          filtered.map(item => (
            <div key={item.id} className="bg-white rounded-xl p-4 shadow flex items-start justify-between">
              <div className="flex-1">
                <div className="font-medium">{item.activityName}</div>
                <div className="text-sm text-gray-600 mt-1">{item.description}</div>
                <div className="text-xs text-gray-500 mt-2">
                  {new Date(item.createdAt?.toDate?.() || item.createdAt).toLocaleString('vi-VN')}
                </div>
              </div>
              <div className={`text-xl font-bold ml-4 ${
                (item.points || 0) > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {(item.points || 0) > 0 ? '+' : ''}{item.points || 0}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
