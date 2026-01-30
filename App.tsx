import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { db } from './db';
import LoginPage from './pages/auth/LoginPage';
import AdminDashboard from './pages/admin/dashboard/AdminDashboard';
import MemberPortal from './pages/member/MemberPortal';
import AdminLayout from './components/AdminLayout';
// Re-importing to ensure correct path resolution
import MemberManagement from './pages/admin/membership/MemberManagement';
import NoticeManagement from './pages/admin/system/NoticeManagement';
import CareSessionPage from './pages/admin/care/CareSessionPage';
import MasterSettings from './pages/admin/system/MasterSettings';
import CareRecordManagement from './pages/admin/care/CareRecordManagement';
import CareHistorySplitPage from './pages/admin/care/CareHistorySplitPage';
import NotificationCenter from './pages/admin/system/NotificationCenter';
import NotificationControl from './pages/admin/system/NotificationControl';
import AccountManagement from './pages/admin/system/AccountManagement';
import WellnessHistoryReportPage from './pages/admin/care/WellnessHistoryReportPage';
import InstructorRecordingPage from './pages/admin/care/InstructorRecordingPage';
import InstructorDashboard from './pages/instructor/InstructorDashboard';
import PWAInstallBanner from './components/PWAInstallBanner';
import { UpdatePrompt } from './components/common/UpdatePrompt';

import { FcmService } from './src/firebase';

const App: React.FC = () => {
  // [PWA] Request Notification Permission & Badge Update
  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem('hannam_auth_session');
      if (saved) {
        const session = JSON.parse(saved);
        if (session?.id) {
          // 1. Permission & Token
          await FcmService.requestPermission(session.id);

          // 2. Initial Badge Count
          await updateBadge(session.id);
        }
      }
    };
    init();

    // Listen for foreground messages -> Update Badge
    FcmService.onForegroundMessage(async (payload) => {
      console.log("Foreground Push:", payload);
      // Refresh badge
      const saved = localStorage.getItem('hannam_auth_session');
      if (saved) {
        const session = JSON.parse(saved);
        if (session?.id) await updateBadge(session.id);
      }
    });
  }, []);

  const updateBadge = async (memberId: string) => {
    try {
      const counts = await db.notifications.getBadgeCount(memberId);
      console.log('[App] Badge Updated:', counts);
    } catch (e) {
      console.error('[App] Badge Update Failed:', e);
    }
  };

  const [auth, setAuth] = useState<{ type: 'admin' | 'member' | null; id: string | null; email?: string }>(() => {
    const saved = localStorage.getItem('hannam_auth_session');
    return saved ? JSON.parse(saved) : { type: null, id: null };
  });

  useEffect(() => {
    localStorage.setItem('hannam_auth_session', JSON.stringify(auth));
  }, [auth]);

  const handleLogin = (type: 'admin' | 'member', id: string, email?: string) => {
    setAuth({ type, id, email });
  };

  const handleLogout = () => {
    setAuth({ type: null, id: null });
    localStorage.removeItem('hannam_auth_session');
  };

  return (
    <HashRouter>
      <PWAInstallBanner />
      <UpdatePrompt />
      <Routes>
        <Route path="/login" element={
          auth.type === 'admin' ? <Navigate to="/admin" /> :
            auth.type === 'member' ? <Navigate to="/member" /> :
              <LoginPage onLogin={handleLogin} />
        } />

        <Route path="/instructor/*" element={
          auth.type === 'admin' ? (
            <Routes>
              <Route index element={<InstructorDashboard />} />
              <Route path="record/:resId" element={<InstructorRecordingPage />} />
              <Route path="*" element={<Navigate to="/instructor" />} />
            </Routes>
          ) : <Navigate to="/login" />
        } />

        <Route
          path="/admin/*"
          element={
            auth.type === 'admin' ? (
              <AdminLayout onLogout={handleLogout}>
                <Routes>
                  <Route index element={<AdminDashboard />} />
                  <Route path="members" element={<MemberManagement />} />
                  <Route path="members/:memberId" element={<MemberManagement />} />
                  <Route path="members/:memberId/care-history" element={<CareHistorySplitPage />} />
                  <Route path="records" element={<CareRecordManagement />} />
                  <Route path="notices" element={<NoticeManagement />} />
                  <Route path="notification-center" element={<NotificationCenter />} />
                  <Route path="notification-control" element={<NotificationControl />} />
                  <Route path="care/:memberId" element={<CareSessionPage />} />
                  <Route path="care-report/:memberId" element={<WellnessHistoryReportPage />} />
                  {/* [MOVED] care-record-edit moved to /instructor/record */}
                  <Route path="settings" element={<MasterSettings />} />
                  <Route path="accounts" element={<AccountManagement />} />
                  <Route path="*" element={<Navigate to="/admin" />} />
                </Routes>
              </AdminLayout>
            ) : <Navigate to="/login" />
          }
        />

        <Route
          path="/member/*"
          element={
            auth.type === 'member' ? (
              <MemberPortal memberId={auth.id!} onLogout={handleLogout} />
            ) : <Navigate to="/login" />
          }
        />

        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
