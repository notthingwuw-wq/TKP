// scripts/create-admin.js
// Chạy: node scripts/create-admin.js admin@test.com Admin123! "Tên Admin"

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
  console.error('❌ Không tìm thấy file scripts/service-account.json');
  console.error('   Tải tại: Firebase Console → Project Settings → Service accounts');
  process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));

// ===== Init Admin SDK (cách mới) =====
initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore();
const auth = getAuth();

// ===== Đọc args =====
const [,, email, password, name] = process.argv;

if (!email || !password || !name) {
  console.error('❌ Thiếu tham số!');
  console.error('   Cách dùng: node scripts/create-admin.js <email> <password> "<tên>"');
  console.error('   Ví dụ:     node scripts/create-admin.js admin@x.com Admin123! "Nguyễn Văn A"');
  process.exit(1);
}

async function main() {
  console.log('🔥 Firebase Admin SDK initialized');
  console.log(`   Project: ${serviceAccount.project_id}`);

  let userRecord;
  try {
    // Nếu user đã tồn tại → lấy về
    userRecord = await auth.getUserByEmail(email);
    console.log(`ℹ️  User đã tồn tại: ${email}`);
    // Reset password nếu cần
    await auth.updateUser(userRecord.uid, { password, displayName: name });
    console.log(`🔄 Đã cập nhật password + tên`);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    // Chưa có → tạo mới
    userRecord = await auth.createUser({
      email,
      password,
      displayName: name
    });
    console.log(`✅ Đã tạo user trong Authentication: ${email}`);
  }

  // Ghi / cập nhật Firestore
  await db.collection('users').doc(userRecord.uid).set({
    name,
    email,
    role: 'admin',
    classId: null,
    teamId: null,
    status: 'active',
    falseReportCount: 0,
    createdAt: FieldValue.serverTimestamp()
  }, { merge: true });
  console.log(`✅ Đã ghi document users/${userRecord.uid}`);

  // Audit log
  await db.collection('audit_logs').add({
    actorId: userRecord.uid,
    action: 'create_admin',
    targetType: 'user',
    targetId: userRecord.uid,
    after: { email, role: 'admin' },
    createdAt: FieldValue.serverTimestamp()
  });

  console.log('');
  console.log('🎉 TẠO ADMIN THÀNH CÔNG!');
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   UID:      ${userRecord.uid}`);
  console.log('');
  console.log('👉 Đăng nhập tại: http://localhost:5173/login');
  console.log('👉 Sau đó vào:   http://localhost:5173/admin');
}

main().catch(err => {
  console.error('');
  console.error('❌ LỖI:', err.message);
  if (err.code) console.error('   Code:', err.code);
  process.exit(1);
});