// src/pages/Score.jsx
// Xem điểm cá nhân + lịch sử
import { useEffect, useState } from 'react';
import {
  collection, query, where, getDocs
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

const FILTERS = [
  { key: 'today',  label: 'Hôm nay' },
  { key: 'week',   label: 'Tuần này' },
  { key: 'month',  label: 'Tháng này' },
  { key: 'all',    label: 'Tất cả' }
];

export default function Score() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('week');

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      setLoading(true);
      try {
        // Bỏ orderBy và limit để tránh lỗi composite index, sort client-side
        const q = query(
          collection(db, 'score_ledger'),
          where('userId', '==', profile.id)
        );
        const snap = await getDocs(q);
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
          .slice(0, 200);
        setEntries(list);
      } catch (err) {
        console.error('Score load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [profile?.id]);

  // Filter theo thời gian
  const filtered = entries.filter(e => {
    if (filter === 'all' || !e.createdAt) return true;
    const date = e.createdAt.toDate?.() || new Date(e.createdAt);
    const now = new Date();
    const diff = (now - date) / 1000 / 3600; // giờ
    if (filter === 'today') return diff < 24;
    if (filter === 'week') return diff < 24 * 7;
    if (filter === 'month') return diff < 24 * 30;
    return true;
  });

  const total = filtered.reduce((s, e) => s + (e.points || 0), 0);
  const plus = filtered.filter(e => e.points > 0).reduce((s, e) => s + e.points, 0);
  const minus = filtered.filter(e => e.points < 0).reduce((s, e) => s + e.points, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Điểm của tôi</h1>

      {/* Card tổng điểm */}
      <div className="bg-white rounded-2xl shadow-sm border p-5">
        <div className="text-sm text-gray-500 mb-2">Tổng điểm</div>
        <div className={`text-4xl font-bold ${
          total > 0 ? 'text-green-600' : total < 0 ? 'text-red-600' : 'text-gray-900'
        }`}>
          {total >= 0 ? '+' : ''}{total}
        </div>
        <div className="flex gap-4 mt-3 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-green-600">●</span>
            <span className="text-gray-600">Cộng: </span>
            <span className="font-semibold text-green-600">+{plus}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-red-600">●</span>
            <span className="text-gray-600">Trừ: </span>
            <span className="font-semibold text-red-600">{minus}</span>
          </div>
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f.key
                ? 'bg-brand-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Danh sách */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-gray-500 text-sm">Chưa có hoạt động nào</p>
          <p className="text-xs text-gray-400 mt-1">
            Điểm sẽ hiện ở đây sau khi request được xác nhận
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border divide-y">
          {filtered.map(e => (
            <div key={e.id} className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${
                e.points >= 0 ? 'bg-green-50' : 'bg-red-50'
              }`}>
                {e.points >= 0 ? '⭐' : '⚠️'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {e.activityName || e.description || 'Hoạt động'}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {e.createdAt?.toDate?.().toLocaleString('vi-VN', {
                    day: '2-digit', month: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                  }) || '—'}
                </div>
              </div>
              <div className={`font-bold text-base flex-shrink-0 ${
                e.points >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {e.points >= 0 ? '+' : ''}{e.points}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}