// src/pages/admin/ManageClasses.jsx
import { useState, useEffect } from 'react';
import {
  collection, getDocs, doc, setDoc, getDoc,
  serverTimestamp, deleteDoc, writeBatch
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, School, Users, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ManageClasses() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newClassId, setNewClassId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadClasses = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'classes'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort theo classId
      list.sort((a, b) => (a.classId || '').localeCompare(b.classId || ''));
      setClasses(list);
    } catch (err) {
      console.error('Load classes error:', err);
      toast.error('Không tải được danh sách lớp');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const handleAdd = async () => {
    const classId = newClassId.trim().toUpperCase();

    // Validate format: 10A1, 11B5, 12C13
    if (!/^1[0-2][ABC]\d{1,2}$/.test(classId)) {
      toast.error('Mã lớp sai định dạng. VD: 10A1, 11B5, 12C13');
      return;
    }

    setSubmitting(true);
    try {
      // Kiểm tra đã tồn tại
      const classRef = doc(db, 'classes', classId);
      const existing = await getDoc(classRef);
      if (existing.exists()) {
        toast.error(`Lớp ${classId} đã tồn tại`);
        setSubmitting(false);
        return;
      }

      const grade = parseInt(classId.slice(0, 2));
      const block = classId.slice(2, 3);
      const number = parseInt(classId.slice(3));
      const teamIds = [1, 2, 3, 4].map(n => `${classId}-team${n}`);

      // Tạo class document — dùng setDoc KHÔNG phải doc().set()
      await setDoc(classRef, {
        classId,
        name: `Lớp ${classId}`,
        grade,
        block,
        number,
        teams: teamIds,
        activePeriodId: null,
        teacherId: null,
        studentCount: 0,
        createdAt: serverTimestamp()
      });

      // Tạo 4 team documents
      for (let n = 1; n <= 4; n++) {
        await setDoc(doc(db, 'teams', `${classId}-team${n}`), {
          teamId: `${classId}-team${n}`,
          name: `Tổ ${n}`,
          teamNumber: n,
          classId,
          grade,
          memberIds: [],
          createdAt: serverTimestamp()
        });
      }

      // Audit log
      await setDoc(doc(collection(db, 'audit_logs')), {
        actorId: user.uid,
        action: 'create_class',
        targetType: 'class',
        targetId: classId,
        after: { classId, grade, block, number },
        createdAt: serverTimestamp()
      });

      toast.success(`Đã tạo lớp ${classId} với 4 tổ`);
      setNewClassId('');
      setShowModal(false);
      loadClasses();
    } catch (err) {
      console.error('Create class error:', err);
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (cls) => {
    if (!confirm(`Xóa lớp ${cls.classId}? Chỉ xóa được nếu lớp trống.`)) return;

    try {
      // Kiểm tra lớp có học sinh chưa
      const usersSnap = await getDocs(collection(db, 'users'));
      const studentsInClass = usersSnap.docs.filter(
        d => d.data().classId === cls.classId && d.data().role === 'student'
      );
      if (studentsInClass.length > 0) {
        toast.error(`Lớp còn ${studentsInClass.length} học sinh. Không thể xóa.`);
        return;
      }

      // Xóa class + teams
      const batch = writeBatch(db);
      batch.delete(doc(db, 'classes', cls.classId));
      for (let n = 1; n <= 4; n++) {
        batch.delete(doc(db, 'teams', `${cls.classId}-team${n}`));
      }
      await batch.commit();

      await setDoc(doc(collection(db, 'audit_logs')), {
        actorId: user.uid,
        action: 'delete_class',
        targetType: 'class',
        targetId: cls.classId,
        createdAt: serverTimestamp()
      });

      toast.success(`Đã xóa lớp ${cls.classId}`);
      loadClasses();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi xóa lớp');
    }
  };

  // Group theo khối
  const grouped = { 10: [], 11: [], 12: [] };
  classes.forEach(c => {
    if (grouped[c.grade]) grouped[c.grade].push(c);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Quản lý lớp</h2>
          <p className="text-gray-600 text-sm mt-1">
            Tổng cộng: {classes.length} lớp
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg hover:bg-brand-600 font-medium"
        >
          <Plus className="w-4 h-4" />
          Tạo lớp mới
        </button>
      </div>

      {/* Grouped classes */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500"></div>
        </div>
      ) : classes.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <School className="w-12 h-12 mx-auto text-gray-300 mb-3" strokeWidth={1.5} />
          <p className="text-gray-500">Chưa có lớp nào</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-block mt-3 text-brand-500 text-sm font-medium"
          >
            Tạo lớp đầu tiên →
          </button>
        </div>
      ) : (
        Object.entries(grouped).map(([grade, list]) => {
          if (list.length === 0) return null;
          return (
            <div key={grade}>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Khối {grade} ({list.length} lớp)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {list.map(cls => (
                  <div
                    key={cls.id}
                    className="bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-400 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-semibold text-gray-900">
                        {cls.classId}
                      </div>
                      <button
                        onClick={() => handleDelete(cls)}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                        title="Xóa lớp"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Users className="w-3.5 h-3.5" />
                      <span>{cls.studentCount || 0} học sinh</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      4 tổ
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Modal tạo lớp */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Tạo lớp mới</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Mã lớp
                </label>
                <input
                  type="text"
                  value={newClassId}
                  onChange={e => setNewClassId(e.target.value.toUpperCase())}
                  placeholder="VD: 10A1, 11B5, 12C13"
                  maxLength={5}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-base uppercase"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Định dạng: Khối (10-12) + Khối chữ (A/B/C) + Số lớp (1-13)
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="flex-1 bg-gray-100 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleAdd}
                  disabled={submitting || !newClassId.trim()}
                  className="flex-1 bg-brand-500 text-white font-medium py-2.5 rounded-lg hover:bg-brand-600 disabled:opacity-50"
                >
                  {submitting ? 'Đang tạo...' : 'Tạo lớp'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}