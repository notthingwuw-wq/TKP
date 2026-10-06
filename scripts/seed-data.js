/**
 * Seed: chạy 1 lần để tạo users/teams/period/activity_types.
 * Cách chạy:
 *   1. Firebase Console → Project Settings → Service accounts → tạo key
 *   2. Lưu file vào scripts/service-account.json
 *   3. node scripts/seed-data.js
 */
import admin from 'firebase-admin';
import fs from 'fs';

const sa = JSON.parse(fs.readFileSync(new URL('./service-account.json', import.meta.url)));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const auth = admin.auth();

const CLASS_ID = '10A1';

async function main() {
  // 1. Class
  await db.doc(`classes/${CLASS_ID}`).set({
    name: 'Lớp 10A1',
    teacherId: 'TODO_GVCN_UID',
    teams: ['team1', 'team2', 'team3', 'team4'],
    activePeriodId: 'week1'
  });

  // 2. Teams
  for (let i = 1; i <= 4; i++) {
    await db.doc(`teams/team${i}`).set({
      name: `Tổ ${i}`,
      classId: CLASS_ID,
      memberIds: []
    });
  }

  // 3. Period
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 86400 * 1000);
  await db.doc('periods/week1').set({
    name: 'Tuần 1',
    startDate: admin.firestore.Timestamp.fromDate(now),
    endDate: admin.firestore.Timestamp.fromDate(end),
    rules: {
      requestThresholdPercent: 0.10,
      reportThresholdPercent: 0.15,
      voteWindowHours: 48,
      appealWindowHours: 24
    },
    status: 'active'
  });

  // 4. Activity types
  const activities = [
    { id: 'phat_bieu', name: 'Phát biểu', points: 1, type: 'activity', needsConfirm: true },
    { id: 'tra_loi_dung', name: 'Trả lời đúng', points: 2, type: 'activity', needsConfirm: true },
    { id: 'giup_ban', name: 'Giúp bạn', points: 2, type: 'activity', needsConfirm: true },
    { id: 'nhiem_vu', name: 'Hoàn thành nhiệm vụ', points: 3, type: 'task', needsConfirm: true },
    { id: 'noi_chuyen', name: 'Nói chuyện', points: -1, type: 'violation', needsConfirm: true },
    { id: 'khong_thuoc', name: 'Không thuộc bài', points: -2, type: 'violation', needsConfirm: true },
    { id: 'xa_rac', name: 'Xả rác', points: -2, type: 'violation', needsConfirm: true }
  ];
  for (const a of activities) {
    const { id, ...rest } = a;
    await db.doc(`activity_types/${id}`).set(rest);
  }

  // 5. GVCN account
  const gvcnEmail = 'gvcn@truong.edu.vn';
  const gvcnPass = 'DoiMatKhau123!';
  let gvcn;
  try {
    gvcn = await auth.getUserByEmail(gvcnEmail);
  } catch {
    gvcn = await auth.createUser({ email: gvcnEmail, password: gvcnPass });
  }
  await db.doc(`users/${gvcn.uid}`).set({
    role: 'GVCN',
    name: 'Cô giáo chủ nhiệm',
    email: gvcnEmail,
    teamId: null,
    classId: CLASS_ID,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    falseReportCount: 0,
    settings: { notifications: true, twoFA: false }
  });
  await db.doc(`classes/${CLASS_ID}`).update({ teacherId: gvcn.uid });

  // 6. Students (demo 8 em, chia 4 tổ)
  const names = ['Nguyễn A','Trần B','Lê C','Phạm D','Hoàng E','Vũ F','Đặng G','Bùi H'];
  for (let i = 0; i < names.length; i++) {
    const email = `hs${i + 1}@truong.edu.vn`;
    const pass = '123456';
    let u;
    try { u = await auth.getUserByEmail(email); }
    catch { u = await auth.createUser({ email, password: pass }); }
    const teamId = `team${(i % 4) + 1}`;
    await db.doc(`users/${u.uid}`).set({
      role: 'student',
      name: names[i],
      email,
      teamId,
      classId: CLASS_ID,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      falseReportCount: 0,
      activePeriodId: 'week1',
      settings: { notifications: true }
    });
    await db.doc(`teams/${teamId}`).update({
      memberIds: admin.firestore.FieldValue.arrayUnion(u.uid)
    });
  }

  console.log('✅ Seed xong!');
  console.log('GVCN:', gvcnEmail, '| pass:', gvcnPass);
  console.log('HS mẫu: hs1@truong.edu.vn … hs8@truong.edu.vn | pass: 123456');
}

main().catch((e) => { console.error(e); process.exit(1); });