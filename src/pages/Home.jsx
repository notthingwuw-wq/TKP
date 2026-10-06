// src/pages/Home.jsx
// Dashboard học sinh — có section "Việc cần làm"
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useStudentTodos } from '../hooks/useStudentTodos';
import {
  Plus, CheckCircle2, AlertCircle, TrendingUp, TrendingDown,
  Clock, ChevronRight, Award, Bell, Inbox, ShieldAlert
} from 'lucide-react';

export default function Home() {
  const { profile } = useAuth();
  const todos = useStudentTodos();
  const [loading, setLoading] = useState(true);
  const [myScore, setMyScore] = useState(0);
  const [teamScore, setTeamScore] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [recentHistory, setRecentHistory] = useState([]);

  const loadHomeData = async () => {
    if (!profile?.id) return;
    try {
      // 1. Điểm cá nhân
      const mySnap = await getDocs(query(
        collection(db, 'score_ledger'),
        where('userId', '==', profile.id)
      ));
      let mySum = 0;
      mySnap.forEach(d => { mySum += d.data().points || 0; });
      setMyScore(mySum);

      // 2. Điểm tổ
      if (profile.teamId) {
        const teamSnap = await getDocs(query(
          collection(db, 'score_ledger'),
          where('teamId', '==', profile.teamId)
        ));
        let teamSum = 0;
        teamSnap.forEach(d => { teamSum += d.data().points || 0; });
        setTeamScore(teamSum);
      }

      // 3. Request pending chưa vote
      const reqSnap = await getDocs(query(
        collection(db, 'requests'),
        where('status', '==', 'pending')
      ));
      const filtered = reqSnap.docs.filter(d => {
        const r = d.data();
        if (r.creatorId === profile.id) return false;
        if ((r.voterIds || []).includes(profile.id)) return false;
        return true;
      });
      setPendingCount(filtered.length);

      // 4. Lịch sử gần đây
      const historySnap = await getDocs(query(
        collection(db, 'score_ledger'),
        where('userId', '==', profile.id)
      ));
      const historyList = historySnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .slice(0, 5);
      setRecentHistory(historyList);
    } catch (err) {
      console.error('Home load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHomeData();
  }, [profile?.id, profile?.teamId]);

  useEffect(() => {
    const handler = () => loadHomeData();
    window.addEventListener('refresh-home', handler);
    return () => window.removeEventListener('refresh-home', handler);
  }, [profile?.id]);

  const teamNumber = profile?.teamId?.match(/-team(\d+)/)?.[1] || '?';

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ===== Card chào mừng ===== */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-brand-500 px-6 py-5 text-white">
          <div className="flex items-center gap-4">
            <img
              src="/icons/icon-192.png"
              alt="Logo"
              className="w-14 h-14 rounded-full border-2 border-white/20 object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wider opacity-80 font-medium">
                Chào mừng trở lại
              </div>
              <h1 className="text-xl font-bold leading-tight mt-0.5 truncate">
                {profile?.name}
              </h1>
              <div className="text-xs opacity-90 mt-1">
                Lớp {profile?.classId} · Tổ {teamNumber}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-gray-100">
          <div className="p-5">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
              <Award className="w-3.5 h-3.5" />
              <span>Điểm cá nhân</span>
            </div>
            <div className={`text-3xl font-bold flex items-baseline gap-1 ${
              myScore > 0 ? 'text-green-600' : myScore < 0 ? 'text-red-600' : 'text-gray-900'
            }`}>
              {myScore > 0 ? <TrendingUp className="w-5 h-5" /> :
               myScore < 0 ? <TrendingDown className="w-5 h-5" /> : null}
              <span>{myScore >= 0 ? '+' : ''}{myScore}</span>
            </div>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
              <Award className="w-3.5 h-3.5" />
              <span>Điểm tổ {teamNumber}</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {teamScore}
            </div>
          </div>
        </div>
      </div>

      {/* ===== VIỆC CẦN LÀM ===== */}
      {todos.total > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 px-1 uppercase tracking-wide flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" />
            Việc cần làm
            <span className="ml-auto text-xs bg-red-500 text-white rounded-full px-2 py-0.5 font-bold">
              {todos.total}
            </span>
          </h2>
          <div className="space-y-2">
            {todos.requestsToVote > 0 && (
              <Link
                to="/requests/vote"
                className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3.5 hover:bg-blue-100 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-blue-900 text-sm">
                    {todos.requestsToVote} yêu cầu cần xác nhận
                  </div>
                  <div className="text-xs text-blue-700 mt-0.5">
                    Bạn bè đang chờ xác nhận
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-500 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            )}

            {todos.reportsToVote > 0 && (
              <Link
                to="/reports"
                className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5 hover:bg-amber-100 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-amber-900 text-sm">
                    {todos.reportsToVote} tố cáo cần xác nhận
                  </div>
                  <div className="text-xs text-amber-700 mt-0.5">
                    Xem và vote cho tố cáo đang chờ
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-500 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            )}

            {todos.reportsToAppeal > 0 && (
              <Link
                to="/reports"
                className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-3.5 hover:bg-red-100 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Inbox className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-red-900 text-sm">
                    Có tố cáo nhắm vào bạn
                  </div>
                  <div className="text-xs text-red-700 mt-0.5">
                    Xem và gửi kháng nghị nếu cần
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-red-500 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ===== Thao tác nhanh ===== */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 px-1 uppercase tracking-wide">
          Thao tác nhanh
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <Link
            to="/requests/new"
            className="group bg-white rounded-xl p-4 border border-gray-200 hover:border-brand-400 hover:shadow-md transition-all text-center"
          >
            <div className="w-12 h-12 rounded-full bg-brand-50 group-hover:bg-brand-100 mx-auto mb-2.5 flex items-center justify-center transition-colors">
              <Plus className="w-6 h-6 text-brand-500" strokeWidth={2.5} />
            </div>
            <div className="text-xs text-gray-700 font-medium leading-tight">
              Yêu cầu<br />cộng điểm
            </div>
          </Link>

          <Link
            to="/requests/vote"
            className="group relative bg-white rounded-xl p-4 border border-gray-200 hover:border-brand-400 hover:shadow-md transition-all text-center"
          >
            <div className="w-12 h-12 rounded-full bg-green-50 group-hover:bg-green-100 mx-auto mb-2.5 flex items-center justify-center transition-colors">
              <CheckCircle2 className="w-6 h-6 text-green-600" strokeWidth={2.5} />
            </div>
            <div className="text-xs text-gray-700 font-medium leading-tight">
              Xác nhận<br />cho bạn khác
            </div>
            {pendingCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full min-w-[24px] h-6 flex items-center justify-center font-bold px-1.5 shadow-lg">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </Link>

          <Link
            to="/reports/new"
            className="group bg-white rounded-xl p-4 border border-gray-200 hover:border-brand-400 hover:shadow-md transition-all text-center"
          >
            <div className="w-12 h-12 rounded-full bg-amber-50 group-hover:bg-amber-100 mx-auto mb-2.5 flex items-center justify-center transition-colors">
              <AlertCircle className="w-6 h-6 text-amber-600" strokeWidth={2.5} />
            </div>
            <div className="text-xs text-gray-700 font-medium leading-tight">
              Tạo<br />tố cáo
            </div>
          </Link>
        </div>
      </div>

      {/* ===== Banner pending ===== */}
      {pendingCount > 0 && (
        <Link
          to="/requests/vote"
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 hover:bg-amber-100 transition-colors group"
        >
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-amber-900 text-sm">
              {pendingCount} yêu cầu đang chờ bạn xác nhận
            </div>
            <div className="text-xs text-amber-700 mt-0.5">
              Nhấn để xem ngay
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-amber-600 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}

      {/* ===== Lịch sử gần đây ===== */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-sm text-gray-900">Hoạt động gần đây</h2>
          <Link
            to="/score"
            className="text-xs text-brand-500 font-medium hover:text-brand-600 flex items-center gap-0.5"
          >
            Xem tất cả
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {recentHistory.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-50 mx-auto mb-3 flex items-center justify-center">
              <Award className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-gray-500 font-medium">Chưa có hoạt động nào</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
              Điểm sẽ hiển thị ở đây sau khi yêu cầu của bạn được xác nhận
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentHistory.map((e) => (
              <div key={e.id} className="px-4 py-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  e.points >= 0 ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  {e.points >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {e.activityName || e.description || 'Hoạt động'}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {e.createdAt?.toDate?.().toLocaleString('vi-VN', {
                      day: '2-digit', month: '2-digit',
                      hour: '2-digit', minute: '2-digit'
                    }) || '—'}
                  </div>
                </div>
                <div className={`font-bold text-sm flex-shrink-0 ${
                  e.points >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {e.points >= 0 ? '+' : ''}{e.points}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}