// src/pages/CreateReport.jsx
// Tạo tố cáo — tự động gửi thông báo cho GVCN + người bị tố
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addDoc, collection, serverTimestamp, getDocs, query, where, getDoc, doc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft, Loader2, AlertTriangle, User, Link2, FileText,
  Send, ShieldAlert, Info
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function CreateReport() {
  const { profile } = useAuth();
  const nav = useNavigate();

  const [students, setStudents] = useState([]);
  const [violations, setViolations] = useState([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [violationCode, setViolationCode] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // ===== Load dữ liệu =====
  useEffect(() => {
    if (!profile?.id || !profile?.classId) return;
    (async () => {
      try {
        const [studentsSnap, activitiesSnap] = await Promise.all([
          getDocs(query(
            collection(db, 'users'),
            where('classId', '==', profile.classId),
            where('role', '==', 'student')
          )),
          getDocs(collection(db, 'activity_types'))
        ]);

        const studentList = studentsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => s.id !== profile.id)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setStudents(studentList);

        const violationList = activitiesSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(a => a.type === 'violation')
          .sort((a, b) => (a.points || 0) - (b.points || 0));
        setViolations(violationList);

        if (violationList.length > 0) {
          setViolationCode(violationList[0].code);
        }
      } catch (err) {
        console.error('Load data error:', err);
        toast.error('Không tải được dữ liệu');
      } finally {
        setLoading(false);
      }
    })();
  }, [profile?.id, profile?.classId]);

  const selectedStudent = students.find(s => s.id === targetUserId);
  const selectedViolation = violations.find(v => v.code === violationCode);

  // ===== Submit =====
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!targetUserId) return toast.error('Vui lòng chọn người bị tố cáo');
    if (targetUserId === profile.id) return toast.error('Không thể tự tố chính mình');
    if (!selectedViolation) return toast.error('Vui lòng chọn loại vi phạm');
    if (description.trim().length < 10) return toast.error('Mô tả phải từ 10 ký tự trở lên');

    setBusy(true);
    try {
      // 1. Tạo report
      const reportData = {
        reporterId: profile.id,
        reporterName: profile.name,
        targetUserId: selectedStudent.id,
        targetUserName: selectedStudent.name,
        targetTeamId: selectedStudent.teamId,
        classId: profile.classId,
        violationCode: selectedViolation.code,
        violationName: selectedViolation.name,
        points: selectedViolation.points || -1,
        description: description.trim(),
        evidenceUrls: evidenceUrl.trim() ? [evidenceUrl.trim()] : [],
        status: 'pending',
        voteCount: 0,
        voterIds: [],
        threshold: 5,
        gvcnDecision: null,
        appealSubmittedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        verifiedAt: null
      };

      const docRef = await addDoc(collection(db, 'reports'), reportData);

      // 2. Notification cho NGƯỜI BỊ TỐ (ngay lập tức)
      await addDoc(collection(db, 'notifications'), {
        userId: selectedStudent.id,
        type: 'report_created',
        title: 'Có tố cáo nhắm vào bạn',
        body: `Bạn bị tố cáo về "${selectedViolation.name}". Đang chờ các bạn trong lớp xác nhận.`,
        relatedId: docRef.id,
        relatedType: 'report',
        read: false,
        createdAt: serverTimestamp()
      });

      // 3. Notification cho GVCN của lớp (ngay lập tức, chưa cần đủ vote)
      try {
        const classSnap = await getDoc(doc(db, 'classes', profile.classId));
        if (classSnap.exists()) {
          const teacherId = classSnap.data().teacherId;
          if (teacherId) {
            await addDoc(collection(db, 'notifications'), {
              userId: teacherId,
              type: 'new_report_pending',
              title: `Tố cáo mới trong lớp ${profile.classId}`,
              body: `Có tố cáo ẩn danh về "${selectedViolation.name}". Đang chờ tập thể xác nhận.`,
              relatedId: docRef.id,
              relatedType: 'report',
              read: false,
              createdAt: serverTimestamp()
            });
          }
        }
      } catch (e) {
        console.warn('Không gửi được thông báo cho GVCN:', e);
      }

      // 4. Audit log
      await addDoc(collection(db, 'audit_logs'), {
        actorId: profile.id,
        actorName: profile.name,
        action: 'create_report',
        targetType: 'report',
        targetId: docRef.id,
        after: {
          targetUserId: selectedStudent.id,
          violation: selectedViolation.name,
          points: reportData.points
        },
        createdAt: serverTimestamp()
      });

      // 5. Refresh badge toàn app
      window.dispatchEvent(new Event('student-todos-refresh'));
      window.dispatchEvent(new Event('reports-badge-refresh'));
      window.dispatchEvent(new Event('gvcn-badge-refresh'));

      toast.success('Đã gửi tố cáo!', { duration: 3000 });
      nav('/reports');
    } catch (err) {
      console.error('Submit report error:', err);
      toast.error('Lỗi gửi tố cáo: ' + err.message);
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
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <button
          onClick={() => nav(-1)}
          className="text-gray-500 hover:text-gray-700 p-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Tạo tố cáo</h1>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <div className="font-semibold mb-1">Lưu ý quan trọng</div>
          <ul className="space-y-1 list-disc list-inside">
            <li>Người bị tố cáo <strong>được thông báo ngay</strong> khi bạn gửi</li>
            <li>GVCN cũng nhận được thông báo về tố cáo này</li>
            <li>Tố cáo sai có thể ảnh hưởng uy tín tài khoản</li>
            <li>Cần 5 người xác nhận để tố cáo được xem xét chính thức</li>
          </ul>
        </div>
      </div>

      {violations.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 mx-auto mb-3 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <p className="font-semibold text-gray-900">Chưa có loại vi phạm nào</p>
          <p className="text-xs text-gray-500 mt-1">
            Vui lòng liên hệ quản trị viên để thêm loại vi phạm
          </p>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-50 mx-auto mb-3 flex items-center justify-center">
            <User className="w-8 h-8 text-gray-300" />
          </div>
          <p className="font-semibold text-gray-900">Lớp chưa có học sinh nào khác</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
          {/* Người bị tố */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-500" />
              Người bị tố cáo <span className="text-red-500">*</span>
            </label>
            <select
              value={targetUserId}
              onChange={e => setTargetUserId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm bg-white"
              required
            >
              <option value="">-- Chọn học sinh --</option>
              {students.map(s => {
                const teamNum = s.teamId?.match(/-team(\d+)$/)?.[1] || '?';
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} (Tổ {teamNum})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Loại vi phạm */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Loại vi phạm <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {violations.map(v => {
                const isSelected = violationCode === v.code;
                return (
                  <button
                    key={v.code}
                    type="button"
                    onClick={() => setViolationCode(v.code)}
                    className={`p-3 rounded-xl border-2 text-left transition-colors ${
                      isSelected
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm text-gray-900">{v.name}</div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        isSelected ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'
                      }`}>
                        {v.points} điểm
                      </span>
                    </div>
                    {v.description && (
                      <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {v.description}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mô tả */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />
              Mô tả chi tiết <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              maxLength={300}
              placeholder="Mô tả cụ thể sự việc..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm resize-none"
              required
            />
            <div className="flex justify-between text-xs mt-1">
              <span className={description.trim().length < 10 ? 'text-red-500' : 'text-green-600'}>
                {description.trim().length < 10
                  ? `Cần thêm ${10 - description.trim().length} ký tự`
                  : '✓ Đủ độ dài'}
              </span>
              <span className="text-gray-400">{description.length}/300</span>
            </div>
          </div>

          {/* Bằng chứng */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-brand-500" />
              Link bằng chứng (tùy chọn)
            </label>
            <input
              type="url"
              value={evidenceUrl}
              onChange={e => setEvidenceUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
            />
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 leading-relaxed">
              Sau khi gửi:
              <br />• <strong>Người bị tố</strong> sẽ nhận thông báo ngay
              <br />• <strong>GVCN</strong> cũng nhận thông báo
              <br />• Cần <strong>5 xác nhận</strong> để chính thức xem xét
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => nav(-1)}
              disabled={busy}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={busy || !targetUserId || !violationCode || description.trim().length < 10}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50"
            >
              {busy ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Đang gửi...</>
              ) : (
                <><Send className="w-4 h-4" /> Gửi tố cáo</>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}