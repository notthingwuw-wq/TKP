// src/pages/gvcn/Dashboard.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  AlertTriangle, MessageSquare, ShieldAlert, Users,
  TrendingUp, Clock, ChevronRight, CheckCircle2, Trophy,
  Vote
} from 'lucide-react';

export default function Dashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pendingReports: 0,
    verifiedReports: 0,
    pendingAppeals: 0,
    newWarnings: 0,
    classSize: 0,
    classScore: 0
  });
  const [urgentReports, setUrgentReports] = useState([]);

  useEffect(() => {
    if (!profile?.classId) return;
    (async () => {
      try {
        const classId = profile.classId;

        // ⚡ 1. Load users TRƯỚC — để tính điểm lớp chính xác
        const usersSnap = await getDocs(query(
          collection(db, 'users'),
          where('classId', '==', classId),
          where('role', '==', 'student')
        ));
        const studentIds = new Set(usersSnap.docs.map(d => d.id));

        // 2. Reports của lớp
        const reportsSnap = await getDocs(collection(db, 'reports'));
        const classReports = reportsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(r => {
            if (r.classId) return r.classId === classId;
            if (r.targetTeamId) return r.targetTeamId.startsWith(classId);
            return false;
          });

        const pendingReports = classReports.filter(r => r.status === 'pending').length;
        const verifiedReports = classReports.filter(r => r.status === 'verified').length;

        // 3. Urgent reports (>24h)
        const now = Date.now();
        const urgent = classReports
          .filter(r => r.status === 'verified')
          .filter(r => {
            const created = r.verifiedAt?.seconds * 1000 || r.createdAt?.seconds * 1000 || 0;
            return now - created > 24 * 3600 * 1000;
          })
          .sort((a, b) => {
            const at = a.verifiedAt?.seconds || a.createdAt?.seconds || 0;
            const bt = b.verifiedAt?.seconds || b.createdAt?.seconds || 0;
            return at - bt;
          });
        setUrgentReports(urgent.slice(0, 5));

        // 4. Appeals của lớp
        const appealsSnap = await getDocs(query(
          collection(db, 'appeals'),
          where('status', '==', 'pending')
        ));
        const classReportIds = new Set(classReports.map(r => r.id));
        const classAppeals = appealsSnap.docs.filter(d =>
          classReportIds.has(d.data().reportId)
        );

        // 5. Warnings
        const warningsSnap = await getDocs(query(
          collection(db, 'warnings'),
          where('status', '==', 'new')
        ));

        // 6. ⚡ Điểm lớp = SUM ledger của TẤT CẢ học sinh trong lớp
        const ledgerSnap = await getDocs(collection(db, 'score_ledger'));
        const classScore = ledgerSnap.docs
          .filter(d => studentIds.has(d.data().userId))
          .reduce((sum, d) => sum + (d.data().points || 0), 0);

        setStats({
          pendingReports,
          verifiedReports,
          pendingAppeals: classAppeals.length,
          newWarnings: warningsSnap.size,
          classSize: usersSnap.size,
          classScore
        });
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [profile?.classId]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    );
  }

  const cards = [
    {
      label: 'Chờ GVCN xử lý',
      value: stats.verifiedReports,
      Icon: AlertTriangle,
      color: 'text-amber-600 bg-amber-50',
      to: '/gvcn/reports',
      highlight: stats.verifiedReports > 0
    },
    {
      label: 'Tố cáo chờ vote',
      value: stats.pendingReports,
      Icon: Vote,
      color: 'text-gray-600 bg-gray-50',
      to: '/gvcn/reports'
    },
    {
      label: 'Kháng nghị mới',
      value: stats.pendingAppeals,
      Icon: MessageSquare,
      color: 'text-blue-600 bg-blue-50',
      to: '/gvcn/appeals',
      highlight: stats.pendingAppeals > 0
    },
    {
      label: 'Cảnh báo',
      value: stats.newWarnings,
      Icon: ShieldAlert,
      color: 'text-red-600 bg-red-50',
      to: '/gvcn/warnings',
      highlight: stats.newWarnings > 0
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tổng quan lớp {profile?.classId}</h1>
        <p className="text-gray-600 text-sm mt-1">
          {new Date().toLocaleDateString('vi-VN', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
          })}
        </p>
      </div>

      {/* Class score banner */}
      <div className="bg-gradient-to-r from-brand-500 to-brand-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider opacity-80 mb-1">
              Điểm thi đua lớp (tổng tất cả học sinh)
            </div>
            <div className="text-4xl font-bold flex items-baseline gap-2">
              <Trophy className="w-7 h-7" />
              {stats.classScore >= 0 ? '+' : ''}{stats.classScore}
            </div>
            <div className="text-xs opacity-80 mt-1">
              {stats.classSize} học sinh
            </div>
          </div>
          <Link
            to="/gvcn/class"
            className="inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Xem chi tiết
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(({ label, value, Icon, color, to, highlight }) => (
          <Link
            key={label}
            to={to}
            className={`bg-white rounded-xl border p-5 transition-all hover:shadow-md ${
              highlight ? 'border-amber-300 ring-1 ring-amber-100' : 'border-gray-200'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </Link>
        ))}
      </div>

      {/* Urgent reports */}
      {urgentReports.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
          <div className="px-5 py-4 bg-amber-50 border-b border-amber-200 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600" />
            <div className="flex-1">
              <div className="font-semibold text-amber-900 text-sm">
                {urgentReports.length} tố cáo quá 24h chưa xử lý
              </div>
            </div>
            <Link
              to="/gvcn/reports"
              className="text-xs font-medium text-amber-700 hover:text-amber-900 inline-flex items-center gap-1"
            >
              Xử lý ngay
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {urgentReports.map(r => {
              const hoursAgo = Math.floor(
                (Date.now() - (r.verifiedAt?.seconds * 1000 || r.createdAt?.seconds * 1000 || 0)) / 3600000
              );
              return (
                <Link
                  key={r.id}
                  to={`/gvcn/reports?id=${r.id}`}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-amber-50/50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">
                      {r.violationName}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {r.targetUserName} · {r.voteCount || 0} xác nhận
                    </div>
                  </div>
                  <div className="text-xs text-amber-700 font-medium flex-shrink-0">
                    {hoursAgo}h trước
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Thao tác nhanh
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link
            to="/gvcn/reports"
            className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-400 hover:shadow-sm transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-lg bg-amber-50 group-hover:bg-amber-100 flex items-center justify-center transition-colors">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900 text-sm">Xử lý tố cáo</div>
              <div className="text-xs text-gray-500 mt-0.5">Xem và ra quyết định</div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 group-hover:text-brand-500 transition-all" />
          </Link>

          <Link
            to="/gvcn/class"
            className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-400 hover:shadow-sm transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-lg bg-green-50 group-hover:bg-green-100 flex items-center justify-center transition-colors">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900 text-sm">Xem điểm lớp</div>
              <div className="text-xs text-gray-500 mt-0.5">Bảng điểm toàn lớp</div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 group-hover:text-brand-500 transition-all" />
          </Link>

          <Link
            to="/gvcn/warnings"
            className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-400 hover:shadow-sm transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-lg bg-red-50 group-hover:bg-red-100 flex items-center justify-center transition-colors">
              <ShieldAlert className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900 text-sm">Xem cảnh báo</div>
              <div className="text-xs text-gray-500 mt-0.5">Phát hiện bất thường</div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 group-hover:text-brand-500 transition-all" />
          </Link>
        </div>
      </div>

      {/* Empty state */}
      {stats.verifiedReports === 0 && stats.pendingAppeals === 0 && stats.newWarnings === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 mx-auto mb-3 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <p className="font-semibold text-gray-900">Tất cả đã được xử lý! 🎉</p>
          <p className="text-xs text-gray-500 mt-1">
            Không có tố cáo, kháng nghị hay cảnh báo nào đang chờ
          </p>
        </div>
      )}
    </div>
  );
}