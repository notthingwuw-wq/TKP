// scripts/push-worker-once.js
// Worker chạy 1 LẦN — dùng cho GitHub Actions cron
// Đọc Firebase credentials từ ENV (GitHub Secrets)
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== Đọc Service Account: ưu tiên ENV (GitHub Actions) =====
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    console.log('🔑 Đọc credentials từ ENV');
  } catch (err) {
    console.error('❌ ENV FIREBASE_SERVICE_ACCOUNT_JSON không phải JSON hợp lệ');
    console.error('   Lỗi:', err.message);
    process.exit(1);
  }
} else {
  // Fallback: đọc từ file (local)
  const saPath = path.join(__dirname, 'service-account.json');
  if (!fs.existsSync(saPath)) {
    console.error('❌ Không tìm thấy credentials');
    console.error('   - ENV: FIREBASE_SERVICE_ACCOUNT_JSON chưa set');
    console.error('   - File:', saPath, 'không tồn tại');
    process.exit(1);
  }
  serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  console.log('🔑 Đọc credentials từ file');
}

// ===== Init Firebase =====
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const messaging = getMessaging();

const BATCH_LIMIT = 50;
const MIN_AGE_MS = 5000;
const MAX_AGE_MS = 3600000;

async function sendNotification(notifDoc) {
  const n = notifDoc.data();
  const notifId = notifDoc.id;

  // Lấy user
  const userSnap = await db.collection('users').doc(n.userId).get();
  if (!userSnap.exists) {
    await notifDoc.ref.update({
      sentAt: FieldValue.serverTimestamp(),
      sendError: 'User không tồn tại',
      sendStatus: 'failed'
    });
    return { status: 'failed' };
  }

  const token = userSnap.data().fcmToken;
  if (!token) {
    await notifDoc.ref.update({
      sentAt: FieldValue.serverTimestamp(),
      sendError: 'User chưa bật thông báo',
      sendStatus: 'skipped'
    });
    return { status: 'skipped' };
  }

  try {
    const linkMap = {
      request: '/requests',
      report: '/reports',
      appeal: '/reports'
    };
    const link = linkMap[n.relatedType] || '/';

    const messageId = await messaging.send({
      token,
      notification: {
        title: n.title || 'Thi Đua Lớp',
        body: n.body || 'Bạn có thông báo mới'
      },
      data: {
        title: n.title || 'Thi Đua Lớp',
        body: n.body || 'Bạn có thông báo mới',
        type: n.type || 'general',
        link: link,
        relatedId: n.relatedId || '',
        relatedType: n.relatedType || '',
        notifId: notifId
      },
      webpush: {
        headers: {
          Urgency: 'high',
          TTL: '86400'
        },
        notification: {
          title: n.title || 'Thi Đua Lớp',
          body: n.body || 'Bạn có thông báo mới',
          icon: 'https://managerclass-3b6ed.web.app/icons/icon-192.png',
          badge: 'https://managerclass-3b6ed.web.app/icons/icon-192.png',
          vibrate: [200, 100, 200],
          tag: n.type || 'default',
          renotify: true
        },
        data: {
          title: n.title || 'Thi Đua Lớp',
          body: n.body || 'Bạn có thông báo mới',
          type: n.type || 'general',
          link: link,
          notifId: notifId
        },
        fcmOptions: { link }
      }
    });

    await notifDoc.ref.update({
      sentAt: FieldValue.serverTimestamp(),
      sendStatus: 'sent',
      fcmMessageId: messageId
    });

    console.log(`  ✅ [${n.userId.slice(0, 6)}] ${n.title}`);
    return { status: 'sent' };
  } catch (err) {
    if (
      err.code === 'messaging/registration-token-not-registered' ||
      err.code === 'messaging/invalid-registration-token' ||
      err.code === 'messaging/invalid-argument'
    ) {
      console.log(`  ⚠️  Token invalid → xóa khỏi user`);
      await db.collection('users').doc(n.userId).update({
        fcmToken: null,
        notificationsEnabled: false
      });
    }

    await notifDoc.ref.update({
      sentAt: FieldValue.serverTimestamp(),
      sendError: err.message,
      sendStatus: 'failed'
    });

    console.error(`  ❌ [${n.userId.slice(0, 6)}] ${err.message}`);
    return { status: 'failed' };
  }
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('   📬 PUSH WORKER — ONCE (GitHub Actions)');
  console.log('═══════════════════════════════════════════════');
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log('');

  // Query notifications chưa gửi
  const snap = await db.collection('notifications')
    .orderBy('createdAt', 'desc')
    .limit(BATCH_LIMIT)
    .get();

  if (snap.empty) {
    console.log('   Không có notification nào trong DB');
    process.exit(0);
  }

  const now = Date.now();
  const toSend = [];

  snap.forEach(doc => {
    const n = doc.data();

    // Đã gửi rồi
    if (n.sentAt) return;

    const createdMs = n.createdAt?.toMillis?.() || 0;
    const age = now - createdMs;

    // Quá mới → chờ lần sau
    if (age < MIN_AGE_MS) return;

    // Quá cũ → bỏ qua
    if (age > MAX_AGE_MS) {
      doc.ref.update({
        sentAt: FieldValue.serverTimestamp(),
        sendStatus: 'expired'
      });
      return;
    }

    toSend.push(doc);
  });

  if (toSend.length === 0) {
    console.log('   Không có notification mới cần gửi');
    process.exit(0);
  }

  console.log(`   📬 Tìm thấy ${toSend.length} notification cần gửi`);
  console.log('');

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const doc of toSend) {
    const result = await sendNotification(doc);
    if (result.status === 'sent') sent++;
    else if (result.status === 'skipped') skipped++;
    else failed++;
  }

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log(`   ✅ Xong: ${sent} gửi · ${skipped} bỏ qua · ${failed} lỗi`);
  console.log('═══════════════════════════════════════════════');
  console.log('');

  process.exit(0);
}

main().catch(err => {
  console.error('');
  console.error('❌ Fatal error:', err.message);
  console.error('   Stack:', err.stack);
  process.exit(1);
});
