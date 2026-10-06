// src/pages/CreateRequest.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addDoc, collection, serverTimestamp, getDocs, query, where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Loader2, TrendingUp, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CreateRequest() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [activities, setActivities] = useState([]);
  const [activityCode, setActivityCode] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // ===== Load activities từ Firestore =====
  useEffect(() => {
    (async () => {
      try {
        // Chỉ lấy activity + task (không lấy violation — vì đó là tố cáo)
        const snap = await getDocs(collection(db, 'activity_types'));
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(a => a.type === 'activity' || a.type === 'task')
          .sort((a, b) => (b.points || 0) - (a.points || 0));

        setActivities(list);
        if (list.length > 0) setActivityCode(list[0].code);
      } catch (err) {
        console.error('Load activities error:', err);
        toast.error('Không tải được danh sách hoạt động');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selected = activities.find(a => a.code === activityCode);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!profile?.id) return;
    if (!selected) return toast.error('Chọn hoạt động');

    setBusy(true);
    try {
      await addDoc(collection(db, 'requests'), {
        creatorId: profile.id,
        creatorName: profile.name,
        teamId: profile.teamId,
        classId: profile.classId,
        activityCode: selected.code,
        activityName: selected.name,
        points: selected.points,
        description: description.trim(),
        status: 'pending',
        voteCount: 0,
        voterIds: [],
        threshold: 3,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        verifiedAt: null
      });

      toast.success('Đã gửi yêu cầu! Chờ bạn bè xác nhận.');
      nav('/requests');
    } catch (err) {
      console.error(err);
      toast.error('Lỗi gửi yêu cầu');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => nav(-1)}
          className="text-gray-500 hover:text-gray-700 p-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Tạo yêu cầu cộng điểm</h1>
      </div>

      {activities.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 mx-auto mb-3 flex items-center justify-center">
            <ClipboardList className="w-8 h-8 text-amber-600" />
          </div>
          <p className="font-semibold text-gray-900">Chưa có hoạt động nào</p>
          <p className="text-xs text-gray-500 mt-1">
            Vui lòng liên hệ quản trị viên để thêm hoạt động
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          {/* Chọn hoạt động */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hoạt động
            </label>
            <div className="grid grid-cols-2 gap-2">
              {activities.map(a => (
                <button
                  key={a.code}
                  type="button"
                  onClick={() => setActivityCode(a.code)}
                  className={`p-3 rounded-xl border-2 text-left transition-colors ${
                    activityCode === a.code
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                    <div className="font-medium text-sm text-gray-900">
                      {a.name}
                    </div>
                  </div>
                  <div className="text-xs text-green-600 font-semibold">
                    +{a.points} điểm
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Mô tả */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mô tả chi tiết (tùy chọn)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="Ví dụ: Phát biểu môn Toán, bài 3..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm resize-none"
            />
            <div className="text-xs text-gray-400 text-right mt-1">
              {description.length}/200
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            ℹ️ Cần tối thiểu <strong>3 người</strong> xác nhận để được ghi điểm.
            Request tự động hết hạn sau 48 giờ.
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-brand-500 text-white font-semibold py-3 rounded-xl hover:bg-brand-600 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang gửi...
              </>
            ) : (
              'Gửi yêu cầu'
            )}
          </button>
        </form>
      )}
    </div>
  );
}