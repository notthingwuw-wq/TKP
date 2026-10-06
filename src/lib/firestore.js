import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

// ==================== REQUESTS ====================
export async function createRequest(data) {
  const docRef = await addDoc(collection(db, 'requests'), {
    ...data,
    status: 'pending',
    voteCount: 0,
    votes: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

export async function getRequestById(id) {
  const snap = await getDoc(doc(db, 'requests', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getPendingRequests(teamId = null) {
  let q = query(
    collection(db, 'requests'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
  if (teamId) q = query(q, where('teamId', '!=', teamId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getMyRequests(userId) {
  const q = query(
    collection(db, 'requests'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function voteRequest(requestId, userId, userName, teamId) {
  const ref = doc(db, 'requests', requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Request not found');

  const data = snap.data();
  if (data.votes?.some(v => v.userId === userId)) {
    throw new Error('Already voted');
  }

  const newVote = { userId, userName, teamId, votedAt: new Date().toISOString() };
  await updateDoc(ref, {
    votes: [...(data.votes || []), newVote],
    voteCount: increment(1),
    updatedAt: serverTimestamp()
  });

  // Check if threshold met
  const threshold = data.threshold || 3;
  if ((data.voteCount || 0) + 1 >= threshold && data.status === 'pending') {
    await updateDoc(ref, { status: 'verified', verifiedAt: serverTimestamp() });
    // Create score ledger entry
    await addScoreLedger({
      userId: data.userId,
      teamId: data.teamId,
      periodId: data.periodId || 'current',
      points: data.points || 0,
      activityCode: data.activityCode,
      activityName: data.activityName,
      sourceType: 'request',
      sourceId: requestId,
      description: data.description
    });
  }
}

// ==================== REPORTS ====================
export async function createReport(data) {
  const docRef = await addDoc(collection(db, 'reports'), {
    ...data,
    status: 'pending',
    voteCount: 0,
    votes: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

export async function getReportById(id) {
  const snap = await getDoc(doc(db, 'reports', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getMyReports(userId) {
  const q = query(
    collection(db, 'reports'),
    where('targetUserId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPendingReports() {
  const q = query(
    collection(db, 'reports'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function voteReport(reportId, userId, userName, teamId) {
  const ref = doc(db, 'reports', reportId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Report not found');

  const data = snap.data();
  if (data.votes?.some(v => v.userId === userId)) {
    throw new Error('Already voted');
  }

  const newVote = { userId, userName, teamId, votedAt: new Date().toISOString() };
  await updateDoc(ref, {
    votes: [...(data.votes || []), newVote],
    voteCount: increment(1),
    updatedAt: serverTimestamp()
  });

  // Check if threshold met
  const threshold = data.threshold || 5;
  if ((data.voteCount || 0) + 1 >= threshold && data.status === 'pending') {
    await updateDoc(ref, { status: 'verified', verifiedAt: serverTimestamp() });
  }
}

export async function updateReportStatus(reportId, status, reviewNote = '') {
  await updateDoc(doc(db, 'reports', reportId), {
    status,
    reviewNote,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // If confirmed, apply penalty
  if (status === 'confirmed') {
    const report = await getReportById(reportId);
    if (report) {
      await addScoreLedger({
        userId: report.targetUserId,
        teamId: report.targetTeamId,
        periodId: report.periodId || 'current',
        points: report.points || 0,
        activityCode: report.violationCode,
        activityName: report.violationName,
        sourceType: 'report',
        sourceId: reportId,
        description: report.description
      });
    }
  }
}

// ==================== APPEALS ====================
export async function createAppeal(data) {
  const docRef = await addDoc(collection(db, 'appeals'), {
    ...data,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

export async function getMyAppeals(userId) {
  const q = query(
    collection(db, 'appeals'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getAllAppeals() {
  const q = query(collection(db, 'appeals'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateAppealStatus(appealId, status, reviewNote = '') {
  await updateDoc(doc(db, 'appeals', appealId), {
    status,
    reviewNote,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

// ==================== SCORE LEDGER ====================
export async function addScoreLedger(data) {
  await addDoc(collection(db, 'score_ledger'), {
    ...data,
    createdAt: serverTimestamp()
  });
}

export async function getScoreLedger(userId, periodId = 'current') {
  const q = query(
    collection(db, 'score_ledger'),
    where('userId', '==', userId),
    where('periodId', '==', periodId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getTeamScoreLedger(teamId, periodId = 'current') {
  const q = query(
    collection(db, 'score_ledger'),
    where('teamId', '==', teamId),
    where('periodId', '==', periodId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ==================== USERS ====================
export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getUsersByTeam(teamId) {
  const q = query(collection(db, 'users'), where('teamId', '==', teamId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ==================== WARNINGS ====================
export async function createWarning(data) {
  await addDoc(collection(db, 'warnings'), {
    ...data,
    status: 'new',
    createdAt: serverTimestamp()
  });
}

export async function getWarnings(status = null) {
  let q = query(collection(db, 'warnings'), orderBy('createdAt', 'desc'));
  if (status) q = query(q, where('status', '==', status));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateWarningStatus(warningId, status) {
  await updateDoc(doc(db, 'warnings', warningId), {
    status,
    reviewedAt: serverTimestamp()
  });
}

// ==================== AUDIT LOG ====================
export async function addAuditLog(data) {
  await addDoc(collection(db, 'audit_log'), {
    ...data,
    timestamp: serverTimestamp()
  });
}

export async function getAuditLogs(filters = {}) {
  let q = query(collection(db, 'audit_log'), orderBy('timestamp', 'desc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
