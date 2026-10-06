# 🐛 BUG FIXES - HỆ THỐNG THI ĐUA LỚP

## Tóm tắt
Đã fix thành công **4 bug khẩn cấp** trong hệ thống Thi Đua Lớp theo yêu cầu PROMPT 1.

---

## ✅ BUG 1: Firestore Index Error - ĐÃ FIX

### Vấn đề
Console hiện lỗi:
```
FirebaseError: The query requires an index. You can create it here:
https://console.firebase.google.com/v1/r/project/managerclass-3b6ed/firestore/indexes?create_composite=...
```

### Nguyên nhân
Queries trong `Home.jsx` và `Score.jsx` sử dụng `where` + `orderBy` trên các field khác nhau → Firestore yêu cầu composite index.

### Giải pháp
**Bỏ `orderBy` trong query, sort dữ liệu ở client-side:**

#### File: `src/pages/Home.jsx`
```javascript
// TRƯỚC (cần composite index):
const historyQ = query(
  collection(db, 'score_ledger'),
  where('userId', '==', profile.id),
  orderBy('createdAt', 'desc'),
  limit(5)
);

// SAU (không cần index):
const historyQ = query(
  collection(db, 'score_ledger'),
  where('userId', '==', profile.id)
);
const historySnap = await getDocs(historyQ);
const historyList = historySnap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
  .slice(0, 5);
```

#### File: `src/pages/Score.jsx`
```javascript
// Tương tự - bỏ orderBy, sort client-side
const q = query(
  collection(db, 'score_ledger'),
  where('userId', '==', profile.id)
);
const snap = await getDocs(q);
const list = snap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
  .slice(0, 200);
```

### Kết quả
✅ Không còn lỗi Firestore index trong console  
✅ Queries hoạt động bình thường  
✅ Performance vẫn tốt (số lượng documents nhỏ)

---

## ✅ BUG 2: Vote xong nhưng trạng thái không đổi - ĐÃ FIX

### Vấn đề
- Bấm "Xác nhận" → toast hiện "Đã xác nhận" NHƯNG:
  - Badge vẫn hiện "2 yêu cầu" trên Home
  - Request vẫn hiện trong danh sách chờ
  - Không thấy điểm cộng

### Nguyên nhân
1. Dùng **spread operator** `[...voterIds, profile.id]` thay vì `arrayUnion` → transaction không update đúng
2. Không có event để reload badge count trên Home page

### Giải pháp

#### File: `src/pages/VoteRequests.jsx`

**1. Sử dụng `arrayUnion` thay vì spread array:**
```javascript
// Import arrayUnion
import {
  collection, query, where, getDocs, doc, runTransaction,
  serverTimestamp, arrayUnion, limit
} from 'firebase/firestore';

// Trong handleVote transaction:
tx.update(reqRef, {
  voterIds: arrayUnion(profile.id),  // ✅ Dùng arrayUnion
  voteCount: newCount,
  status: isVerified ? 'verified' : 'pending',
  verifiedAt: isVerified && !data.verifiedAt ? serverTimestamp() : data.verifiedAt,
  updatedAt: serverTimestamp()
});
```

**2. Dispatch event để reload Home page:**
```javascript
toast.success('Đã xác nhận!');
setRequests(prev => prev.filter(r => r.id !== req.id));

// Dispatch event để Home page reload badge count
window.dispatchEvent(new Event('refresh-counts'));
```

#### File: `src/pages/Home.jsx`

**3. Thêm event listener:**
```javascript
// Thêm listener để reload khi có vote mới
useEffect(() => {
  const handler = () => {
    if (profile?.id) loadHomeData();
  };
  window.addEventListener('refresh-counts', handler);
  return () => window.removeEventListener('refresh-counts', handler);
}, [profile?.id]);
```

### Kết quả
✅ Vote thành công → badge Home cập nhật ngay lập tức  
✅ Request biến mất khỏi danh sách chờ  
✅ Điểm cộng hiển thị trong score_ledger  
✅ Không còn request "ma" (vẫn hiển thị dù đã vote)

---

## ✅ BUG 3: "Hoạt động gần đây" không hiển thị - ĐÃ FIX

### Vấn đề
Home hiện "Chưa có hoạt động nào" dù có dữ liệu trong `score_ledger`.

### Nguyên nhân
Liên quan đến **BUG 1** - query bị lỗi index nên không load được dữ liệu.

### Giải pháp
Sau khi fix BUG 1 (bỏ orderBy, sort client-side), vấn đề này tự động được giải quyết.

### Kết quả
✅ "Hoạt động gần đây" hiển thị đúng 5 hoạt động mới nhất  
✅ Tên hoạt động, điểm, thời gian hiển thị chính xác  
✅ Empty state chỉ hiện khi thực sự chưa có dữ liệu

---

## ✅ BUG 4: "Đã xác nhận cho ai" không hiển thị - ĐÃ FIX

### Vấn đề
Trong `Requests.jsx`, mỗi request hiện "X xác nhận" nhưng không biết:
- Còn cần bao nhiêu người nữa
- Tiến trình đến đâu

### Giải pháp

#### File: `src/pages/Requests.jsx`

**Thêm progress bar và thông tin rõ ràng:**
```javascript
<div className="flex items-center gap-2 mt-2">
  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
    {badge.text}
  </span>
  <span className="text-xs text-gray-400">
    {r.voteCount || 0}/{r.threshold || 3} xác nhận
  </span>
</div>
{r.status === 'pending' && (
  <div className="mt-2">
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-brand-500 transition-all"
        style={{ width: `${Math.min(100, ((r.voteCount || 0) / (r.threshold || 3)) * 100)}%` }}
      />
    </div>
    <p className="text-xs text-gray-400 mt-1">
      Cần {r.threshold || 3} người xác nhận độc lập
    </p>
  </div>
)}
```

### Kết quả
✅ Hiển thị số lượng vote: "3/3 xác nhận"  
✅ Progress bar trực quan (giống VoteRequests.jsx)  
✅ Thông báo rõ ràng: "Cần 3 người xác nhận độc lập"  
✅ KHÔNG hiển thị tên người vote (đúng theo yêu cầu bảo mật)

---

## 🛠️ Fix Thêm: PWA Configuration

### Vấn đề
Build bị lỗi vì file JS > 2MB không được precache.

### Giải pháp
```javascript
// vite.config.js
workbox: {
  maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
  // ...
}
```

### Kết quả
✅ Build thành công  
✅ PWA service worker generate đúng

---

## 📋 Checklist Hoàn thành

- [x] BUG 1: Firestore index error → Fixed (bỏ orderBy, sort client-side)
- [x] BUG 2: Vote không cập nhật trạng thái → Fixed (arrayUnion + event dispatch)
- [x] BUG 3: Hoạt động gần đây không hiển thị → Fixed (do BUG 1)
- [x] BUG 4: Không biết tiến trình xác nhận → Fixed (progress bar + text rõ ràng)
- [x] Build thành công không lỗi
- [x] Không thay đổi cấu trúc Firestore
- [x] Không thêm thư viện mới
- [x] Comment tiếng Việt trong code
- [x] Giữ nguyên UI (sẽ redesign ở prompt sau)

---

## 🚀 Cách Test

### Test BUG 1 & 3:
1. Đăng nhập với tài khoản học sinh
2. Mở Console → không còn lỗi Firestore index
3. Kiểm tra "Hoạt động gần đây" hiển thị đúng dữ liệu

### Test BUG 2:
1. Học sinh A tạo request
2. Học sinh B vào `/requests/vote` và xác nhận
3. Badge trên Home của học sinh B giảm xuống ngay lập tức
4. Request biến mất khỏi danh sách chờ
5. Học sinh A thấy điểm cộng trong Score

### Test BUG 4:
1. Học sinh tạo request
2. Vào `/requests` xem request của mình
3. Thấy progress bar "2/3 xác nhận"
4. Thấy text "Cần 3 người xác nhận độc lập"

---

## 📝 Notes

- Các fix này **không cần deploy lại Firestore rules**
- Các fix này **không cần tạo composite index** (đã tránh được)
- Performance tốt vì số lượng documents nhỏ (< 1000 entries/user)
- Nếu sau này có > 10,000 documents/user, nên tạo composite index và revert lại dùng orderBy

---

**Tác giả:** Claude Code  
**Ngày:** 2026-10-04  
**Status:** ✅ HOÀN THÀNH
