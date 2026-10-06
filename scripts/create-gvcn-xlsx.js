// scripts/create-gvcn-xlsx.js
// Chạy: node scripts/create-gvcn-xlsx.js
// → Tạo samples/danh-sach-gvcn-mau.xlsx với 39 GVCN (3 khối × 13 lớp)

import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tên GVCN mẫu — bạn có thể sửa
const NAMES = [
  'Nguyễn Thị Hồng', 'Trần Văn An', 'Lê Thị Mai', 'Phạm Quốc Bảo',
  'Hoàng Thị Lan', 'Vũ Minh Tuấn', 'Đặng Thị Hoa', 'Bùi Văn Nam',
  'Đỗ Thị Thu', 'Ngô Văn Hùng', 'Dương Thị Yến', 'Lý Văn Sơn',
  'Trịnh Thị Ngọc', 'Cao Văn Đức'
];

const GRADES = [
  { grade: 10, block: 'A' },
  { grade: 11, block: 'B' },
  { grade: 12, block: 'C' }
];

function getName(grade, n) {
  return `GVCN ${grade}${n}`;   // Đơn giản, bạn có thể sửa thành tên thật
}

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Thi Đua Lớp';
  wb.created = new Date();

  const ws = wb.addWorksheet('Danh sách GVCN', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  ws.columns = [
    { header: 'STT',           key: 'stt',      width: 6  },
    { header: 'Họ và tên',     key: 'name',     width: 25 },
    { header: 'Email',         key: 'email',    width: 32 },
    { header: 'Mật khẩu tạm',  key: 'password', width: 16 },
    { header: 'Lớp',           key: 'classId',  width: 10 }
  ];

  // Style header
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E5AA8' } };
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FF174585' } },
      left:   { style: 'thin', color: { argb: 'FF174585' } },
      bottom: { style: 'thin', color: { argb: 'FF174585' } },
      right:  { style: 'thin', color: { argb: 'FF174585' } }
    };
  });

  let stt = 0;
  for (const { grade, block } of GRADES) {
    for (let n = 1; n <= 13; n++) {
      stt++;
      const classId = `${grade}${block}${n}`;
      const email = `gvcn${classId.toLowerCase()}@truong.edu.vn`;
      const name = getName(grade, n);

      const row = ws.addRow({
        stt,
        name,
        email,
        password: '123456',
        classId
      });

      // Alternating color theo khối
      const colors = { 10: 'FFFEF3C7', 11: 'FFDBEAFE', 12: 'FFD1FAE5' };
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors[grade] } };
        cell.border = {
          top:    { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left:   { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right:  { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
        cell.alignment = { vertical: 'middle' };
      });
      row.getCell('stt').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('classId').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('password').alignment = { vertical: 'middle', horizontal: 'center' };
    }
  }

  // Sheet hướng dẫn
  const ws2 = wb.addWorksheet('Hướng dẫn');
  ws2.columns = [{ width: 100 }];
  const guide = [
    { text: '📋 HƯỚNG DẪN IMPORT GVCN', bold: true, size: 16, color: 'FF1E5AA8' },
    { text: '' },
    { text: '1. File này chứa 39 GVCN cho 3 khối (10A1-10A13, 11B1-11B13, 12C1-12C13)' },
    { text: '2. Mỗi lớp 1 GVCN, email format: gvcn{ma_lop}@truong.edu.vn' },
    { text: '3. Mật khẩu mặc định: 123456 (GVCN nên đổi sau khi nhận)' },
    { text: '' },
    { text: '🔄 QUY TRÌNH IMPORT:', bold: true, size: 13, color: 'FF1E5AA8' },
    { text: '   Bước 1: Admin vào /admin/import-gvcn' },
    { text: '   Bước 2: Upload file này' },
    { text: '   Bước 3: Xem preview' },
    { text: '   Bước 4: Bấm "Bắt đầu import"' },
    { text: '   Bước 5: Đợi ~30 giây (39 GVCN)' },
    { text: '' },
    { text: '⚠️ LƯU Ý:' },
    { text: '   - Lớp phải tồn tại trong hệ thống trước khi import GVCN' },
    { text: '   - Nếu lớp chưa có → vào /admin/classes tạo trước' },
    { text: '   - GVCN sẽ được gán vào lớp tương ứng (teacherId)' },
    { text: '   - Email đã tồn tại với mật khẩu khác → bỏ qua (báo lỗi)' }
  ];
  guide.forEach(line => {
    const row = ws2.addRow([line.text || '']);
    if (line.bold) row.font = { bold: true, size: line.size || 12, color: { argb: line.color || 'FF000000' } };
    else row.font = { size: 11 };
  });

  // Save
  const outDir = path.join(__dirname, '..', 'samples');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'danh-sach-gvcn-mau.xlsx');
  await wb.xlsx.writeFile(outPath);

  console.log('');
  console.log('✅ ĐÃ TẠO FILE MẪU GVCN!');
  console.log(`   📁 Vị trí: ${outPath}`);
  console.log(`   👥 Số GVCN: ${stt}`);
  console.log(`   📚 Chia khối: 10A (13) | 11B (13) | 12C (13)`);
  console.log('');
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });