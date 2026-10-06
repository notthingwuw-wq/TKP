// scripts/send-test-notification.js
// Chạy: node scripts/send-test-notification.js <email> "<title>" "<body>"

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
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
const messaging = getMessaging();

const [,, email, title, body] = process.argv;

if (!email || !title || !body) {
  console.error('Cách dùng: node scripts/send-test-notification.js <email> "<title>" "<body>"');
  console.error('Ví dụ:   node scripts/send-test-notification.js hs01@truong.edu.vn "Test" "Xin chào"');
  process.exit(1);
}

async function main() {
  console.log(`🔍 Tìm user: ${email}`);

  const usersSnap = await db.collection('users')
    .where('email', '==', email.toLowerCase())
    .limit(1)
    .get();

  if (usersSnap.empty) {
    console.error(`❌ Không tìm thấy user ${email}`);
    process.exit(1);
  }

  const uid = usersSnap.docs[0].id;
  const user = usersSnap.docs[0].data();

  console.log(`✅ UID: ${uid}`);
  console.log(`   Name: ${user.name}`);
  console.log(`   Role: ${user.role}`);

  if (!user.fcmToken) {
    console.error(`❌ User chưa bật thông báo (không có fcmToken)`);
    console.error('   → User cần vào Profile → "Bật thông báo đẩy"');
    process.exit(1);
  }

  console.log(`   FCM Token: ${user.fcmToken.slice(0, 20)}...`);
  console.log('');
  console.log(`📤 Đang gửi...`);

  try {
    const res = await messaging.send({
      token: user.fcmToken,
      notification: { title, body },
      webpush: {
        notification: {
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          vibrate: [200, 100, 200]
        },
        fcmOptions: { link: '/' }
      }
    });
    console.log(`✅ Gửi thành công!`);
    console.log(`   Message ID: ${res}`);
    console.log('');
    console.log('📱 Kiểm tra thiết bị sau 5-15 giây.');
    console.log('   Nếu không nhận → xem hướng dẫn debug bên dưới.');
  } catch (err) {
    console.error(`❌ Lỗi: ${err.message}`);
    if (err.code === 'messaging/registration-token-not-registered') {
      console.error('   → Token hết hạn. User cần bật lại thông báo.');
    }
  }
}

main().catch(console.error);