// src/App.jsx
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import AppShell from './components/layout/AppShell';
import TeamSelectionModal from './components/student/TeamSelectionModal';
import InstallGuard from './components/InstallGuard';
import NotificationBanner from './components/NotificationBanner';

// ===== LOGIN — load ngay (user chưa đăng nhập) =====
import Login from './pages/Login';

// ===== LAZY LOAD ROUTES =====

// Student pages
const Home = lazy(() => import('./pages/Home'));
const Score = lazy(() => import('./pages/Score'));
const Requests = lazy(() => import('./pages/Requests'));
const CreateRequest = lazy(() => import('./pages/CreateRequest'));
const VoteRequests = lazy(() => import('./pages/VoteRequests'));
const Profile = lazy(() => import('./pages/Profile'));
const Reports = lazy(() => import('./pages/Reports'));
const CreateReport = lazy(() => import('./pages/CreateReport'));
const Appeals = lazy(() => import('./pages/Appeals'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));

// Admin pages
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ImportStudents = lazy(() => import('./pages/admin/ImportStudents'));
const ImportGVCN = lazy(() => import('./pages/admin/ImportGVCN'));
const ImportQueue = lazy(() => import('./pages/admin/ImportQueue'));
const ManageUsers = lazy(() => import('./pages/admin/ManageUsers'));
const ManageClasses = lazy(() => import('./pages/admin/ManageClasses'));
const ManageActivities = lazy(() => import('./pages/admin/ManageActivities'));
const AdminProfile = lazy(() => import('./pages/admin/AdminProfile'));

// GVCN pages
const GVCNLayout = lazy(() => import('./pages/gvcn/GVCNLayout'));
const GVCNHome = lazy(() => import('./pages/gvcn/Dashboard'));
const ManageReports = lazy(() => import('./pages/gvcn/ManageReports'));
const ManageAppeals = lazy(() => import('./pages/gvcn/ManageAppeals'));
const ClassOverview = lazy(() => import('./pages/gvcn/ClassOverview'));
const Warnings = lazy(() => import('./pages/gvcn/Warnings'));
const AuditLog = lazy(() => import('./pages/gvcn/AuditLog'));
const GVCNProfile = lazy(() => import('./pages/gvcn/GVCNProfile'));

// ===== Loading components =====
function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-2 border-brand-500 border-t-transparent"></div>
    </div>
  );
}

function PageLoader() {
  return (
    <div className="flex justify-center py-16">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
    </div>
  );
}

// ===== Redirect về dashboard theo role =====
function RoleDashboard() {
  const { profile } = useAuth();
  if (!profile) return <Navigate to="/login" replace />;
  if (profile.role === 'admin') return <Navigate to="/admin" replace />;
  if (profile.role === 'GVCN') return <Navigate to="/gvcn" replace />;
  return <Navigate to="/" replace />;
}

// ===== Protected =====
function Protected({ children, roles }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <Loading />;

  if (roles && !roles.includes(profile.role)) {
    return <RoleDashboard />;
  }
  return children;
}

// ===== Student guard — bắt buộc chọn tổ =====
function StudentGuard({ children }) {
  const { profile, refreshProfile } = useAuth();
  if (profile?.teamId) return children;

  return (
    <TeamSelectionModal
      user={{ uid: profile?.id }}
      profile={profile}
      onComplete={async () => {
        if (refreshProfile) await refreshProfile();
        window.location.reload();
      }}
    />
  );
}

export default function App() {
  return (
    <InstallGuard>
      <Suspense fallback={<Loading />}>
        <Routes>
          {/* ===== LOGIN ===== */}
          <Route path="/login" element={<Login />} />

          {/* ===== ĐỔI MẬT KHẨU ===== */}
          <Route
            path="/change-password"
            element={
              <Protected roles={['student', 'GVCN', 'admin']}>
                <div className="min-h-screen bg-slate-50 py-6 px-4">
                  <div className="max-w-md mx-auto">
                    <Suspense fallback={<PageLoader />}>
                      <ChangePassword />
                    </Suspense>
                  </div>
                </div>
              </Protected>
            }
          />

          {/* ===== STUDENT ===== */}
          <Route
            element={
              <Protected roles={['student']}>
                <StudentGuard>
                  <AppShell />
                </StudentGuard>
              </Protected>
            }
          >
            <Route path="/" element={<Home />} />
            <Route path="/score" element={<Score />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/requests/new" element={<CreateRequest />} />
            <Route path="/requests/vote" element={<VoteRequests />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/new" element={<CreateReport />} />
            <Route path="/appeals/new" element={<Appeals />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* ===== ADMIN ===== */}
          <Route
            path="/admin"
            element={
              <Protected roles={['admin']}>
                <AdminLayout />
              </Protected>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="import" element={<ImportStudents />} />
            <Route path="import-gvcn" element={<ImportGVCN />} />
            <Route path="activities" element={<ManageActivities />} />
            <Route path="queue" element={<ImportQueue />} />
            <Route path="users" element={<ManageUsers />} />
            <Route path="classes" element={<ManageClasses />} />
            <Route path="profile" element={<AdminProfile />} />
          </Route>

          {/* ===== GVCN ===== */}
          <Route
            path="/gvcn"
            element={
              <Protected roles={['GVCN', 'admin']}>
                <GVCNLayout />
              </Protected>
            }
          >
            <Route index element={<GVCNHome />} />
            <Route path="reports" element={<ManageReports />} />
            <Route path="appeals" element={<ManageAppeals />} />
            <Route path="class" element={<ClassOverview />} />
            <Route path="warnings" element={<Warnings />} />
            <Route path="audit" element={<AuditLog />} />
            <Route path="profile" element={<GVCNProfile />} />
          </Route>

          {/* ===== FALLBACK ===== */}
          <Route
            path="*"
            element={
              <Protected roles={[]}>
                <RoleDashboard />
              </Protected>
            }
          />
        </Routes>
      </Suspense>

      {/* Banner thông báo — hiện sau khi đã cài PWA */}
      <NotificationBanner />
    </InstallGuard>
  );
}