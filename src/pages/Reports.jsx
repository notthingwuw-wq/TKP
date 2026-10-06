// src/pages/Reports.jsx
// Danh sách tố cáo — 3 tab + nút "Không quan tâm"
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection, query, where, getDocs, doc, runTransaction,
  serverTimestamp, arrayUnion
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { markReportsSeen } from '../hooks/useReportsBadge';
import {
  Plus, AlertTriangle, Calendar, Users, ExternalLink,
  ChevronRight, MessageSquare, CheckCircle2, XCircle, Clock,
  HelpCircle, Loader2, Send, ShieldAlert, Vote, EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';

// ===== Status meta =====
const STATUS_META = {
  pending:   { label: 'Chờ xác nhận',   cls: 'bg-gray-50 text-gray-700 border-gray-200',   Icon: Clock },
  verified:  { label: 'Chờ GVCN xử lý', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock },
  confirmed: { label: 'Đã xác nhận',    cls: 'bg-red-50 text-red-700 border-red-200',       Icon: AlertTriangle },
  rejected:  { label: 'Đã bác bỏ',      cls: 'bg-green-50 text-green-700 border-green-200', Icon: CheckCircle2 },
  need_info: { label: 'Cần thêm TT',    cls: 'bg-blue-50 text-blue-700 border-blue-200',    Icon: HelpCircle },
  expired:   { label: 'Hết hạn',        cls: 'bg-gray-50 text-gray-500 border-gray-200',    Icon: XCircle }
};

// ===== Local storage cho "đã bỏ qua" =====
const DISMISSED_KEY = 'dismissedReports';

function getDismissed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function addDismissed(reportId) {
  try {
    const set = getDismissed();
    set.add(reportId);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
  } catch (err) {
    console.warn('addDismissed error:', err);
  }
}

export default function Reports() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState('vote'); // 'vote' | 'mine' | 'against'
  const [myReports, setMyReports] = useState([]);
  const [againstMe, setAgainstMe] = useState([]);
  const [toVote, setToVote] = useState([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState(null);

  // ===== Load data =====
  const loadData = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const [mineSnap, againstSnap, pendingSnap] = await Promise.all([
        getDocs(query(collection(db, 'reports'), where('reporterId', '==', profile.id))),
        getDocs(query(collection(db, 'reports'), where('targetUserId', '==', profile.id))),
        getDocs(query(collection(db, 'reports'), where('status', '==', 'pending')))
      ]);

      const sortByCreated = (a, b) =>
        (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);

      setMyReports(
        mineSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort(sortByCreated)
      );
      setAgainstMe(
        againstSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort(sortByCreated)
      );

      // Filter pending cho tab vote
      const dismissed = getDismissed();
      const voteList = pendingSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(r =>
          r.reporterId !== profile.id &&
          r.targetUserId !== profile.id &&
          !(r.voterIds || []).includes(profile.id) &&
          !dismissed.has(r.id)                // ← Bỏ qua report đã dismiss
        )
        .sort(sortByCreated);
      setToVote(voteList);
    } catch (err) {
      console.error('Reports load error:', err);
      toast.error('Không tải được danh sách');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile?.id]);

  // Auto mark seen → xóa badge
  useEffect(() => {
    const all = [...myReports, ...againstMe];
    if (all.length === 0) return;
    markReportsSeen(all.map(r => r.id));
  }, [myReports, againstMe]);

  // ===== Vote (FIX transaction) =====
  const handleVote = async (report) => {
    if (!profile?.id || votingId) return;
    setVotingId(report.id);

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, 'reports', report.id);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Tố cáo không tồn tại');

        const data = snap.data();
        const voterIds = data.voterIds || [];

        if (voterIds.includes(profile.id)) {
          throw new Error('Bạn đã xác nhận tố cáo này rồi');
        }
        if (data.status !== 'pending') {
          throw new Error('Tố cáo này đã được xử lý');
        }

        const newCount = voterIds.length + 1;
        const threshold = data.threshold || 5;
        const isVerified = newCount >= threshold;

        // ⚡ FIX: chỉ build object với các field được phép update
        const updateData = {
          voterIds: arrayUnion(profile.id),
          voteCount: newCount,
          status: isVerified ? 'verified' : 'pending',
          updatedAt: serverTimestamp()
        };

        // Chỉ thêm verifiedAt khi lần đầu tiên đạt ngưỡng
        if (isVerified && !data.verifiedAt) {
          updateData.verifiedAt = serverTimestamp();
        }

        tx.update(ref, updateData);
      });

      toast.success('Đã xác nhận tố cáo');
      setToVote(prev => prev.filter(r => r.id !== report.id));
      window.dispatchEvent(new Event('student-todos-refresh'));
      window.dispatchEvent(new Event('reports-badge-refresh'));
      window.dispatchEvent(new Event('refresh-home'));
    } catch (err) {
      console.error('Vote error:', err);
      toast.error(err.message || 'Lỗi xác nhận');
    } finally {
      setVotingId(null);
    }
  };

  // ===== Bỏ qua tố cáo (không quan tâm) =====
  const handleDismiss = (report) => {
    if (!confirm('Bỏ qua tố cáo này?\n\nBạn sẽ không thấy nó trong danh sách cần xác nhận nữa.')) return;

    addDismissed(report.id);
    setToVote(prev => prev.filter(r => r.id !== report.id));
    toast.success('Đã bỏ qua tố cáo');
    // Cập nhật badge Home
    window.dispatchEvent(new Event('student-todos-refresh'));
    window.dispatchEvent(new Event('reports-badge-refresh'));
    window.dispatchEvent(new Event('refresh-home'));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
      </div>
    );
  }

  const currentList =
    tab === 'mine' ? myReports :
    tab === 'against' ? againstMe :
    toVote;

  const TABS = [
    { key: 'vote',    label: 'Cần xác nhận', Icon: Vote,          count: toVote.length,   highlight: true },
    { key: 'mine',    label: 'Tôi gửi',      Icon: Send,          count: myReports.length },
    { key: 'against', label: 'Nhắm vào tôi', Icon: ShieldAlert,   count: againstMe.length }
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tố cáo</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Quản lý tố cáo vi phạm nội quy lớp
          </p>
        </div>
        <Link
          to="/reports/new"
          className="inline-flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-3.5 py-2 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Tạo tố cáo
        </Link>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-xl p-1 flex gap-1">
        {TABS.map(t => {
          const Icon = t.Icon;
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-500 text-white shadow-sm'
                  : t.highlight && t.count > 0
                  ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.label.split(' ')[0]}</span>
              {t.count > 0 && (
                <span className={`text-xs rounded-full px-1.5 min-w-[18px] h-[18px] inline-flex items-center justify-center font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : t.highlight
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {t.count > 9 ? '9+' : t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {currentList.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div className="space-y-2.5">
          {currentList.map(r => (
            <ReportCard
              key={r.id}
              report={r}
              mode={tab}
              voting={votingId === r.id}
              onAppeal={() => nav(`/appeals/new?reportId=${r.id}`)}
              onVote={() => handleVote(r)}
              onDismiss={() => handleDismiss(r)}
            />
          ))}
        </div>
      )}

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 leading-relaxed">
          <div className="font-semibold mb-1">Lưu ý về tố cáo</div>
          <ul className="space-y-1 list-disc list-inside">
            <li>Cần tối thiểu <strong>5 người xác nhận</strong> để tố cáo được xem xét</li>
            <li>Danh tính người tố cáo được bảo mật tuyệt đối</li>
            <li>Tố cáo sai có thể ảnh hưởng uy tín tài khoản</li>
            <li>Không biết rõ sự việc? Bấm <strong>"Không quan tâm"</strong> để bỏ qua</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ============ SUB COMPONENTS ============

function EmptyState({ tab }) {
  const config = {
    mine: {
      title: 'Bạn chưa gửi tố cáo nào',
      desc: 'Khi thấy bạn bè vi phạm nội quy, bạn có thể tạo tố cáo tại đây',
      showCreate: true
    },
    against: {
      title: 'Không có tố cáo nào nhắm vào bạn',
      desc: 'Yên tâm nhé — không ai đang tố cáo bạn cả',
      showCreate: false
    },
    vote: {
      title: 'Bạn đã xác nhận hết rồi!',
      desc: 'Quay lại sau để xem tố cáo mới',
      showCreate: false
    }
  }[tab];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
      <div className="w-16 h-16 rounded-full bg-green-50 mx-auto mb-3 flex items-center justify-center">
        {tab === 'vote' ? (
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        ) : (
          <AlertTriangle className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
        )}
      </div>
      <p className="font-semibold text-gray-900 text-sm">{config.title}</p>
      <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">{config.desc}</p>
      {config.showCreate && (
        <Link
          to="/reports/new"
          className="inline-flex items-center gap-1.5 mt-4 text-brand-600 hover:text-brand-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Tạo tố cáo đầu tiên
        </Link>
      )}
    </div>
  );
}

function ReportCard({ report, mode, voting, onAppeal, onVote, onDismiss }) {
  const meta = STATUS_META[report.status] || STATUS_META.pending;
  const StatusIcon = meta.Icon;
  const threshold = report.threshold || 5;
  const progress = Math.min(100, ((report.voteCount || 0) / threshold) * 100);

  const isAgainstMe = mode === 'against';
  const isVoteMode = mode === 'vote';

  const canAppeal =
    isAgainstMe &&
    (report.status === 'verified' || report.status === 'confirmed') &&
    !report.appealSubmittedAt;

  const isConfirmed = report.status === 'confirmed';
  const isRejected = report.status === 'rejected';

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-colors ${
      isVoteMode ? 'border-amber-200 bg-amber-50/30' :
      isConfirmed ? 'border-red-200' :
      isRejected ? 'border-green-200' :
      'border-gray-200'
    }`}>
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${meta.cls}`}>
                <StatusIcon className="w-3 h-3" />
                {meta.label}
              </span>
              {report.verifiedAt && (
                <span className="text-xs text-gray-400">
                  {report.verifiedAt?.toDate?.().toLocaleDateString('vi-VN')}
                </span>
              )}
            </div>

            <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              {report.violationName || 'Vi phạm'}
            </div>
          </div>
        </div>

        {/* Description */}
        {report.description && (
          <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
            {report.description}
          </p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
          {(isAgainstMe || isVoteMode) ? (
            <span className="inline-flex items-center gap-1">
              <Users className="w-3 h-3" />
              {report.voteCount || 0}/{threshold} người xác nhận
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Users className="w-3 h-3" />
              {report.targetUserName || 'Học sinh'}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {report.createdAt?.toDate?.().toLocaleString('vi-VN', {
              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            }) || '—'}
          </span>
        </div>

        {/* Progress */}
        {report.status === 'pending' && (
          <div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isVoteMode ? 'bg-amber-500' : 'bg-brand-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Cần thêm {Math.max(0, threshold - (report.voteCount || 0))} người xác nhận nữa
            </p>
          </div>
        )}

        {/* Evidence */}
        {report.evidenceUrls?.length > 0 && (
          <a
            href={report.evidenceUrls[0]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Xem bằng chứng
          </a>
        )}

        {/* GVCN note */}
        {report.gvcnDecision?.note && (isConfirmed || isRejected) && (
          <div className={`rounded-lg p-3 text-xs ${
            isConfirmed ? 'bg-red-50 border border-red-200' :
            'bg-green-50 border border-green-200'
          }`}>
            <div className={`font-medium mb-1 ${
              isConfirmed ? 'text-red-900' : 'text-green-900'
            }`}>
              Ghi chú của GVCN
            </div>
            <div className={`leading-relaxed ${
              isConfirmed ? 'text-red-800' : 'text-green-800'
            }`}>
              {report.gvcnDecision.note}
            </div>
          </div>
        )}

        {/* Appeal submitted notice */}
        {isAgainstMe && report.appealSubmittedAt && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Bạn đã gửi kháng nghị. Vui lòng chờ GVCN xem xét.</span>
          </div>
        )}

        {/* Actions */}
        {canAppeal && (
          <button
            onClick={onAppeal}
            className="w-full inline-flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Gửi kháng nghị
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Vote mode: 2 nút */}
        {isVoteMode && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onDismiss}
              disabled={voting}
              className="inline-flex items-center justify-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
              title="Không biết / không liên quan → bỏ qua"
            >
              <EyeOff className="w-4 h-4" />
              Không quan tâm
            </button>
            <button
              onClick={onVote}
              disabled={voting}
              className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
            >
              {voting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Xác nhận
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}