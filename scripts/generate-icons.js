// scripts/generate-icons.js
// Chạy: node scripts/generate-icons.js
// → Tạo icon-192.png, icon-512.png, favicon từ logo có sẵn

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const iconsDir = path.join(publicDir, 'icons');

// Source: logo gốc
const SOURCE = path.join(iconsDir, 'apple-touch-icon.png');

if (!fs.existsSync(SOURCE)) {
  console.error('❌ Không tìm thấy public/icons/apple-touch-icon.png');
  console.error('   Đảm bảo bạn đã có logo trường ở đường dẫn đó.');
  process.exit(1);
}

async function generate() {
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

  // 192x192
  await sharp(SOURCE).resize(192, 192).png().toFile(path.join(iconsDir, 'icon-192.png'));
  console.log('✅ icons/icon-192.png');

  // 512x512
  await sharp(SOURCE).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-512.png'));
  console.log('✅ icons/icon-512.png');

  // 32x32 favicon
  await sharp(SOURCE).resize(32, 32).png().toFile(path.join(publicDir, 'favicon.ico'));
  console.log('✅ favicon.ico');

  // Maskable (crop vuông cho Android)
  await sharp(SOURCE).resize(512, 512, { fit: 'contain', background: { r: 30, g: 90, b: 168, alpha: 1 } })
    .png().toFile(path.join(iconsDir, 'icon-maskable-512.png'));
  console.log('✅ icons/icon-maskable-512.png');

  console.log('\n🎉 Xong! F5 web để thấy logo.');
}
generate().catch(err => { console.error('❌', err.message); process.exit(1); });