// scripts/create-sample-xlsx.js
// Chạy: node scripts/create-sample-xlsx.js
// → Tạo file samples/danh-sach-hoc-sinh-mau.xlsx

import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== Dữ liệu 16 học sinh, chia 4 tổ =====
const students = [
  // ===== TỔ 1 =====
  { name: 'Nguyễn Văn An',      email: 'hs01@truong.edu.vn', team: 1 },
  { name: 'Trần Thị Bình',       email: 'hs02@truong.edu.vn', team: 1 },
  { name: 'Lê Hoàng Cường',      email: 'hs03@truong.edu.vn', team: 1 },
  { name: 'Phạm Thu Dung',       email: 'hs04@truong.edu.vn', team: 1 },

  // ===== TỔ 2 =====
  { name: 'Hoàng Minh Đức',      email: 'hs05@truong.edu.vn', team: 2 },
  { name: 'Vũ Thị Hằng',         email: 'hs06@truong.edu.vn', team: 2 },
  { name: 'Đặng Quốc Huy',       email: 'hs07@truong.edu.vn', team: 2 },
  { name: 'Bùi Khánh Linh',      email: 'hs08@truong.edu.vn', team: 2 },

  // ===== TỔ 3 =====
  { name: 'Đỗ Thị Mai',          email: 'hs09@truong.edu.vn', team: 3 },
  { name: 'Ngô Văn Nam',         email: 'hs10@truong.edu.vn', team: 3 },
  { name: 'Dương Bảo Ngọc',      email: 'hs11@truong.edu.vn', team: 3 },
  { name: 'Lý Thị Oanh',         email: 'hs12@truong.edu.vn', team: 3 },

  // ===== TỔ 4 =====
  { name: 'Trịnh Văn Phúc',      email: 'hs13@truong.edu.vn', team: 4 },
  { name: 'Cao Thị Quỳnh',       email: 'hs14@truong.edu.vn', team: 4 },
  { name: 'Mai Đức Sơn',         email: 'hs15@truong.edu.vn', team: 4 },
  { name: 'Hồ Thị Trang',        email: 'hs16@truong.edu.vn', team: 4 }
];

const DEFAULT_PASSWORD = '123456';

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Thi Đua Lớp';
  wb.created = new Date();

  // ===== Sheet 1: Danh sách học sinh =====
  const ws = wb.addWorksheet('Danh sách học sinh', {
    views: [{ state: 'frozen', ySplit: 1 }]   // Freeze header row
  });

  // Định nghĩa cột
  ws.columns = [
    { header: 'STT',           key: 'stt',      width: 6  },
    { header: 'Họ và tên',     key: 'name',     width: 25 },
    { header: 'Email',         key: 'email',    width: 32 },
    { header: 'Mật khẩu tạm',  key: 'password', width: 16 },
    { header: 'Tổ',            key: 'team',     width: 8  }
  ];

  // Style cho header
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0EA5E9' }   // brand-500
    };
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FF0284C7' } },
      left:   { style: 'thin', color: { argb: 'FF0284C7' } },
      bottom: { style: 'thin', color: { argb: 'FF0284C7' } },
      right:  { style: 'thin', color: { argb: 'FF0284C7' } }
    };
  });

  // Ghi dữ liệu
  students.forEach((s, idx) => {
    const row = ws.addRow({
      stt: idx + 1,
      name: s.name,
      email: s.email,
      password: DEFAULT_PASSWORD,
      team: s.team
    });

    // Style cho data row
    row.alignment = { vertical: 'middle' };
    row.getCell('stt').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('team').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('password').alignment = { vertical: 'middle', horizontal: 'center' };

    row.eachCell((cell) => {
      cell.border = {
        top:    { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left:   { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right:  { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };
    });

    // Tô màu xen kẽ theo tổ
    const teamColors = {
      1: 'FFFEF3C7',  // vàng nhạt
      2: 'FFDBEAFE',  // xanh dương nhạt
      3: 'FFFCE7F3',  // hồng nhạt
      4: 'FFD1FAE5'   // xanh lá nhạt
    };
    row.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: teamColors[s.team] }
      };
    });
  });

  // ===== Sheet 2: Hướng dẫn =====
  const ws2 = wb.addWorksheet('Hướng dẫn');
  ws2.columns = [{ width: 100 }];

  const instructions = [
    { text: '📋 HƯỚNG DẪN IMPORT DANH SÁCH HỌC SINH', bold: true, size: 16, color: 'FF0EA5E9' },
    { text: '' },
    { text: '1. KHÔNG sửa tên cột ở hàng đầu tiên (STT, Họ và tên, Email, Mật khẩu tạm, Tổ)' },
    { text: '2. Mỗi dòng = 1 học sinh. Có thể thêm/xóa dòng tùy ý.' },
    { text: '3. Cột "Email" phải UNIQUE — không được trùng nhau.' },
    { text: '4. Cột "Mật khẩu tạm" phải có ÍT NHẤT 6 ký tự.' },
    { text: '5. Cột "Tổ" chỉ nhận giá trị: 1, 2, 3, hoặc 4.' },
    { text: '6. Không để trống bất kỳ ô nào trong 5 cột.' },
    { text: '7. File phải lưu định dạng .xlsx (không phải .xls hoặc .csv).' },
    { text: '' },
    { text: '🔄 QUY TRÌNH IMPORT:', bold: true, size: 13, color: 'FF0EA5E9' },
    { text: '   Bước 1: Admin đăng nhập → vào /admin/import' },
    { text: '   Bước 2: Chọn lớp → Upload file này' },
    { text: '   Bước 3: Preview + xác nhận → Đưa vào hàng đợi' },
    { text: '   Bước 4: Chạy lệnh: node scripts/import-students.js' },
    { text: '   Bước 5: Học sinh nhận tài khoản → đăng nhập → chọn tổ' },
    { text: '' },
    { text: '⚠️ LƯU Ý:' },
    { text: '   - Nếu email đã tồn tại trong hệ thống → dòng đó sẽ bị bỏ qua (không lỗi toàn bộ).' },
    { text: '   - Sau khi import, học sinh đăng nhập bằng email + mật khẩu tạm ở trên.' },
    { text: '   - Học sinh nên đổi mật khẩu sau lần đăng nhập đầu tiên.' },
    { text: '' },
    { text: '📧 LIÊN HỆ: Nếu có lỗi, liên hệ admin hoặc GVCN.' }
  ];

  instructions.forEach((line, i) => {
    const row = ws2.addRow([line.text || '']);
    if (line.bold) row.font = { bold: true, size: line.size || 12, color: { argb: line.color || 'FF000000' } };
    else row.font = { size: line.size || 11 };
    row.alignment = { vertical: 'middle', wrapText: true };
  });

  // ===== Lưu file =====
  const outDir = path.join(__dirname, '..', 'samples');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'danh-sach-hoc-sinh-mau.xlsx');
  await wb.xlsx.writeFile(outPath);

  console.log('');
  console.log('✅ ĐÃ TẠO FILE MẪU!');
  console.log(`   📁 Vị trí: ${outPath}`);
  console.log(`   👥 Số học sinh: ${students.length}`);
  console.log(`   📊 Chia tổ: 4 tổ x 4 học sinh`);
  console.log('');
  console.log('👉 Mở file bằng Excel để xem.');
  console.log('👉 Admin có thể upload file này trong /admin/import để test.');
  console.log('');
}

main().catch(err => {
  console.error('❌ LỖI:', err.message);
  process.exit(1);
});