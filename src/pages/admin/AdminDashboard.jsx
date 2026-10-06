// src/pages/admin/AdminDashboard.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  Users, GraduationCap, CheckCircle2, Clock, School,
  Upload, ArrowRight, TrendingUp
} from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    students: 0,
    gvcn: 0,
    admins: 0,
    activeStudents: 0,
    pendingStudents: 0,
    totalClasses: 0,
    pendingImports: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [usersSnap, classesSnap, queuesSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'classes')),
          getDocs(collection(db, 'import_queue'))
        ]);

        const users = usersSnap.docs.map(d => d.data());
        const students = users.filter(u => u.role === 'student');
        const pendingImports = queuesSnap.docs.filter(
          d => d.data().status === 'pending'
        ).length;

        setStats({
          totalUsers: users.length,
          students: students.length,
          gvcn: users.filter(u => u.role === 'GVCN').length,
          admins: users.filter(u => u.role === 'admin').length,
          activeStudents: students.filter(u => u.status === 'active').length,
          pendingStudents: students.filter(u => u.status === 'pending' || !u.teamId).length,
          totalClasses: classesSnap.size,
          pendingImports
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    );
  }

  const cards = [
    {
      label: 'Tổng người dùng',
      value: stats.totalUsers,
      Icon: Users,
      color: 'text-blue-600 bg-blue-50'
    },
    {
      label: 'Học sinh',
      value: stats.students,
      Icon: GraduationCap,
      color: 'text-green-600 bg-green-50'
    },
    {
      label: 'Đã kích hoạt',
      value: stats.activeStudents,
      Icon: CheckCircle2,
      color: 'text-emerald-600 bg-emerald-50'
    },
    {
      label: 'Chờ chọn tổ',
      value: stats.pendingStudents,
      Icon: Clock,
      color: 'text-amber-600 bg-amber-50'
    },
    {
      label: 'Tổng số lớp',
      value: stats.totalClasses,
      Icon: School,
      color: 'text-purple-600 bg-purple-50'
    },
    {
      label: 'Import chờ xử lý',
      value: stats.pendingImports,
      Icon: Upload,
      color: 'text-orange-600 bg-orange-50',
      highlight: stats.pendingImports > 0
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 text-sm mt-1">
          Tổng quan hệ thống Thi Đua Lớp THPT Trần Kỳ Phong
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map(({ label, value, Icon, color, highlight }) => (
          <div
            key={label}
            className={`bg-white rounded-xl border p-5 transition-shadow hover:shadow-sm ${
              highlight ? 'border-orange-300 ring-1 ring-orange-100' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Thao tác nhanh
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Link
            to="/admin/import"
            className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-400 hover:shadow-sm transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-lg bg-brand-50 group-hover:bg-brand-100 flex items-center justify-center transition-colors">
              <Upload className="w-6 h-6 text-brand-500" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900 text-sm">Import học sinh</div>
              <div className="text-xs text-gray-500 mt-0.5">Tải file Excel để thêm hàng loạt</div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 group-hover:text-brand-500 transition-all" />
          </Link>

          <Link
            to="/admin/users"
            className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-400 hover:shadow-sm transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-lg bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900 text-sm">Quản lý người dùng</div>
              <div className="text-xs text-gray-500 mt-0.5">Xem, sửa, chuyển lớp, đổi tổ</div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 group-hover:text-blue-500 transition-all" />
          </Link>
        </div>
      </div>

      {/* Info banner */}
      {stats.pendingImports > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-900 text-sm">
              Có {stats.pendingImports} import đang chờ xử lý
            </div>
            <div className="text-xs text-amber-700 mt-1">
              Chạy lệnh sau trong terminal để hoàn tất:
              <code className="mx-2 px-2 py-0.5 bg-amber-100 rounded font-mono">
                node scripts/import-students.js
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}