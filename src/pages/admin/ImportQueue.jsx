// src/pages/admin/ImportQueue.jsx
// Xem lịch sử import — dùng onSnapshot không orderBy, sort client-side
import { useEffect, useState } from 'react';
import {
  collection, query, onSnapshot, deleteDoc, doc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  Clock, CheckCircle, XCircle, Loader2, Trash2, FileSpreadsheet
} from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_META = {
  pending:    { icon: Clock,         cls: 'bg-amber-50 text-amber-700 border-amber-200',   label: 'Chờ xử lý' },
  processing: { icon: Loader2,       cls: 'bg-blue-50 text-blue-700 border-blue-200',      label: 'Đang xử lý' },
  done:       { icon: CheckCircle,   cls: 'bg-green-50 text-green-700 border-green-200',   label: 'Hoàn thành' },
  failed:     { icon: XCircle,       cls: 'bg-red-50 text-red-700 border-red-200',         label: 'Thất bại' }
};

export default function ImportQueue() {
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'import_queue'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setQueues(list);
        setLoading(false);
      },
      (err) => {
        console.error('ImportQueue listener error:', err);
        toast.error('Không tải được danh sách queue');
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const handleDelete = async (queueId) => {
    if (!confirm('Xóa queue này khỏi lịch sử?')) return;
    try {
      await deleteDoc(doc(db, 'import_queue', queueId));
      toast.success('Đã xóa');
    } catch (err) {
      console.error(err);
      toast.error('Lỗi xóa');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Lịch sử import</h2>
        <p className="text-gray-600 text-sm mt-1">
          Tổng cộng {queues.length} queue
        </p>
      </div>

      {queues.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-300 mb-3" strokeWidth={1.5} />
          <p className="text-gray-500 text-sm">Chưa có queue nào</p>
          <p className="text-xs text-gray-400 mt-1">
            Vào tab "Import học sinh" để tạo queue
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {queues.map(q => {
            const meta = STATUS_META[q.status] || STATUS_META.pending;
            const Icon = meta.icon;
            const result = q.result || {};
            return (
              <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${meta.cls}`}>
                        <Icon className={`w-3 h-3 ${q.status === 'processing' ? 'animate-spin' : ''}`} />
                        {meta.label}
                      </span>
                      <span className="font-semibold text-gray-900">
                        {q.className || q.classId}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {(q.students?.length || 0)} học sinh · {q.createdAt?.toDate?.().toLocaleString('vi-VN') || '—'}
                    </div>
                    {q.status === 'done' && (
                      <div className="mt-2 text-xs">
                        <span className="text-green-600 font-medium">
                          ✓ {result.successCount || 0} thành công
                        </span>
                        {result.failedCount > 0 && (
                          <>
                            <span className="mx-2 text-gray-300">·</span>
                            <span className="text-red-600 font-medium">
                              ✗ {result.failedCount} lỗi
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(q.id)}
                    className="text-gray-400 hover:text-red-500 p-1"
                    title="Xóa queue"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}