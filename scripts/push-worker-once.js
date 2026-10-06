// scripts/push-worker.js
// Worker gửi push notification — chạy trên PC nhà
// Bản fix: thêm urgency HIGH + data field cho iOS
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const saPath = path.join(__dirname, 'service-account.json');
if (!fs.existsSync(saPath)) {
  console.error('❌ Không tìm thấy scripts/service-account.json');
  process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
initializeApp({ credential: cert(sa) });

const db = getFirestore();
const messaging = getMessaging();

const POLL_INTERVAL = 15000;
const BATCH_LIMIT = 50;
const MIN_AGE_MS = 5000;
const MAX_AGE_MS = 3600000;

let stats = { sent: 0, failed: 0, skipped: 0, startedAt: Date.now() };

async function sendNotification(notifDoc) {
  const n = notifDoc.data();
  const notifId = notifDoc.id;

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

    // ⚡ QUAN TRỌNG: Gửi CẢ notification + data + urgency high
    const messageId = await messaging.send({
      token,

      // Field `notification` — hiện tự động khi app background (Android + Desktop)
      notification: {
        title: n.title || 'Thi Đua Lớp',
        body: n.body || 'Bạn có thông báo mới'
      },

      // Field `data` — SW tự show (iOS PWA dùng cái này)
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
        // ⚡ HEADERS — QUAN TRỌNG NHẤT cho iOS
        headers: {
          Urgency: 'high',           // iOS ưu tiên cao → push ngay
          TTL: '86400'                // Tồn tại 24h nếu không đến được
        },

        // Notification block
        notification: {
          title: n.title || 'Thi Đua Lớp',
          body: n.body || 'Bạn có thông báo mới',
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          vibrate: [200, 100, 200],
          tag: n.type || 'default',
          renotify: true,
          requireInteraction: false
        },

        // Data cho SW
        data: {
          title: n.title || 'Thi Đua Lớp',
          body: n.body || 'Bạn có thông báo mới',
          type: n.type || 'general',
          link: link,
          notifId: notifId
        },

        fcmOptions: {
          link: link
        }
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

async function processNotifications() {
  try {
    const snap = await db.collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(BATCH_LIMIT)
      .get();

    if (snap.empty) return;

    const now = Date.now();
    const toSend = [];

    snap.forEach(doc => {
      const n = doc.data();
      if (n.sentAt) return;

      const createdMs = n.createdAt?.toMillis?.() || 0;
      const age = now - createdMs;

      if (age < MIN_AGE_MS) return;
      if (age > MAX_AGE_MS) {
        doc.ref.update({
          sentAt: FieldValue.serverTimestamp(),
          sendStatus: 'expired'
        });
        return;
      }
      toSend.push(doc);
    });

    if (toSend.length === 0) return;

    console.log(`\n📬 Tìm thấy ${toSend.length} notification cần gửi`);

    for (const doc of toSend) {
      const result = await sendNotification(doc);
      if (result.status === 'sent') stats.sent++;
      else if (result.status === 'skipped') stats.skipped++;
      else stats.failed++;
    }
  } catch (err) {
    console.error('❌ Process error:', err.message);
  }
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('   📬 PUSH WORKER v2 — THI ĐUA LỚP');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  console.log(`   Project:      ${sa.project_id}`);
  console.log(`   Poll:         mỗi ${POLL_INTERVAL / 1000}s`);
  console.log(`   Batch:        ${BATCH_LIMIT}`);
  console.log(`   Urgency:      HIGH (tối ưu cho iOS)`);
  console.log('');
  console.log('   ⚠️  GIỮ CMD MỞ — Tắt là không nhận thông báo');
  console.log('');

  await processNotifications();

  setInterval(async () => {
    await processNotifications();
    const uptimeMin = Math.floor((Date.now() - stats.startedAt) / 60000);
    if (uptimeMin > 0 && uptimeMin % 2 === 0) {
      console.log(`[${new Date().toLocaleTimeString('vi-VN')}] ` +
        `Hoạt động ${uptimeMin}p · Đã gửi: ${stats.sent} · ` +
        `Bỏ qua: ${stats.skipped} · Lỗi: ${stats.failed}`);
    }
  }, POLL_INTERVAL);
}

main().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});