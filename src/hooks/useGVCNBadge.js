// src/hooks/useGVCNBadge.js
// Đếm việc cần làm cho GVCN — bao gồm cả tố cáo chưa đủ vote
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export function useGVCNBadge() {
  const { profile } = useAuth();
  const [counts, setCounts] = useState({
    reports: 0,           // tổng (pending + verified) — hiện badge tab
    pendingReports: 0,    // chưa đủ vote
    verifiedReports: 0,   // đã đủ vote, cần xử lý
    appeals: 0            // kháng nghị chờ
  });

  const compute = async () => {
    if (!profile?.classId) {
      setCounts({ reports: 0, pendingReports: 0, verifiedReports: 0, appeals: 0 });
      return;
    }

    try {
      const classId = profile.classId;

      const [reportsSnap, appealsSnap] = await Promise.all([
        getDocs(collection(db, 'reports')),
        getDocs(collection(db, 'appeals'))
      ]);

      // Filter reports của lớp
      const classReports = reportsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(r => {
          if (r.classId) return r.classId === classId;
          if (r.targetTeamId) return r.targetTeamId.startsWith(classId);
          return false;
        });

      const pendingReports = classReports.filter(r => r.status === 'pending').length;
      const verifiedReports = classReports.filter(r => r.status === 'verified').length;

      // Appeals pending thuộc report của lớp
      const classReportIds = new Set(classReports.map(r => r.id));
      const appeals = appealsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(a => a.status === 'pending' && classReportIds.has(a.reportId)).length;

      setCounts({
        reports: pendingReports + verifiedReports,
        pendingReports,
        verifiedReports,
        appeals
      });
    } catch (err) {
      console.warn('useGVCNBadge error:', err);
    }
  };

  useEffect(() => {
    compute();
    const handler = () => compute();
    window.addEventListener('gvcn-badge-refresh', handler);
    return () => window.removeEventListener('gvcn-badge-refresh', handler);
  }, [profile?.classId]);

  return counts;
}