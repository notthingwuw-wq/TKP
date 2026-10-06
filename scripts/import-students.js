// scripts/import-students.js
// Chạy: node scripts/import-students.js
// → Import tất cả queue pending trong Firestore

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== Đọc Service Account =====
const saPath = path.join(__dirname, 'service-account.json');
if (!fs.existsSync(saPath)) {
  console.error('❌ Không tìm thấy scripts/service-account.json');
  console.error('   Tải tại: Firebase Console → Project Settings → Service accounts');
  process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const auth = getAuth();

console.log('🚀 Bắt đầu import học sinh...\n');

async function main() {
  const queuesSnapshot = await db.collection('import_queue')
    .where('status', '==', 'pending')
    .get();

  if (queuesSnapshot.empty) {
    console.log('✅ Không có queue nào pending.');
    console.log('   Vào /admin/import để tạo queue mới.');
    process.exit(0);
  }

  console.log(`📦 Tìm thấy ${queuesSnapshot.size} queue pending\n`);

  for (const queueDoc of queuesSnapshot.docs) {
    await processQueue(queueDoc);
  }

  console.log('\n✅ Hoàn thành tất cả queue!');
  process.exit(0);
}

async function processQueue(queueDoc) {
  const queue = queueDoc.data();
  const queueId = queueDoc.id;

  console.log(`${'='.repeat(60)}`);
  console.log(`📚 Queue: ${queue.className || queue.classId}`);
  console.log(`   ID: ${queueId}`);
  console.log(`   Số học sinh: ${queue.students.length}`);
  console.log(`${'='.repeat(60)}\n`);

  await queueDoc.ref.update({ status: 'processing' });

  const success = [];
  const failed = [];

  for (let i = 0; i < queue.students.length; i++) {
    const student = queue.students[i];
    const idx = i + 1;

    try {
      console.log(`[${idx}/${queue.students.length}] ${student.email}`);

      // Check email tồn tại
      try {
        await auth.getUserByEmail(student.email);
        failed.push({ email: student.email, name: student.name, error: 'Email đã tồn tại' });
        console.log(`   ⚠️  Email đã tồn tại, bỏ qua\n`);
        continue;
      } catch (e) {
        if (e.code !== 'auth/user-not-found') throw e;
      }

      // Tạo Auth user
      const userRecord = await auth.createUser({
        email: student.email,
        password: student.password,
        displayName: student.name
      });
      console.log(`   ✅ Auth user: ${userRecord.uid}`);

      // Tạo Firestore doc — CHƯA gán team (chờ học sinh chọn qua modal)
      await db.collection('users').doc(userRecord.uid).set({
        name: student.name,
        email: student.email,
        role: 'student',
        classId: queue.classId,
        teamId: null,                    // Sẽ gán sau khi học sinh chọn qua modal
        teamNumberFromExcel: student.teamNumber || null,  // Lưu để tham khảo
        status: 'pending',               // Chờ kích hoạt
        falseReportCount: 0,
        settings: { notifications: true },
        createdAt: FieldValue.serverTimestamp(),
        createdBy: 'import',
        importQueueId: queueId
      });
      console.log(`   ✅ Firestore doc\n`);

      success.push({
        email: student.email,
        name: student.name,
        uid: userRecord.uid
      });

    } catch (err) {
      console.error(`   ❌ ${err.message}\n`);
      failed.push({
        email: student.email,
        name: student.name,
        error: err.message
      });
    }

    // Delay tránh rate limit
    await new Promise(r => setTimeout(r, 100));
  }

  // Update queue kết quả
  await queueDoc.ref.update({
    status: 'done',
    result: {
      success,
      failed,
      successCount: success.length,
      failedCount: failed.length
    },
    processedAt: FieldValue.serverTimestamp()
  });

  // Audit log
  await db.collection('audit_logs').add({
    actorId: queue.createdBy,
    action: 'import_students',
    targetType: 'class',
    targetId: queue.classId,
    metadata: {
      queueId,
      successCount: success.length,
      failedCount: failed.length
    },
    createdAt: FieldValue.serverTimestamp()
  });

  console.log(`${'='.repeat(60)}`);
  console.log(`📊 KẾT QUẢ: ${queue.className || queue.classId}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Thành công: ${success.length}/${queue.students.length}`);
  console.log(`❌ Thất bại:   ${failed.length}/${queue.students.length}`);
  if (failed.length > 0) {
    console.log('\n❌ Chi tiết lỗi:');
    failed.forEach((f, i) => console.log(`   ${i + 1}. ${f.email}: ${f.error}`));
  }
  console.log(`${'='.repeat(60)}\n`);
}

main().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});