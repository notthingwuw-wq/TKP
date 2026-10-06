// src/pages/VoteRequests.jsx
// Xác nhận request của bạn khác
import { useEffect, useState } from 'react';
import {
  collection, query, where, getDocs, doc, runTransaction,
  serverTimestamp, arrayUnion, limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function VoteRequests() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState(null);

  const loadRequests = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'requests'),
        where('status', '==', 'pending'),
        limit(50)
      );
      const snap = await getDocs(q);
      // Loại request của mình + đã vote
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(r => r.creatorId !== profile.id)
        .filter(r => !(r.voterIds || []).includes(profile.id))
        .sort((a, b) => {
          const at = a.createdAt?.seconds || 0;
          const bt = b.createdAt?.seconds || 0;
          return bt - at;
        });
      setRequests(list);
    } catch (err) {
      console.error(err);
      toast.error('Không tải được danh sách');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [profile?.id]);

  const handleVote = async (req) => {
    if (!profile?.id || votingId) return;
    setVotingId(req.id);

    try {
      await runTransaction(db, async (tx) => {
        const reqRef = doc(db, 'requests', req.id);
        const reqSnap = await tx.get(reqRef);

        if (!reqSnap.exists()) throw new Error('Request không tồn tại');

        const data = reqSnap.data();
        const voterIds = data.voterIds || [];

        // Đã vote rồi
        if (voterIds.includes(profile.id)) {
          throw new Error('Bạn đã xác nhận request này rồi');
        }

        const newCount = voterIds.length + 1;
        const threshold = data.threshold || 3;
        const isVerified = newCount >= threshold;

        // Update request - sử dụng arrayUnion thay vì spread array
        tx.update(reqRef, {
          voterIds: arrayUnion(profile.id),
          voteCount: newCount,
          status: isVerified ? 'verified' : 'pending',
          verifiedAt: isVerified && !data.verifiedAt
            ? serverTimestamp()
            : data.verifiedAt,
          updatedAt: serverTimestamp()
        });

        // Nếu verified → ghi score_ledger
        if (isVerified && data.status !== 'verified') {
          const ledgerRef = doc(collection(db, 'score_ledger'));
          tx.set(ledgerRef, {
            userId: data.creatorId,
            teamId: data.teamId,
            points: data.points,
            activityCode: data.activityCode,
            activityName: data.activityName,
            sourceType: 'request',
            sourceId: req.id,
            description: data.description || '',
            createdAt: serverTimestamp()
          });
        }
      });

      toast.success('Đã xác nhận!');
      setRequests(prev => prev.filter(r => r.id !== req.id));

      // Dispatch event để Home page reload badge count
      window.dispatchEvent(new Event('refresh-counts'));

    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Lỗi xác nhận');
    } finally {
      setVotingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Xác nhận request</h1>
        <p className="text-sm text-gray-500 mt-1">
          {requests.length} request đang chờ bạn
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="text-5xl mb-3">🎉</div>
          <p className="text-gray-500 text-sm">Bạn đã xác nhận hết rồi!</p>
          <p className="text-xs text-gray-400 mt-1">
            Quay lại sau để xem request mới
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(r => {
            const voting = votingId === r.id;
            const threshold = r.threshold || 3;
            const progress = Math.min(100, ((r.voteCount || 0) / threshold) * 100);

            return (
              <div key={r.id} className="bg-white rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                        Tổ {r.teamId?.match(/-team(\d+)$/)?.[1] || '?'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {r.creatorName || 'Học sinh'}
                      </span>
                    </div>
                    <div className="font-medium text-gray-900">
                      {r.activityName}
                    </div>
                    {r.description && (
                      <div className="text-sm text-gray-500 mt-1">
                        {r.description}
                      </div>
                    )}
                  </div>
                  <div className="text-lg font-bold text-green-600 flex-shrink-0">
                    {r.points >= 0 ? '+' : ''}{r.points}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{r.voteCount || 0}/{threshold} xác nhận</span>
                    {r.voteCount >= threshold && (
                      <span className="text-green-600 font-medium">✓ Đã đủ</span>
                    )}
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleVote(r)}
                  disabled={voting}
                  className="w-full bg-brand-600 text-white font-medium py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {voting ? 'Đang xác nhận...' : '✅ Xác nhận'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}