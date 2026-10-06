// src/pages/admin/ManageUsers.jsx
// Quản lý users theo lớp + đổi tổ + chuyển lớp + thêm/xóa
import { useEffect, useState, useMemo } from 'react';
import {
  collection, getDocs, doc, updateDoc, deleteDoc,
  writeBatch, addDoc, arrayUnion, serverTimestamp, getDoc,
  setDoc  // ← THÊM DÒNG NÀY
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search, Filter, X, ChevronDown, Users, UserCog,
  ArrowRightLeft, Trash2, Plus, Loader2, Shield, GraduationCap,
  School
} from 'lucide-react';
import toast from 'react-hot-toast';

const ROLE_META = {
  admin:   { label: 'Admin',   cls: 'bg-purple-50 text-purple-700 border-purple-200', Icon: Shield },
  GVCN:    { label: 'GVCN',    cls: 'bg-blue-50 text-blue-700 border-blue-200',       Icon: UserCog },
  student: { label: 'Học sinh', cls: 'bg-green-50 text-green-700 border-green-200',   Icon: GraduationCap }
};

const STATUS_META = {
  active:  { label: 'Đã kích hoạt', cls: 'bg-green-50 text-green-700 border-green-200' },
  pending: { label: 'Chờ chọn tổ',  cls: 'bg-amber-50 text-amber-700 border-amber-200' }
};

export default function ManageUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    classId: 'all',
    role: 'all',
    status: 'all',
    search: ''
  });
  const [editingUser, setEditingUser] = useState(null); // user đang mở modal
  const [showAddModal, setShowAddModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersSnap, classesSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'classes'))
      ]);

      const userList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      userList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      const classList = classesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      classList.sort((a, b) => (a.classId || '').localeCompare(b.classId || ''));

      setUsers(userList);
      setClasses(classList);
    } catch (err) {
      console.error(err);
      toast.error('Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Filter
  const filtered = useMemo(() => {
    let list = [...users];
    if (filters.classId !== 'all') list = list.filter(u => u.classId === filters.classId);
    if (filters.role !== 'all') list = list.filter(u => u.role === filters.role);
    if (filters.status !== 'all') {
      if (filters.status === 'active') list = list.filter(u => u.status === 'active');
      else if (filters.status === 'pending') list = list.filter(u => u.status === 'pending' || !u.teamId);
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      list = list.filter(u =>
        (u.name || '').toLowerCase().includes(s) ||
        (u.email || '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [users, filters]);

  // Group by team (khi filter theo lớp)
  const grouped = useMemo(() => {
    if (filters.classId === 'all') return null;
    const groups = { 1: [], 2: [], 3: [], 4: [], none: [], other: [] };
    filtered.forEach(u => {
      if (u.role !== 'student') { groups.other.push(u); return; }
      if (!u.teamId) { groups.none.push(u); return; }
      const n = parseInt(u.teamId.match(/-team(\d+)$/)?.[1]);
      if (n >= 1 && n <= 4) groups[n].push(u);
      else groups.none.push(u);
    });
    return groups;
  }, [filtered, filters.classId]);

  // Handlers
  const handleChangeTeam = async (targetUser, newTeamNumber) => {
    if (!targetUser.classId) {
      toast.error('User chưa có lớp');
      return;
    }
    const newTeamId = `${targetUser.classId}-team${newTeamNumber}`;
    const oldTeamId = targetUser.teamId;

    if (oldTeamId === newTeamId) {
      toast('Đã ở tổ này rồi');
      return;
    }

    if (!confirm(`Đổi ${targetUser.name} sang Tổ ${newTeamNumber}?`)) return;

    try {
      const batch = writeBatch(db);

      // Update user
      batch.update(doc(db, 'users', targetUser.id), {
        teamId: newTeamId,
        status: 'active',
        updatedAt: serverTimestamp()
      });

      // Xóa khỏi team cũ
      if (oldTeamId) {
        const oldSnap = await getDoc(doc(db, 'teams', oldTeamId));
        if (oldSnap.exists()) {
          const ids = oldSnap.data().memberIds || [];
          batch.update(doc(db, 'teams', oldTeamId), {
            memberIds: ids.filter(id => id !== targetUser.id)
          });
        }
      }

      // Thêm vào team mới
      const newRef = doc(db, 'teams', newTeamId);
      const newSnap = await getDoc(newRef);
      if (newSnap.exists()) {
        batch.update(newRef, { memberIds: arrayUnion(targetUser.id) });
      }

      await batch.commit();

      await addDoc(collection(db, 'audit_logs'), {
        actorId: currentUser.uid,
        action: 'change_team',
        targetType: 'user',
        targetId: targetUser.id,
        before: { teamId: oldTeamId },
        after: { teamId: newTeamId },
        createdAt: serverTimestamp()
      });

      toast.success(`Đã đổi ${targetUser.name} sang Tổ ${newTeamNumber}`);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi đổi tổ');
    }
  };

  const handleChangeClass = async (targetUser, newClassId) => {
    if (newClassId === targetUser.classId) {
      toast('Đã ở lớp này rồi');
      return;
    }

    if (!confirm(`Chuyển ${targetUser.name} sang lớp ${newClassId}?\n\nUser sẽ phải chọn lại tổ sau khi đăng nhập.`)) return;

    try {
      const batch = writeBatch(db);
      const oldClassId = targetUser.classId;
      const oldTeamId = targetUser.teamId;

      // Update user
      batch.update(doc(db, 'users', targetUser.id), {
        classId: newClassId,
        teamId: null,
        status: 'pending',
        updatedAt: serverTimestamp()
      });

      // Xóa khỏi team cũ
      if (oldTeamId) {
        const oldSnap = await getDoc(doc(db, 'teams', oldTeamId));
        if (oldSnap.exists()) {
          const ids = oldSnap.data().memberIds || [];
          batch.update(doc(db, 'teams', oldTeamId), {
            memberIds: ids.filter(id => id !== targetUser.id)
          });
        }
      }

      // Update studentCount
      if (oldClassId) {
        const oldClassSnap = await getDoc(doc(db, 'classes', oldClassId));
        if (oldClassSnap.exists()) {
          batch.update(doc(db, 'classes', oldClassId), {
            studentCount: Math.max(0, (oldClassSnap.data().studentCount || 1) - 1)
          });
        }
      }
      const newClassSnap = await getDoc(doc(db, 'classes', newClassId));
      if (newClassSnap.exists()) {
        batch.update(doc(db, 'classes', newClassId), {
          studentCount: (newClassSnap.data().studentCount || 0) + 1
        });
      }

      await batch.commit();

      await addDoc(collection(db, 'audit_logs'), {
        actorId: currentUser.uid,
        action: 'change_class',
        targetType: 'user',
        targetId: targetUser.id,
        before: { classId: oldClassId },
        after: { classId: newClassId },
        createdAt: serverTimestamp()
      });

      toast.success(`Đã chuyển ${targetUser.name} sang lớp ${newClassId}`);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi chuyển lớp');
    }
  };

const handleDeleteUser = async (targetUser) => {
  if (targetUser.role === 'admin') {
    toast.error('Không thể xóa admin');
    return;
  }

  const confirmMsg = `Xóa ${targetUser.name} khỏi hệ thống?\n\n` +
    `✓ Học sinh sẽ bị đăng xuất và không đăng nhập lại được\n` +
    `✗ Email ${targetUser.email} vẫn còn trong Firebase Auth\n` +
    `⚠ Để giải phóng email hoàn toàn, admin cần xóa thủ công trong Firebase Console\n\n` +
    `Tiếp tục?`;

  if (!confirm(confirmMsg)) return;

  try {
    const batch = writeBatch(db);

    // 1. Xóa khỏi team
    if (targetUser.teamId) {
      const teamSnap = await getDoc(doc(db, 'teams', targetUser.teamId));
      if (teamSnap.exists()) {
        const ids = teamSnap.data().memberIds || [];
        batch.update(doc(db, 'teams', targetUser.teamId), {
          memberIds: ids.filter(id => id !== targetUser.id)
        });
      }
    }

    // 2. Update class count
    if (targetUser.classId && targetUser.role === 'student') {
      const clsSnap = await getDoc(doc(db, 'classes', targetUser.classId));
      if (clsSnap.exists()) {
        batch.update(doc(db, 'classes', targetUser.classId), {
          studentCount: Math.max(0, (clsSnap.data().studentCount || 1) - 1)
        });
      }
    }

    // 3. Thay vì xóa hẳn → chuyển sang trash collection
    const trashRef = doc(db, 'users_trash', targetUser.id);
    batch.set(trashRef, {
      ...targetUser,
      deletedAt: serverTimestamp(),
      deletedBy: currentUser.uid
    });

    // 4. Xóa khỏi users collection
    batch.delete(doc(db, 'users', targetUser.id));

    // 5. Ghi vào delete_queue để admin chạy script xóa Auth (tuỳ chọn)
    const queueRef = doc(collection(db, 'delete_queue'));
    batch.set(queueRef, {
      uid: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      requestedBy: currentUser.uid,
      status: 'pending',
      createdAt: serverTimestamp()
    });

    await batch.commit();

    // 6. Audit log
    await addDoc(collection(db, 'audit_logs'), {
      actorId: currentUser.uid,
      action: 'delete_user',
      targetType: 'user',
      targetId: targetUser.id,
      before: { email: targetUser.email, name: targetUser.name },
      createdAt: serverTimestamp()
    });

    toast.success(`Đã xóa ${targetUser.name} khỏi hệ thống`);
    loadData();
  } catch (err) {
    console.error(err);
    toast.error('Lỗi xóa user');
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
          <h1 className="text-2xl font-bold text-gray-900">Quản lý người dùng</h1>
          <p className="text-gray-600 text-sm mt-1">
            Hiển thị {filtered.length} / {users.length} người dùng
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg hover:bg-brand-600 font-medium text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Thêm học sinh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên, email..."
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            />
          </div>
          <select
            value={filters.classId}
            onChange={e => setFilters({ ...filters, classId: e.target.value })}
            className="px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
          >
            <option value="all">Tất cả lớp</option>
            {classes.map(c => (
              <option key={c.id} value={c.classId}>{c.classId}</option>
            ))}
          </select>
          <select
            value={filters.role}
            onChange={e => setFilters({ ...filters, role: e.target.value })}
            className="px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
          >
            <option value="all">Tất cả role</option>
            <option value="student">Học sinh</option>
            <option value="GVCN">GVCN</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <select
            value={filters.status}
            onChange={e => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đã kích hoạt</option>
            <option value="pending">Chờ chọn tổ</option>
          </select>
          <button
            onClick={() => setFilters({ classId: 'all', role: 'all', status: 'all', search: '' })}
            className="text-xs text-gray-500 hover:text-gray-900 font-medium"
          >
            Xóa bộ lọc
          </button>
        </div>
      </div>

      {/* User list */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" strokeWidth={1.5} />
          <p className="text-gray-500 text-sm">Không tìm thấy người dùng nào</p>
        </div>
      ) : grouped ? (
        // Grouped theo tổ khi chọn lớp
        <div className="space-y-4">
          {[1, 2, 3, 4].map(n => grouped[n].length > 0 && (
            <TeamGroup
              key={n}
              title={`Tổ ${n}`}
              users={grouped[n]}
              onEdit={setEditingUser}
              onDelete={handleDeleteUser}
            />
          ))}
          {grouped.none.length > 0 && (
            <TeamGroup
              title="Chưa chọn tổ"
              users={grouped.none}
              highlight
              onEdit={setEditingUser}
              onDelete={handleDeleteUser}
            />
          )}
          {grouped.other.length > 0 && (
            <TeamGroup
              title="Giáo viên & Admin"
              users={grouped.other}
              onEdit={setEditingUser}
              onDelete={handleDeleteUser}
            />
          )}
        </div>
      ) : (
        // Bảng thường khi không chọn lớp
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tên</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Lớp</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tổ</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Trạng thái</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(u => (
                  <UserRow
                    key={u.id}
                    user={u}
                    onEdit={setEditingUser}
                    onDelete={handleDeleteUser}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          classes={classes}
          onChangeTeam={handleChangeTeam}
          onChangeClass={handleChangeClass}
          onClose={() => setEditingUser(null)}
        />
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddUserModal
          classes={classes}
          currentUser={currentUser}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); loadData(); }}
        />
      )}
    </div>
  );
}

// ============ Sub-components ============

function TeamGroup({ title, users, highlight, onEdit, onDelete }) {
  return (
    <div className={`bg-white border rounded-xl overflow-hidden ${
      highlight ? 'border-amber-300' : 'border-gray-200'
    }`}>
      <div className={`px-4 py-3 border-b flex items-center justify-between ${
        highlight ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'
      }`}>
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <span className="text-xs text-gray-500 font-medium">{users.length} người</span>
      </div>
      <div className="divide-y divide-gray-100">
        {users.map(u => (
          <UserRow key={u.id} user={u} onEdit={onEdit} onDelete={onDelete} compact />
        ))}
      </div>
    </div>
  );
}

function UserRow({ user, onEdit, onDelete, compact }) {
  const roleMeta = ROLE_META[user.role] || ROLE_META.student;
  const statusMeta = STATUS_META[user.status] || STATUS_META.pending;
  const RoleIcon = roleMeta.Icon;

  // Compact: dùng trong TeamGroup (không phải table)
  if (compact) {
    return (
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm flex-shrink-0">
          {(user.name || '?').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 text-sm truncate">{user.name}</div>
          <div className="text-xs text-gray-500 truncate">{user.email}</div>
        </div>
        <span className={`hidden md:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${roleMeta.cls}`}>
          <RoleIcon className="w-3 h-3" />
          {roleMeta.label}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusMeta.cls}`}>
          {statusMeta.label}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(user)}
            className="p-1.5 text-gray-500 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"
            title="Chỉnh sửa"
          >
            <UserCog className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(user)}
            className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Xóa"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Không compact: dùng trong table → phải trả về <tr>
  return (
    <tr>
      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{user.name}</td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{user.email}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${roleMeta.cls}`}>
          <RoleIcon className="w-3 h-3" />
          {roleMeta.label}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{user.classId || '—'}</td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
        {user.teamId ? user.teamId.match(/-team(\d+)$/)?.[1] : '—'}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusMeta.cls}`}>
          {statusMeta.label}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onEdit(user)}
            className="p-1.5 text-gray-500 hover:text-brand-500 hover:bg-brand-50 rounded-lg"
            title="Chỉnh sửa"
          >
            <UserCog className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(user)}
            className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg"
            title="Xóa"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
function EditUserModal({ user, classes, onChangeTeam, onChangeClass, onClose }) {
  const teamNumber = user.teamId?.match(/-team(\d+)$/)?.[1] || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">Chỉnh sửa người dùng</h3>
            <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* User info */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold">
              {(user.name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900">{user.name}</div>
              <div className="text-xs text-gray-500">
                {user.role === 'student'
                  ? `Lớp ${user.classId || '?'} · Tổ ${teamNumber || '?'}`
                  : user.role}
              </div>
            </div>
          </div>

          {/* Đổi tổ */}
          {user.role === 'student' && user.classId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <ArrowRightLeft className="w-4 h-4 inline mr-1" />
                Đổi tổ
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => { onChangeTeam(user, n); onClose(); }}
                    disabled={String(n) === teamNumber}
                    className={`py-2.5 rounded-lg font-medium text-sm border-2 transition-colors ${
                      String(n) === teamNumber
                        ? 'border-brand-500 bg-brand-50 text-brand-600 cursor-not-allowed'
                        : 'border-gray-200 hover:border-brand-400 hover:bg-brand-50 text-gray-700'
                    }`}
                  >
                    Tổ {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chuyển lớp */}
          {user.role === 'student' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <School className="w-4 h-4 inline mr-1" />
                Chuyển lớp
              </label>
              <select
                value={user.classId || ''}
                onChange={e => {
                  if (e.target.value && e.target.value !== user.classId) {
                    onChangeClass(user, e.target.value);
                    onClose();
                  }
                }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
              >
                <option value="">-- Chọn lớp mới --</option>
                {classes.map(c => (
                  <option key={c.id} value={c.classId} disabled={c.classId === user.classId}>
                    {c.classId} {c.classId === user.classId ? '(lớp hiện tại)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                <ArrowRightLeft className="w-3 h-3" />
                Chuyển lớp sẽ yêu cầu user chọn lại tổ
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

function AddUserModal({ classes, currentUser, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '123456',
    classId: '',
    teamNumber: ''
  });
  const [submitting, setSubmitting] = useState(false);

const handleSubmit = async () => {
  if (!form.name.trim()) return toast.error('Nhập họ tên');
  if (!form.email.trim() || !form.email.includes('@')) return toast.error('Email không hợp lệ');
  if (form.password.length < 6) return toast.error('Mật khẩu từ 6 ký tự');
  if (!form.classId) return toast.error('Chọn lớp');

  setSubmitting(true);
  try {
    const { createAuthUser, signInExistingUser } = await import('../../lib/authRest');
    const email = form.email.trim().toLowerCase();

    let authUser;

    // BƯỚC 1: Thử tạo Auth user
    try {
      authUser = await createAuthUser(email, form.password);
    } catch (err) {
      if (err.message.includes('đã tồn tại')) {
        // Email đã tồn tại → thử sign in với password vừa nhập
        // Nếu thành công → đây là user cũ bị xóa Firestore → khôi phục
        const existing = await signInExistingUser(email, form.password);
        if (!existing) {
          toast.error(`Email ${email} đã tồn tại trong hệ thống với mật khẩu khác. Vui lòng liên hệ quản trị viên.`, { duration: 6000 });
          setSubmitting(false);
          return;
        }
        authUser = existing;
        toast.success('Khôi phục tài khoản cũ');
      } else {
        toast.error(err.message);
        setSubmitting(false);
        return;
      }
    }

    // BƯỚC 2-5: (giữ nguyên như cũ)
    const userRef = doc(db, 'users', authUser.localId);
    const teamId = form.teamNumber
      ? `${form.classId}-team${form.teamNumber}`
      : null;

    await setDoc(userRef, {
      name: form.name.trim(),
      email,
      role: 'student',
      classId: form.classId,
      teamId,
      status: teamId ? 'active' : 'pending',
      falseReportCount: 0,
      settings: { notifications: true },
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    });

    if (teamId) {
      const teamRef = doc(db, 'teams', teamId);
      const teamSnap = await getDoc(teamRef);
      if (teamSnap.exists()) {
        await updateDoc(teamRef, {
          memberIds: arrayUnion(authUser.localId)
        });
      }
    }

    const classRef = doc(db, 'classes', form.classId);
    const classSnap = await getDoc(classRef);
    if (classSnap.exists()) {
      await updateDoc(classRef, {
        studentCount: (classSnap.data().studentCount || 0) + 1
      });
    }

    await addDoc(collection(db, 'audit_logs'), {
      actorId: currentUser.uid,
      action: 'create_student',
      targetType: 'user',
      targetId: authUser.localId,
      after: { email, classId: form.classId, teamId },
      createdAt: serverTimestamp()
    });

    toast.success(`Đã tạo tài khoản ${form.name}`);
    onSuccess();
  } catch (err) {
    console.error(err);
    toast.error(err.message || 'Lỗi tạo user');
  } finally {
    setSubmitting(false);
  }
};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Thêm học sinh</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Họ và tên *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              placeholder="Nguyễn Văn A"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              placeholder="hs01@truong.edu.vn"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu tạm</label>
            <input
              type="text"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Lớp *</label>
              <select
                value={form.classId}
                onChange={e => setForm({ ...form, classId: e.target.value, teamNumber: '' })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
              >
                <option value="">-- Chọn --</option>
                {classes.map(c => (
                  <option key={c.id} value={c.classId}>{c.classId}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tổ (tùy chọn)</label>
              <select
                value={form.teamNumber}
                onChange={e => setForm({ ...form, teamNumber: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
              >
                <option value="">-- Trống --</option>
                <option value="1">Tổ 1</option>
                <option value="2">Tổ 2</option>
                <option value="3">Tổ 3</option>
                <option value="4">Tổ 4</option>
              </select>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs text-green-900 leading-relaxed">
              <strong>✓ Tự động:</strong> Tài khoản được tạo ngay lập tức, không cần script.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-lg disabled:opacity-50"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Đang tạo...</>
            ) : (
              <><Plus className="w-4 h-4" /> Tạo tài khoản</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}