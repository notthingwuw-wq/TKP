// src/pages/gvcn/ClassOverview.jsx
// Bảng điểm toàn lớp — điểm tổ là TỔNG điểm các thành viên
import { useEffect, useState, useMemo } from 'react';
import {
  collection, query, where, getDocs
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Trophy, Users, TrendingUp, TrendingDown, Download,
  ChevronUp, ChevronDown, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ClassOverview() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [teams, setTeams] = useState([]);
  const [sortBy, setSortBy] = useState('score');
  const [sortDir, setSortDir] = useState('desc');
  const [filterTeam, setFilterTeam] = useState('all');

  useEffect(() => {
    if (!profile?.classId) return;
    (async () => {
      try {
        const classId = profile.classId;

        // Load students
        const usersSnap = await getDocs(query(
          collection(db, 'users'),
          where('classId', '==', classId),
          where('role', '==', 'student')
        ));

        // Load ledger
        const ledgerSnap = await getDocs(collection(db, 'score_ledger'));

        // Aggregate score per user
        const scoreMap = new Map();
        ledgerSnap.forEach(d => {
          const e = d.data();
          if (!e.teamId?.startsWith(classId)) return;
          if (!scoreMap.has(e.userId)) {
            scoreMap.set(e.userId, { plus: 0, minus: 0, total: 0, count: 0 });
          }
          const s = scoreMap.get(e.userId);
          s.total += e.points || 0;
          if ((e.points || 0) >= 0) s.plus += e.points;
          else s.minus += e.points;
          s.count += 1;
        });

        const list = usersSnap.docs.map(d => {
          const u = d.data();
          const s = scoreMap.get(d.id) || { plus: 0, minus: 0, total: 0, count: 0 };
          const teamNum = u.teamId?.match(/-team(\d+)$/)?.[1] || null;
          return {
            id: d.id,
            ...u,
            teamNumber: teamNum ? parseInt(teamNum) : null,
            ...s
          };
        });

        setStudents(list);

        // Aggregate per team — TỔNG ĐIỂM, không phải average
        const teamStats = { 1: [], 2: [], 3: [], 4: [] };
        list.forEach(s => {
          if (s.teamNumber && teamStats[s.teamNumber]) {
            teamStats[s.teamNumber].push(s);
          }
        });

        const teamList = Object.entries(teamStats).map(([num, members]) => {
          const total = members.reduce((sum, m) => sum + m.total, 0);
          return {
            number: parseInt(num),
            name: `Tổ ${num}`,
            memberCount: members.length,
            total,       // ← TỔNG, không chia
            plus: members.reduce((sum, m) => sum + m.plus, 0),
            minus: members.reduce((sum, m) => sum + m.minus, 0)
          };
        }).sort((a, b) => b.total - a.total);   // ← Sort theo TỔNG

        setTeams(teamList);
      } catch (err) {
        console.error('ClassOverview error:', err);
        toast.error('Không tải được dữ liệu');
      } finally {
        setLoading(false);
      }
    })();
  }, [profile?.classId]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...students];
    if (filterTeam !== 'all') {
      list = list.filter(s => s.teamNumber === parseInt(filterTeam));
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'score') cmp = a.total - b.total;
      else if (sortBy === 'name') cmp = (a.name || '').localeCompare(b.name || '');
      else if (sortBy === 'team') cmp = (a.teamNumber || 0) - (b.teamNumber || 0);
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [students, sortBy, sortDir, filterTeam]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const exportExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const { saveAs } = await import('file-saver');

      const wb = new ExcelJS.Workbook();
      wb.creator = 'Thi Đua Lớp';
      const ws = wb.addWorksheet(`Lớp ${profile.classId}`);

      ws.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Họ và tên', key: 'name', width: 28 },
        { header: 'Tổ', key: 'team', width: 8 },
        { header: 'Cộng', key: 'plus', width: 10 },
        { header: 'Trừ', key: 'minus', width: 10 },
        { header: 'Tổng', key: 'total', width: 10 }
      ];

      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E5AA8' } };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      filtered.forEach((s, i) => {
        ws.addRow({
          stt: i + 1,
          name: s.name,
          team: s.teamNumber || '—',
          plus: s.plus,
          minus: s.minus,
          total: s.total
        });
      });

      // Sheet điểm tổ — cột Tổng (không có TB)
      const ws2 = wb.addWorksheet('Điểm tổ');
      ws2.columns = [
        { header: 'Tổ', key: 'name', width: 10 },
        { header: 'Số HS', key: 'count', width: 10 },
        { header: 'Tổng', key: 'total', width: 12 },
        { header: 'Cộng', key: 'plus', width: 12 },
        { header: 'Trừ', key: 'minus', width: 12 }
      ];
      ws2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws2.getRow(1).eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E5AA8' } };
      });
      teams.forEach(t => {
        ws2.addRow({
          name: t.name,
          count: t.memberCount,
          total: t.total,
          plus: t.plus,
          minus: t.minus
        });
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      saveAs(blob, `DiemLop_${profile.classId}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Đã xuất file Excel');
    } catch (err) {
      console.error(err);
      toast.error('Lỗi xuất Excel');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
      </div>
    );
  }

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return null;
    return sortDir === 'desc'
      ? <ChevronDown className="w-3 h-3 inline" />
      : <ChevronUp className="w-3 h-3 inline" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Điểm lớp {profile?.classId}</h1>
          <p className="text-gray-600 text-sm mt-1">
            {students.length} học sinh · 4 tổ
          </p>
        </div>
        <button
          onClick={exportExcel}
          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium text-sm"
        >
          <Download className="w-4 h-4" />
          Xuất Excel
        </button>
      </div>

      {/* Team ranking — TỔNG ĐIỂM */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h2 className="font-semibold text-gray-900">Xếp hạng tổ</h2>
          <span className="text-xs text-gray-500 ml-auto">Theo tổng điểm</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
          {teams.map((t, idx) => (
            <div key={t.number} className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  idx === 0 ? 'bg-amber-100 text-amber-700' :
                  idx === 1 ? 'bg-gray-200 text-gray-700' :
                  idx === 2 ? 'bg-orange-100 text-orange-700' :
                  'bg-blue-50 text-blue-600'
                }`}>
                  #{idx + 1}
                </div>
                <span className="text-xs text-gray-500">{t.memberCount} HS</span>
              </div>
              <div className="font-semibold text-gray-900">{t.name}</div>
              <div className="text-2xl font-bold text-brand-600 mt-1">
                {t.total > 0 ? '+' : ''}{t.total}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                <span className="text-green-600">+{t.plus}</span>
                <span className="mx-1 text-gray-300">·</span>
                <span className="text-red-600">{t.minus}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-gray-700">Lọc theo tổ:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterTeam('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterTeam === 'all'
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tất cả
            </button>
            {[1, 2, 3, 4].map(n => (
              <button
                key={n}
                onClick={() => setFilterTeam(String(n))}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterTeam === String(n)
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Tổ {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-12">STT</th>
                <th
                  onClick={() => handleSort('name')}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:text-brand-600"
                >
                  Họ và tên <SortIcon field="name" />
                </th>
                <th
                  onClick={() => handleSort('team')}
                  className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:text-brand-600 w-20"
                >
                  Tổ <SortIcon field="team" />
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase w-20">Cộng</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase w-20">Trừ</th>
                <th
                  onClick={() => handleSort('score')}
                  className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:text-brand-600 w-24"
                >
                  Tổng <SortIcon field="score" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((s, i) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500 text-center">{i + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-center">
                    {s.teamNumber ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        s.teamNumber === 1 ? 'bg-blue-50 text-blue-700' :
                        s.teamNumber === 2 ? 'bg-green-50 text-green-700' :
                        s.teamNumber === 3 ? 'bg-yellow-50 text-yellow-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        Tổ {s.teamNumber}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-green-600 font-medium">
                    {s.plus > 0 ? `+${s.plus}` : '0'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-red-600 font-medium">
                    {s.minus < 0 ? s.minus : '0'}
                  </td>
                  <td className={`px-4 py-3 text-right text-sm font-bold ${
                    s.total > 0 ? 'text-green-600' :
                    s.total < 0 ? 'text-red-600' :
                    'text-gray-900'
                  }`}>
                    {s.total > 0 ? '+' : ''}{s.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-gray-500 text-sm">Không có học sinh nào</p>
          </div>
        )}
      </div>
    </div>
  );
}