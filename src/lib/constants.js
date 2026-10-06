export const ROLES = {
  STUDENT: 'student',
  GVCN: 'GVCN',
  ADMIN: 'admin'
};

export const REQUEST_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  REVOKED: 'revoked',
  EXPIRED: 'expired'
};

export const REPORT_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  REVIEWING: 'reviewing',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  NEED_INFO: 'need_info',
  EXPIRED: 'expired'
};

export const WARNING_LEVEL = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH'
};

export const WARNING_TYPE = {
  VOTE_PATTERN: 'vote_pattern',
  MUTUAL_REPORT: 'mutual_report',
  RAPID_VOTE: 'rapid_vote',
  DEVICE_DUPLICATE: 'device_duplicate'
};

export const RATE_LIMITS = {
  REQUEST_PER_DAY: 10,
  VOTE_PER_HOUR: 20,
  REPORT_PER_DAY: 3
};

export const DEFAULT_PERIOD_RULES = {
  requestThresholdPercent: 0.10,
  reportThresholdPercent: 0.15,
  voteWindowHours: 48,
  appealWindowHours: 24
};

export const DEFAULT_ACTIVITIES = [
  { code: 'phat_bieu',   name: 'Phát biểu',           points: +1, type: 'activity', needsConfirm: true  },
  { code: 'tra_loi_dung', name: 'Trả lời đúng',       points: +2, type: 'activity', needsConfirm: true  },
  { code: 'giup_ban',     name: 'Giúp bạn',            points: +2, type: 'activity', needsConfirm: true  },
  { code: 'nhiem_vu',     name: 'Hoàn thành nhiệm vụ', points: +3, type: 'task',     needsConfirm: true  },
  { code: 'noi_chuyen',   name: 'Nói chuyện',          points: -1, type: 'violation',needsConfirm: true  },
  { code: 'khong_thuoc',  name: 'Không thuộc bài',     points: -2, type: 'violation',needsConfirm: true  },
  { code: 'xa_rac',       name: 'Xả rác',              points: -2, type: 'violation',needsConfirm: true  }
];