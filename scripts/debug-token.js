// scripts/debug-token.js
// In full token để kiểm tra
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
  console.error('Cách dùng: node scripts/debug-token.js <email>');
  process.exit(1);
}

async function main() {
  const snap = await db.collection('users')
    .where('email', '==', email.toLowerCase())
    .limit(1)
    .get();

  if (snap.empty) {
    console.error(`❌ Không tìm thấy user ${email}`);
    process.exit(1);
  }

  const u = snap.docs[0].data();
  const token = u.fcmToken;

  if (!token) {
    console.error('❌ User chưa có token');
    process.exit(1);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('   TOKEN FULL');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  console.log(`   Length: ${token.length} ký tự`);
  console.log('');
  console.log(`   Full token:`);
  console.log(`   ${token}`);
  console.log('');
  console.log('   Prefix (nên bắt đầu bằng):');
  console.log(`   - "BN..." hoặc "cX..." → Web Push token ✅`);
  console.log(`   - "dG..." hoặc "fG..." → Android token`);
  console.log(`   - Token ngắn < 50 ký tự → có vấn đề`);
  console.log('');
}

main().catch(console.error);