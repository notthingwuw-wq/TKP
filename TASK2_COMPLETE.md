# ✅ NHIỆM VỤ 2 - HOÀN THÀNH
## TẠO 3 TRANG REPORT/APPEAL

**Thời gian:** 2026-10-04  
**Trạng thái:** ✅ HOÀN THÀNH

---

## 📁 Files đã tạo

### 1. src/pages/Reports.jsx ✅
**Chức năng:** Xem danh sách tố cáo

**Features:**
- ✅ 2 tabs: "Tôi gửi" (reporterId == uid) và "Nhắm vào tôi" (targetUserId == uid)
- ✅ Query không dùng orderBy → sort client-side (tránh composite index error)
- ✅ Hiển thị: violationName, description, badge status, số vote/threshold
- ✅ Nếu tab "Nhắm vào tôi" + status='verified' + chưa có appealSubmittedAt:
  - Nút "Gửi kháng nghị" → navigate to `/appeals/new?reportId={id}`
- ✅ Nút "+ Tạo tố cáo" → navigate to `/reports/new`
- ✅ Empty state với icon lucide (AlertTriangle)
- ✅ Badge status với màu sắc rõ ràng
- ✅ Link xem bằng chứng (nếu có)
- ✅ Hiển thị thời gian tạo format đẹp

**Status badges:**
```javascript
pending: 'Chờ xác nhận' (vàng)
verified: 'Đã xác nhận' (xanh dương)
confirmed: 'Đã xác nhận vi phạm' (đỏ)
rejected: 'Đã bác bỏ' (xám)
need_info: 'Cần thêm thông tin' (cam)
expired: 'Hết hạn' (xám)
```

---

### 2. src/pages/CreateReport.jsx ✅
**Chức năng:** Form tạo tố cáo mới

**Features:**
- ✅ Dropdown "Người bị tố cáo": load users where classId == profile.classId AND role == 'student'
- ✅ Loại trừ chính mình khỏi danh sách
- ✅ Dropdown "Loại vi phạm" với 5 loại hardcode:
  ```javascript
  - Nói chuyện trong giờ học (-1 điểm)
  - Không thuộc bài (-2 điểm)
  - Xả rác (-1 điểm)
  - Không làm nhiệm vụ được giao (-2 điểm)
  - Vi phạm nội quy khác (-1 điểm)
  ```
- ✅ Textarea mô tả (required, min 10 ký tự) với counter
- ✅ Input URL bằng chứng (optional, type="url")
- ✅ Validation:
  - Không cho tự tố chính mình
  - Mô tả >= 10 ký tự
  - Phải chọn người bị tố + loại vi phạm
- ✅ Khi submit:
  - Tạo document trong `reports` collection
  - threshold = 5
  - status = 'pending'
  - voteCount = 0, voterIds = []
  - Lưu classId để GVCN filter được
- ✅ Cảnh báo nổi bật về hậu quả tố cáo sai
- ✅ Toast success → navigate về `/reports`

---

### 3. src/pages/Appeals.jsx ✅
**Chức năng:** Form gửi kháng nghị

**Features:**
- ✅ Nhận reportId từ URL query params (`useSearchParams`)
- ✅ Load report tương ứng + validate:
  - Report phải tồn tại
  - targetUserId phải là profile.id (chỉ người bị tố mới được kháng nghị)
  - status phải là 'verified' hoặc 'confirmed'
- ✅ Hiển thị thông tin report gốc:
  - Loại vi phạm
  - Mô tả
  - Link bằng chứng (nếu có)
  - Ngày tạo
- ✅ Check xem đã có kháng nghị chưa:
  - Nếu có → hiển thị thông báo "Đã gửi kháng nghị", không cho gửi lại
- ✅ Form kháng nghị:
  - Textarea "Giải trình" (required, min 20 ký tự) với counter
  - Input URL bằng chứng phản bác (optional)
- ✅ Khi submit:
  - Tạo document trong `appeals` collection:
    ```javascript
    {
      reportId, appellantId, content, evidenceUrls,
      status: 'pending', createdAt
    }
    ```
  - Update report: `appealSubmittedAt = serverTimestamp()`
- ✅ Cảnh báo về việc chỉ kháng nghị khi có căn cứ
- ✅ Toast success + navigate về `/reports`

---

### 4. src/App.jsx - Cập nhật routes ✅

**Thêm 3 routes mới trong student section:**
```jsx
<Route path="/reports" element={<Reports />} />
<Route path="/reports/new" element={<CreateReport />} />
<Route path="/appeals/new" element={<Appeals />} />
```

**Import statements:**
```javascript
import Reports from './pages/Reports';
import CreateReport from './pages/CreateReport';
import Appeals from './pages/Appeals';
```

---

## 🎨 UI/UX Design

### Tuân thủ design principles:
- ✅ KHÔNG dùng emoji icon → dùng lucide-react (AlertTriangle, Plus, ArrowLeft, MessageSquare)
- ✅ Font Inter, size 16px base
- ✅ Màu brand navy (#1e5aa8)
- ✅ Badge với màu pastel nhẹ, border rõ ràng
- ✅ Empty state professional với icon + text
- ✅ Loading spinner brand-colored
- ✅ Form validation rõ ràng với counter
- ✅ Button states: hover, disabled
- ✅ Mobile-first responsive

### Layout pattern:
- Header: title + action button (+ Tạo mới)
- Content: tabs / form / list
- Card-based list với hover effect
- Form với label rõ ràng, required mark (*)
- Button group: Cancel + Submit

---

## 🔒 Security & Validation

### CreateReport.jsx:
- ✅ Không cho tự tố chính mình
- ✅ Chỉ load học sinh cùng lớp (classId match)
- ✅ Chỉ load role='student'
- ✅ Min length validation (mô tả >= 10 chars)
- ✅ URL type validation cho evidence

### Appeals.jsx:
- ✅ Check targetUserId === profile.id (chỉ người bị tố mới được kháng nghị)
- ✅ Check status phải verified/confirmed
- ✅ Check đã có appeal chưa (không cho submit 2 lần)
- ✅ Min length validation (giải trình >= 20 chars)

### Reports.jsx:
- ✅ Filter đúng reporterId hoặc targetUserId
- ✅ Không hiển thị tên người tố cáo trong tab "Nhắm vào tôi" (ẩn danh)
- ✅ Chỉ hiện nút "Gửi kháng nghị" khi đủ điều kiện

---

## 📊 Firestore Structure

### reports collection:
```javascript
{
  reporterId: string,           // uid người tố cáo
  targetUserId: string,         // uid người bị tố
  targetUserName: string,       // tên người bị tố
  targetTeamId: string,         // teamId người bị tố
  classId: string,              // để GVCN filter
  violationCode: string,        // 'noi_chuyen', 'khong_thuoc', ...
  violationName: string,        // 'Nói chuyện trong giờ học'
  description: string,          // mô tả chi tiết
  evidenceUrls: string[],       // link bằng chứng
  status: string,               // 'pending'|'verified'|'confirmed'|'rejected'|'need_info'|'expired'
  voteCount: number,            // số vote hiện tại
  voterIds: string[],           // uid của người đã vote
  threshold: number,            // 5 (cần 5 vote)
  gvcnDecision: object|null,    // {decision, note, reviewedBy, reviewedAt}
  appealSubmittedAt: Timestamp|null,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### appeals collection:
```javascript
{
  reportId: string,             // id của report
  appellantId: string,          // uid người kháng nghị (= targetUserId)
  content: string,              // nội dung giải trình
  evidenceUrls: string[],       // link bằng chứng phản bác
  status: string,               // 'pending'|'reviewed'
  createdAt: Timestamp
}
```

---

## 🧪 Testing Checklist

### Reports.jsx:
- [ ] Tab "Tôi gửi" hiển thị đúng reports của mình
- [ ] Tab "Nhắm vào tôi" hiển thị đúng reports targetUserId == uid
- [ ] Nút "Gửi kháng nghị" chỉ hiện khi status='verified' và chưa có appealSubmittedAt
- [ ] Badge màu đúng theo status
- [ ] Empty state hiển thị khi không có data
- [ ] Nút "+ Tạo tố cáo" navigate đúng

### CreateReport.jsx:
- [ ] Dropdown học sinh chỉ hiển thị cùng lớp, loại trừ chính mình
- [ ] Dropdown vi phạm hiển thị đủ 5 loại
- [ ] Validation mô tả >= 10 ký tự
- [ ] Không cho tự tố chính mình
- [ ] Submit thành công → toast + navigate về /reports
- [ ] Loading state khi load students

### Appeals.jsx:
- [ ] Load report đúng từ reportId query param
- [ ] Chỉ cho người bị tố (targetUserId) kháng nghị
- [ ] Không cho kháng nghị nếu đã submit rồi
- [ ] Validation giải trình >= 20 ký tự
- [ ] Submit thành công → toast + navigate về /reports
- [ ] Hiển thị thông tin report gốc đầy đủ

---

## 🚀 Next Steps

Sau khi user test NHIỆM VỤ 2, chuyển sang:

**NHIỆM VỤ 3 - REDESIGN UI + LOGO:**
- Cài lucide-react
- Cập nhật tailwind.config.js với brand colors
- Redesign AppShell với bottom nav icons
- Redesign Home.jsx bỏ gradient chói
- Redesign toàn bộ pages
- Tải + integrate logo trường

---

**Tác giả:** Claude Code  
**Ngày:** 2026-10-04  
**Status:** ✅ HOÀN THÀNH - Chờ user test
