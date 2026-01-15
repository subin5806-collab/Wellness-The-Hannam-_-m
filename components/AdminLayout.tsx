
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface AdminLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, onLogout }) => {
  const location = useLocation();

  const navItems = [
    { path: '/admin', label: '운영 현황' },
    { path: '/admin/members', label: '회원 통합 관리' },
    { path: '/admin/records', label: '이용 내역 관리' },
    { path: '/admin/notices', label: '공지/알림' },
    { path: '/admin/settings', label: '시스템 설정' },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB] page-transition">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#E5E8EB] px-8">
        <div className="max-w-[1440px] mx-auto h-20 flex items-center justify-between">
          <div className="flex items-center gap-14">
            <Link to="/admin" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#2F3A32] rounded-xl flex items-center justify-center text-white text-[14px] font-bold shadow-lg">W</div>
              <span className="font-bold text-[14px] text-[#2F3A32] tracking-tighter uppercase whitespace-nowrap italic font-serif">Wellness Hannam</span>
            </Link>

            <nav className="flex gap-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-6 py-2.5 text-[13px] font-bold transition-all rounded-xl tracking-tight ${
                      isActive ? 'bg-[#2F3A32] text-white shadow-md' : 'text-[#6B7280] hover:text-[#2F3A32] hover:bg-[#F3F4F6]'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex flex-col text-right pr-8 border-r border-[#E5E8EB]">
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
      </header>

      <main className="max-w-[1440px] mx-auto p-10 lg:px-14">
        {children}
      </main>

      <footer className="max-w-[1440px] mx-auto px-8 pb-14 text-center">
        <div className="w-12 h-px bg-slate-200 mx-auto mb-6"></div>
        <p className="text-[10px] text-[#9CA3AF] font-bold tracking-[0.4em] uppercase">
          © Wellness, The Hannam Digital Concierge & Security System
        </p>
      </footer>
    </div>
  );
};

export default AdminLayout;
