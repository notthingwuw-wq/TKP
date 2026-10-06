// src/pages/Requests.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, CheckCircle, ClipboardList } from 'lucide-react';

const STATUS_BADGE = {
  pending:  { text: 'Chờ xác nhận', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  verified: { text: 'Đã xác nhận',  cls: 'bg-green-50 text-green-700 border-green-200' },
  expired:  { text: 'Hết hạn',      cls: 'bg-gray-50 text-gray-600 border-gray-200' },
  revoked:  { text: 'Đã hủy',       cls: 'bg-red-50 text-red-700 border-red-200' }
};

export default function Requests() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('mine'); // 'mine' | 'vote'

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      try {
        // Query KHÔNG orderBy — sort client-side
        const snap = await getDocs(query(
          collection(db, 'requests'),
          where('creatorId', '==', profile.id)
        ));
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setRequests(list);
      } catch (err) {
        console.error('Requests load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [profile?.id]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Yêu cầu của tôi</h1>
        <Link
          to="/requests/new"
          className="inline-flex items-center gap-1.5 bg-brand-500 text-white text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-brand-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tạo mới
        </Link>
      </div>

      {/* Quick link to vote */}
      <Link
        to="/requests/vote"
        className="block bg-brand-50 border border-brand-200 rounded-xl p-4 hover:bg-brand-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-brand-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-brand-900 text-sm">
              Xác nhận request của bạn khác
            </div>
            <div className="text-xs text-brand-700 mt-0.5">
              Giúp bạn bè ghi điểm
            </div>
          </div>
        </div>
      </Link>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <ClipboardList className="w-12 h-12 mx-auto text-gray-300 mb-3" strokeWidth={1.5} />
          <p className="text-gray-500 text-sm font-medium">Bạn chưa có request nào</p>
          <Link
            to="/requests/new"
            className="inline-block mt-3 text-brand-500 hover:text-brand-600 text-sm font-medium"
          >
            Tạo request đầu tiên →
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {requests.map(r => {
            const badge = STATUS_BADGE[r.status] || STATUS_BADGE.pending;
            const threshold = r.threshold || 3;
            const progress = Math.min(100, ((r.voteCount || 0) / threshold) * 100);

            return (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">
                      {r.activityName || 'Hoạt động'}
                    </div>
                    {r.description && (
                      <div className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {r.description}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${badge.cls}`}>
                        {badge.text}
                      </span>
                      <span className="text-xs text-gray-500">
                        {r.voteCount || 0}/{threshold} xác nhận
                      </span>
                    </div>
                  </div>
                  <div className={`text-lg font-bold flex-shrink-0 ${
                    r.points >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {r.points >= 0 ? '+' : ''}{r.points}
                  </div>
                </div>

                {/* Progress bar */}
                {r.status === 'pending' && (
                  <div className="mt-3">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      Cần {threshold} người xác nhận độc lập
                    </p>
                  </div>
                )}

                <div className="text-xs text-gray-400 mt-2">
                  {r.createdAt?.toDate?.().toLocaleString('vi-VN') || '—'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}