// src/pages/gvcn/ManageAppeals.jsx
// Quản lý kháng nghị — GVCN xem xét, chấp nhận / từ chối
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  collection, query, where, getDocs, doc, getDoc,
  writeBatch, addDoc, serverTimestamp, updateDoc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  MessageSquare, X, CheckCircle2, XCircle, AlertTriangle,
  User, Calendar, FileText, ExternalLink, ChevronRight,
  Loader2, Clock, ShieldCheck, TrendingUp, RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';

// ===== Status meta =====
const STATUS_META = {
  pending:  { label: 'Chờ xử lý',     cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  accepted: { label: 'Đã chấp nhận',  cls: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'Đã từ chối',    cls: 'bg-gray-50 text-gray-700 border-gray-200' }
};

const TABS = [
  { key: 'pending',  label: 'Chờ xử lý' },
  { key: 'accepted', label: 'Đã chấp nhận' },
  { key: 'rejected', label: 'Đã từ chối' },
  { key: 'all',      label: 'Tất cả' }
];

// ===== Helper tính điểm vi phạm =====
function getViolationPoints(code) {
  const map = {
    noi_chuyen: -1,
    khong_thuoc: -2,
    xa_rac: -1,
    khong_nhiem_vu: -2,
    vi_pham_noi_quy: -1
  };
  return map[code] || -1;
}

// ===== Trigger refresh cho badges toàn app =====
function triggerRefresh() {
  window.dispatchEvent(new Event('gvcn-badge-refresh'));
  window.dispatchEvent(new Event('student-todos-refresh'));
  window.dispatchEvent(new Event('reports-badge-refresh'));
  window.dispatchEvent(new Event('refresh-home'));
}

export default function ManageAppeals() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [appeals, setAppeals] = useState([]);
  const [reportMap, setReportMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedAppeal, setSelectedAppeal] = useState(null);
  const [stats, setStats] = useState({ pending: 0, accepted: 0, rejected: 0, all: 0 });

  // ===== Load data =====
  const loadAppeals = async () => {
    if (!profile?.classId) return;
    setLoading(true);
    try {
      const classId = profile.classId;

      // Load tất cả reports của lớp (để filter appeals theo reportId)
      const reportsSnap = await getDocs(collection(db, 'reports'));
      const classReports = reportsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(r => {
          if (r.classId) return r.classId === classId;
          if (r.targetTeamId) return r.targetTeamId.startsWith(classId);
          return false;
        });

      const classReportIds = new Set(classReports.map(r => r.id));
      const reportMapObj = {};
      classReports.forEach(r => { reportMapObj[r.id] = r; });
      setReportMap(reportMapObj);

      // Load appeals thuộc report của lớp
      const appealsSnap = await getDocs(collection(db, 'appeals'));
      const list = appealsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(a => classReportIds.has(a.reportId))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      setAppeals(list);

      const newStats = { pending: 0, accepted: 0, rejected: 0, all: list.length };
      list.forEach(a => {
        if (a.status === 'pending') newStats.pending++;
        else if (a.status === 'accepted') newStats.accepted++;
        else if (a.status === 'rejected') newStats.rejected++;
      });
      setStats(newStats);

      // Auto-open nếu URL có ?id=
      const idFromUrl = searchParams.get('id');
      if (idFromUrl) {
        const found = list.find(a => a.id === idFromUrl);
        if (found) setSelectedAppeal(found);
      }
    } catch (err) {
      console.error('Load appeals error:', err);
      toast.error('Không tải được danh sách kháng nghị');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppeals();
  }, [profile?.classId]);

  // ===== Filter theo tab =====
  const filtered = useMemo(() => {
    if (activeTab === 'all') return appeals;
    return appeals.filter(a => a.status === activeTab);
  }, [appeals, activeTab]);

  // ===== HANDLE ACCEPT =====
  const handleAccept = async (appeal, note) => {
    const report = reportMap[appeal.reportId];
    if (!report) {
      toast.error('Không tìm thấy tố cáo gốc');
      return;
    }

    const violationPoints = getViolationPoints(report.violationCode);
    const restorePoints = Math.abs(violationPoints);   // Hoàn điểm (dương)

    if (!confirm(
      `Chấp nhận kháng nghị của ${appeal.appellantName || 'học sinh'}?\n\n` +
      `→ Tố cáo gốc sẽ bị BÁC BỎ\n` +
      `→ Hoàn lại +${restorePoints} điểm cho học sinh\n` +
      `→ Không thể hoàn tác sau khi xác nhận`
    )) return;

    try {
      const batch = writeBatch(db);

      // 1. Update appeal → accepted
      batch.update(doc(db, 'appeals', appeal.id), {
        status: 'accepted',
        gvcnNote: note || '',
        reviewedBy: profile.id,
        reviewedByName: profile.name,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 2. Update report gốc → rejected (đảo ngược tố cáo)
      batch.update(doc(db, 'reports', appeal.reportId), {
        status: 'rejected',
        reversedByAppeal: true,
        gvcnDecision: {
          decision: 'rejected',
          note: `Kháng nghị được chấp nhận. ${note || ''}`,
          reviewedBy: profile.id,
          reviewedByName: profile.name,
          reviewedAt: serverTimestamp()
        },
        updatedAt: serverTimestamp()
      });

      // 3. Tạo entry **CỘNG** trong score_ledger để hoàn điểm
      const ledgerRef = doc(collection(db, 'score_ledger'));
      batch.set(ledgerRef, {
        userId: report.targetUserId,
        teamId: report.targetTeamId,
        points: restorePoints,
        activityCode: 'hoan_diem',
        activityName: `Hoàn điểm - Kháng nghị được chấp nhận`,
        sourceType: 'appeal',
        sourceId: appeal.id,
        description: `Hoàn lại điểm cho tố cáo "${report.violationName}"`,
        createdAt: serverTimestamp()
      });

      await batch.commit();

      // 4. Notification cho người kháng nghị (người bị tố)
      await addDoc(collection(db, 'notifications'), {
        userId: appeal.appellantId,
        type: 'appeal_accepted',
        title: 'Kháng nghị được chấp nhận',
        body: `Kháng nghị của bạn cho tố cáo "${report.violationName}" đã được chấp nhận. Bạn được hoàn lại +${restorePoints} điểm.`,
        relatedId: report.id,
        relatedType: 'report',
        read: false,
        createdAt: serverTimestamp()
      });

      // 5. Notification cho reporter
      await addDoc(collection(db, 'notifications'), {
        userId: report.reporterId,
        type: 'report_reversed',
        title: 'Tố cáo đã bị đảo ngược',
        body: `Tố cáo của bạn về "${report.violationName}" đã bị bác bỏ do kháng nghị được chấp nhận.`,
        relatedId: report.id,
        relatedType: 'report',
        read: false,
        createdAt: serverTimestamp()
      });

      // 6. Audit log
      await addDoc(collection(db, 'audit_logs'), {
        actorId: profile.id,
        actorName: profile.name,
        action: 'accept_appeal',
        targetType: 'appeal',
        targetId: appeal.id,
        after: {
          appealStatus: 'accepted',
          reportStatus: 'rejected',
          restorePoints
        },
        createdAt: serverTimestamp()
      });

      toast.success(`Đã chấp nhận kháng nghị + hoàn +${restorePoints} điểm`);
      setSelectedAppeal(null);
      setSearchParams({});
      await loadAppeals();
      triggerRefresh();
    } catch (err) {
      console.error('Accept appeal error:', err);
      toast.error('Lỗi xử lý: ' + err.message);
    }
  };

  // ===== HANDLE REJECT =====
  const handleReject = async (appeal, note) => {
    if (!note || note.trim().length < 10) {
      toast.error('Vui lòng nhập lý do từ chối (≥10 ký tự)');
      return;
    }

    const report = reportMap[appeal.reportId];
    if (!confirm(
      `Từ chối kháng nghị của ${appeal.appellantName || 'học sinh'}?\n\n` +
      `→ Tố cáo gốc vẫn giữ trạng thái ĐÃ XÁC NHẬN\n` +
      `→ Học sinh không được hoàn điểm`
    )) return;

    try {
      // 1. Update appeal → rejected
      await updateDoc(doc(db, 'appeals', appeal.id), {
        status: 'rejected',
        gvcnNote: note,
        reviewedBy: profile.id,
        reviewedByName: profile.name,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 2. Notification cho appellant
      await addDoc(collection(db, 'notifications'), {
        userId: appeal.appellantId,
        type: 'appeal_rejected',
        title: 'Kháng nghị bị từ chối',
        body: `Kháng nghị của bạn cho tố cáo "${report?.violationName || ''}" đã bị từ chối. Lý do: ${note}`,
        relatedId: appeal.reportId,
        relatedType: 'report',
        read: false,
        createdAt: serverTimestamp()
      });

      // 3. Audit log
      await addDoc(collection(db, 'audit_logs'), {
        actorId: profile.id,
        actorName: profile.name,
        action: 'reject_appeal',
        targetType: 'appeal',
        targetId: appeal.id,
        after: { appealStatus: 'rejected', note },
        createdAt: serverTimestamp()
      });

      toast.success('Đã từ chối kháng nghị');
      setSelectedAppeal(null);
      setSearchParams({});
      await loadAppeals();
      triggerRefresh();
    } catch (err) {
      console.error('Reject appeal error:', err);
      toast.error('Lỗi xử lý: ' + err.message);
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
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quản lý kháng nghị</h1>
        <p className="text-gray-600 text-sm mt-1">
          Kháng nghị từ học sinh lớp {profile?.classId}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            {stats.pending > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            )}
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{stats.pending}</div>
          <div className="text-xs text-gray-500 mt-0.5">Chờ xử lý</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{stats.accepted}</div>
          <div className="text-xs text-gray-500 mt-0.5">Đã chấp nhận</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center">
            <XCircle className="w-4 h-4 text-gray-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{stats.rejected}</div>
          <div className="text-xs text-gray-500 mt-0.5">Đã từ chối</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{stats.all}</div>
          <div className="text-xs text-gray-500 mt-0.5">Tổng cộng</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-xl p-1 flex gap-1">
        {TABS.map(t => {
          const count = stats[t.key] ?? 0;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className={`ml-1.5 text-xs ${
                  activeTab === t.key ? 'opacity-90' : 'text-gray-400'
                }`}>
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 mx-auto mb-3 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <p className="font-semibold text-gray-900">
            {activeTab === 'pending' ? 'Không có kháng nghị nào đang chờ' : 'Không có kháng nghị nào'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {activeTab === 'pending'
              ? 'Tất cả kháng nghị đã được xử lý'
              : 'Chưa có kháng nghị ở mục này'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(a => (
            <AppealCard
              key={a.id}
              appeal={a}
              report={reportMap[a.reportId]}
              onClick={() => {
                setSelectedAppeal(a);
                setSearchParams({ id: a.id });
              }}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {selectedAppeal && (
        <AppealDetailModal
          appeal={selectedAppeal}
          report={reportMap[selectedAppeal.reportId]}
          onClose={() => {
            setSelectedAppeal(null);
            setSearchParams({});
          }}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      )}
    </div>
  );
}

// ============ SUB-COMPONENTS ============

function AppealCard({ appeal, report, onClick }) {
  const meta = STATUS_META[appeal.status] || STATUS_META.pending;
  const teamNum = report?.targetTeamId?.match(/-team(\d+)$/)?.[1] || '?';

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-400 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${
          appeal.status === 'pending' ? 'bg-amber-50' :
          appeal.status === 'accepted' ? 'bg-green-50' :
          'bg-gray-50'
        }`}>
          <MessageSquare className={`w-5 h-5 ${
            appeal.status === 'pending' ? 'text-amber-600' :
            appeal.status === 'accepted' ? 'text-green-600' :
            'text-gray-500'
          }`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium ${meta.cls}`}>
              {meta.label}
            </span>
            {report && (
              <span className="text-xs text-gray-400 truncate">
                Tố cáo: {report.violationName}
              </span>
            )}
          </div>

          <div className="font-semibold text-gray-900 text-sm">
            {appeal.appellantName || report?.targetUserName || 'Học sinh'}
          </div>

          <div className="text-xs text-gray-600 mt-1 line-clamp-2">
            {appeal.content}
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <User className="w-3 h-3" />
              Tổ {teamNum}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {appeal.createdAt?.toDate?.().toLocaleString('vi-VN', {
                day: '2-digit', month: '2-digit',
                hour: '2-digit', minute: '2-digit'
              }) || '—'}
            </span>
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-2" />
      </div>
    </button>
  );
}

function AppealDetailModal({ appeal, report, onClose, onAccept, onReject }) {
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const isProcessed = appeal.status !== 'pending';

  const violationPoints = report ? getViolationPoints(report.violationCode) : 0;
  const restorePoints = Math.abs(violationPoints);

  const wrapAction = (fn) => async () => {
    if (processing) return;
    setProcessing(true);
    try {
      await fn(appeal, note);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-bold text-gray-900">Chi tiết kháng nghị</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Mã: #{appeal.id.slice(0, 8)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Status banner */}
          <div className={`rounded-xl p-4 border ${STATUS_META[appeal.status]?.cls || ''}`}>
            <div className="font-semibold text-sm">
              {STATUS_META[appeal.status]?.label}
            </div>
            {isProcessed && appeal.reviewedByName && (
              <div className="text-xs mt-1 opacity-90">
                Xử lý bởi: {appeal.reviewedByName}
                {' · '}
                {appeal.reviewedAt?.toDate?.().toLocaleString('vi-VN') || '—'}
              </div>
            )}
          </div>

          {/* Người kháng nghị */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-blue-500" />
              Người kháng nghị
            </h4>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <DetailRow
                icon={<User className="w-4 h-4 text-gray-500" />}
                label="Họ tên"
                value={appeal.appellantName || report?.targetUserName || '—'}
              />
              <DetailRow
                icon={<Calendar className="w-4 h-4 text-gray-500" />}
                label="Thời gian gửi"
                value={appeal.createdAt?.toDate?.().toLocaleString('vi-VN') || '—'}
              />
            </div>
          </div>

          {/* Nội dung kháng nghị */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              Nội dung kháng nghị
            </h4>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="text-sm text-blue-900 leading-relaxed whitespace-pre-wrap">
                {appeal.content}
              </div>
              {appeal.evidenceUrls?.length > 0 && (
                <div className="pt-3 mt-3 border-t border-blue-200">
                  <div className="text-xs text-blue-700 mb-1.5">Bằng chứng phản bác</div>
                  <div className="space-y-1.5">
                    {appeal.evidenceUrls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs text-blue-700 hover:underline bg-white rounded-lg px-3 py-2 border border-blue-200 w-full"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="truncate">{url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tố cáo gốc */}
          {report && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-amber-500" />
                Tố cáo gốc
              </h4>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                <DetailRow
                  icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
                  label="Loại vi phạm"
                  value={
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{report.violationName}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                        {violationPoints} điểm
                      </span>
                    </div>
                  }
                />
                <DetailRow
                  icon={<User className="w-4 h-4 text-amber-600" />}
                  label="Người bị tố"
                  value={report.targetUserName || '—'}
                />
                <DetailRow
                  icon={<TrendingUp className="w-4 h-4 text-amber-600" />}
                  label="Mức độ xác nhận"
                  value={`${report.voteCount || 0}/${report.threshold || 5} người`}
                />
                {report.description && (
                  <div className="pt-2 mt-2 border-t border-amber-200">
                    <div className="text-xs text-amber-700 mb-1">Mô tả</div>
                    <div className="text-sm text-amber-900 leading-relaxed">
                      {report.description}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ghi chú GVCN nếu đã xử lý */}
          {isProcessed && appeal.gvcnNote && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">
                Ghi chú quyết định
              </h4>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap">
                {appeal.gvcnNote}
              </div>
            </div>
          )}

          {/* Note input */}
          {!isProcessed && (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Ghi chú quyết định (bắt buộc nếu từ chối)
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Nhập lý do chấp nhận / từ chối kháng nghị..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm resize-none"
              />
              <div className="text-xs text-gray-400 text-right mt-1">
                {note.length}/500
              </div>
            </div>
          )}

          {/* Info về hệ quả khi chấp nhận */}
          {!isProcessed && report && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
              <RotateCcw className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-green-900 leading-relaxed">
                <div className="font-semibold mb-1">Nếu chấp nhận kháng nghị:</div>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Tố cáo gốc sẽ <strong>bị bác bỏ</strong></li>
                  <li>Hoàn lại <strong>+{restorePoints} điểm</strong> cho {report.targetUserName}</li>
                  <li>Người tố cáo sẽ không bị ảnh hưởng uy tín</li>
                </ul>
              </div>
            </div>
          )}

          {/* Warning nếu từ chối */}
          {!isProcessed && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <strong>Lưu ý:</strong> Nếu <strong>từ chối</strong>, tố cáo gốc vẫn giữ trạng thái "Đã xác nhận".
                Học sinh không được hoàn điểm.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isProcessed ? (
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0 flex-wrap">
            <button
              onClick={onClose}
              disabled={processing}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
            >
              Đóng
            </button>
            <button
              onClick={wrapAction(onReject)}
              disabled={processing || note.trim().length < 10}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg disabled:opacity-50"
              title={note.trim().length < 10 ? 'Cần nhập lý do ≥10 ký tự' : ''}
            >
              <XCircle className="w-4 h-4" />
              Từ chối
            </button>
            <button
              onClick={wrapAction(onAccept)}
              disabled={processing}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 rounded-lg disabled:opacity-50"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Chấp nhận + hoàn điểm
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 mb-0.5">{label}</div>
        <div className="text-sm text-gray-900">{value}</div>
      </div>
    </div>
  );
}