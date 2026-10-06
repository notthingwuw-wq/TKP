#!/usr/bin/env node
/**
 * Script test kết nối Firebase
 * Chạy để kiểm tra service-account.json có hoạt động không
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  const serviceAccountPath = path.join(__dirname, 'service-account.json');

  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ Không tìm thấy file service-account.json');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  const db = admin.firestore();

  console.log('✅ Kết nối Firebase Admin SDK thành công!');
  console.log(`📁 Project ID: ${serviceAccount.project_id}`);

  // Test read Firestore
  const snap = await db.collection('users').limit(1).get();
  console.log(`✅ Đọc Firestore OK (${snap.size} documents)`);

  process.exit(0);

} catch (error) {
  console.error('❌ Lỗi:', error.message);
  process.exit(1);
}
