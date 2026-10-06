// src/lib/activityTypes.js
// Danh mục hoạt động mặc định — dùng khi Firestore chưa có activity_types

export const DEFAULT_ACTIVITY_TYPES = [
  { code: 'phat_bieu',    name: 'Phát biểu',            points: +1, type: 'activity',  needsConfirm: true },
  { code: 'tra_loi_dung', name: 'Trả lời đúng',         points: +2, type: 'activity',  needsConfirm: true },
  { code: 'giup_ban',     name: 'Giúp bạn',             points: +2, type: 'activity',  needsConfirm: true },
  { code: 'nhiem_vu',     name: 'Hoàn thành nhiệm vụ',  points: +3, type: 'task',      needsConfirm: true },
  { code: 'noi_chuyen',   name: 'Nói chuyện',           points: -1, type: 'violation', needsConfirm: true },
  { code: 'khong_thuoc',  name: 'Không thuộc bài',      points: -2, type: 'violation', needsConfirm: true },
  { code: 'xa_rac',       name: 'Xả rác',               points: -2, type: 'violation', needsConfirm: true },
  { code: 'khac',         name: 'Khác...',              points:  0, type: 'activity',  needsConfirm: true }
];

export const VIOLATION_TYPES = [
  { code: 'noi_chuyen',   name: 'Nói chuyện' },
  { code: 'khong_thuoc',  name: 'Không thuộc bài' },
  { code: 'xa_rac',       name: 'Xả rác' },
  { code: 'khong_nhiem_vu', name: 'Không làm nhiệm vụ' },
  { code: 'vi_pham_noi_quy', name: 'Vi phạm nội quy' }
];

// Ngưỡng mặc định — học sinh cần bao nhiêu vote để verified
export const DEFAULT_THRESHOLDS = {
  request: 3,   // 3 vote là đủ cho request
  report: 5     // 5 vote cho tố cáo
};