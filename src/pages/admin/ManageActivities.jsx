// src/pages/admin/ManageActivities.jsx
// Quản lý hoạt động cộng/trừ điểm — Admin toàn quyền
import { useEffect, useState, useMemo } from 'react';
import {
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc,
  addDoc, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Plus, Search, X, Edit3, Trash2, Loader2, Save,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  FileText, Zap, RotateCcw, RefreshCw, Trophy, ClipboardList
} from 'lucide-react';
import toast from 'react-hot-toast';

// ===== Default activities để seed =====
const DEFAULT_ACTIVITIES = [
  // Cộng điểm
  { code: 'phat_bieu',    name: 'Phát biểu',            points: 1, type: 'activity',  needsConfirm: true,  description: 'Học sinh phát biểu xây dựng bài' },
  { code: 'tra_loi_dung', name: 'Trả lời đúng',         points: 2, type: 'activity',  needsConfirm: true,  description: 'Trả lời đúng câu hỏi của giáo viên' },
  { code: 'giup_ban',     name: 'Giúp bạn',             points: 2, type: 'activity',  needsConfirm: true,  description: 'Giúp đỡ bạn bè trong học tập' },
  { code: 'nhiem_vu',     name: 'Hoàn thành nhiệm vụ',  points: 3, type: 'task',      needsConfirm: true,  description: 'Hoàn thành nhiệm vụ được giao' },
  { code: 'diem_cong_1',  name: 'Điểm cộng khác (1đ)',  points: 1, type: 'activity',  needsConfirm: true,  description: 'Hoạt động tích cực khác' },

  // Trừ điểm (vi phạm)
  { code: 'noi_chuyen',   name: 'Nói chuyện trong giờ', points: -1, type: 'violation', needsConfirm: true,  description: 'Nói chuyện riêng trong giờ học' },
  { code: 'khong_thuoc',  name: 'Không thuộc bài',      points: -2, type: 'violation', needsConfirm: true,  description: 'Không thuộc bài khi được kiểm tra' },
  { code: 'xa_rac',       name: 'Xả rác',               points: -1, type: 'violation', needsConfirm: true,  description: 'Xả rác bừa bãi' },
  { code: 'khong_nhiem_vu', name: 'Không làm nhiệm vụ', points: -2, type: 'violation', needsConfirm: true,  description: 'Không làm nhiệm vụ được giao' },
  { code: 'vi_pham_noi_quy', name: 'Vi phạm nội quy',   points: -1, type: 'violation', needsConfirm: true,  description: 'Vi phạm nội quy khác của lớp' }
];

// ===== Type meta =====
const TYPE_META = {
  activity:  { label: 'Cộng điểm',  cls: 'bg-green-50 text-green-700 border-green-200', Icon: TrendingUp },
  task:      { label: 'Nhiệm vụ',   cls: 'bg-blue-50 text-blue-700 border-blue-200',    Icon: ClipboardList },
  violation: { label: 'Trừ điểm',   cls: 'bg-red-50 text-red-700 border-red-200',       Icon: TrendingDown }
};

const TABS = [
  { key: 'all',       label: 'Tất cả' },
  { key: 'activity',  label: 'Cộng điểm' },
  { key: 'task',      label: 'Nhiệm vụ' },
  { key: 'violation', label: 'Trừ điểm' }
];

export default function ManageActivities() {
  const { user: currentUser } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);   // activity đang sửa
  const [showAddModal, setShowAddModal] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // ===== Load data =====
  const loadActivities = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'activity_types'));
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          // Sort theo type rồi theo points
          const typeOrder = { activity: 1, task: 2, violation: 3 };
          const ta = typeOrder[a.type] || 9;
          const tb = typeOrder[b.type] || 9;
          if (ta !== tb) return ta - tb;
          return (b.points || 0) - (a.points || 0);
        });

      setActivities(list);
    } catch (err) {
      console.error('Load activities error:', err);
      toast.error('Không tải được danh sách hoạt động');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  // ===== Filter =====
  const filtered = useMemo(() => {
    let list = activities;
    if (activeTab !== 'all') {
      list = list.filter(a => a.type === activeTab);
    }
    if (search.trim()) {
      const s = search.toLowerCase().trim();
      list = list.filter(a =>
        (a.name || '').toLowerCase().includes(s) ||
        (a.code || '').toLowerCase().includes(s) ||
        (a.description || '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [activities, activeTab, search]);

  // ===== Stats =====
  const stats = useMemo(() => ({
    total: activities.length,
    activity: activities.filter(a => a.type === 'activity').length,
    task: activities.filter(a => a.type === 'task').length,
    violation: activities.filter(a => a.type === 'violation').length
  }), [activities]);

  // ===== Seed default =====
  const handleSeedDefaults = async () => {
    if (!confirm(
      `Thêm ${DEFAULT_ACTIVITIES.length} hoạt động mặc định?\n\n` +
      `Các hoạt động có sẵn (cùng code) sẽ bị ghi đè.`
    )) return;

    setSeeding(true);
    try {
      const batch = writeBatch(db);
      for (const act of DEFAULT_ACTIVITIES) {
        const ref = doc(db, 'activity_types', act.code);
        batch.set(ref, {
          ...act,
          isDefault: true,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.uid
        });
      }
      await batch.commit();

      await addDoc(collection(db, 'audit_logs'), {
        actorId: currentUser.uid,
        actorName: 'Admin',
        action: 'seed_activities',
        targetType: 'activity_types',
        after: { count: DEFAULT_ACTIVITIES.length },
        createdAt: serverTimestamp()
      });

      toast.success(`Đã thêm ${DEFAULT_ACTIVITIES.length} hoạt động mặc định`);
      loadActivities();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi seed dữ liệu');
    } finally {
      setSeeding(false);
    }
  };

  // ===== Delete =====
  const handleDelete = async (activity) => {
    if (!confirm(
      `Xóa hoạt động "${activity.name}"?\n\n` +
      `Cảnh báo: Các request/tố cáo cũ dùng hoạt động này vẫn giữ nguyên tên. ` +
      `Chỉ những request MỚI sẽ không dùng được hoạt động này nữa.`
    )) return;

    try {
      await deleteDoc(doc(db, 'activity_types', activity.id));

      await addDoc(collection(db, 'audit_logs'), {
        actorId: currentUser.uid,
        actorName: 'Admin',
        action: 'delete_activity',
        targetType: 'activity_type',
        targetId: activity.id,
        before: activity,
        createdAt: serverTimestamp()
      });

      toast.success('Đã xóa hoạt động');
      loadActivities();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi xóa');
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý hoạt động</h1>
          <p className="text-gray-600 text-sm mt-1">
            Thêm / sửa / xóa các hoạt động cộng và trừ điểm
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSeedDefaults}
            disabled={seeding}
            className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium text-sm disabled:opacity-50"
          >
            {seeding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang seed...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Nạp mặc định
              </>
            )}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg hover:bg-brand-600 font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            Thêm hoạt động
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 leading-relaxed">
          <strong>Lưu ý:</strong> Khi xóa hoạt động, các request/tố cáo cũ dùng hoạt động đó vẫn giữ nguyên.
          Chỉ những request MỚI của học sinh sẽ không thấy hoạt động này nữa.
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Tổng cộng" value={stats.total} Icon={FileText} color="blue" />
        <StatCard label="Cộng điểm" value={stats.activity} Icon={TrendingUp} color="green" />
        <StatCard label="Nhiệm vụ" value={stats.task} Icon={ClipboardList} color="purple" />
        <StatCard label="Trừ điểm" value={stats.violation} Icon={TrendingDown} color="red" />
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên, code, mô tả..."
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

        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => {
            const count = t.key === 'all' ? stats.total : stats[t.key];
            return (
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
                {count > 0 && (
                  <span className={`ml-1.5 text-xs ${activeTab === t.key ? 'opacity-90' : 'text-gray-400'}`}>
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-50 mx-auto mb-3 flex items-center justify-center">
            <FileText className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
          </div>
          <p className="font-semibold text-gray-900 text-sm">Chưa có hoạt động nào</p>
          <p className="text-xs text-gray-500 mt-1">
            {activities.length === 0
              ? 'Bấm "Nạp mặc định" để bắt đầu với 10 hoạt động có sẵn'
              : 'Thử xóa filter hoặc từ khóa tìm kiếm'}
          </p>
          {activities.length === 0 && (
            <button
              onClick={handleSeedDefaults}
              disabled={seeding}
              className="inline-flex items-center gap-2 mt-4 bg-brand-500 text-white px-4 py-2 rounded-lg hover:bg-brand-600 text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Nạp 10 hoạt động mặc định
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {filtered.map(a => (
            <ActivityRow
              key={a.id}
              activity={a}
              onEdit={() => setEditing(a)}
              onDelete={() => handleDelete(a)}
            />
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <ActivityModal
          activity={editing}
          onClose={() => setEditing(null)}
          onSave={() => { setEditing(null); loadActivities(); }}
          currentUser={currentUser}
        />
      )}

      {/* Add modal */}
      {showAddModal && (
        <ActivityModal
          onClose={() => setShowAddModal(false)}
          onSave={() => { setShowAddModal(false); loadActivities(); }}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

// ============ SUB-COMPONENTS ============

function StatCard({ label, value, Icon, color }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    red:    'bg-red-50 text-red-600'
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-2xl font-bold text-gray-900 mt-2">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function ActivityRow({ activity, onEdit, onDelete }) {
  const meta = TYPE_META[activity.type] || TYPE_META.activity;
  const Icon = meta.Icon;
  const isPlus = activity.points > 0;

  return (
    <div className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors group">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.cls}`}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 text-sm">
            {activity.name}
          </span>
          <code className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
            {activity.code}
          </code>
        </div>
        {activity.description && (
          <div className="text-xs text-gray-500 mt-0.5 truncate">
            {activity.description}
          </div>
        )}
      </div>

      <div className={`text-lg font-bold flex-shrink-0 ${
        isPlus ? 'text-green-600' : 'text-red-600'
      }`}>
        {isPlus ? '+' : ''}{activity.points}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="p-2 text-gray-500 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"
          title="Sửa"
        >
          <Edit3 className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Xóa"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ActivityModal({ activity, onClose, onSave, currentUser }) {
  const isEdit = !!activity;
  const [form, setForm] = useState({
    code: activity?.code || '',
    name: activity?.name || '',
    points: activity?.points ?? 1,
    type: activity?.type || 'activity',
    needsConfirm: activity?.needsConfirm ?? true,
    description: activity?.description || ''
  });
  const [saving, setSaving] = useState(false);

  // Auto-suggest code từ tên
  const generateCode = (name) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 30);
  };

  const handleNameChange = (name) => {
    setForm(f => ({
      ...f,
      name,
      // Chỉ auto-code nếu là thêm mới
      code: isEdit ? f.code : generateCode(name)
    }));
  };

  // Khi đổi type → auto sửa dấu points
  const handleTypeChange = (type) => {
    setForm(f => {
      let points = f.points;
      if (type === 'violation' && points > 0) points = -points;
      if (type !== 'violation' && points < 0) points = -points;
      return { ...f, type, points };
    });
  };

  const handlePointsChange = (val) => {
    const n = parseInt(val) || 0;
    setForm(f => ({ ...f, points: n }));
  };

  const handleSubmit = async () => {
    // Validate
    if (!form.code.trim()) return toast.error('Nhập mã hoạt động');
    if (!/^[a-z0-9_]{2,40}$/.test(form.code)) {
      return toast.error('Mã chỉ được chứa chữ thường, số và dấu _ (2-40 ký tự)');
    }
    if (!form.name.trim()) return toast.error('Nhập tên hoạt động');
    if (form.points === 0) return toast.error('Điểm không được bằng 0');

    setSaving(true);
    try {
      const data = {
        code: form.code.trim(),
        name: form.name.trim(),
        points: form.points,
        type: form.type,
        needsConfirm: form.needsConfirm,
        description: form.description.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid
      };

      if (isEdit) {
        // Update — giữ code cũ
        await updateDoc(doc(db, 'activity_types', activity.id), {
          name: data.name,
          points: data.points,
          type: data.type,
          needsConfirm: data.needsConfirm,
          description: data.description,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy
        });
        toast.success('Đã cập nhật hoạt động');
      } else {
        // Tạo mới — dùng code làm document ID
        await setDoc(doc(db, 'activity_types', data.code), {
          ...data,
          isDefault: false,
          createdAt: serverTimestamp()
        });
        toast.success('Đã thêm hoạt động');
      }

      // Audit log
      await addDoc(collection(db, 'audit_logs'), {
        actorId: currentUser.uid,
        actorName: 'Admin',
        action: isEdit ? 'update_activity' : 'create_activity',
        targetType: 'activity_type',
        targetId: data.code,
        before: isEdit ? activity : null,
        after: data,
        createdAt: serverTimestamp()
      });

      onSave();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi lưu: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const meta = TYPE_META[form.type] || TYPE_META.activity;
  const Icon = meta.Icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meta.cls}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">
                {isEdit ? 'Sửa hoạt động' : 'Thêm hoạt động mới'}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {isEdit ? `Mã: ${activity.code}` : 'Điền thông tin hoạt động'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Loại hoạt động *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(TYPE_META).map(([key, m]) => {
                const TypeIcon = m.Icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleTypeChange(key)}
                    className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                      form.type === key
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <TypeIcon className={`w-5 h-5 ${
                      form.type === key ? 'text-brand-600' : 'text-gray-400'
                    }`} />
                    <span className={`text-xs font-medium ${
                      form.type === key ? 'text-brand-700' : 'text-gray-600'
                    }`}>
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Tên hoạt động *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="VD: Phát biểu, Nói chuyện, ..."
              maxLength={100}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
            />
          </div>

          {/* Code */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Mã (code) *
            </label>
            <input
              type="text"
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
              placeholder="phat_bieu"
              disabled={isEdit}
              maxLength={40}
              className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-sm ${
                isEdit ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'border-gray-300'
              }`}
            />
            <p className="text-xs text-gray-500 mt-1">
              {isEdit
                ? 'Không thể sửa mã sau khi tạo'
                : 'Tự động sinh từ tên. Có thể sửa (chỉ chữ thường, số, dấu _)'}
            </p>
          </div>

          {/* Points */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Điểm *
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePointsChange(-Math.abs(form.points))}
                className={`px-4 py-2.5 rounded-lg font-medium text-sm border-2 transition-colors ${
                  form.points < 0
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                − Trừ điểm
              </button>
              <input
                type="number"
                value={Math.abs(form.points)}
                onChange={e => {
                  const abs = Math.abs(parseInt(e.target.value) || 0);
                  handlePointsChange(form.points < 0 ? -abs : abs);
                }}
                min="1"
                max="100"
                className="w-20 text-center px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-bold"
              />
              <button
                type="button"
                onClick={() => handlePointsChange(Math.abs(form.points))}
                className={`px-4 py-2.5 rounded-lg font-medium text-sm border-2 transition-colors ${
                  form.points > 0
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                + Cộng điểm
              </button>
            </div>
            <div className={`mt-2 text-sm font-medium ${
              form.points > 0 ? 'text-green-600' : form.points < 0 ? 'text-red-600' : 'text-gray-500'
            }`}>
              Kết quả: {form.points > 0 ? '+' : ''}{form.points} điểm
            </div>
          </div>

          {/* Needs confirm */}
          <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={form.needsConfirm}
              onChange={e => setForm({ ...form, needsConfirm: e.target.checked })}
              className="mt-0.5 w-4 h-4 text-brand-500 rounded focus:ring-brand-500"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">
                Yêu cầu xác nhận từ bạn bè
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Học sinh cần được 3+ bạn xác nhận mới được ghi điểm
              </div>
            </div>
          </label>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Mô tả
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2}
              maxLength={200}
              placeholder="Giải thích ngắn gọn về hoạt động..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm resize-none"
            />
            <div className="text-xs text-gray-400 text-right mt-1">
              {form.description.length}/200
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEdit ? 'Cập nhật' : 'Thêm mới'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}