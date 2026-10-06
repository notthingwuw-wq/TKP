# Hướng dẫn Import Học sinh

## Tổng quan

Hệ thống import học sinh cho Firebase Spark (không có Cloud Functions) sử dụng **script Node.js chạy local** để tạo Firebase Auth users.

## Luồng hoạt động

```
Admin Web → Upload Excel → Firestore (import_queue)
                ↓
        Script Node.js (local)
                ↓
     Firebase Auth + Firestore (users)
                ↓
        Học sinh đăng nhập → Chọn tổ
```

---

## Bước 1: Chuẩn bị file Excel

### Download file mẫu

Tải file mẫu từ Admin Panel hoặc từ `samples/danh-sach-hoc-sinh-mau.xlsx`

### Format file Excel

File cần có các cột sau (có thể đặt tên khác nhau):

| Cột | Tên khác được chấp nhận | Bắt buộc | Ghi chú |
|-----|-------------------------|----------|---------|
| Họ và tên | Họ tên, name | ✅ | Tên đầy đủ |
| Email | email | ✅ | Phải có `@` |
| Mật khẩu tạm | Mật khẩu, password | ✅ | Tối thiểu 6 ký tự |
| Tổ | Team, team | ✅ | Số từ 1-4 |

### Ví dụ:

| STT | Họ và tên | Email | Mật khẩu tạm | Tổ |
|-----|-----------|-------|---------------|-----|
| 1 | Nguyễn Văn A | nguyenvana@truong.edu.vn | 123456 | 1 |
| 2 | Trần Thị B | tranthib@truong.edu.vn | 123456 | 2 |
| 3 | Lê Văn C | levanc@truong.edu.vn | 123456 | 3 |

---

## Bước 2: Upload qua Admin Panel

1. Đăng nhập với tài khoản Admin
2. Vào `/admin/import`
3. Chọn lớp (hoặc tạo lớp mới ở `/admin/classes`)
4. Upload file Excel
5. Xem preview 5 dòng đầu
6. Nếu có lỗi → sửa file → upload lại
7. Nếu OK → bấm **"Đưa vào hàng đợi import"**

Hệ thống sẽ tạo một document trong Firestore collection `import_queue` với:
- `status: "pending"`
- Danh sách học sinh
- Thông tin lớp

---

## Bước 3: Lấy Service Account Key

**Chỉ làm 1 lần:**

1. Truy cập [Firebase Console](https://console.firebase.google.com/)
2. Chọn project
3. ⚙️ Project Settings → Service accounts
4. Click **"Generate new private key"**
5. Tải file JSON về
6. Đổi tên thành `service-account.json`
7. Copy vào folder `thiduaclass/scripts/`
8. **QUAN TRỌNG:** File này chứa quyền admin, **KHÔNG ĐƯỢC COMMIT LÊN GIT**

---

## Bước 4: Chạy script import

### Cài đặt dependencies (chỉ lần đầu)

```bash
cd thiduaclass
npm install
```

### Chạy script

```bash
node scripts/import-students.js
```

### Script sẽ:

1. ✅ Kết nối Firebase Admin SDK
2. ✅ Query tất cả queue có `status: "pending"`
3. ✅ Với mỗi học sinh:
   - Kiểm tra email đã tồn tại chưa
   - Tạo Firebase Auth user
   - Tạo Firestore document trong `users` collection
4. ✅ Cập nhật kết quả vào queue (`status: "done"`)
5. ✅ Ghi audit log

### Output mẫu:

```
🚀 Bắt đầu import học sinh...

📦 Tìm thấy 1 queue đang chờ xử lý

============================================================
📚 Xử lý queue: Lớp 10A1
   Queue ID: abc123xyz
   Số học sinh: 3
============================================================

[1/3] Xử lý: nguyenvana@truong.edu.vn
   ✅ Đã tạo Auth user: uid123
   ✅ Đã tạo Firestore document
   ✨ Hoàn thành!

[2/3] Xử lý: tranthib@truong.edu.vn
   ✅ Đã tạo Auth user: uid456
   ✅ Đã tạo Firestore document
   ✨ Hoàn thành!

[3/3] Xử lý: existing@email.com
   ⚠️  Email đã tồn tại, bỏ qua

============================================================
📊 KẾT QUẢ: Lớp 10A1
============================================================
✅ Thành công: 2/3
❌ Thất bại:   1/3

❌ Chi tiết lỗi:
   1. existing@email.com: Email đã tồn tại trong hệ thống
============================================================

✅ Hoàn thành tất cả queue!
```

---

## Bước 5: Xem kết quả

1. Quay lại Admin Panel → `/admin/queue`
2. Refresh trang (F5)
3. Thấy queue vừa import với status **"Hoàn thành"**
4. Click vào để xem chi tiết:
   - Danh sách thành công (email, UID)
   - Danh sách thất bại (email, lỗi)

---

## Bước 6: Học sinh đăng nhập lần đầu

Khi học sinh đăng nhập:

1. Nhập email/password (mật khẩu tạm từ file Excel)
2. Hệ thống phát hiện `teamId: null`
3. Hiện popup **"Chọn tổ của bạn"**
4. Học sinh chọn 1 trong 4 tổ
5. Hệ thống cập nhật:
   - `users/{uid}.teamId = "team1"`
   - `users/{uid}.status = "active"`
   - `teams/team1.memberIds` thêm uid
6. Đóng popup, vào trang Home

**Lưu ý:** Học sinh chỉ chọn tổ 1 lần, không thể đổi sau đó.

---

## Xử lý lỗi thường gặp

### ❌ "Không tìm thấy file service-account.json"

**Nguyên nhân:** Chưa có Service Account Key

**Giải pháp:**
1. Tải key từ Firebase Console
2. Lưu vào `scripts/service-account.json`

---

### ❌ "Email đã tồn tại trong hệ thống"

**Nguyên nhân:** Email đã được import trước đó hoặc tạo thủ công

**Giải pháp:**
- Bỏ qua (script tự động skip)
- Hoặc xóa user cũ trong Firebase Console → Authentication

---

### ❌ "Invalid password"

**Nguyên nhân:** Mật khẩu trong Excel < 6 ký tự

**Giải pháp:**
- Sửa file Excel
- Upload lại
- Script sẽ từ chối ngay tại bước preview

---

### ❌ Script chạy nhưng không thấy user trong Firebase

**Kiểm tra:**
1. Script có in "✅ Đã tạo Auth user" không?
2. Kiểm tra Firebase Console → Authentication → Users
3. Kiểm tra Firestore → `users` collection
4. Xem queue trong Admin Panel → có status "done" không?

---

## Tạo tài khoản Admin

Để tạo tài khoản Admin đầu tiên:

```bash
node scripts/create-admin.js admin@truong.edu.vn Admin123! "Quản trị viên"
```

Output:

```
🚀 Tạo tài khoản Admin...

📧 Email: admin@truong.edu.vn
👤 Tên: Quản trị viên

📝 Tạo Firebase Auth user...
✅ Đã tạo Auth user: uid_admin

📝 Tạo Firestore document...
✅ Đã tạo/cập nhật Firestore document

============================================================
🎉 HOÀN THÀNH!
============================================================
✅ UID:      uid_admin
✅ Email:    admin@truong.edu.vn
✅ Tên:      Quản trị viên
✅ Role:     admin
============================================================
```

---

## Cấu trúc Firestore

### Collection: `import_queue`

```javascript
{
  id: "auto_generated",
  classId: "10A1",
  className: "Lớp 10A1",
  students: [
    {
      name: "Nguyễn Văn A",
      email: "nguyenvana@truong.edu.vn",
      password: "123456",
      teamNumber: 1
    }
  ],
  status: "pending" | "processing" | "done" | "failed",
  createdBy: "admin_uid",
  createdAt: Timestamp,
  processedAt: Timestamp,
  result: {
    success: [
      { email: "...", uid: "...", name: "..." }
    ],
    failed: [
      { email: "...", error: "...", name: "..." }
    ],
    successCount: 2,
    failedCount: 1
  }
}
```

### Collection: `users` (sau import)

```javascript
{
  id: "firebase_auth_uid",
  name: "Nguyễn Văn A",
  email: "nguyenvana@truong.edu.vn",
  role: "student",
  classId: "10A1",
  teamId: null,              // Chưa chọn tổ
  status: "pending",         // Chờ chọn tổ
  falseReportCount: 0,
  createdAt: Timestamp,
  createdBy: "import",
  importQueueId: "queue_id"
}
```

---

## Security

### Service Account Key

⚠️ **CỰC KỲ QUAN TRỌNG:**

- File `service-account.json` có quyền **ADMIN TOÀN BỘ** Firebase project
- **KHÔNG BAO GIỜ** commit lên Git
- **KHÔNG BAO GIỜ** chia sẻ cho người khác
- Lưu ở nơi an toàn
- Thêm vào `.gitignore`:

```
scripts/service-account.json
```

### Firestore Rules

Collection `import_queue` chỉ admin mới đọc/ghi:

```javascript
match /import_queue/{queueId} {
  allow read, write: if isAdmin();
}
```

---

## FAQ

**Q: Tại sao không dùng Cloud Functions?**

A: Gói Spark miễn phí không hỗ trợ Cloud Functions. Script Node.js local là giải pháp thay thế.

**Q: Script có chạy trên server không?**

A: Không. Script chạy trên máy admin, dùng Service Account Key để gọi Firebase Admin SDK.

**Q: Học sinh có thể tự import không?**

A: Không. Chỉ admin mới có quyền tạo queue và chạy script.

**Q: Script có tự động chạy không?**

A: Không. Admin phải chạy thủ công mỗi khi có queue mới.

**Q: Có thể chạy script trên GitHub Actions không?**

A: Có, nhưng cần lưu Service Account Key trong GitHub Secrets. Không khuyến khích với project nhỏ.

**Q: Import 100 học sinh mất bao lâu?**

A: Khoảng 10-30 giây (tùy mạng). Script có delay 100ms giữa mỗi user để tránh rate limit.

---

## Tóm tắt Commands

```bash
# Cài đặt (lần đầu)
cd thiduaclass
npm install

# Tạo admin
node scripts/create-admin.js <email> <password> <name>

# Import học sinh (chạy sau khi upload queue trên web)
node scripts/import-students.js

# Deploy Firestore Rules
firebase deploy --only firestore:rules
```

---

**Lưu ý cuối:** Sau khi import xong, nhớ gửi email/password cho học sinh để họ đăng nhập lần đầu!
