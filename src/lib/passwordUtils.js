// src/lib/passwordUtils.js
// Tiện ích đổi mật khẩu — hoạt động trên gói Spark
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  sendPasswordResetEmail,
  getAuth
} from 'firebase/auth';
import { auth } from './firebase';

/**
 * Đổi mật khẩu cho user đang đăng nhập
 * Yêu cầu: nhập đúng mk cũ để reauthenticate (Firebase yêu cầu)
 *
 * @param {string} currentPassword - mật khẩu hiện tại
 * @param {string} newPassword - mật khẩu mới (>=6 ký tự)
 */
export async function changeOwnPassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('Chưa đăng nhập');
  }

  if (newPassword.length < 6) {
    throw new Error('Mật khẩu mới phải từ 6 ký tự');
  }

  // Bước 1: Reauthenticate — Firebase yêu cầu verify lại danh tính
  const credential = EmailAuthProvider.credential(user.email, currentPassword);

  try {
    await reauthenticateWithCredential(user, credential);
  } catch (err) {
    // Map lỗi
    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      throw new Error('Mật khẩu hiện tại không đúng');
    }
    if (err.code === 'auth/too-many-requests') {
      throw new Error('Quá nhiều lần thử. Vui lòng đợi vài phút');
    }
    throw new Error('Xác thực thất bại: ' + err.message);
  }

  // Bước 2: Update password
  try {
    await updatePassword(user, newPassword);
  } catch (err) {
    if (err.code === 'auth/weak-password') {
      throw new Error('Mật khẩu quá yếu (tối thiểu 6 ký tự)');
    }
    if (err.code === 'auth/requires-recent-login') {
      throw new Error('Phiên đăng nhập quá cũ. Vui lòng đăng xuất và đăng nhập lại');
    }
    throw new Error('Đổi mật khẩu thất bại: ' + err.message);
  }
}

/**
 * Gửi email reset password (dùng khi admin reset cho user khác)
 * Firebase sẽ gửi email cho user với link đổi mk
 *
 * @param {string} email - email của user cần reset
 */
export async function sendResetPasswordEmail(email) {
  try {
    await sendPasswordResetEmail(auth, email, {
      url: window.location.origin + '/login',  // Link quay về sau khi đổi
      handleCodeInApp: false
    });
    return true;
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      throw new Error('Email không tồn tại trong hệ thống');
    }
    if (err.code === 'auth/too-many-requests') {
      throw new Error('Quá nhiều yêu cầu. Vui lòng đợi');
    }
    throw new Error('Không gửi được email: ' + err.message);
  }
}