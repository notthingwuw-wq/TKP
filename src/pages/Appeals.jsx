// src/pages/Appeals.jsx
// Form gửi kháng nghị
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  collection, query, where, getDocs, addDoc, doc, getDoc, updateDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { MessageSquare, ArrowLeft, AlertTriangle } from 'lucide-react';

export default function Appeals() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reportId = searchParams.get('reportId');

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingAppeal, setExistingAppeal] = useState(null);

  const [content, setContent] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  // Load report và check xem đã có kháng nghị chưa
  useEffect(() => {
    if (!reportId || !profile?.id) {
      toast.error('Không tìm thấy tố cáo');
      navigate('/reports');
      return;
    }

    (async () => {
      try {
        // Load report
        const reportRef = doc(db, 'reports', reportId);
        const reportSnap = await getDoc(reportRef);

        if (!reportSnap.exists()) {
          throw new Error('Tố cáo không tồn tại');
        }

        const reportData = { id: reportSnap.id, ...reportSnap.data() };

        // Kiểm tra xem report này có nhắm vào mình không
        if (reportData.targetUserId !== profile.id) {
          throw new Error('Bạn không có quyền kháng nghị tố cáo này');
        }

        // Kiểm tra status
        if (reportData.status !== 'verified' && reportData.status !== 'confirmed') {
          throw new Error('Chỉ có thể kháng nghị tố cáo đã được xác nhận');
        }

        setReport(reportData);

        // Check xem đã có kháng nghị chưa
        const appealsQ = query(
          collection(db, 'appeals'),
          where('reportId', '==', reportId),
          where('appellantId', '==', profile.id)
        );
        const appealsSnap = await getDocs(appealsQ);

        if (!appealsSnap.empty) {
          setExistingAppeal({ id: appealsSnap.docs[0].id, ...appealsSnap.docs[0].data() });
        }

      } catch (err) {
        console.error('Load report error:', err);
        toast.error(err.message || 'Có lỗi xảy ra');
        navigate('/reports');
      } finally {
        setLoading(false);
      }
    })();
  }, [reportId, profile?.id, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (content.trim().length < 20) {
      toast.error('Giải trình phải có ít nhất 20 ký tự');
      return;
    }

    if (existingAppeal) {
      toast.error('Bạn đã gửi kháng nghị cho tố cáo này rồi');
      return;
    }

    setSubmitting(true);

    try {
      // Tạo appeal
      await addDoc(collection(db, 'appeals'), {
        reportId,
        appellantId: profile.id,
        content: content.trim(),
        evidenceUrls: evidenceUrl.trim() ? [evidenceUrl.trim()] : [],
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Update report
      await updateDoc(doc(db, 'reports', reportId), {
        appealSubmittedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.success('Đã gửi kháng nghị. GVCN sẽ xem xét trong thời gian sớm nhất.');
      navigate('/reports');
    } catch (err) {
      console.error('Submit appeal error:', err);
      toast.error(err.message || 'Có lỗi xảy ra khi gửi kháng nghị');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  // Nếu đã có kháng nghị
  if (existingAppeal) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/reports')}
            className="text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Kháng nghị</h1>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <MessageSquare size={48} className="mx-auto text-blue-600 mb-3" />
          <p className="text-blue-900 font-medium mb-2">
            Bạn đã gửi kháng nghị cho tố cáo này
          </p>
          <p className="text-sm text-blue-700">
            GVCN sẽ xem xét và trả lời trong thời gian sớm nhất
          </p>
          <button
            onClick={() => navigate('/reports')}
            className="mt-4 px-6 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700"
          >
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/reports')}
          className="text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gửi kháng nghị</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Giải trình về tố cáo nhắm vào bạn
          </p>
        </div>
      </div>

      {/* Thông tin tố cáo */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Thông tin tố cáo</h2>

        <div className="space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="text-gray-500 w-24 flex-shrink-0">Loại vi phạm:</span>
            <span className="font-medium text-gray-900">{report.violationName}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-24 flex-shrink-0">Mô tả:</span>
            <span className="text-gray-700">{report.description}</span>
          </div>
          {report.evidenceUrls && report.evidenceUrls.length > 0 && (
            <div className="flex gap-2">
              <span className="text-gray-500 w-24 flex-shrink-0">Bằng chứng:</span>
              <a
                href={report.evidenceUrls[0]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline"
              >
                Xem bằng chứng →
              </a>
            </div>
          )}
          <div className="flex gap-2">
            <span className="text-gray-500 w-24 flex-shrink-0">Ngày tạo:</span>
            <span className="text-gray-700">
              {report.createdAt?.toDate?.().toLocaleString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }) || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Cảnh báo */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3">
        <AlertTriangle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm text-yellow-900">
          <p className="font-medium mb-1">Lưu ý:</p>
          <ul className="list-disc list-inside space-y-0.5 text-yellow-800">
            <li>Chỉ gửi kháng nghị khi có căn cứ rõ ràng</li>
            <li>Cung cấp bằng chứng minh chứng bạn không vi phạm</li>
            <li>GVCN sẽ xem xét và đưa ra quyết định cuối cùng</li>
          </ul>
        </div>
      </div>

      {/* Form kháng nghị */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* Giải trình */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Giải trình của bạn <span className="text-red-500">*</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Giải trình chi tiết lý do tại sao bạn cho rằng tố cáo này không chính xác..."
            rows={6}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
            required
            minLength={20}
          />
          <p className="text-xs text-gray-500 mt-1">
            Tối thiểu 20 ký tự. Hiện tại: {content.length} ký tự
          </p>
        </div>

        {/* Link bằng chứng */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Link bằng chứng phản bác (không bắt buộc)
          </label>
          <input
            type="url"
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            Link ảnh, video hoặc tài liệu chứng minh bạn không vi phạm
          </p>
        </div>

        {/* Submit buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
            disabled={submitting}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="flex-1 px-6 py-3 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={submitting}
          >
            {submitting ? 'Đang gửi...' : 'Gửi kháng nghị'}
          </button>
        </div>
      </form>
    </div>
  );
}
