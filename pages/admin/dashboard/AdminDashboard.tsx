import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../../db';
import { Reservation, Member, Program, Manager } from '../../../types';
import QuickReservationModal from '../../../components/admin/reservation/QuickReservationModal';
import EditReservationModal from '../../../components/admin/reservation/EditReservationModal';
import MemberRegistrationModal from '../../../components/admin/member/MemberRegistrationModal';

type ViewMode = 'DAILY' | 'WEEKLY' | 'MONTHLY';

const AdminDashboard: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('DAILY');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showResModal, setShowResModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [dashQuery, setDashQuery] = useState('');
  const [selectedResForEdit, setSelectedResForEdit] = useState<Reservation | null>(null);

  const [stats, setStats] = useState({
    todayTotal: 0,
    lowBalance: 0,
    unsettled: 0
  });

  const dateRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    if (viewMode === 'DAILY') {
      // Same day
    } else if (viewMode === 'WEEKLY') {
      const day = now.getDay();
      start.setDate(now.getDate() - day);
      end.setDate(now.getDate() + (6 - day));
    } else if (viewMode === 'MONTHLY') {
      start.setDate(1);
      end.setMonth(now.getMonth() + 1);
      end.setDate(0);
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }, [viewMode]);

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedReservations, fetchedMembers, fetchedPrograms, fetchedManagers, dashboardStats] = await Promise.all([
        db.reservations.getByDateRange(dateRange.start, dateRange.end),
        db.members.getAll(),
        db.master.programs.getAll(),
        db.master.managers.getAll(),
        db.reservations.getDashboardStats()
      ]);

      setReservations(fetchedReservations);
      setMembers(fetchedMembers);
      setPrograms(fetchedPrograms);
      setManagers(fetchedManagers);

      setStats(dashboardStats);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const getMemberName = (id: string) => members.find(m => m.id === id)?.name || '알 수 없음';
  const getProgramName = (id: string) => programs.find(p => p.id === id)?.name || '알 수 없음';
  const getManagerName = (id: string) => managers.find(m => m.id === id)?.name || '미지정';

  const statusMap: any = {
    'RESERVED': { label: '예약 확정', class: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    'COMPLETED': { label: '이용 완료', class: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    'CANCELLED': { label: '취소됨', class: 'bg-rose-50 text-rose-600 border-rose-100' }
  };

  const filteredReservations = reservations.filter(res => {
    const m = members.find(mem => mem.id === res.memberId);
    if (!m) return true;
    const query = dashQuery.toLowerCase();
    return m.name.toLowerCase().includes(query) || m.phone.includes(query);
  });

  const handleDeleteReservation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('정말 이 예약을 삭제하시겠습니까? 관련 정산 데이터에 주의하십시오.')) return;
    try {
      const res = reservations.find(r => r.id === id);
      await db.system.logAdminAction('DELETE_RESERVATION', res?.memberId || null, `Reservation Deleted: ${id}`, 'reservation', res, null);
      await db.reservations.delete(id);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="w-full space-y-8 pb-32 page-transition">
      {/* Header Section */}
      <header className="flex justify-between items-end border-b border-slate-100 pb-10">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-[#2F3A32] font-serif italic">운영 현황 대시보드</h1>
          <p className="text-[11px] text-[#A58E6F] font-bold uppercase tracking-[0.5em] pl-1">THE HANNAM OPERATIONAL INTELLIGENCE</p>
        </div>

        <div className="flex gap-4 items-center">
          <div className="flex bg-slate-100/50 p-1.5 rounded-2xl shadow-inner border border-slate-200/50 mr-2">
            {(['DAILY', 'WEEKLY', 'MONTHLY'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-6 py-2 text-[12px] font-bold rounded-xl transition-all duration-300 ${viewMode === mode
                  ? 'bg-white text-[#2F3A32] shadow-sm ring-1 ring-slate-100'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                  }`}
              >
                {mode === 'DAILY' ? '오늘' : mode === 'WEEKLY' ? '주간' : '월간'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowMemberModal(true)}
            className="bg-white text-[#2F3A32] border border-slate-200 px-6 py-4 rounded-2xl font-bold text-[12px] uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all flex items-center gap-3 active:scale-95"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            + 신규 회원 등록
          </button>

          <button
            onClick={() => setShowResModal(true)}
            className="bg-[#2F3A32] text-white px-8 py-4 rounded-2xl font-bold text-[12px] uppercase tracking-widest shadow-lg hover:bg-[#1A3C34] hover:-translate-y-0.5 transition-all flex items-center gap-3 active:scale-95"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
            + 예약 추가
          </button>
        </div>
      </header>

      {/* Stats Cards Section - Slim Bar Style */}
      <div className="w-full grid grid-cols-3 gap-6">
        <div className="bg-white px-10 py-6 rounded-[32px] border border-slate-100 flex items-center justify-between group hover:border-[#A58E6F]/20 transition-all duration-500 shadow-sm">
          <h3 className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">오늘의 총 예약</h3>
          <p className="text-3xl font-black text-[#2F3A32] tracking-tighter">{stats.todayTotal.toLocaleString()}</p>
        </div>

        <div className="bg-white px-10 py-6 rounded-[32px] border border-slate-100 flex items-center justify-between group hover:border-[#A58E6F]/20 transition-all duration-500 shadow-sm">
          <h3 className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">잔액 부족 주의 (30만 미만)</h3>
          <p className="text-3xl font-black text-orange-500 tracking-tighter">{stats.lowBalance.toLocaleString()}</p>
        </div>

        <div className={`px-10 py-6 rounded-[32px] border flex items-center justify-between group transition-all duration-500 shadow-sm ${stats.unsettled > 0 ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'}`}>
          <h3 className={`${stats.unsettled > 0 ? 'text-rose-400' : 'text-slate-400'} font-bold uppercase text-[10px] tracking-[0.2em]`}>미정산 현황</h3>
          <p className={`text-3xl font-black tracking-tighter ${stats.unsettled > 0 ? 'text-rose-500' : 'text-[#2F3A32]'}`}>{stats.unsettled.toLocaleString()}</p>
        </div>
      </div>

      {/* Reservation List Section */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-8">
        <div className="flex justify-between items-center mb-8 px-2 bg-slate-50/50 p-6 rounded-2xl border border-slate-100/50">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-[#2F3A32] font-serif italic flex items-center gap-3">
              예약 현황 보고서
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </h2>
            <div className="flex items-center gap-2">
              <svg className="w-3 h-3 text-[#A58E6F]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span className="text-[10px] text-[#A58E6F] font-bold uppercase tracking-[0.2em]">
                {dateRange.start.replace(/-/g, '.')} ~ {dateRange.end.replace(/-/g, '.')}
              </span>
            </div>
          </div>

          <div className="relative group">
            <input
              type="text"
              placeholder="회원 성함 또는 연락처로 검색..."
              className="w-96 px-12 py-5 bg-white border border-slate-200 rounded-[24px] outline-none text-sm font-bold placeholder:text-slate-300 focus:border-[#A58E6F]/40 focus:ring-4 focus:ring-[#A58E6F]/5 transition-all shadow-sm"
              value={dashQuery}
              onChange={e => setDashQuery(e.target.value)}
            />
            <svg className="w-4 h-4 text-slate-300 absolute left-5 top-1/2 -translate-y-1/2 group-focus-within:text-[#A58E6F] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            {dashQuery && (
              <button
                onClick={() => setDashQuery('')}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-8 px-10 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] w-[20%]">예약 일시</th>
                <th className="text-left py-8 px-10 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] w-[25%]">회원 정보</th>
                <th className="text-left py-8 px-10 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] w-[22%]">프로그램 명</th>
                <th className="text-left py-8 px-10 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] w-[18%]">담당 전담 관리사</th>
                <th className="text-center py-8 px-10 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] w-[15%]">진행 상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={5} className="py-32 text-center text-slate-300 italic font-medium">데이터를 세밀하게 분석 중입니다...</td></tr>
              ) : filteredReservations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-40 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-2xl">📋</div>
                      <p className="text-slate-400 font-bold text-sm">해당 검색어와 일치하는 예약 내역이 없습니다.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredReservations.map(res => (
                  <tr
                    key={res.id}
                    className={`transition-all duration-300 group ${res.status === 'RESERVED' ? 'hover:bg-emerald-50/50 cursor-pointer' : 'hover:bg-slate-50/70'}`}
                    onClick={() => {
                      if (res.status === 'RESERVED') {
                        const path = `/admin/care/${res.memberId}?resId=${res.id}&progId=${res.programId}`;
                        window.location.hash = `#${path}`; // Using hash as we are in HashRouter
                      }
                    }}
                  >
                    <td className="py-8 px-10">
                      <div className="font-bold text-[#1A1A1A] text-lg">{res.date.split('-').slice(1).join('.')}</div>
                      <div className="text-[11px] text-[#A58E6F] font-bold uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {res.time}
                      </div>
                    </td>
                    <td className="py-8 px-10">
                      <Link to={`/admin/members/${res.memberId}`} className="font-bold text-[#1A1A1A] text-xl hover:text-[#A58E6F] transition-colors cursor-pointer">
                        {getMemberName(res.memberId)}
                      </Link>
                      <div className="text-[12px] text-slate-400 font-medium mt-1">{res.memberId.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}</div>
                    </td>
                    <td className="py-8 px-10">
                      <div className="inline-flex px-5 py-2.5 bg-[#FDFCFB] border border-[#F1EEE9] rounded-xl text-[15px] font-bold text-[#2F3A32]">
                        {getProgramName(res.programId)}
                      </div>
                    </td>
                    <td className="py-8 px-10">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-sm shadow-inner">👤</div>
                        <span className="text-[15px] font-bold text-slate-600">{getManagerName(res.managerId || '')}</span>
                      </div>
                    </td>
                    <td className="py-8 px-10 text-center">
                      <div className="flex items-center justify-center gap-4">
                        <span className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border shadow-sm transition-all group-hover:scale-105 ${statusMap[res.status].class}`}>
                          {statusMap[res.status].label}
                        </span>
                        {res.status === 'RESERVED' && (
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedResForEdit(res); }}
                              className="p-2 text-slate-200 hover:text-indigo-400 transition-colors"
                              title="예약 수정"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              onClick={(e) => handleDeleteReservation(e, res.id)}
                              className="p-2 text-slate-200 hover:text-rose-400 transition-colors"
                              title="예약 취소/삭제"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Overlays */}
      {
        showResModal && (
          <QuickReservationModal
            onClose={() => setShowResModal(false)}
            onSuccess={loadData}
          />
        )
      }
      {
        showMemberModal && (
          <MemberRegistrationModal
            onClose={() => setShowMemberModal(false)}
            onSuccess={loadData}
          />
        )
      }
      {selectedResForEdit && (
        <EditReservationModal
          reservation={selectedResForEdit}
          onClose={() => setSelectedResForEdit(null)}
          onSuccess={loadData}
        />
      )}
    </div >
  );
};

export default AdminDashboard;
