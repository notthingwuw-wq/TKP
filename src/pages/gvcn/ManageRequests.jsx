import { useState, useEffect } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function ManageRequests() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, [filter]);

  const loadRequests = async () => {
    setLoading(true);
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (filter !== 'all') {
      items = items.filter(r => r.status === filter);
    }

    setRequests(items);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Quản lý Requests</h1>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {['all', 'pending', 'verified', 'revoked'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${
              filter === status ? 'bg-brand-600 text-white' : 'bg-white border'
            }`}
          >
            {status === 'all' ? 'Tất cả' :
             status === 'pending' ? 'Chờ xác nhận' :
             status === 'verified' ? 'Đã xác nhận' : 'Đã hủy'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8">Đang tải...</div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req.id} className="bg-white rounded-xl p-4 shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-semibold">{req.activityName}</div>
                  <div className="text-sm text-gray-600 mt-1">Người tạo: {req.userName} (Tổ {req.teamId?.replace('team', '')})</div>
                  <div className="text-sm text-gray-600">{req.description}</div>
                  <div className="text-xs text-gray-500 mt-2">
                    {req.voteCount || 0} xác nhận • {new Date(req.createdAt?.toDate?.() || req.createdAt).toLocaleString('vi-VN')}
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  req.status === 'verified' ? 'bg-green-100 text-green-700' :
                  req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {req.status === 'verified' ? '✓ Đã xác nhận' :
                   req.status === 'pending' ? 'Chờ xác nhận' : 'Đã hủy'}
                </div>
              </div>

              {req.votes && req.votes.length > 0 && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="font-medium mb-2">Người xác nhận:</div>
                  <div className="flex flex-wrap gap-2">
                    {req.votes.map((v, idx) => (
                      <span key={idx} className="px-2 py-1 bg-white rounded text-xs">
                        {v.userName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
