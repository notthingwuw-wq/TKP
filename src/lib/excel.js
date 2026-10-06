// src/lib/excel.js
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export async function exportWeeklyReport(periodId, periodName) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Thi Đua Lớp';

  // ===== Sheet 1: Điểm học sinh =====
  const ws = wb.addWorksheet('Điểm học sinh');
  ws.columns = [
    { header: 'Học sinh', key: 'name', width: 25 },
    { header: 'Tổ', key: 'team', width: 8 },
    { header: 'Cộng', key: 'plus', width: 10 },
    { header: 'Trừ', key: 'minus', width: 10 },
    { header: 'Tổng', key: 'total', width: 10 }
  ];
  ws.getRow(1).font = { bold: true };

  const [usersSnap, ledgerSnap] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
    getDocs(query(collection(db, 'score_ledger'), where('periodId', '==', periodId)))
  ]);

  const scoreMap = new Map();
  ledgerSnap.forEach((d) => {
    const e = d.data();
    if (!scoreMap.has(e.userId)) scoreMap.set(e.userId, { plus: 0, minus: 0 });
    const s = scoreMap.get(e.userId);
    if (e.points >= 0) s.plus += e.points; else s.minus += e.points;
  });

  usersSnap.forEach((d) => {
    const u = d.data();
    const s = scoreMap.get(d.id) || { plus: 0, minus: 0 };
    ws.addRow({
      name: u.name, team: u.teamId,
      plus: s.plus, minus: s.minus, total: s.plus + s.minus
    });
  });

  // ===== Sheet 2: Điểm tổ =====
  const ws2 = wb.addWorksheet('Điểm tổ');
  ws2.columns = [
    { header: 'Tổ', key: 'team', width: 10 },
    { header: 'Tổng điểm', key: 'total', width: 15 },
    { header: 'TB/người', key: 'avg', width: 15 }
  ];
  ws2.getRow(1).font = { bold: true };

  const teamStats = {};
  for (const [userId, s] of scoreMap.entries()) {
    const userDoc = usersSnap.docs.find((d) => d.id === userId);
    if (!userDoc) continue;
    const teamId = userDoc.data().teamId;
    if (!teamStats[teamId]) teamStats[teamId] = { total: 0, count: 0 };
    teamStats[teamId].total += s.plus + s.minus;
  }
  usersSnap.forEach((d) => {
    const t = d.data().teamId;
    if (!teamStats[t]) teamStats[t] = { total: 0, count: 0 };
    teamStats[t].count += 1;
  });
  Object.entries(teamStats).forEach(([teamId, s]) => {
    ws2.addRow({
      team: teamId,
      total: s.total,
      avg: s.count ? (s.total / s.count).toFixed(2) : 0
    });
  });

  // ===== Sheet 3: Request =====
  const ws3 = wb.addWorksheet('Request');
  ws3.columns = [
    { header: 'ID', key: 'id', width: 25 },
    { header: 'Người tạo', key: 'creator', width: 20 },
    { header: 'Hoạt động', key: 'act', width: 20 },
    { header: 'Điểm', key: 'points', width: 8 },
    { header: 'Xác nhận', key: 'votes', width: 10 },
    { header: 'Trạng thái', key: 'status', width: 12 }
  ];
  ws3.getRow(1).font = { bold: true };
  const reqSnap = await getDocs(query(
    collection(db, 'requests'), where('periodId', '==', periodId)
  ));
  const userMap = Object.fromEntries(usersSnap.docs.map((d) => [d.id, d.data().name]));
  reqSnap.forEach((d) => {
    const r = d.data();
    ws3.addRow({
      id: d.id,
      creator: userMap[r.creatorId] || r.creatorId,
      act: r.activityName, points: r.points,
      votes: r.voteCount || 0, status: r.status
    });
  });

  // ===== Sheet 4: Tố cáo =====
  const ws4 = wb.addWorksheet('Tố cáo');
  ws4.columns = [
    { header: 'ID', key: 'id', width: 25 },
    { header: 'Loại vi phạm', key: 'type', width: 20 },
    { header: 'Xác nhận', key: 'votes', width: 10 },
    { header: 'Trạng thái', key: 'status', width: 12 },
    { header: 'Kết quả', key: 'decision', width: 15 }
  ];
  ws4.getRow(1).font = { bold: true };
  const repSnap = await getDocs(query(
    collection(db, 'reports'), where('periodId', '==', periodId)
  ));
  repSnap.forEach((d) => {
    const r = d.data();
    ws4.addRow({
      id: d.id, type: r.violationType,
      votes: r.voteCount || 0, status: r.status,
      decision: r.gvcnDecision?.decision || ''
    });
  });

  // ===== Xuất file =====
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const fileName = `BaoCao_${periodName || periodId}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(blob, fileName);
  return fileName;
}