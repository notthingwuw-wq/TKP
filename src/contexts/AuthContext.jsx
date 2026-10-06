// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { clearReportsSeen } from '../hooks/useReportsBadge';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // ===== Lắng nghe auth state =====
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        // 1. Chưa login
        if (!u) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        // 2. Có auth user → đọc Firestore profile
        const snap = await getDoc(doc(db, 'users', u.uid));

        // 3. Firestore doc không tồn tại → auto logout
        if (!snap.exists()) {
          console.warn('[AuthContext] Firestore doc không tồn tại → tự động đăng xuất');
          clearReportsSeen();
          await signOut(auth);
          setUser(null);
          setProfile(null);
          setLoading(false);
          toast.error('Tài khoản đã bị xóa. Liên hệ quản trị viên.', {
            duration: 5000,
            id: 'account-deleted'
          });
          return;
        }

        // 4. Có đủ auth + firestore → set state
        setUser(u);
        setProfile({ id: snap.id, ...snap.data() });
      } catch (err) {
        console.error('[AuthContext] error:', err);
        setProfile(null);
        // Không logout trên lỗi mạng
      } finally {
        setLoading(false);
      }
    });

    return unsub;
  }, []);

  // ===== Login =====
  const login = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  // ===== Logout =====
  const logout = async () => {
    try {
      clearReportsSeen();
    } catch (err) {
      console.warn('clearReportsSeen error:', err);
    }
    await signOut(auth);
  };

  // ===== Refresh profile từ Firestore =====
  const refreshProfile = async () => {
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        setProfile({ id: snap.id, ...snap.data() });
      } else {
        // Profile đã bị xóa trong lúc dùng
        clearReportsSeen();
        await signOut(auth);
        setProfile(null);
        toast.error('Tài khoản đã bị xóa', { id: 'account-deleted' });
      }
    } catch (err) {
      console.error('refreshProfile error:', err);
    }
  };

  // ===== Context value =====
  const value = {
    user,
    profile,
    loading,
    login,
    logout,
    refreshProfile,
    role: profile?.role
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}