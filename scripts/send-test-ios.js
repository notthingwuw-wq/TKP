// scripts/send-test-ios.js
// Gửi test push tối ưu cho iOS PWA
// Chạy: node scripts/send-test-ios.js <email>

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

const [,, email] = process.argv;

if (!email) {
  console.error('Cách dùng: node scripts/send-test-ios.js <email>');
  process.exit(1);
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('   🍎 iOS PUSH TEST');
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
  const token = u.fcmToken;

  if (!token) {
    console.error(`❌ User chưa có fcmToken`);
    process.exit(1);
  }

  console.log(`   User:   ${u.name}`);
  console.log(`   UID:    ${uid}`);
  console.log(`   Token:  ${token.length} ký tự`);
  console.log(`   Prefix: ${token.slice(0, 10)}...`);
  console.log('');

  // Kiểm tra token có phải Web Push không
  if (token.length < 100) {
    console.error('⚠️  CẢNH BÁO: Token quá ngắn (<100 ký tự)!');
    console.error('   Token Web Push thật thường 150-200 ký tự.');
    console.error('   → User cần TẮT và BẬT LẠI thông báo trong app.');
    console.error('');
  }

  if (!token.startsWith('BN') && !token.startsWith('cX') && !token.startsWith('dG')) {
    console.error('⚠️  CẢNH BÁO: Prefix token lạ!');
    console.error('   Web Push token thường bắt đầu bằng "BN..." hoặc "cX..."');
    console.error(`   Token của bạn: "${token.slice(0, 15)}..."`);
    console.error('');
  }

  console.log('📤 Đang gửi test...');
  console.log('');

  try {
    const messageId = await messaging.send({
      token,

      // Cả 2 field — để iOS lấy được
      notification: {
        title: '🍎 Test iOS',
        body: `Gửi lúc ${new Date().toLocaleTimeString('vi-VN')}`
      },

      data: {
        title: '🍎 Test iOS',
        body: `Gửi lúc ${new Date().toLocaleTimeString('vi-VN')}`,
        type: 'test',
        link: '/',
        timestamp: String(Date.now())
      },

      webpush: {
        // ⚡ QUAN TRỌNG CHO iOS
        headers: {
          Urgency: 'high',
          TTL: '2419200'  // 28 ngày
        },

        notification: {
          title: '🍎 Test iOS',
          body: `Gửi lúc ${new Date().toLocaleTimeString('vi-VN')}`,
          icon: 'https://managerclass-3b6ed.web.app/icons/icon-192.png',
          badge: 'https://managerclass-3b6ed.web.app/icons/icon-192.png',
          tag: 'test',
          renotify: true,
          requireInteraction: true  // ← Giữ notification không tự tắt
        },

        data: {
          title: '🍎 Test iOS',
          body: `Gửi lúc ${new Date().toLocaleTimeString('vi-VN')}`,
          type: 'test',
          link: '/'
        },

        fcmOptions: {
          link: 'https://managerclass-3b6ed.web.app/'
        }
      }
    });

    console.log(`✅ Gửi thành công!`);
    console.log(`   Message ID: ${messageId}`);
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('   📱 BƯỚC TIẾP THEO TRÊN iPHONE:');
    console.log('═══════════════════════════════════════════════');
    console.log('');
    console.log('   1. PWA phải ĐANG Ở BACKGROUND (đã vuốt về Home)');
    console.log('   2. Khoá màn hình iPhone để test kỹ hơn');
    console.log('   3. Đợi 15-60 giây');
    console.log('   4. Nếu vẫn không nhận → xem checklist bên dưới');
    console.log('');
  } catch (err) {
    console.error(`❌ LỖI: ${err.message}`);
    console.error(`   Code: ${err.code || 'unknown'}`);
    console.error('');

    if (err.code === 'messaging/registration-token-not-registered') {
      console.error('→ Token KHÔNG hợp lệ hoặc đã hết hạn');
      console.error('→ User cần TẮT + BẬT LẠI thông báo trong app');
    } else if (err.code === 'messaging/invalid-argument') {
      console.error('→ Token SAI FORMAT');
      console.error('→ Có thể token này được tạo bằng cách khác, không phải FCM Web');
    } else if (err.code === 'messaging/authentication-error') {
      console.error('→ Lỗi xác thực — có thể service-account.json sai');
    }
  }
}

main().catch(console.error);