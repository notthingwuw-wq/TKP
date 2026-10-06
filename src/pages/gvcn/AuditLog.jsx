// src/pages/gvcn/AuditLog.jsx
// Lịch sử thao tác — GVCN xem lại mọi hành động
import { useEffect, useState, useMemo } from 'react';
import {
  collection, getDocs, query, where, orderBy, limit
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  History, Search, Filter, Loader2, CheckCircle2, XCircle,
  AlertTriangle, MessageSquare, FileText, User, ChevronRight,
  X, Activity, Clock, RotateCcw, ShieldAlert, Eye, Zap,
  Upload, Trash2, UserCog, School
} from 'lucide-react';
import toast from 'react-hot-toast';

// ===== Action meta =====
const ACTION_META = {
  confirm_report:     { label: 'Xác nhận tố cáo',    Icon: CheckCircle2,  color: 'text-red-600 bg-red-50' },
  reject_report:      { label: 'Bác bỏ tố cáo',      Icon: XCircle,       color: 'text-green-600 bg-green-50' },
  need_info_report:   { label: 'Yêu cầu bổ sung',    Icon: MessageSquare, color: 'text-blue-600 bg-blue-50' },
  accept_appeal:      { label: 'Chấp nhận kháng nghị', Icon: RotateCcw,   color: 'text-green-600 bg-green-50' },
  reject_appeal:      { label: 'Từ chối kháng nghị', Icon: XCircle,       color: 'text-gray-600 bg-gray-50' },
  review_warning:     { label: 'Đã xem cảnh báo',    Icon: Eye,           color: 'text-blue-600 bg-blue-50' },
  dismiss_warning:    { label: 'Bỏ qua cảnh báo',    Icon: XCircle,       color: 'text-gray-600 bg-gray-50' },
  change_team:        { label: 'Đổi tổ',             Icon: UserCog,       color: 'text-purple-600 bg-purple-50' },
  change_class:       { label: 'Chuyển lớp',         Icon: School,        color: 'text-purple-600 bg-purple-50' },
  delete_user:        { label: 'Xóa người dùng',     Icon: Trash2,        color: 'text-red-600 bg-red-50' },
  create_student:     { label: 'Tạo học sinh',       Icon: User,          color: 'text-green-600 bg-green-50' },
  import_students:    { label: 'Import học sinh',    Icon: Upload,        color: 'text-blue-600 bg-blue-50' },
  import_gvcn:        { label: 'Import GVCN',        Icon: Upload,        color: 'text-blue-600 bg-blue-50' },
  create_class:       { label: 'Tạo lớp',            Icon: School,        color: 'text-blue-600 bg-blue-50' },
  delete_class:       { label: 'Xóa lớp',            Icon: Trash2,        color: 'text-red-600 bg-red-50' },
  create_admin:       { label: 'Tạo admin',          Icon: ShieldAlert,   color: 'text-purple-600 bg-purple-50' },
  create_request:     { label: 'Tạo yêu cầu',        Icon: FileText,      color: 'text-blue-600 bg-blue-50' },
  vote_request:       { label: 'Xác nhận yêu cầu',   Icon: CheckCircle2,  color: 'text-green-600 bg-green-50' },
  vote_report:        { label: 'Xác nhận tố cáo',    Icon: CheckCircle2,  color: 'text-green-600 bg-green-50' },
  create_report:      { label: 'Tạo tố cáo',         Icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
  create_appeal:      { label: 'Gửi kháng nghị',     Icon: MessageSquare, color: 'text-blue-600 bg-blue-50' },
  admin_set_password: { label: 'Đổi mật khẩu',       Icon: UserCog,       color: 'text-purple-600 bg-purple-50' }
};

const DEFAULT_ACTION = { label: 'Hành động', Icon: Activity, color: 'text-gray-600 bg-gray-50' };

const TABS = [
  { key: 'all',           label: 'Tất cả' },
  { key: 'report',        label: 'Tố cáo' },
  { key: 'appeal',        label: 'Kháng nghị' },
  { key: 'warning',       label: 'Cảnh báo' },
  { key: 'user_management', label: 'Quản lý user' }
];

// Group actions thành tab
const ACTION_GROUPS = {
  report: ['confirm_report', 'reject_report', 'need_info_report'],
  appeal: ['accept_appeal', 'reject_appeal'],
  warning: ['review_warning', 'dismiss_warning'],
  user_management: ['change_team', 'change_class', 'delete_user', 'create_student',
                    'import_students', 'import_gvcn', 'create_admin', 'admin_set_password']
};

export default function AuditLog() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  // ===== Load =====
  const loadLogs = async () => {
    if (!profile?.classId) return;
    setLoading(true);
    try {
      // Load audit_logs — không orderBy để tránh index
      const [logsSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, 'audit_logs')),
        getDocs(collection(db, 'users'))
      ]);

      // Build user map
      const uMap = {};
      usersSnap.docs.forEach(d => {
        const u = d.data();
        uMap[d.id] = { name: u.name, email: u.email, role: u.role };
      });
      setUserMap(uMap);

      // Lấy logs liên quan đến lớp này:
      // - Của GVCN hiện tại
      // - Hoặc là action liên quan đến user/report của lớp
      const classUserIdSet = new Set(
        usersSnap.docs
          .filter(d => d.data().classId === profile.classId)
          .map(d => d.id)
      );

      const list = logsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(l => {
          // Log do chính GVCN thực hiện
          if (l.actorId === profile.id) return true;
          // Log liên quan đến user của lớp
          if (l.targetId && classUserIdSet.has(l.targetId)) return true;
          // Log của cùng lớp (nếu có classId)
          if (l.classId === profile.classId) return true;
          return false;
        })
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .slice(0, 500);   // Giới hạn 500 log gần nhất

      setLogs(list);
    } catch (err) {
      console.error('Load audit logs error:', err);
      toast.error('Không tải được lịch sử');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [profile?.classId]);

  // ===== Filter =====
  const filtered = useMemo(() => {
    let list = logs;

    // Filter theo tab
    if (activeTab !== 'all') {
      const actions = ACTION_GROUPS[activeTab] || [];
      list = list.filter(l => actions.includes(l.action));
    }

    // Search
    if (search.trim()) {
      const s = search.toLowerCase().trim();
      list = list.filter(l => {
        const actor = userMap[l.actorId];
        const target = userMap[l.targetId];
        return (
          (l.action || '').toLowerCase().includes(s) ||
          (actor?.name || '').toLowerCase().includes(s) ||
          (target?.name || '').toLowerCase().includes(s) ||
          (l.actorName || '').toLowerCase().includes(s) ||
          (l.targetId || '').toLowerCase().includes(s)
        );
      });
    }

    return list;
  }, [logs, activeTab, search, userMap]);

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lịch sử thao tác</h1>
          <p className="text-gray-600 text-sm mt-1">
            Xem lại mọi hành động trong hệ thống
          </p>
        </div>
        <div className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg">
          <History className="w-3.5 h-3.5 inline mr-1" />
          {logs.length} bản ghi
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên người dùng, hành động..."
            className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === t.key
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-50 mx-auto mb-3 flex items-center justify-center">
            <History className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
          </div>
          <p className="font-semibold text-gray-900">Không có bản ghi nào</p>
          <p className="text-xs text-gray-500 mt-1">
            {search ? 'Thử từ khóa khác' : 'Chưa có hành động nào được ghi lại'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(log => (
            <LogRow
              key={log.id}
              log={log}
              userMap={userMap}
              onClick={() => setSelectedLog(log)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          userMap={userMap}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}

// ============ SUB COMPONENTS ============

function LogRow({ log, userMap, onClick }) {
  const meta = ACTION_META[log.action] || DEFAULT_ACTION;
  const Icon = meta.Icon;
  const actor = userMap[log.actorId];
  const target = userMap[log.targetId];
  const actorName = log.actorName || actor?.name || 'Người dùng';

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-gray-200 rounded-xl p-3.5 hover:border-brand-400 hover:shadow-sm transition-all group flex items-center gap-3"
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 text-sm">
            {meta.label}
          </span>
          {target && (
            <span className="text-xs text-gray-500">
              → {target.name}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
          <span>Bởi: <strong>{actorName}</strong></span>
          <span className="text-gray-300">·</span>
          <span>
            {log.createdAt?.toDate?.().toLocaleString('vi-VN', {
              day: '2-digit', month: '2-digit',
              hour: '2-digit', minute: '2-digit'
            }) || '—'}
          </span>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </button>
  );
}

function LogDetailModal({ log, userMap, onClose }) {
  const meta = ACTION_META[log.action] || DEFAULT_ACTION;
  const Icon = meta.Icon;
  const actor = userMap[log.actorId];
  const target = userMap[log.targetId];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meta.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{meta.label}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Mã: #{log.id.slice(0, 8)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* General info */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <DetailRow
              icon={<User className="w-4 h-4 text-gray-500" />}
              label="Người thực hiện"
              value={log.actorName || actor?.name || log.actorId || '—'}
            />
            {log.targetId && (
              <DetailRow
                icon={<ChevronRight className="w-4 h-4 text-gray-500" />}
                label="Đối tượng"
                value={
                  target?.name
                    ? `${target.name} (${target.email})`
                    : `${log.targetType || 'unknown'}: ${log.targetId.slice(0, 12)}...`
                }
              />
            )}
            <DetailRow
              icon={<Clock className="w-4 h-4 text-gray-500" />}
              label="Thời gian"
              value={log.createdAt?.toDate?.().toLocaleString('vi-VN') || '—'}
            />
            <DetailRow
              icon={<Activity className="w-4 h-4 text-gray-500" />}
              label="Action code"
              value={<code className="text-xs bg-white px-2 py-0.5 rounded border">{log.action}</code>}
            />
          </div>

          {/* Before/After */}
          {(log.before || log.after) && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">
                Chi tiết thay đổi
              </h4>

              {log.before && (
                <div>
                  <div className="text-xs text-red-600 font-medium mb-1.5 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    Trước
                  </div>
                  <pre className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-900 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(log.before, null, 2)}
                  </pre>
                </div>
              )}

              {log.after && (
                <div>
                  <div className="text-xs text-green-600 font-medium mb-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Sau
                  </div>
                  <pre className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-900 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(log.after, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Metadata */}
          {log.metadata && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">
                Metadata
              </h4>
              <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 mb-0.5">{label}</div>
        <div className="text-sm text-gray-900 break-words">{value}</div>
      </div>
    </div>
  );
}