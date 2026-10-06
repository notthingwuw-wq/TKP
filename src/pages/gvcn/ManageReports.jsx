// src/pages/gvcn/ManageReports.jsx
// Xử lý tố cáo — 5 tabs: Chờ vote / Chờ xử lý / Đã xác nhận / Đã bác bỏ / Tất cả
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  collection, query, where, getDocs, doc, getDoc,
  writeBatch, addDoc, serverTimestamp, updateDoc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  AlertTriangle, X, CheckCircle2, XCircle,
  HelpCircle, User, Calendar, MessageSquare, FileText,
  ExternalLink, Users, ChevronRight, Loader2, Clock,
  ShieldAlert, TrendingUp, Vote
} from 'lucide-react';
import toast from 'react-hot-toast';

// ===== Status meta =====
const STATUS_META = {
  pending:   { label: 'Chờ vote',       cls: 'bg-gray-50 text-gray-700 border-gray-200' },
  verified:  { label: 'Chờ GVCN xử lý', cls: 'bg-amber-50 text-amber-700 border-amber-200', urgent: true },
  confirmed: { label: 'Đã xác nhận',    cls: 'bg-red-50 text-red-700 border-red-200' },
  rejected:  { label: 'Đã bác bỏ',      cls: 'bg-green-50 text-green-700 border-green-200' },
  need_info: { label: 'Cần thêm TT',    cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  expired:   { label: 'Hết hạn',        cls: 'bg-gray-50 text-gray-500 border-gray-200' }
};

// ===== 5 tabs =====
const TABS = [
  { key: 'verified',  label: 'Chờ xử lý',   Icon: Clock },
  { key: 'pending',   label: 'Chờ vote',    Icon: Vote },
  { key: 'confirmed', label: 'Đã xác nhận', Icon: AlertTriangle },
  { key: 'rejected',  label: 'Đã bác bỏ',   Icon: CheckCircle2 },
  { key: 'all',       label: 'Tất cả',      Icon: FileText }
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

// ===== Trigger refresh badges toàn app =====
function triggerRefresh() {
  window.dispatchEvent(new Event('gvcn-badge-refresh'));
  window.dispatchEvent(new Event('student-todos-refresh'));
  window.dispatchEvent(new Event('reports-badge-refresh'));
  window.dispatchEvent(new Event('refresh-home'));
}

export default function ManageReports() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('verified');
  const [selectedReport, setSelectedReport] = useState(null);
  const [stats, setStats] = useState({
    pending: 0, verified: 0, confirmed: 0, rejected: 0, all: 0
  });

  // ===== Load data =====
  const loadReports = async () => {
    if (!profile?.classId) return;
    setLoading(true);
    try {
      const classId = profile.classId;

      const snap = await getDocs(collection(db, 'reports'));
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(r => {
          if (r.classId) return r.classId === classId;
          if (r.targetTeamId) return r.targetTeamId.startsWith(classId);
          return false;
        })
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      setReports(list);

      const newStats = {
        pending: 0, verified: 0, confirmed: 0, rejected: 0, all: list.length
      };
      list.forEach(r => {
        if (r.status === 'pending') newStats.pending++;
        else if (r.status === 'verified') newStats.verified++;
        else if (r.status === 'confirmed') newStats.confirmed++;
        else if (r.status === 'rejected') newStats.rejected++;
      });
      setStats(newStats);

      // Auto-open từ URL ?id=
      const idFromUrl = searchParams.get('id');
      if (idFromUrl) {
        const found = list.find(r => r.id === idFromUrl);
        if (found) setSelectedReport(found);
      }
    } catch (err) {
      console.error('Load reports error:', err);
      toast.error('Không tải được danh sách tố cáo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [profile?.classId]);

  // ===== Filter =====
  const filtered = useMemo(() => {
    if (activeTab === 'all') return reports;
    return reports.filter(r => r.status === activeTab);
  }, [reports, activeTab]);

  // ===== Confirm =====
  const handleConfirm = async (report, note) => {
    if (!confirm(
      `Xác nhận vi phạm của ${report.targetUserName}?\n\n` +
      `Học sinh sẽ bị trừ điểm theo quy định.`
    )) return;

    try {
      const batch = writeBatch(db);
      const violationPoints = getViolationPoints(report.violationCode);

      batch.update(doc(db, 'reports', report.id), {
        status: 'confirmed',
        gvcnDecision: {
          decision: 'confirmed',
          note: note || '',
          reviewedBy: profile.id,
          reviewedByName: profile.name,
          reviewedAt: serverTimestamp()
        },
        updatedAt: serverTimestamp()
      });

      const ledgerRef = doc(collection(db, 'score_ledger'));
      batch.set(ledgerRef, {
        userId: report.targetUserId,
        teamId: report.targetTeamId,
        points: violationPoints,
        activityCode: report.violationCode,
        activityName: `Vi phạm: ${report.violationName}`,
        sourceType: 'report',
        sourceId: report.id,
        description: report.description || '',
        createdAt: serverTimestamp()
      });

      await batch.commit();

      // Notifications
      await addDoc(collection(db, 'notifications'), {
        userId: report.targetUserId,
        type: 'report_confirmed',
        title: 'Tố cáo đã được xác nhận',
        body: `Bạn bị xác nhận vi phạm "${report.violationName}". Điểm bị trừ: ${violationPoints}. Bạn có thể gửi kháng nghị.`,
        relatedId: report.id,
        relatedType: 'report',
        read: false,
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, 'notifications'), {
        userId: report.reporterId,
        type: 'report_processed',
        title: 'Tố cáo đã được xử lý',
        body: `Tố cáo của bạn về "${report.violationName}" đã được xác nhận.`,
        relatedId: report.id,
        relatedType: 'report',
        read: false,
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, 'audit_logs'), {
        actorId: profile.id,
        actorName: profile.name,
        action: 'confirm_report',
        targetType: 'report',
        targetId: report.id,
        before: { status: 'verified' },
        after: { status: 'confirmed', points: violationPoints },
        createdAt: serverTimestamp()
      });

      toast.success('Đã xác nhận vi phạm');
      setSelectedReport(null);
      setSearchParams({});
      await loadReports();
      triggerRefresh();
    } catch (err) {
      console.error('Confirm error:', err);
      toast.error('Lỗi xử lý: ' + err.message);
    }
  };

  // ===== Reject =====
  const handleReject = async (report, note) => {
    if (!confirm(
      `Bác bỏ tố cáo về ${report.targetUserName}?\n\n` +
      `Người bị tố sẽ không bị trừ điểm. Người tố cáo sẽ bị ghi nhận 1 lần tố sai.`
    )) return;

    try {
      const batch = writeBatch(db);

      batch.update(doc(db, 'reports', report.id), {
        status: 'rejected',
        gvcnDecision: {
          decision: 'rejected',
          note: note || '',
          reviewedBy: profile.id,
          reviewedByName: profile.name,
          reviewedAt: serverTimestamp()
        },
        updatedAt: serverTimestamp()
      });

      const reporterRef = doc(db, 'users', report.reporterId);
      const reporterSnap = await getDoc(reporterRef);
      if (reporterSnap.exists()) {
        batch.update(reporterRef, {
          falseReportCount: (reporterSnap.data().falseReportCount || 0) + 1
        });
      }

      await batch.commit();

      await addDoc(collection(db, 'notifications'), {
        userId: report.targetUserId,
        type: 'report_rejected',
        title: 'Tố cáo đã bị bác bỏ',
        body: `Tố cáo về "${report.violationName}" đã được bác bỏ. Bạn không bị trừ điểm.`,
        relatedId: report.id,
        relatedType: 'report',
        read: false,
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, 'notifications'), {
        userId: report.reporterId,
        type: 'report_processed',
        title: 'Tố cáo đã bị bác bỏ',
        body: `Tố cáo của bạn về "${report.violationName}" không đủ căn cứ.`,
        relatedId: report.id,
        relatedType: 'report',
        read: false,
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, 'audit_logs'), {
        actorId: profile.id,
        actorName: profile.name,
        action: 'reject_report',
        targetType: 'report',
        targetId: report.id,
        before: { status: 'verified' },
        after: { status: 'rejected' },
        createdAt: serverTimestamp()
      });

      toast.success('Đã bác bỏ tố cáo');
      setSelectedReport(null);
      setSearchParams({});
      await loadReports();
      triggerRefresh();
    } catch (err) {
      console.error('Reject error:', err);
      toast.error('Lỗi xử lý: ' + err.message);
    }
  };

  // ===== Need Info =====
  const handleNeedInfo = async (report, note) => {
    if (!note || note.trim().length < 10) {
      toast.error('Vui lòng nhập lý do cần thêm thông tin (≥10 ký tự)');
      return;
    }

    try {
      await updateDoc(doc(db, 'reports', report.id), {
        status: 'need_info',
        gvcnDecision: {
          decision: 'need_info',
          note,
          reviewedBy: profile.id,
          reviewedByName: profile.name,
          reviewedAt: serverTimestamp()
        },
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'notifications'), {
        userId: report.reporterId,
        type: 'report_need_info',
        title: 'Cần bổ sung thông tin',
        body: `GVCN yêu cầu bổ sung thông tin cho tố cáo "${report.violationName}": ${note}`,
        relatedId: report.id,
        relatedType: 'report',
        read: false,
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, 'audit_logs'), {
        actorId: profile.id,
        actorName: profile.name,
        action: 'need_info_report',
        targetType: 'report',
        targetId: report.id,
        after: { status: 'need_info', note },
        createdAt: serverTimestamp()
      });

      toast.success('Đã gửi yêu cầu bổ sung');
      setSelectedReport(null);
      setSearchParams({});
      await loadReports();
      triggerRefresh();
    } catch (err) {
      console.error('NeedInfo error:', err);
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
        <h1 className="text-2xl font-bold text-gray-900">Xử lý tố cáo</h1>
        <p className="text-gray-600 text-sm mt-1">
          Danh sách tố cáo của lớp {profile?.classId}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            {stats.verified > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            )}
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{stats.verified}</div>
          <div className="text-xs text-gray-500 mt-0.5">Chờ GVCN xử lý</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center">
            <Vote className="w-4 h-4 text-gray-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{stats.pending}</div>
          <div className="text-xs text-gray-500 mt-0.5">Chờ vote</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{stats.confirmed}</div>
          <div className="text-xs text-gray-500 mt-0.5">Đã xác nhận</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{stats.rejected}</div>
          <div className="text-xs text-gray-500 mt-0.5">Đã bác bỏ</div>
        </div>
      </div>

      {/* Tabs — 5 tabs */}
      <div className="bg-white border border-gray-200 rounded-xl p-1 flex gap-1 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.Icon;
          const count = stats[t.key] ?? 0;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 min-w-fit inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-brand-500 text-white shadow-sm'
                  : t.key === 'verified' && count > 0
                  ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.label.split(' ').slice(-1)[0]}</span>
              {count > 0 && (
                <span className={`text-xs rounded-full px-1.5 min-w-[18px] h-[18px] inline-flex items-center justify-center font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : t.key === 'verified'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {count > 9 ? '9+' : count}
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
            {activeTab === 'verified'
              ? 'Không có tố cáo nào cần xử lý!'
              : 'Không có tố cáo nào'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {activeTab === 'verified'
              ? 'Tất cả tố cáo đã được xử lý'
              : 'Chưa có tố cáo ở mục này'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(r => (
            <ReportCard
              key={r.id}
              report={r}
              onClick={() => {
                setSelectedReport(r);
                setSearchParams({ id: r.id });
              }}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => {
            setSelectedReport(null);
            setSearchParams({});
          }}
          onConfirm={handleConfirm}
          onReject={handleReject}
          onNeedInfo={handleNeedInfo}
        />
      )}
    </div>
  );
}

// ============ SUB COMPONENTS ============

function ReportCard({ report, onClick }) {
  const meta = STATUS_META[report.status] || STATUS_META.pending;
  const teamNum = report.targetTeamId?.match(/-team(\d+)$/)?.[1] || '?';
  const hoursAgo = Math.floor(
    (Date.now() - (report.verifiedAt?.seconds * 1000 || report.createdAt?.seconds * 1000 || 0)) / 3600000
  );

  const isPending = report.status === 'pending';
  const isVerified = report.status === 'verified';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white border rounded-xl p-4 hover:border-brand-400 hover:shadow-sm transition-all group ${
        isVerified ? 'border-amber-200' :
        report.status === 'confirmed' ? 'border-red-200' :
        report.status === 'rejected' ? 'border-green-200' :
        'border-gray-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isVerified ? 'bg-amber-50' :
          report.status === 'confirmed' ? 'bg-red-50' :
          report.status === 'rejected' ? 'bg-green-50' :
          'bg-gray-50'
        }`}>
          <AlertTriangle className={`w-5 h-5 ${
            isVerified ? 'text-amber-600' :
            report.status === 'confirmed' ? 'text-red-600' :
            report.status === 'rejected' ? 'text-green-600' :
            'text-gray-500'
          }`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium ${meta.cls}`}>
              {meta.label}
            </span>
            {isVerified && hoursAgo > 24 && (
              <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                <Clock className="w-3 h-3" />
                Quá hạn {hoursAgo}h
              </span>
            )}
          </div>

          <div className="font-semibold text-gray-900 text-sm">
            {report.violationName}
          </div>

          <div className="text-xs text-gray-500 mt-1 line-clamp-2">
            {report.description || '(Không có mô tả)'}
          </div>

          {/* Progress bar cho pending */}
          {isPending && (
            <div className="mt-2">
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-400 transition-all"
                  style={{ width: `${Math.min(100, ((report.voteCount || 0) / (report.threshold || 5)) * 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <User className="w-3 h-3" />
              {report.targetUserName} · Tổ {teamNum}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="w-3 h-3" />
              {report.voteCount || 0}/{report.threshold || 5}
            </span>
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-2" />
      </div>
    </button>
  );
}

function ReportDetailModal({ report, onClose, onConfirm, onReject, onNeedInfo }) {
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [appeal, setAppeal] = useState(null);
  const [loadingAppeal, setLoadingAppeal] = useState(true);
  const teamNum = report.targetTeamId?.match(/-team(\d+)$/)?.[1] || '?';
  const violationPoints = getViolationPoints(report.violationCode);

  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(db, 'appeals'), where('reportId', '==', report.id));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setAppeal({ id: snap.docs[0].id, ...snap.docs[0].data() });
        }
      } catch (err) {
        console.error('Load appeal error:', err);
      } finally {
        setLoadingAppeal(false);
      }
    })();
  }, [report.id]);

  const isProcessed = ['confirmed', 'rejected', 'need_info'].includes(report.status);
  const canProcess = report.status === 'verified';

  const wrapAction = (fn) => async () => {
    if (processing) return;
    setProcessing(true);
    try {
      await fn(report, note);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-bold text-gray-900">Chi tiết tố cáo</h3>
            <p className="text-xs text-gray-500 mt-0.5">Mã: #{report.id.slice(0, 8)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <div className={`rounded-xl p-4 border ${STATUS_META[report.status]?.cls || ''}`}>
            <div className="font-semibold text-sm">{STATUS_META[report.status]?.label}</div>
            {isProcessed && report.gvcnDecision && (
              <div className="text-xs mt-1 opacity-90">
                Xử lý bởi: {report.gvcnDecision.reviewedByName || 'GVCN'}
                {' · '}
                {report.gvcnDecision.reviewedAt?.toDate?.().toLocaleString('vi-VN') || '—'}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-500" />
              Thông tin tố cáo
            </h4>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <DetailRow
                icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
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
                icon={<User className="w-4 h-4 text-blue-500" />}
                label="Người bị tố cáo"
                value={`${report.targetUserName} · Lớp ${report.classId || '?'} · Tổ ${teamNum}`}
              />
              <DetailRow
                icon={<Calendar className="w-4 h-4 text-gray-500" />}
                label="Thời gian tạo"
                value={report.createdAt?.toDate?.().toLocaleString('vi-VN') || '—'}
              />
              {report.description && (
                <div className="pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-500 mb-1.5">Mô tả chi tiết</div>
                  <div className="text-sm text-gray-900 leading-relaxed bg-white rounded-lg p-3 border border-gray-200">
                    {report.description}
                  </div>
                </div>
              )}
              {report.evidenceUrls?.length > 0 && (
                <div className="pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-500 mb-1.5">Bằng chứng</div>
                  <div className="space-y-1.5">
                    {report.evidenceUrls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 hover:underline bg-white rounded-lg px-3 py-2 border border-gray-200 w-full"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="truncate">{url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Mức độ xác nhận
            </h4>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">
                  {report.voteCount || 0} / {report.threshold || 5} xác nhận
                </span>
                {report.voteCount >= (report.threshold || 5) && (
                  <span className="text-xs text-green-600 font-medium">✓ Đã đạt ngưỡng</span>
                )}
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${Math.min(100, ((report.voteCount || 0) / (report.threshold || 5)) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Cần tối thiểu {report.threshold || 5} người xác nhận độc lập
              </p>
            </div>
          </div>

          {!loadingAppeal && appeal && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                Kháng nghị của người bị tố
              </h4>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="text-xs text-blue-700 flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Gửi lúc: {appeal.createdAt?.toDate?.().toLocaleString('vi-VN') || '—'}
                </div>
                <div className="text-sm text-blue-900 leading-relaxed whitespace-pre-wrap">
                  {appeal.content}
                </div>
                {appeal.evidenceUrls?.length > 0 && (
                  <div className="pt-3 border-t border-blue-200">
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
          )}

          {isProcessed && report.gvcnDecision?.note && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Ghi chú của GVCN</h4>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap">
                {report.gvcnDecision.note}
              </div>
            </div>
          )}

          {canProcess && (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Ghi chú quyết định (bắt buộc nếu "Cần thêm TT")
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Nhập lý do hoặc ghi chú..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm resize-none"
              />
              <div className="text-xs text-gray-400 text-right mt-1">{note.length}/500</div>
            </div>
          )}

          {canProcess && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <strong>Lưu ý:</strong> Quyết định sẽ ảnh hưởng trực tiếp đến điểm của học sinh và được lưu vào lịch sử.
              </div>
            </div>
          )}

          {report.status === 'pending' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
              <Vote className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900 leading-relaxed">
                Tố cáo chưa đủ <strong>{report.threshold || 5} người xác nhận</strong>.
                Hiện có {report.voteCount || 0} vote. GVCN có thể theo dõi nhưng chỉ xử lý khi đã đủ vote.
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0 flex-wrap">
          <button
            onClick={onClose}
            disabled={processing}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
          >
            Đóng
          </button>

          {canProcess && (
            <>
              <button
                onClick={wrapAction(onNeedInfo)}
                disabled={processing || note.trim().length < 10}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg disabled:opacity-50"
                title={note.trim().length < 10 ? 'Cần nhập lý do ≥10 ký tự' : ''}
              >
                <HelpCircle className="w-4 h-4" />
                Cần thêm TT
              </button>
              <button
                onClick={wrapAction(onReject)}
                disabled={processing}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Bác bỏ
              </button>
              <button
                onClick={wrapAction(onConfirm)}
                disabled={processing}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50"
              >
                {processing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Đang xử lý...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Xác nhận vi phạm</>
                )}
              </button>
            </>
          )}
        </div>
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