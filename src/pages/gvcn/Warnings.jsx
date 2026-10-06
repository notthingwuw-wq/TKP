// src/pages/gvcn/Warnings.jsx
// Cảnh báo bất thường — pattern vote, mutual report, v.v.
import { useEffect, useState, useMemo } from 'react';
import {
  collection, getDocs, doc, updateDoc, addDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ShieldAlert, AlertTriangle, Users, Clock, CheckCircle2,
  XCircle, Eye, Loader2, TrendingUp, UserCog, FileText,
  ChevronRight, X, Info, Activity, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';

// ===== Level meta =====
const LEVEL_META = {
  LOW:    { label: 'Thấp',   cls: 'bg-blue-50 text-blue-700 border-blue-200',       dot: 'bg-blue-500' },
  MEDIUM: { label: 'Trung bình', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  HIGH:   { label: 'Cao',    cls: 'bg-red-50 text-red-700 border-red-200',          dot: 'bg-red-500' }
};

// ===== Type meta =====
const TYPE_META = {
  vote_pattern:    { label: 'Pattern vote',        Icon: Activity,    desc: 'Nhóm vote qua lại bất thường' },
  mutual_report:   { label: 'Tố cáo chéo',         Icon: AlertTriangle, desc: 'A tố B, B tố A cùng lúc' },
  rapid_vote:      { label: 'Vote nhanh',          Icon: Zap,         desc: 'Nhiều vote trong thời gian ngắn' },
  device_duplicate:{ label: 'Trùng thiết bị',      Icon: Users,       desc: 'Nhiều tài khoản cùng thiết bị' }
};

const TABS = [
  { key: 'new',      label: 'Mới' },
  { key: 'reviewed', label: 'Đã xem' },
  { key: 'dismissed', label: 'Đã bỏ qua' },
  { key: 'all',      label: 'Tất cả' }
];

export default function Warnings() {
  const { profile } = useAuth();
  const [warnings, setWarnings] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('new');
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState({ new: 0, reviewed: 0, dismissed: 0, all: 0 });

  // ===== Load =====
  const loadWarnings = async () => {
    setLoading(true);
    try {
      // Load warnings + users song song
      const [warningsSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, 'warnings')),
        getDocs(collection(db, 'users'))
      ]);

      // Build user map để hiện tên
      const uMap = {};
      usersSnap.docs.forEach(d => {
        const u = d.data();
        uMap[d.id] = {
          name: u.name,
          email: u.email,
          role: u.role,
          classId: u.classId,
          teamId: u.teamId
        };
      });
      setUserMap(uMap);

      // Sort warnings
      const list = warningsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          // HIGH trước, rồi MEDIUM, LOW
          const levelOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
          const la = levelOrder[a.level] || 0;
          const lb = levelOrder[b.level] || 0;
          if (la !== lb) return lb - la;
          return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        });

      setWarnings(list);

      const newStats = { new: 0, reviewed: 0, dismissed: 0, all: list.length };
      list.forEach(w => {
        if (w.status === 'new' || !w.status) newStats.new++;
        else if (w.status === 'reviewed') newStats.reviewed++;
        else if (w.status === 'dismissed') newStats.dismissed++;
      });
      setStats(newStats);
    } catch (err) {
      console.error('Load warnings error:', err);
      toast.error('Không tải được cảnh báo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWarnings();
  }, []);

  // ===== Filter =====
  const filtered = useMemo(() => {
    if (activeTab === 'all') return warnings;
    if (activeTab === 'new') return warnings.filter(w => w.status === 'new' || !w.status);
    return warnings.filter(w => w.status === activeTab);
  }, [warnings, activeTab]);

  // ===== Mark as reviewed =====
  const handleReview = async (warning) => {
    try {
      await updateDoc(doc(db, 'warnings', warning.id), {
        status: 'reviewed',
        reviewedBy: profile.id,
        reviewedByName: profile.name,
        reviewedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'audit_logs'), {
        actorId: profile.id,
        actorName: profile.name,
        action: 'review_warning',
        targetType: 'warning',
        targetId: warning.id,
        after: { status: 'reviewed' },
        createdAt: serverTimestamp()
      });

      toast.success('Đã đánh dấu đã xem');
      setSelected(null);
      await loadWarnings();
      window.dispatchEvent(new Event('gvcn-badge-refresh'));
    } catch (err) {
      console.error(err);
      toast.error('Lỗi xử lý');
    }
  };

  // ===== Dismiss =====
  const handleDismiss = async (warning, reason) => {
    if (!confirm(`Bỏ qua cảnh báo này?\n\nCảnh báo sẽ bị ẩn đi và không cần xử lý nữa.`)) return;

    try {
      await updateDoc(doc(db, 'warnings', warning.id), {
        status: 'dismissed',
        dismissedBy: profile.id,
        dismissedByName: profile.name,
        dismissedAt: serverTimestamp(),
        dismissReason: reason || ''
      });

      await addDoc(collection(db, 'audit_logs'), {
        actorId: profile.id,
        actorName: profile.name,
        action: 'dismiss_warning',
        targetType: 'warning',
        targetId: warning.id,
        after: { status: 'dismissed', reason },
        createdAt: serverTimestamp()
      });

      toast.success('Đã bỏ qua cảnh báo');
      setSelected(null);
      await loadWarnings();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi xử lý');
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
        <h1 className="text-2xl font-bold text-gray-900">Cảnh báo bất thường</h1>
        <p className="text-gray-600 text-sm mt-1">
          Phát hiện pattern vote / tố cáo bất thường của lớp {profile?.classId}
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 leading-relaxed">
          <strong>Cảnh báo không phải kết luận gian lận.</strong> Hệ thống chỉ phát hiện
          <strong> mô hình bất thường</strong> trong dữ liệu vote. Việc đánh giá cuối cùng thuộc về GVCN.
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-red-600" />
            </div>
            {stats.new > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            )}
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{stats.new}</div>
          <div className="text-xs text-gray-500 mt-0.5">Cảnh báo mới</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{stats.reviewed}</div>
          <div className="text-xs text-gray-500 mt-0.5">Đã xem</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center">
            <XCircle className="w-4 h-4 text-gray-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{stats.dismissed}</div>
          <div className="text-xs text-gray-500 mt-0.5">Đã bỏ qua</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <FileText className="w-4 h-4 text-blue-600" />
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
          <p className="font-semibold text-gray-900">Không có cảnh báo nào</p>
          <p className="text-xs text-gray-500 mt-1">
            {activeTab === 'new'
              ? 'Hệ thống chưa phát hiện bất thường nào'
              : 'Chưa có cảnh báo ở mục này'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(w => (
            <WarningCard
              key={w.id}
              warning={w}
              userMap={userMap}
              onClick={() => setSelected(w)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {selected && (
        <WarningDetailModal
          warning={selected}
          userMap={userMap}
          onClose={() => setSelected(null)}
          onReview={handleReview}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  );
}

// ============ SUB COMPONENTS ============

function WarningCard({ warning, userMap, onClick }) {
  const level = LEVEL_META[warning.level] || LEVEL_META.LOW;
  const type = TYPE_META[warning.type] || TYPE_META.vote_pattern;
  const TypeIcon = type.Icon;
  const relatedCount = (warning.relatedUserIds || warning.involvedUserIds || []).length;
  const status = warning.status || 'new';

  const statusBadge = {
    new:       { label: 'Mới',       cls: 'bg-red-50 text-red-700 border-red-200' },
    reviewed:  { label: 'Đã xem',    cls: 'bg-green-50 text-green-700 border-green-200' },
    dismissed: { label: 'Đã bỏ qua', cls: 'bg-gray-50 text-gray-600 border-gray-200' }
  }[status] || { label: 'Mới', cls: 'bg-red-50 text-red-700 border-red-200' };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white border rounded-xl p-4 hover:shadow-sm transition-all group ${
        warning.level === 'HIGH' ? 'border-red-200' :
        warning.level === 'MEDIUM' ? 'border-amber-200' :
        'border-gray-200'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Level indicator */}
        <div className="relative flex-shrink-0">
          <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${
            warning.level === 'HIGH' ? 'bg-red-50' :
            warning.level === 'MEDIUM' ? 'bg-amber-50' :
            'bg-blue-50'
          }`}>
            <TypeIcon className={`w-5 h-5 ${
              warning.level === 'HIGH' ? 'text-red-600' :
              warning.level === 'MEDIUM' ? 'text-amber-600' :
              'text-blue-600'
            }`} />
          </div>
          <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full ${level.dot} border-2 border-white`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium ${level.cls}`}>
              {level.label}
            </span>
            <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium ${statusBadge.cls}`}>
              {statusBadge.label}
            </span>
            <span className="text-xs text-gray-400">
              {type.label}
            </span>
          </div>

          <div className="font-semibold text-gray-900 text-sm">
            {warning.description || type.desc}
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <Users className="w-3 h-3" />
              {relatedCount} người liên quan
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {warning.createdAt?.toDate?.().toLocaleString('vi-VN', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
              }) || '—'}
            </span>
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-2" />
      </div>
    </button>
  );
}

function WarningDetailModal({ warning, userMap, onClose, onReview, onDismiss }) {
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const level = LEVEL_META[warning.level] || LEVEL_META.LOW;
  const type = TYPE_META[warning.type] || TYPE_META.vote_pattern;
  const TypeIcon = type.Icon;
  const isProcessed = warning.status && warning.status !== 'new';
  const relatedIds = warning.relatedUserIds || warning.involvedUserIds || [];
  const pattern = warning.pattern || warning.details || {};

  const wrap = (fn) => async () => {
    if (processing) return;
    setProcessing(true);
    try {
      await fn();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              warning.level === 'HIGH' ? 'bg-red-50' :
              warning.level === 'MEDIUM' ? 'bg-amber-50' :
              'bg-blue-50'
            }`}>
              <TypeIcon className={`w-5 h-5 ${
                warning.level === 'HIGH' ? 'text-red-600' :
                warning.level === 'MEDIUM' ? 'text-amber-600' :
                'text-blue-600'
              }`} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Chi tiết cảnh báo</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Mã: #{warning.id.slice(0, 8)} · {type.label}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Level banner */}
          <div className={`rounded-xl p-4 border ${level.cls}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${level.dot}`} />
              <span className="font-semibold text-sm">Mức độ: {level.label}</span>
            </div>
            <p className="text-xs opacity-90 leading-relaxed">
              {warning.description || type.desc}
            </p>
          </div>

          {/* Thông tin cảnh báo */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-brand-500" />
              Thông tin phát hiện
            </h4>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <DetailRow
                icon={<Activity className="w-4 h-4 text-gray-500" />}
                label="Loại cảnh báo"
                value={`${type.label} — ${type.desc}`}
              />
              <DetailRow
                icon={<Clock className="w-4 h-4 text-gray-500" />}
                label="Thời gian phát hiện"
                value={warning.createdAt?.toDate?.().toLocaleString('vi-VN') || '—'}
              />
              {warning.timeRange && (
                <DetailRow
                  icon={<TrendingUp className="w-4 h-4 text-gray-500" />}
                  label="Khoảng thời gian"
                  value={warning.timeRange}
                />
              )}
            </div>
          </div>

          {/* Chi tiết pattern */}
          {Object.keys(pattern).length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-amber-500" />
                Chi tiết pattern
              </h4>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(pattern).map(([key, value]) => (
                    <div key={key}>
                      <div className="text-xs text-amber-700 mb-0.5">{formatKey(key)}</div>
                      <div className="text-sm font-medium text-amber-900">
                        {typeof value === 'number' && key.includes('confidence')
                          ? `${(value * 100).toFixed(0)}%`
                          : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Người liên quan */}
          {relatedIds.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-blue-500" />
                Người liên quan ({relatedIds.length})
              </h4>
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {relatedIds.map(uid => {
                  const u = userMap[uid];
                  const teamNum = u?.teamId?.match(/-team(\d+)$/)?.[1] || '?';
                  return (
                    <div key={uid} className="px-4 py-2.5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-xs flex-shrink-0">
                        {(u?.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {u?.name || 'Không rõ'}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {u?.email} {u?.teamId && `· Tổ ${teamNum}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lưu ý */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 leading-relaxed">
              <strong>Cảnh báo không phải kết luận gian lận.</strong> Đây là dữ liệu tham khảo
              để GVCN xem xét. Không tự động trừ điểm học sinh.
            </div>
          </div>

          {/* Nếu đã xử lý */}
          {isProcessed && (
            <div className={`rounded-xl p-4 border ${
              warning.status === 'reviewed'
                ? 'bg-green-50 border-green-200'
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="text-xs font-medium mb-1">
                {warning.status === 'reviewed' ? 'Đã đánh dấu xem' : 'Đã bỏ qua'}
              </div>
              <div className="text-xs opacity-80">
                Bởi: {warning.reviewedByName || warning.dismissedByName || 'GVCN'}
                {' · '}
                {(warning.reviewedAt || warning.dismissedAt)?.toDate?.().toLocaleString('vi-VN') || '—'}
              </div>
              {warning.dismissReason && (
                <div className="text-xs mt-2 italic opacity-90">
                  Lý do: {warning.dismissReason}
                </div>
              )}
            </div>
          )}

          {/* Input lý do — chỉ khi chưa xử lý */}
          {!isProcessed && (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Ghi chú (tùy chọn)
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder="Ghi chú về quyết định của bạn..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm resize-none"
              />
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
              onClick={wrap(() => onDismiss(warning, reason))}
              disabled={processing}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Bỏ qua
            </button>
            <button
              onClick={wrap(() => onReview(warning))}
              disabled={processing}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg disabled:opacity-50"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Đánh dấu đã xem
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

function formatKey(key) {
  const map = {
    mutualVoteCount: 'Số vote qua lại',
    timeRange: 'Khoảng thời gian',
    confidence: 'Độ tin cậy',
    voteCount: 'Số vote',
    spanSec: 'Thời gian (giây)',
    targetKey: 'Đối tượng',
    deviceCount: 'Số thiết bị',
    accountCount: 'Số tài khoản'
  };
  return map[key] || key;
}