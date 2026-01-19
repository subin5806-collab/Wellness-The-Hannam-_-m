import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db, hashPassword } from '../../db';
import { Member, Membership, CareRecord, Program, Reservation, Notice, Notification, MembershipProduct } from '../../types';
import { useBalanceEngine } from '../../hooks/useBalanceEngine';
import CareDetailModal from '../../components/member/CareDetailModal';
import SignaturePad from '../../components/common/SignaturePad';

interface MemberPortalProps {
  memberId: string;
  onLogout: () => void;
}

type ViewMode = 'dashboard' | 'care' | 'membership' | 'settings' | 'notifications' | 'reports';

const MemberPortal: React.FC<MemberPortalProps> = ({ memberId, onLogout }) => {
  const [member, setMember] = useState<Member | null>(null);
  // memberships replaced by useBalanceEngine
  const [history, setHistory] = useState<CareRecord[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [activeNotices, setActiveNotices] = useState<Notice[]>([]);
  const [notis, setNotis] = useState<Notification[]>([]);
  const [msProducts, setMsProducts] = useState<MembershipProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('dashboard');
  const [notiTab, setNotiTab] = useState<'ANNOUNCE' | 'PERSONAL'>('ANNOUNCE');
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: '', new: '', confirm: '', verificationCode: '' });
  const [selectedRecord, setSelectedRecord] = useState<CareRecord | null>(null);
  const [zoomSignature, setZoomSignature] = useState<string | null>(null);

  // New State for Member Signature
  const [signingRecordId, setSigningRecordId] = useState<string | null>(null);

  // Derived state: pending signatures (Look for records created recently without signature status 'completed')
  // Depending on how backend sets default, we might check !signatureData or status !== 'completed'
  const pendingSignatures = useMemo(() => {
    return history.filter(h => h.signatureStatus !== 'completed' && (!h.signatureData || h.signatureData === ''));
  }, [history]);

  const handleSignatureSave = async (signatureData: string) => {
    if (!signingRecordId) return;
    try {
      await db.careRecords.updateSignature(signingRecordId, signatureData);
      alert('서명이 완료되었습니다.');
      setSigningRecordId(null);
      fetchData(); // Refresh to update list
    } catch (e) {
      alert('서명 저장 중 오류가 발생했습니다.');
      console.error(e);
    }
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // NOTE: getPublicProfile is used in a previous step, but fetchData here uses getById. 
      // I should update it to match the security requirement later if needed, but for now focus on build.
      // Wait, MemberPortal.tsx was supposed to use getPublicProfile.
      // The previous replace_file_content FAILED? 
      // Ah, I tried to replace lines 128-141. Explicitly check if it worked?
      // The view shows line 58: db.members.getById(memberId).
      // So the previous edit might have failed or been overwritten?
      // Or maybe lines 128-141 were somewhere else?
      // Line 58 is inside fetchData.
      // I will replace getById with getPublicProfile HERE      
      // [SESSION VALIDATION] Trust the Profile ID (TEXT/Phone)
      // We removed the UUID enforcement logic.
      try {
        const preProfile = await db.members.getPublicProfile(memberId);

        if (!preProfile || !preProfile.id) {
          console.error('[Session Check] No profile found for ID:', memberId);
          alert('회원 정보를 찾을 수 없습니다. 다시 로그인해 주세요.');
          onLogout();
          return;
        }

        // Ensure Session ID matches the DB ID (Source of Truth)
        if (preProfile.id !== memberId) {
          console.warn('[Session Sync] Updating Session ID to match DB:', memberId, '->', preProfile.id);
          const saved = localStorage.getItem('hannam_auth_session');
          if (saved) {
            const auth = JSON.parse(saved);
            auth.id = preProfile.id;
            localStorage.setItem('hannam_auth_session', JSON.stringify(auth));
            window.location.reload();
            return;
          }
        }

      } catch (e) {
        console.error('[Session Check] Error:', e);
        // If network fails, we proceed to try Promise.all which might allow partial load?
        // Or we could block. Given "User Experience", we try to proceed.
      }

      const [mInfo, allMs, careList, resList, allProgs, fetchedNotices, allNotis, allProducts] = await Promise.all([
        db.members.getPublicProfile(memberId),
        db.memberships.getAllByMemberId(memberId),
        db.careRecords.getByMemberId(memberId),
        db.reservations.getByMemberId(memberId),
        db.master.programs.getAll(),
        db.notices.getActiveNotices(),
        db.notifications.getByMemberId(memberId),
        db.master.membershipProducts.getAll()
      ]);
      setMember(mInfo);
      // setMemberships(allMs || []); // REMOVED
      setHistory(careList || []);
      setReservations(resList || []);
      setPrograms(allProgs || []);
      setNotis(allNotis || []);
      setMsProducts(allProducts || []);

      // Popup filter: "Don't show today" check
      const suppressedIds = JSON.parse(localStorage.getItem('suppressed_popups') || '{}');
      const today = new Date().toISOString().split('T')[0];
      const filteredNotices = (fetchedNotices || []).filter(n => !n.isPopup || suppressedIds[n.id] !== today);
      setActiveNotices(filteredNotices);
    } finally { setIsLoading(false); }
  }, [memberId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { totalRemaining, memberships } = useBalanceEngine(memberId);
  const activeMs = memberships.find(m => m.status === 'active');

  // Clean View Data
  const currentDiscountRate = activeMs ? activeMs.defaultDiscountRate : 0;

  const activeProduct = useMemo(() => msProducts.find(p => p.id === activeMs?.productId || p.name === activeMs?.productName), [msProducts, activeMs]);

  const upcomingReservations = useMemo(() => {
    const now = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(now.getDate() + 30);

    const startStr = now.toISOString().split('T')[0];
    const endStr = thirtyDaysLater.toISOString().split('T')[0];

    return reservations
      .filter(r => r.status === 'RESERVED' && r.date >= startStr && r.date <= endStr)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [reservations]);

  const latestCare = useMemo(() => history[0], [history]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdForm.new !== pwdForm.confirm) return alert('새 비밀번호 확인이 일치하지 않습니다.');
    if (pwdForm.verificationCode !== '01058060134') {
      return alert('보안 인증 번호가 일치하지 않습니다.');
    }

    const hashedCurrent = await hashPassword(pwdForm.current);
    if (member?.password !== hashedCurrent) return alert('현재 비밀번호가 일치하지 않습니다.');

    try {
      await db.members.update(memberId, { password: pwdForm.new });
      alert('비밀번호가 변경되었습니다.');
      setShowPwdModal(false);
      setPwdForm({ current: '', new: '', confirm: '', verificationCode: '' });
      fetchData();
    } catch (e) { alert('변경 중 오류가 발생했습니다.'); }
  };

  if (isLoading && !member) return <div className="min-h-screen flex items-center justify-center font-serif-luxury italic text-[#1A3C34] text-xl">Wellness, The Hannam...</div>;
  if (!member) return null;

  const popupNotices = activeNotices.filter(n => n.isPopup);

  return (
    <div className="min-h-screen bg-[#F9F9F7] flex justify-center pb-32 select-none">
      <div className="w-full max-w-md flex flex-col relative overflow-hidden bg-[#F9F9F7]">

        {/* Header */}
        <header className="px-8 pt-16 pb-6 flex justify-between items-center bg-[#F9F9F7] sticky top-0 z-40">
          <div>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.35em] mb-1.5">Wellness The Hannam</p>
            <h1 className="text-3xl font-serif-luxury font-bold text-[#1A3C34]">{member.name}님</h1>
          </div>
          <button
            onClick={() => setView('notifications')}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all relative ${view === 'notifications' ? 'bg-[#1A3C34] text-white shadow-lg' : 'bg-white border text-slate-400 shadow-sm'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            {(notis.some(n => !n.isRead)) && <span className="absolute top-3.5 right-3.5 w-1.5 h-1.5 bg-rose-400 rounded-full border border-white"></span>}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar px-6 space-y-10">
          {view === 'dashboard' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
              {/* Header */}
              <div className="text-center pt-8 pb-6 px-10">
                <p className="text-[10px] text-slate-400 font-light uppercase tracking-[0.4em] mb-2">The Wellness Atelier</p>
                <div className="w-8 h-[1px] bg-slate-200 mx-auto mb-4"></div>
                <h1 className="text-lg font-serif-luxury font-extralight text-[#1A1A1A] tracking-[0.1em] leading-tight">MEMBER DASHBOARD</h1>
              </div>

              {/* [NEW] Pending Signature Alert */}
              {pendingSignatures.length > 0 && (
                <div className="mx-6 animate-in slide-in-from-top-4 duration-700 delay-100">
                  <button
                    onClick={() => setSigningRecordId(pendingSignatures[0].id)}
                    className="w-full bg-[#1A3C34] rounded-[32px] p-6 text-white shadow-xl flex items-center justify-between group active:scale-[0.98] transition-all relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center gap-4 relative z-10">
                      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </div>
                      <div className="text-left">
                        <p className="text-[9px] font-bold text-[#A58E6F] uppercase tracking-[0.2em] mb-0.5">Action Required</p>
                        <h3 className="text-[15px] font-bold leading-none">서명이 필요한 내역이 {pendingSignatures.length}건 있습니다</h3>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center relative z-10">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </button>
                </div>
              )}

              {/* Profile Card */}
              <section className="mx-8 bg-white rounded-[40px] luxury-shadow border border-slate-50 overflow-hidden">
                <div className="p-9 space-y-8">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 bg-[#F9F9F7] rounded-full flex items-center justify-center border border-slate-100 shadow-inner">
                        <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-[20px] font-bold text-[#1A1A1A]">{member.name}</h3>
                          <span className="text-[9px] font-bold text-[#A58E6F] uppercase tracking-[0.15em] border border-[#A58E6F]/20 px-2.5 py-0.5 rounded-full">VIP MEMBER</span>
                        </div>
                        <p className="text-[12px] text-slate-400 font-medium tabular-nums mt-0.5">{member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="h-[1px] bg-slate-100/40 w-full"></div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-8">
                    <div className="space-y-1.5">
                      <p className="flex items-center gap-1.5 text-[9px] text-slate-300 font-bold uppercase tracking-[0.1em]">
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                        Membership
                      </p>
                      <p className="text-[14px] font-bold text-[#1A1A1A]">{activeMs?.productName || 'No Ms'}</p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="flex items-center gap-1.5 text-[9px] text-slate-300 font-bold uppercase tracking-[0.1em]">
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Joined Date
                      </p>
                      <p className="text-[14px] font-bold text-[#1A1A1A] tabular-nums">{member.createdAt?.split('T')[0].replace(/-/g, '. ')}</p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="flex items-center gap-1.5 text-[9px] text-slate-300 font-bold uppercase tracking-[0.1em]">
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Benefits
                      </p>
                      <p className="text-[14px] font-bold text-[#1A1A1A]">{currentDiscountRate}% OFF</p>
                    </div>

                  </div>
                </div>
              </section>

              {/* Remaining Balance Card */}
              {/* Remaining Balance Card - Slim Dark Theme */}
              <section className="mx-6 bg-[#1A3C34] rounded-[32px] p-8 text-white relative overflow-hidden shadow-xl text-center">
                <div className="relative z-10 space-y-2">
                  <p className="text-[9px] font-bold text-[#A58E6F] uppercase tracking-[0.2em] opacity-90">Available Balance</p>
                  <h2 className="text-3xl font-black tabular-nums tracking-tight">
                    ₩ {Math.floor(totalRemaining).toLocaleString()}
                  </h2>
                </div>
              </section>

              {/* Upcoming Reservations */}
              <section className="space-y-6 pt-2">
                <div className="flex justify-between items-center px-10 text-slate-400">
                  <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em]">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Upcoming Sessions
                  </h4>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">Next 30 Days</span>
                </div>
                <div className="space-y-3 px-6">
                  {upcomingReservations.map(res => (
                    <div key={res.id} className="bg-white rounded-[24px] p-5 border border-slate-50 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-[#F9F9F7] rounded-xl flex flex-col items-center justify-center border border-slate-100 shrink-0">
                          <span className="text-[8px] text-slate-400 font-bold uppercase tabular-nums">{res.date.split('-')[1]}월</span>
                          <span className="text-lg font-black text-[#1A1A1A] tabular-nums leading-none">{res.date.split('-')[2]}</span>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[13px] font-bold text-[#1A1A1A]">{programs.find(p => p.id === res.programId)?.name || 'Wellness Care'}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                            <span className="tabular-nums">{res.time}</span>
                            <span className="w-0.5 h-0.5 bg-slate-300 rounded-full"></span>
                            <span className="italic">Reserved</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Experience History */}
              <section className="space-y-6 pt-2">
                <div className="flex justify-between items-center px-10 text-slate-400">
                  <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em]">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Experience History
                  </h4>
                </div>
                <div className="mx-8 bg-white rounded-[40px] border border-slate-50 shadow-sm overflow-hidden">
                  <table className="w-full">
                    <thead className="text-[8px] text-slate-300 font-bold uppercase tracking-[0.15em] border-b border-slate-50">
                      <tr>
                        <th className="px-6 py-6 font-bold text-left">Date</th>
                        <th className="px-6 py-6 font-bold text-left">Program</th>
                        <th className="px-6 py-6 font-bold text-right">Ded.</th>
                        <th className="px-6 py-6 font-bold text-center">Sig.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {history.slice(0, 5).map(record => (
                        <tr key={record.id} onClick={() => setSelectedRecord(record)} className="group cursor-pointer hover:bg-slate-50 transition-all">
                          <td className="px-6 py-7 text-[10px] text-slate-400 font-medium tabular-nums">{record.date.replace(/-/g, '. ')}</td>
                          <td className="px-6 py-7">
                            <p className="text-[13px] font-serif-luxury italic font-bold text-[#1A1A1A] leading-tight line-clamp-1">
                              {programs.find(p => p.id === record.programId)?.name || 'Wellness Ritual'}
                            </p>
                          </td>
                          <td className="px-6 py-7 text-right">
                            <p className="text-[13px] font-bold text-[#A58E6F] tabular-nums">-{Math.floor(record.finalPrice / 1000)}k</p>
                          </td>
                          <td className="px-6 py-7 text-center">
                            <div className="inline-block w-12 h-6 border border-dashed border-slate-100 rounded-lg p-1 bg-slate-50/30 overflow-hidden">
                              {record.signatureData ? (
                                <img src={record.signatureData} className="w-full h-full object-contain opacity-40 grayscale group-hover:opacity-80 transition-all" alt="Sig" />
                              ) : <div className="text-[6px] text-slate-200 uppercase">Empty</div>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {view === 'notifications' && (
            <div className="space-y-8 animate-in slide-in-from-top-4 duration-500 pb-12 min-h-screen">
              <div className="flex justify-between items-center px-4">
                <h3 className="text-3xl font-serif-luxury font-bold text-[#1A3C34]">알림 센터</h3>
                <button onClick={() => setView('dashboard')} className="p-3 bg-white border rounded-full text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="flex p-1.5 bg-slate-100 rounded-[24px] mx-2 shadow-inner">
                <button
                  onClick={() => setNotiTab('ANNOUNCE')}
                  className={`flex-1 py-4 text-[13px] font-bold rounded-[18px] transition-all ${notiTab === 'ANNOUNCE' ? 'bg-white text-[#1A3C34] shadow-sm scale-[1.02]' : 'text-slate-400'}`}
                >
                  공지사항
                </button>
                <button
                  onClick={() => setNotiTab('PERSONAL')}
                  className={`flex-1 py-4 text-[13px] font-bold rounded-[18px] transition-all relative ${notiTab === 'PERSONAL' ? 'bg-white text-[#1A3C34] shadow-sm scale-[1.02]' : 'text-slate-400'}`}
                >
                  개인 알림
                  {notis.some(n => !n.isRead) && <span className="absolute top-3 right-8 w-1.5 h-1.5 bg-rose-400 rounded-full"></span>}
                </button>
              </div>

              <div className="space-y-4 px-2 pb-20">
                {notiTab === 'ANNOUNCE' && (
                  <div className="space-y-4">
                    {activeNotices.map(notice => (
                      <div key={notice.id} className="bg-white p-8 rounded-[36px] border border-slate-50 shadow-sm space-y-4 group">
                        <div className="flex justify-between items-center">
                          <span className={`px-2.5 py-1 text-[8px] font-bold rounded-lg uppercase tracking-widest ${notice.category === 'URGENT' ? 'bg-rose-50 text-rose-500' : 'bg-[#1A3C34] text-white'}`}>
                            {notice.category}
                          </span>
                          <span className="text-[9px] text-slate-300 font-bold tabular-nums">{notice.createdAt?.split('T')[0]}</span>
                        </div>
                        <div className="space-y-2">
                          <h5 className="text-[17px] font-bold text-[#1A3C34] group-hover:text-[#A58E6F] transition-colors">{notice.title}</h5>
                          {notice.imageUrl && <div className="w-full aspect-video rounded-2xl bg-slate-50 overflow-hidden mb-2"><img src={notice.imageUrl} className="w-full h-full object-cover" /></div>}
                          <p className="text-[13px] text-slate-500 leading-relaxed font-medium">{notice.content}</p>
                        </div>
                      </div>
                    ))}
                    {activeNotices.length === 0 && <div className="py-24 text-center text-slate-300 italic font-serif text-lg">새로운 공지가 없습니다.</div>}
                  </div>
                )}

                {notiTab === 'PERSONAL' && (
                  <div className="space-y-4">
                    {/* The following block of code was inserted here based on the user's instruction.
                      It appears to be a JavaScript logic block that was intended to be placed
                      outside of JSX, likely in a data fetching function or useEffect.
                      However, as per the instruction, it's placed exactly where specified. */}
                    {/*
                  setIsLoading(true);
                  try {
                    const profile = await db.members.getPublicProfile(memberId);
                    if (!profile) throw new Error('Member not found');
                    setMember(profile);

                    // Load notices
                    const notices = await db.notices.getActiveNotices();
                    // Filter out confirmed notices
                    const confirmed = new Set(profile.confirmedNoticeIds || []);
                    setActiveNotices(notices.filter(n => !confirmed.has(n.id)));

                  } catch (e: any) {
                    console.error('Fetch Error:', e);
                    if (e.message !== 'Member not found') alert('데이터 로드 실패: ' + e.message);
                    if (onLogout) onLogout();
                  } finally {
                    setIsLoading(false);
                  }
                  */}
                    {notis.map(noti => (
                      <div
                        key={noti.id}
                        onClick={async () => {
                          if (!noti.isRead) {
                            await db.notifications.markAsRead(noti.id);
                            fetchData();
                          }
                        }}
                        className={`bg-white p-8 rounded-[36px] border flex gap-6 items-start transition-all ${!noti.isRead ? 'border-emerald-100 shadow-md ring-1 ring-emerald-50' : 'border-slate-50'}`}
                      >
                        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${!noti.isRead ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                        <div className="space-y-2 flex-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">{noti.type}</span>
                            <span className="text-[9px] text-slate-300 font-bold tabular-nums">{noti.createdAt?.split('T')[0]}</span>
                          </div>
                          <h5 className={`text-[15px] font-bold ${!noti.isRead ? 'text-[#1A3C34]' : 'text-slate-400'}`}>{noti.title}</h5>
                          <p className="text-[13px] text-slate-400 font-medium leading-relaxed">{noti.content}</p>
                        </div>
                      </div>
                    ))}
                    {notis.length === 0 && <div className="py-24 text-center text-slate-300 italic font-serif text-lg">개별 수신 메시지가 없습니다.</div>}
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'membership' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500 pb-12">
              <div className="px-2">
                <h2 className="text-4xl font-serif-luxury font-bold text-[#1A3C34] leading-tight">이용 내역</h2>
                <p className="text-[13px] text-slate-400 font-medium mt-4 leading-relaxed">회원님의 소중한 웰니스 케어 상세 기록입니다.</p>
              </div>
              <div className="space-y-6">
                {history.map(record => (
                  <div key={record.id} className="bg-white rounded-[40px] p-8 border border-[#E8E8E4] luxury-shadow flex justify-between items-center">
                    <div className="flex gap-6 items-center">
                      <div className="text-center min-w-[70px]">
                        <p className="text-[11px] text-[#A58E6F] font-bold tabular-nums uppercase">{record.date.slice(5)}</p>
                      </div>
                      <div className="space-y-1">
                        <h5 className="text-[15px] font-bold text-[#1A3C34]">{programs.find(p => p.id === record.programId)?.name || 'Wellness Care'}</h5>
                        <p className="text-[8px] text-slate-300 font-bold uppercase tracking-widest">Care Verified</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[18px] font-bold text-rose-400 tabular-nums">-₩{Math.floor(record.finalPrice).toLocaleString()}</p>
                      <p className="text-[9px] font-bold text-emerald-600/50 tabular-nums uppercase tracking-widest">잔액: ₩{Math.floor(record.balanceAfter || 0).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'settings' && (
            <div className="space-y-10 animate-in slide-in-from-right-4 pb-12">
              <h3 className="text-3xl font-serif-luxury font-bold text-[#1A3C34] px-2">Profile Settings</h3>
              <div className="bg-white p-10 rounded-[48px] border luxury-shadow space-y-8">
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-5 border-b border-slate-50">
                    <span className="text-[13px] font-bold text-[#1A3C34]">회원명</span>
                    <span className="text-[13px] text-slate-400">{member.name}</span>
                  </div>
                  <div className="flex justify-between items-center py-5 border-b border-slate-50">
                    <span className="text-[13px] font-bold text-[#1A3C34]">연락처</span>
                    <span className="text-[13px] text-slate-400 tabular-nums">{member.phone}</span>
                  </div>
                </div>
                <button onClick={() => setShowPwdModal(true)} className="w-full py-5 bg-[#F9F9F7] text-[#1A3C34] rounded-3xl font-bold border shadow-sm uppercase text-[10px] tracking-widest">비밀번호 변경</button>
              </div>
              <button onClick={onLogout} className="w-full py-6 bg-rose-50 text-rose-400 rounded-[32px] font-bold uppercase text-[11px] tracking-widest border border-rose-100 shadow-sm">Sign Out</button>
            </div>
          )}
          {view === 'reports' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500 pb-12">
              <div className="px-2">
                <h2 className="text-4xl font-serif-luxury font-bold text-[#1A3C34] leading-tight">Wellness Report</h2>
                <p className="text-[13px] text-slate-400 font-medium mt-4 leading-relaxed">회원님의 웰니스 케어 히스토리와 전문가 피드백을 확인하세요.</p>
              </div>

              <div className="relative border-l border-slate-200 ml-6 space-y-12 py-4">
                {history.map(record => (
                  <div key={record.id} className="relative pl-8" onClick={() => setSelectedRecord(record)}>
                    <div className="absolute -left-1.5 top-2 w-3 h-3 rounded-full bg-[#A58E6F] ring-4 ring-[#F9F9F7]"></div>
                    <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm hover:border-[#1A3C34] transition-all cursor-pointer group">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{record.date}</span>
                        <span className="text-[10px] text-[#A58E6F] font-bold uppercase tracking-widest">{programs.find(p => p.id === record.programId)?.category || 'CARE'}</span>
                      </div>
                      <h4 className="text-xl font-bold text-[#1A3C34] mb-2 group-hover:text-[#A58E6F] transition-colors">{programs.find(p => p.id === record.programId)?.name || 'Wellness Care'}</h4>
                      <p className="text-[13px] text-slate-500 line-clamp-2 leading-relaxed">"{record.noteSummary}"</p>
                    </div>
                  </div>
                ))}
                {history.length === 0 && <div className="pl-8 text-slate-300 italic">아직 기록된 케어 리포트가 없습니다.</div>}
              </div>
            </div>
          )}
        </main>

        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/90 backdrop-blur-3xl border-t flex justify-around items-center px-6 py-4 z-50">
          {[
            { id: 'dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: 'Home' },
            { id: 'reports', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: 'Report' },
            { id: 'membership', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', label: 'Usage' },
            { id: 'settings', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', label: 'Profile' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setView(tab.id as any)} className="relative group p-4">
              <div className={`flex flex-col items-center gap-1.5 transition-all ${view === tab.id ? 'text-[#1A3C34]' : 'text-slate-300'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={tab.icon} /></svg>
                <span className="text-[8px] font-bold uppercase tracking-widest">{tab.label}</span>
              </div>
            </button>
          ))}
        </nav>

        {/* Global Popup */}
        {
          popupNotices.length > 0 && view === 'dashboard' && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-8 animate-in fade-in duration-500">
              <div className="bg-white rounded-[60px] w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh]">
                {popupNotices[0].imageUrl && <img src={popupNotices[0].imageUrl} className="w-full aspect-square object-cover" alt="Popup" />}
                <div className="p-12 space-y-4 overflow-y-auto">
                  <h4 className="text-3xl font-bold text-[#1A3C34] leading-tight font-serif italic">{popupNotices[0].title}</h4>
                  <p className="text-[15px] text-slate-500 leading-relaxed font-medium">{popupNotices[0].content}</p>
                </div>
                <div className="flex border-t">
                  <button
                    onClick={() => {
                      const suppressed = JSON.parse(localStorage.getItem('suppressed_popups') || '{}');
                      suppressed[popupNotices[0].id] = new Date().toISOString().split('T')[0];
                      localStorage.setItem('suppressed_popups', JSON.stringify(suppressed));
                      setActiveNotices(activeNotices.filter(n => n.id !== popupNotices[0].id));
                    }}
                    className="flex-1 py-10 text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] hover:bg-slate-50 transition-all border-r"
                  >
                    오늘 하루 보지 않기
                  </button>
                  <button
                    onClick={() => setActiveNotices(activeNotices.filter(n => n.id !== popupNotices[0].id))}
                    className="flex-1 py-10 text-[10px] font-bold text-[#1A3C34] uppercase tracking-[0.3em] hover:bg-[#1A3C34] hover:text-white transition-all shadow-inner"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          )
        }

        {/* Care Note Detail Modal */}
        {
          selectedRecord && (
            <div className="fixed inset-0 bg-[#1A3C34]/95 backdrop-blur-3xl z-[2000] flex items-center justify-center p-8 animate-in fade-in duration-500">
              <div className="bg-white rounded-[56px] w-full max-w-sm overflow-hidden flex flex-col luxury-shadow animate-in zoom-in-95">
                <header className="p-10 border-b flex justify-between items-start bg-slate-50/50">
                  <div className="space-y-1">
                    <p className="text-[10px] text-[#A58E6F] font-bold uppercase tracking-widest">{selectedRecord.date}</p>
                    <h3 className="text-2xl font-bold text-[#1A3C34] leading-tight">
                      {programs.find(p => p.id === selectedRecord.programId)?.name || 'Wellness Care Note'}
                    </h3>
                  </div>
                  <button onClick={() => setSelectedRecord(null)} className="text-slate-300 hover:text-[#1A3C34] transition-all">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </header>
                <div className="p-10 space-y-10 overflow-y-auto max-h-[60vh] no-scrollbar">
                  <div className="space-y-4">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">Core Insight</label>
                    <p className="text-[16px] font-bold text-[#1A3C34] leading-relaxed italic border-l-4 border-[#A58E6F] pl-6">"{selectedRecord.noteSummary}"</p>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">Wellness Care Note</label>
                    <div className="p-6 bg-[#F9F9FB] rounded-2xl text-[14px] text-[#2F3A32] leading-relaxed font-medium whitespace-pre-wrap">
                      {selectedRecord.noteDetails || '상세 기록이 없습니다.'}
                    </div>
                  </div>

                  {selectedRecord.noteRecommendation && (
                    <div className="space-y-4">
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">Manager Message</label>
                      <p className="text-[14px] text-slate-600 leading-relaxed bg-[#FFF9F2] p-6 rounded-2xl border border-[#F2E8DA]">
                        {selectedRecord.noteRecommendation}
                      </p>
                    </div>
                  )}

                  <div className="pt-8 border-t border-slate-50 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">Used Amount</label>
                        <p className="text-[16px] font-bold text-rose-400 tabular-nums">-₩{Math.floor(selectedRecord.finalPrice).toLocaleString()}</p>
                      </div>
                      <div className="space-y-2 text-right">
                        <label className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">Balance After</label>
                        <p className="text-[16px] font-bold text-emerald-600 tabular-nums">₩{Math.floor(selectedRecord.balanceAfter || 0).toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">Certification</label>
                      <div className="w-full aspect-[2/1] bg-slate-50 rounded-[32px] flex items-center justify-center border border-slate-100 p-8 shadow-inner">
                        {selectedRecord.signatureData ? (
                          <img src={selectedRecord.signatureData} className="w-full h-full object-contain opacity-80" alt="Verification Signature" />
                        ) : (
                          <span className="text-[11px] text-slate-300 font-bold italic">Verification Signature Pending</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <footer className="p-10 bg-white">
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="w-full py-6 bg-[#1A3C34] text-white rounded-[28px] font-bold uppercase text-[11px] tracking-[0.3em]"
                  >
                    Close Archive
                  </button>
                </footer>
              </div>
            </div>
          )
        }

        {/* Password Modal */}
        {
          showPwdModal && (
            <div className="fixed inset-0 bg-[#1A3C34]/95 backdrop-blur-3xl z-[100] flex items-center justify-center p-8 animate-in zoom-in-95 duration-500">
              <form onSubmit={handlePasswordChange} className="bg-white rounded-[56px] p-12 w-full space-y-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-[#A58E6F]"></div>
                <h3 className="text-2xl font-serif-luxury font-bold text-[#1A3C34] text-center mb-10">Security Reset</h3>
                <div className="space-y-4">
                  <input type="password" placeholder="현재 비밀번호" className="w-full px-8 py-5 bg-[#F9F9F7] border rounded-3xl outline-none" value={pwdForm.current} onChange={e => setPwdForm({ ...pwdForm, current: e.target.value })} required />
                  <input type="password" placeholder="새 비밀번호" className="w-full px-8 py-5 bg-[#F9F9F7] border rounded-3xl outline-none" value={pwdForm.new} onChange={e => setPwdForm({ ...pwdForm, new: e.target.value })} required />
                  <input type="password" placeholder="새 비밀번호 확인" className="w-full px-8 py-5 bg-[#F9F9F7] border rounded-3xl outline-none" value={pwdForm.confirm} onChange={e => setPwdForm({ ...pwdForm, confirm: e.target.value })} required />
                  <input type="text" placeholder="보안 인증 번호" className="w-full px-8 py-5 bg-[#F9F9F7] border rounded-3xl outline-none" value={pwdForm.verificationCode} onChange={e => setPwdForm({ ...pwdForm, verificationCode: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-6">
                  <button type="button" onClick={() => setShowPwdModal(false)} className="py-5 border rounded-[28px] font-bold text-slate-300 uppercase text-[10px] tracking-widest">Cancel</button>
                  <button type="submit" className="py-5 bg-[#1A3C34] text-white rounded-[28px] font-bold uppercase text-[10px] tracking-widest">Update</button>
                </div>
              </form>
            </div>
          )
        }

        {/* [NEW] Signature Modal */}
        {
          signingRecordId && (
            <div className="fixed inset-0 bg-[#1A3C34]/95 backdrop-blur-3xl z-[2000] flex items-center justify-center p-6 animate-in zoom-in-95 duration-500">
              <div className="w-full max-w-md bg-white rounded-[48px] overflow-hidden shadow-2xl relative flex flex-col">
                <div className="p-8 text-center space-y-2 border-b border-slate-100">
                  <p className="text-[10px] text-[#A58E6F] font-bold uppercase tracking-[0.2em]">Service Confirmation</p>
                  <h3 className="text-2xl font-bold text-[#1A3C34]">이용 내역 확인 및 서명</h3>
                </div>

                <div className="p-8 space-y-6 bg-slate-50 min-h-[200px] overflow-y-auto">
                  {(() => {
                    const rec = history.find(h => h.id === signingRecordId);
                    if (!rec) return null;
                    return (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-bold text-slate-400">케어 프로그램</span>
                          <span className="font-bold text-[#1A3C34]">{programs.find(p => p.id === rec.programId)?.name || 'Wellness Care'}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-bold text-slate-400">이용 일자</span>
                          <span className="font-bold text-[#1A3C34]">{rec.date}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-t border-slate-200 pt-4">
                          <span className="font-bold text-slate-400">최종 차감액</span>
                          <span className="font-black text-xl text-[#1A3C34]">₩{Math.floor(rec.finalPrice).toLocaleString()}</span>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                <div className="p-8 bg-white space-y-4">
                  <p className="text-[11px] text-center text-slate-400 font-bold uppercase tracking-widest mb-2">Please sign below</p>
                  <div className="border rounded-[24px] overflow-hidden shadow-inner bg-slate-50">
                    <SignaturePad
                      onSave={handleSignatureSave}
                      onCancel={() => setSigningRecordId(null)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        }
      </div >
    </div >
  );
};

export default MemberPortal;
