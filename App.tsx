import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import AdminDashboard from './pages/admin/dashboard/AdminDashboard';
import MemberPortal from './pages/member/MemberPortal';
import AdminLayout from './components/AdminLayout';
import MemberManagement from './pages/admin/membership/MemberManagement';
import NoticeManagement from './pages/admin/system/NoticeManagement';
import CareSessionPage from './pages/admin/care/CareSessionPage';
import MasterSettings from './pages/admin/system/MasterSettings';
import CareRecordManagement from './pages/admin/care/CareRecordManagement';

const App: React.FC = () => {
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
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />

        <Route
          path="/admin/*"
          element={
            auth.type === 'admin' ? (
              <AdminLayout onLogout={handleLogout}>
                <Routes>
                  <Route index element={<AdminDashboard />} />
                  <Route path="members" element={<MemberManagement />} />
                  <Route path="records" element={<CareRecordManagement />} />
                  <Route path="notices" element={<NoticeManagement />} />
                  <Route path="care/:memberId" element={<CareSessionPage />} />
                  <Route path="settings" element={<MasterSettings />} />
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
