// scripts/create-classes.js
// Chạy: node scripts/create-classes.js
// → Tạo 39 lớp (3 khối x 13 lớp) + 156 tổ (4 tổ/lớp)
// → Idempotent: chạy nhiều lần không lỗi

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== Đọc Service Account =====
const saPath = path.join(__dirname, 'service-account.json');
if (!fs.existsSync(saPath)) {
  console.error('❌ Không tìm thấy scripts/service-account.json');
  process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ===== Cấu hình khối =====
const GRADES = [
  { grade: 10, block: 'A', maxClasses: 13 },
  { grade: 11, block: 'B', maxClasses: 13 },
  { grade: 12, block: 'C', maxClasses: 13 }
];

// Ví dụ: grade=10, block="A", n=1 → "10A1"
function buildClassId(grade, block, n) {
  return `${grade}${block}${n}`;
}

// Ví dụ: "10A1" + team 2 → "10A1-team2"
function buildTeamId(classId, teamNumber) {
  return `${classId}-team${teamNumber}`;
}

async function main() {
  console.log('🔥 Firebase Admin SDK initialized');
  console.log(`   Project: ${serviceAccount.project_id}`);
  console.log('');

  const summary = {
    classes: 0,
    teams: 0,
    skipped: 0
  };

  // Firestore batch — tối đa 500 ops/batch
  // 39 classes + 156 teams = 195 ops → 1 batch là đủ
  let batch = db.batch();
  let opCount = 0;
  const flushIfNeeded = async () => {
    if (opCount >= 450) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  };

  for (const { grade, block, maxClasses } of GRADES) {
    console.log(`📚 Khối ${grade} (${block}) — tạo ${maxClasses} lớp...`);

    for (let n = 1; n <= maxClasses; n++) {
      const classId = buildClassId(grade, block, n);
      const classRef = db.collection('classes').doc(classId);

      // Check đã tồn tại chưa
      const existing = await classRef.get();
      if (existing.exists) {
        console.log(`   ⏭️  ${classId} đã tồn tại — bỏ qua`);
        summary.skipped++;
        continue;
      }

      const teamIds = [];
      for (let t = 1; t <= 4; t++) {
        teamIds.push(buildTeamId(classId, t));
      }

      // Tạo document lớp
      batch.set(classRef, {
        classId,
        name: `Lớp ${classId}`,
        grade,
        block,
        number: n,
        teams: teamIds,
        activePeriodId: null,
        teacherId: null,
        studentCount: 0,
        createdAt: FieldValue.serverTimestamp()
      });
      opCount++;
      summary.classes++;

      // Tạo 4 tổ
      for (let t = 1; t <= 4; t++) {
        const teamId = buildTeamId(classId, t);
        const teamRef = db.collection('teams').doc(teamId);
        batch.set(teamRef, {
          teamId,
          name: `Tổ ${t}`,
          teamNumber: t,
          classId,
          grade,
          memberIds: [],
          createdAt: FieldValue.serverTimestamp()
        });
        opCount++;
        summary.teams++;
        await flushIfNeeded();
      }

      await flushIfNeeded();
      console.log(`   ✅ ${classId} → 4 tổ (${teamIds.join(', ')})`);
    }
    console.log('');
  }

  // Commit batch cuối
  if (opCount > 0) {
    await batch.commit();
  }

  console.log('🎉 HOÀN TẤT!');
  console.log(`   📚 Lớp đã tạo:  ${summary.classes}`);
  console.log(`   👥 Tổ đã tạo:   ${summary.teams}`);
  console.log(`   ⏭️  Bỏ qua:      ${summary.skipped} (đã tồn tại)`);
  console.log('');
  console.log('👉 Vào web admin /admin/import → dropdown "Chọn lớp" giờ có 39 lớp.');
  console.log('');
}

main().catch(err => {
  console.error('');
  console.error('❌ LỖI:', err.message);
  if (err.code) console.error('   Code:', err.code);
  process.exit(1);
});