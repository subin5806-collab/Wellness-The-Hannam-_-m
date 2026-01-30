
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import QuickReservationModal from './admin/reservation/QuickReservationModal';
import NotificationCenter from '../pages/admin/system/NotificationCenter';
import MasterSettings from '../pages/admin/system/MasterSettings';
import NotificationControl from '../pages/admin/system/NotificationControl';
import { db } from '../db';

interface AdminLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, onLogout }) => {
  const location = useLocation();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate(); // Need to import useNavigate

  // [SECURITY FIX] Block Instructor Access to Admin Portal
  useEffect(() => {
    const saved = localStorage.getItem('hannam_auth_session');
    if (saved) {
      const session = JSON.parse(saved);
      if (session.email) {
        db.admins.getByEmail(session.email).then(admin => {
          if (admin && admin.role === 'INSTRUCTOR') {
            // Allow only specific routes (like care-record-edit which is under /admin in this app structure)
            // But usually instructors should be in /instructor/*
            // If they are attempting to access /admin/members or similar -> FORCE REDIRECT
            const allowedPaths = ['/admin/care-record-edit'];
            const isAllowed = allowedPaths.some(p => location.pathname.startsWith(p));

            if (!isAllowed) {
              console.warn('[Security] Unauthorized Admin Access Attempt by Instructor. Redirecting.');
              navigate('/instructor', { replace: true });
            }
          }
        });
      }
    }
  }, [location.pathname]);

  const navItems = [
    { path: '/admin', label: '운영 현황' },
    { path: '/admin/members', label: '회원 통합 관리' },
    { path: '/admin/records', label: '이용 내역 관리' },
    { path: '/admin/notices', label: '공지/알림' },
    { path: '/admin/notification-center', label: '알림 센터 (Push)' },
    { path: '/admin/notification-control', label: '알림 통합 관제 (Control)' },
    { path: '/admin/accounts', label: '계정/권한 관리' },
    { path: '/admin/settings', label: '시스템 설정' },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB] page-transition">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#E5E8EB] px-4 lg:px-10">
        <div className="w-full h-16 lg:h-20 flex items-center justify-between">

          {/* Logo Section */}
          <div className="flex items-center gap-3 lg:gap-14">
            <Link to="/admin" className="flex items-center gap-3" onClick={() => setIsMobileMenuOpen(false)}>
              <div className="w-8 h-8 lg:w-9 lg:h-9 bg-[#2F3A32] rounded-xl flex items-center justify-center text-white text-[12px] lg:text-[14px] font-bold shadow-lg">W</div>
              <span className="font-bold text-[12px] lg:text-[14px] text-[#2F3A32] tracking-tighter uppercase whitespace-nowrap italic font-serif">Wellness Hannam</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex gap-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-4 py-2 text-[13px] font-bold transition-all rounded-xl tracking-tight ${isActive ? 'bg-[#2F3A32] text-white shadow-md' : 'text-[#6B7280] hover:text-[#2F3A32] hover:bg-[#F3F4F6]'}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Desktop Right Actions */}
          <div className="hidden lg:flex items-center gap-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowQuickAdd(true)}
                className="px-5 py-2 bg-[#2F3A32] text-white text-[11px] font-bold rounded-xl hover:bg-[#1A3C34] transition-all uppercase tracking-widest shadow-md flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                Quick Add
              </button>
              <div className="flex flex-col text-right pr-4 border-r border-[#E5E8EB]">
                <span className="text-[9px] text-[#A58E6F] font-bold mb-0.5 tracking-[0.3em] uppercase">Security Level : High</span>
                <span className="text-[12px] text-[#2F3A32] font-bold">Administrator Portal</span>
              </div>
              <button
                onClick={onLogout}
                className="px-6 py-2 border border-[#D1D5DB] text-[#6B7280] text-[11px] font-bold rounded-xl hover:bg-[#F9FAFB] hover:text-[#2F3A32] hover:border-[#2F3A32] transition-all uppercase tracking-widest shadow-sm active:scale-95"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Mobile Text & Hamburger */}
          <div className="flex lg:hidden items-center gap-4">
            <span className="text-[10px] text-[#A58E6F] font-bold tracking-widest uppercase">Admin</span>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-[#2F3A32] bg-slate-50 rounded-lg border border-slate-200"
            >
              {isMobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
            <nav className="flex flex-col gap-2 mb-6">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`px-4 py-3 text-[14px] font-bold rounded-xl ${isActive ? 'bg-[#2F3A32] text-white' : 'text-[#6B7280] hover:bg-slate-50'}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => { setShowQuickAdd(true); setIsMobileMenuOpen(false); }}
                className="w-full py-3 bg-[#A58E6F] text-white text-xs font-bold rounded-xl uppercase tracking-widest"
              >
                Quick Add
              </button>
              <button
                onClick={onLogout}
                className="w-full py-3 border border-slate-200 text-slate-500 text-xs font-bold rounded-xl uppercase tracking-widest"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content - Responsive Padding */}
      <main className="w-full p-4 lg:p-14">
        {children}
      </main>

      <footer className="w-full px-8 pb-14 text-center mt-12">
        <div className="w-12 h-px bg-slate-200 mx-auto mb-6"></div>
        <p className="text-[10px] text-[#9CA3AF] font-bold tracking-[0.4em] uppercase">
          © Wellness, The Hannam Digital Concierge & Security System
        </p>
      </footer>

      {showQuickAdd && (
        <QuickReservationModal
          onClose={() => setShowQuickAdd(false)}
          onSuccess={() => {
            window.location.reload();
          }}
        />
      )}
    </div>
  );
};

export default AdminLayout;
