import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sa = JSON.parse(fs.readFileSync(path.join(__dirname, 'service-account.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const COLLECTIONS = ['requests', 'reports', 'appeals', 'score_ledger', 'notifications'];

async function main() {
  for (const name of COLLECTIONS) {
    const snap = await db.collection(name).get();
    if (snap.empty) { console.log(`⏭️  ${name}: trống`); continue; }
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`🗑️  ${name}: xóa ${snap.size} docs`);
  }
  console.log('\n✅ Xong!');
}
main().catch(console.error);