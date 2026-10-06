# 🎯 Hướng dẫn cài đặt ADMIN + Import XLSX

## ✨ Tính năng mới

✅ **Role ADMIN** - Quản lý toàn hệ thống  
✅ **Import học sinh từ Excel** - Upload file, script xử lý  
✅ **Popup chọn tổ** - Học sinh chọn tổ khi đăng nhập lần đầu  
✅ **Dashboard Admin** - Thống kê tổng quan  
✅ **Quản lý users** - Xem, filter, export Excel  
✅ **Quản lý lớp** - Tạo/xóa lớp  

---

## 📦 Cài đặt

### 1. Clone và install

```bash
cd thiduaclass
npm install
```

### 2. Thêm package mới

Package `xlsx` đã được thêm vào `package.json`. Nếu cần install riêng:

```bash
npm install xlsx
```

### 3. Cấu hình Firebase (nếu chưa)

Tạo file `.env.local`:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 4. Deploy Firestore Rules (BẮT BUỘC)

Rules đã được cập nhật để hỗ trợ:
- Collection `import_queue`
- Student update `teamId` khi chọn tổ
- Admin full access

```bash
firebase deploy --only firestore:rules
```

---

## 🔐 Tạo tài khoản Admin đầu tiên

### Bước 1: Lấy Service Account Key

1. Firebase Console → Project Settings → Service accounts
2. Click **"Generate new private key"**
3. Lưu file thành `scripts/service-account.json`

⚠️ **QUAN TRỌNG:** File này có quyền admin toàn bộ project. **KHÔNG commit lên Git!**

### Bước 2: Chạy script

```bash
node scripts/create-admin.js admin@truong.edu.vn Admin123! "Quản trị viên"
```

Thay đổi email, password, tên theo ý bạn.

### Bước 3: Đăng nhập

```bash
npm run dev
```

Truy cập `http://localhost:5173/login` và đăng nhập bằng tài khoản admin vừa tạo.

---

## 📤 Import học sinh từ Excel

### Luồng hoạt động

```
Admin Web → Upload Excel → Firestore (queue)
                ↓
        node scripts/import-students.js
                ↓
        Firebase Auth + Firestore
                ↓
        Học sinh đăng nhập → Chọn tổ
```

### Bước 1: Chuẩn bị file Excel

Download file mẫu từ Admin Panel hoặc xem `samples/danh-sach-hoc-sinh-mau.csv`

Format bắt buộc:

| Họ và tên | Email | Mật khẩu tạm | Tổ |
|-----------|-------|---------------|-----|
| Nguyễn Văn A | nguyenvana@truong.edu.vn | 123456 | 1 |

**Lưu ý:**
- Email phải có `@`
- Mật khẩu >= 6 ký tự
- Tổ từ 1-4

### Bước 2: Upload qua Admin Panel

1. Đăng nhập Admin → `/admin/import`
2. Chọn lớp (hoặc tạo mới ở `/admin/classes`)
3. Upload file Excel
4. Preview → sửa lỗi nếu có
5. Click **"Đưa vào hàng đợi"**

### Bước 3: Chạy script import

```bash
node scripts/import-students.js
```

Script sẽ:
- ✅ Tạo Firebase Auth users
- ✅ Tạo Firestore documents
- ✅ Cập nhật kết quả vào queue
- ✅ Ghi audit log

### Bước 4: Xem kết quả

Admin Panel → `/admin/queue` → Refresh (F5)

Xem chi tiết:
- ✅ Số học sinh thành công
- ❌ Số học sinh lỗi (email trùng, v.v.)

---

## 🎓 Học sinh đăng nhập lần đầu

Khi học sinh đăng nhập bằng email/password từ file Excel:

1. Hệ thống phát hiện `teamId: null`
2. Hiện popup **"Chọn tổ của bạn"** (bắt buộc, không thể đóng)
3. Học sinh click chọn Tổ 1/2/3/4
4. Hệ thống cập nhật:
   - `users/{uid}.teamId = "team1"`
   - `users/{uid}.status = "active"`
   - `teams/team1.memberIds` thêm uid
5. Đóng popup, vào trang Home

**Lưu ý:** Chỉ chọn tổ 1 lần duy nhất!

---

## 📂 Cấu trúc file mới

```
thiduaclass/
├── src/
│   ├── components/
│   │   ├── admin/
│   │   │   ├── FileUploader.jsx        # Component drag-drop upload
│   │   │   └── ImportPreview.jsx       # Preview 5 dòng đầu Excel
│   │   └── student/
│   │       └── TeamSelectionModal.jsx  # Popup chọn tổ
│   │
│   ├── hooks/
│   │   └── useTeamSelection.js         # Hook check cần chọn tổ không
│   │
│   └── pages/
│       └── admin/
│           ├── AdminLayout.jsx         # Layout admin với tabs
│           ├── AdminDashboard.jsx      # Tổng quan stats
│           ├── ImportStudents.jsx      # Upload Excel
│           ├── ImportQueue.jsx         # Lịch sử import
│           ├── ManageUsers.jsx         # Quản lý users (filter, export)
│           └── ManageClasses.jsx       # Quản lý lớp
│
├── scripts/
│   ├── create-admin.js                 # Tạo admin
│   ├── import-students.js              # Import học sinh từ queue
│   └── service-account.json            # (gitignore) Service Account Key
│
├── samples/
│   └── danh-sach-hoc-sinh-mau.csv      # File Excel mẫu
│
└── docs/
    └── IMPORT_GUIDE.md                 # Hướng dẫn chi tiết import
```

---

## 🗂️ Firestore Collections mới

### `import_queue`

```javascript
{
  id: "auto",
  classId: "10A1",
  className: "Lớp 10A1",
  students: [
    { name: "...", email: "...", password: "...", teamNumber: 1 }
  ],
  status: "pending" | "processing" | "done" | "failed",
  createdBy: "admin_uid",
  createdAt: Timestamp,
  processedAt: Timestamp,
  result: {
    success: [...],
    failed: [...],
    successCount: 10,
    failedCount: 2
  }
}
```

### `users` (cập nhật)

Thêm fields:
- `status: "pending" | "active"` - Học sinh chưa chọn tổ / đã chọn
- `activatedAt: Timestamp` - Thời điểm chọn tổ
- `createdBy: "import" | "manual"` - Nguồn tạo
- `importQueueId: string` - Link về queue import

---

## 🔒 Firestore Rules cập nhật

### Cho phép student update teamId

```javascript
match /users/{userId} {
  allow update: if isAdmin()
                || (request.auth.uid == userId
                    && request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['settings', 'fcmToken', 'lastSeen', 'teamId', 'status', 'activatedAt', 'updatedAt']));
}
```

### Cho phép student cập nhật team.memberIds

```javascript
match /teams/{teamId} {
  allow update: if isStudent()
                && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['memberIds'])
                && request.resource.data.memberIds.hasAll(resource.data.memberIds);
}
```

### Import queue chỉ admin

```javascript
match /import_queue/{queueId} {
  allow read, write: if isAdmin();
}
```

---

## 🎨 UI/UX

### Admin Panel

- **Route:** `/admin/*`
- **Header:** Tabs ngang với icon
- **Dashboard:** 6 cards stats (tổng users, học sinh, pending, v.v.)
- **Import:** 4 bước wizard (chọn lớp → upload → preview → done)
- **Queue:** List + Detail panel (2 cột responsive)
- **Users:** Table với filter (role, status, search) + export Excel
- **Classes:** Grid cards + modal tạo mới

### Team Selection Modal

- **Full-screen overlay** (không đóng được)
- **4 nút grid 2x2** với màu khác nhau
- **Icon emoji** cho từng tổ
- **Loading spinner** khi đang cập nhật
- **Animation fade-in** khi hiện

### Mobile Responsive

- Admin Panel: tabs scroll ngang trên mobile
- Import Preview: table scroll ngang
- Team Selection: grid 2x2 vừa màn hình mobile

---

## 🐛 Xử lý lỗi

### Email đã tồn tại

Script tự động skip, ghi vào `result.failed`

### File Excel sai format

Frontend validate trước, không cho submit nếu có lỗi

### Mất mạng khi upload

React Hot Toast hiện lỗi, user thử lại

### Script chạy lỗi

Script in chi tiết lỗi từng dòng, không dừng giữa chừng

---

## 📊 Admin Dashboard Stats

- **Tổng users**: Tất cả users (admin + GVCN + students)
- **Học sinh**: Chỉ role="student"
- **Đã kích hoạt**: status="active" (đã chọn tổ)
- **Chờ chọn tổ**: status="pending"
- **Số lớp**: Count classes
- **Import đang chờ**: Queue có status="pending"

---

## 🔐 Security Checklist

- [x] Service Account Key trong `.gitignore`
- [x] Firestore Rules chỉ admin truy cập `import_queue`
- [x] Student chỉ update `teamId` của chính mình
- [x] Student không đọc được `votes` collection
- [x] Admin route protected với `roles={['admin']}`
- [x] Script validate email/password trước khi tạo
- [x] Mật khẩu không hiển thị trong preview (dùng `••••••`)

---

## 🚀 Deployment

### Deploy lên Firebase Hosting

```bash
npm run build
firebase deploy --only hosting,firestore:rules
```

### Script import chạy ở đâu?

**Script chạy trên máy admin**, KHÔNG chạy trên server.

Lý do: Firebase Spark không có Cloud Functions.

**Lưu ý:** Đừng commit `service-account.json` lên Git!

---

## 📚 Tài liệu

- **Import chi tiết:** `docs/IMPORT_GUIDE.md`
- **README tổng quan:** `README.md`

---

## ❓ FAQ

**Q: Tại sao không tự động chạy script?**

A: Gói Spark không có Cloud Functions. Script phải chạy local.

**Q: Có thể chạy script trên GitHub Actions không?**

A: Có, nhưng cần lưu Service Account Key trong GitHub Secrets. Rủi ro bảo mật cao hơn.

**Q: Học sinh có thể đổi tổ không?**

A: Không. Chỉ chọn 1 lần duy nhất khi đăng nhập lần đầu.

**Q: Admin có thể sửa tổ của học sinh không?**

A: Hiện tại chưa có UI. Có thể sửa trực tiếp trong Firestore Console hoặc thêm tính năng sau.

**Q: Import 100 học sinh mất bao lâu?**

A: Khoảng 10-30 giây (có delay 100ms giữa mỗi request để tránh rate limit).

**Q: File Excel có giới hạn dung lượng không?**

A: Tối đa 10MB (check ở FileUploader component).

---

## 🎉 Hoàn thành!

Bây giờ bạn có:

✅ Admin Panel đầy đủ  
✅ Import Excel + script xử lý  
✅ Popup chọn tổ cho học sinh  
✅ Dashboard thống kê  
✅ Quản lý users & classes  

**Next steps:**

1. Tạo admin đầu tiên
2. Tạo lớp
3. Import học sinh
4. Gửi email/password cho học sinh
5. Học sinh đăng nhập → chọn tổ → sử dụng hệ thống

---

**Version:** 2.1.0 (Admin + Import)  
**Updated:** 2026-10-03
