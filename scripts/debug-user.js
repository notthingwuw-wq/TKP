// scripts/debug-user.js
// Chạy: node scripts/debug-user.js <email>
// → Kiểm tra user đã bật thông báo chưa, có token chưa

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sa = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'service-account.json'), 'utf8')
);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const [,, email] = process.argv;

if (!email) {
  console.error('Cách dùng: node scripts/debug-user.js <email>');
  process.exit(1);
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log(`   🔍 DEBUG USER: ${email}`);
  console.log('═══════════════════════════════════════════════');
  console.log('');

  const snap = await db.collection('users')
    .where('email', '==', email.toLowerCase())
    .limit(1)
    .get();

  if (snap.empty) {
    console.error(`❌ Không tìm thấy user ${email}`);
    process.exit(1);
  }

  const uid = snap.docs[0].id;
  const u = snap.docs[0].data();

  console.log(`   UID:                   ${uid}`);
  console.log(`   Name:                  ${u.name}`);
  console.log(`   Role:                  ${u.role}`);
  console.log(`   ClassId:               ${u.classId}`);
  console.log(`   TeamId:                ${u.teamId || '—'}`);
  console.log('');
  console.log(`   notificationsEnabled:  ${u.notificationsEnabled ? '✅ CÓ' : '❌ KHÔNG'}`);
  console.log(`   fcmToken:              ${u.fcmToken ? '✅ CÓ (' + u.fcmToken.slice(0, 20) + '...)' : '❌ KHÔNG'}`);
  console.log(`   fcmUpdatedAt:          ${u.fcmUpdatedAt?.toDate?.().toLocaleString('vi-VN') || '—'}`);
  console.log('');

  if (!u.fcmToken) {
    console.log('   🚨 VẤN ĐỀ: User CHƯA bật thông báo');
    console.log('   → User cần mở app → vào Profile → "Bật thông báo đẩy"');
    console.log('');
  }

  // Đếm notification chưa gửi
  const notifSnap = await db.collection('notifications')
    .where('userId', '==', uid)
    .get();

  let unsent = 0;
  let sent = 0;
  notifSnap.forEach(d => {
    if (d.data().sentAt) sent++;
    else unsent++;
  });

  console.log(`   📬 Notifications:`);
  console.log(`      - Tổng:       ${notifSnap.size}`);
  console.log(`      - Đã gửi:     ${sent}`);
  console.log(`      - Chưa gửi:   ${unsent}`);
  console.log('');

  if (unsent > 0) {
    console.log(`   ⚠️  Có ${unsent} notification chưa gửi — worker sẽ gửi trong 15s tới`);
    console.log('');
  }
}

main().catch(console.error);