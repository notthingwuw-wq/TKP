// src/lib/authRest.js
// Tạo user Firebase Auth qua REST API — hoạt động trên gói Spark miễn phí

const API_KEY = import.meta.env.VITE_FIREBASE_API_KEY;
const BASE = 'https://identitytoolkit.googleapis.com/v1';

/**
 * Tạo user Firebase Auth mới
 */
export async function createAuthUser(email, password) {
  const res = await fetch(`${BASE}/accounts:signUp?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: false
    })
  });

  const data = await res.json();

  if (!res.ok) {
    const code = data.error?.message || 'UNKNOWN';
    const messages = {
      'EMAIL_EXISTS': 'Email đã tồn tại',
      'INVALID_EMAIL': 'Email không hợp lệ',
      'WEAK_PASSWORD': 'Mật khẩu quá yếu (tối thiểu 6 ký tự)',
      'OPERATION_NOT_ALLOWED': 'Chưa bật Email/Password trong Firebase Console'
    };
    throw new Error(messages[code] || `Lỗi: ${code}`);
  }

  return { localId: data.localId, email: data.email };
}

/**
 * Kiểm tra email + password có tồn tại trong Auth không
 * Trả về { localId, email } nếu đúng, null nếu sai
 */
export async function signInExistingUser(email, password) {
  const res = await fetch(`${BASE}/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: false
    })
  });

  if (!res.ok) return null;

  const data = await res.json();
  return { localId: data.localId, email: data.email };
}