
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db, hashPassword } from '../../db';
import { Member, Membership, CareRecord, Program, Reservation, Notice, Notification } from '../../types';

interface MemberPortalProps {
  memberId: string;
  onLogout: () => void;
}

type ViewMode = 'dashboard' | 'care' | 'membership' | 'settings' | 'notifications';

const MemberPortal: React.FC<MemberPortalProps> = ({ memberId, onLogout }) => {
  const [member, setMember] = useState<Member | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [history, setHistory] = useState<CareRecord[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [activeNotices, setActiveNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('dashboard');
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: '', new: '', confirm: '', verificationCode: '' });
  const [zoomSignature, setZoomSignature] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [mInfo, allMs, careList, resList, allProgs, notices] = await Promise.all([
        db.members.getById(memberId),
        db.memberships.getAllByMemberId(memberId),
        db.careRecords.getByMemberId(memberId),
        db.reservations.getByMemberId(memberId),
        db.master.programs.getAll(),
        db.notices.getActiveNotices()
      ]);
      setMember(mInfo);
      setMemberships(allMs || []);
      setHistory(careList || []);
      setReservations(resList || []);
      setPrograms(allProgs || []);
      setActiveNotices((notices || []).filter(n => n.isPopup));
    } finally { setIsLoading(false); }
  }, [memberId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const activeMs = useMemo(() => memberships.find(ms => ms.status === 'active'), [memberships]);

  const upcomingRes = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return reservations
      .filter(r => r.status === 'RESERVED' && r.date >= today)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  }, [reservations]);

  const latestCare = useMemo(() => history[0], [history]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdForm.new !== pwdForm.confirm) return alert('새 비밀번호 확인이 일치하지 않습니다.');
    if (pwdForm.new !== pwdForm.confirm) return alert('새 비밀번호 확인이 일치하지 않습니다.');

    // Security Verification Logic
    if (pwdForm.verificationCode !== '01058060134') {
      return alert('보안 인증 번호가 일치하지 않습니다. 올바른 번호를 입력해주세요.');
    }

    const hashedCurrent = await hashPassword(pwdForm.current);
    if (member?.password !== hashedCurrent) return alert('현재 비밀번호가 일치하지 않습니다.');

    try {
      await db.members.update(memberId, { password: pwdForm.new });
      alert('비밀번호가 성공적으로 변경되었습니다.');
      setShowPwdModal(false);
      setPwdForm({ current: '', new: '', confirm: '', verificationCode: '' });
      fetchData();
    } catch (e) { alert('변경 중 오류가 발생했습니다.'); }
  };

  if (isLoading && !member) return <div className="min-h-screen flex items-center justify-center font-serif-luxury italic text-[#1A3C34] text-xl">Wellness, The Hannam...</div>;
  if (!member) return null;

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
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${view === 'notifications' ? 'bg-[#1A3C34] text-white shadow-lg' : 'bg-white border text-slate-400 shadow-sm'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            <span className="absolute top-3.5 right-3.5 w-1.5 h-1.5 bg-rose-400 rounded-full border border-white"></span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar px-6 space-y-10">
          {view === 'dashboard' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {/* Asset Summary Card */}
              <section className="bg-[#1A3C34] rounded-[48px] p-10 luxury-shadow text-white relative overflow-hidden">
                <div className="absolute -right-16 -top-16 w-52 h-52 bg-white/5 rounded-full blur-3xl"></div>
                <div className="relative z-10 space-y-10">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[9px] font-bold text-[#A58E6F] uppercase tracking-[0.4em] mb-1.5">Membership Status</p>
                      <span className="text-sm font-bold">{activeMs?.productName || 'No Membership'}</span>
                    </div>
                    <span className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-bold uppercase border border-white/20">Active</span>
                  </div>

                  <div className="grid grid-cols-2 gap-8 border-t border-white/5 pt-10">
                    <div className="space-y-1.5">
                      <p className="text-[8px] opacity-40 uppercase tracking-widest">Total Credit</p>
                      <p className="text-lg font-bold tabular-nums">₩{Math.floor(activeMs?.totalAmount || 0).toLocaleString()}</p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[8px] opacity-40 uppercase tracking-widest">Used Credit</p>
                      <p className="text-lg font-bold tabular-nums text-rose-400">₩{Math.floor(activeMs?.usedAmount || 0).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/10">
                    <p className="text-[10px] opacity-40 uppercase tracking-[0.4em] mb-2.5">Available Balance</p>
                    <h2 className="text-4xl font-serif-luxury font-bold">₩{Math.floor(activeMs?.remainingAmount || 0).toLocaleString()}</h2>
                  </div>
                </div>
              </section>

              {/* Upcoming Appointment */}
              <section className="bg-white rounded-[32px] p-8 luxury-shadow border border-slate-50 space-y-6">
                <h4 className="text-[10px] font-bold text-[#A58E6F] uppercase tracking-[0.2em]">Next Visit</h4>
                {upcomingRes ? (
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-[#F9F9F7] rounded-2xl flex flex-col items-center justify-center border shrink-0">
                      <span className="text-[9px] text-slate-300 font-bold uppercase">{upcomingRes.date.split('-')[1]}월</span>
                      <span className="text-xl font-serif-luxury font-bold text-[#1A3C34]">{upcomingRes.date.split('-')[2]}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#1A3C34]">{programs.find(p => p.id === upcomingRes.programId)?.name || 'Wellness Care'}</p>
                      <p className="text-[11px] text-slate-400 tabular-nums">{upcomingRes.time} @ The Hannam</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 border-2 border-dashed border-slate-50 rounded-2xl">
                    <p className="text-xs text-slate-300 italic mb-4">새로운 관리를 예약해 보세요</p>
                    <button className="px-6 py-2.5 bg-[#F9F9F7] rounded-full text-[9px] font-bold text-[#1A3C34] uppercase tracking-widest border">Book Session</button>
                  </div>
                )}
              </section>

              {/* Recent Insight */}
              {latestCare && (
                <section className="bg-white rounded-[32px] p-7 border-l-4 border-l-[#A58E6F] luxury-shadow">
                  <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mb-2.5">Recent Wellness Insight • {latestCare.date}</p>
                  <p className="text-[14px] font-medium text-[#1A3C34] italic leading-relaxed line-clamp-2">"{latestCare.noteSummary}"</p>
                </section>
              )}
            </div>
          )}

          {view === 'membership' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500 pb-12">
              <div className="px-2">
                <h2 className="text-4xl font-serif-luxury font-bold text-[#1A3C34] leading-tight">멤버십 자산 내역</h2>
                <p className="text-[13px] text-slate-400 font-medium mt-4 leading-relaxed">투명하게 기록된 모든 자산 이용 흐름을 확인하실 수 있습니다.</p>
              </div>

              <div className="space-y-8">
                <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.4em] px-2">Usage Timeline</h4>
                <div className="space-y-6">
                  {history.length > 0 ? history.map(record => (
                    <div key={record.id} className="bg-white rounded-[40px] p-8 border border-[#E8E8E4] luxury-shadow flex justify-between items-center group active:scale-[0.98] transition-all duration-300 relative overflow-hidden">
                      <div className="flex gap-6 items-center">
                        <div className="text-center min-w-[70px]">
                          <p className="text-[11px] text-[#A58E6F] font-bold tabular-nums uppercase">{record.date.slice(5)}</p>
                          {record.reservationTime && <p className="text-[9px] text-slate-300 font-bold tabular-nums mt-0.5">[{record.reservationTime}]</p>}
                        </div>
                        <div className="space-y-1">
                          <h5 className="text-[15px] font-bold text-[#1A3C34]">{programs.find(p => p.id === record.programId)?.name || 'Wellness Care'}</h5>
                          <p className="text-[8px] text-slate-300 font-bold uppercase tracking-widest">Care Verified</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {record.signatureData && (
                          <div
                            onClick={(e) => { e.stopPropagation(); setZoomSignature(record.signatureData!); }}
                            className="w-12 h-12 bg-[#F9F9F7] rounded-xl border p-1 mb-1 grayscale active:grayscale-0"
                          >
                            <img src={record.signatureData} className="w-full h-full object-contain" alt="Sig" />
                          </div>
                        )}
                        <p className="text-[18px] font-bold text-[#E5989B] tabular-nums">-₩{Math.floor(record.finalPrice).toLocaleString()}</p>
                        <p className="text-[9px] font-bold text-emerald-600/50 tabular-nums uppercase tracking-widest">잔액: ₩{Math.floor(record.balanceAfter || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="py-24 text-center text-slate-300 italic font-serif text-lg border-2 border-dashed border-slate-100 rounded-[40px]">이용 내역이 존재하지 않습니다.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {view === 'care' && (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 pb-12">
              <h3 className="text-3xl font-serif-luxury font-bold text-[#1A3C34] px-2">Wellness Journey</h3>
              {history.map(record => (
                <div key={record.id} className="bg-white p-8 rounded-[44px] border luxury-shadow space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[9px] text-[#A58E6F] font-bold uppercase tracking-widest mb-1.5">{record.date} {record.reservationTime && `[${record.reservationTime}]`}</p>
                      <h4 className="text-lg font-bold text-[#1A3C34]">{programs.find(p => p.id === record.programId)?.name}</h4>
                    </div>
                    {record.signatureData && (
                      <div
                        onClick={() => setZoomSignature(record.signatureData!)}
                        className="w-16 h-16 rounded-2xl bg-[#F9F9F7] border p-2 shadow-inner cursor-zoom-in"
                      >
                        <img src={record.signatureData} alt="Sig" className="w-full h-full object-contain grayscale" />
                      </div>
                    )}
                  </div>
                  <div className="bg-[#F9F9F7]/50 p-6 rounded-3xl border border-slate-50 italic">
                    <p className="text-[13px] text-slate-500 leading-relaxed font-medium">"{record.noteSummary}"</p>
                    <p className="text-[11px] text-[#A58E6F] font-bold uppercase tracking-widest mt-4">Next Care: {record.noteRecommendation || 'Scheduled'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === 'notifications' && (
            <div className="space-y-8 animate-in slide-in-from-top-4 duration-500 pb-12">
              <div className="flex justify-between items-end px-2">
                <h3 className="text-3xl font-serif-luxury font-bold text-[#1A3C34]">알림 센터</h3>
                <button onClick={() => setView('dashboard')} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Close</button>
              </div>
              <div className="space-y-4">
                {activeNotices.map(notice => (
                  <div key={notice.id} className="bg-white p-6 rounded-[32px] border shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="px-2 py-1 bg-[#1A3C34] text-white text-[8px] font-bold rounded uppercase tracking-widest">Notice</span>
                      <span className="text-[9px] text-slate-300 font-bold">{notice.createdAt?.split('T')[0]}</span>
                    </div>
                    <h5 className="font-bold text-[#1A3C34]">{notice.title}</h5>
                    <p className="text-xs text-slate-500 leading-relaxed">{notice.content}</p>
                  </div>
                ))}
                {activeNotices.length === 0 && (
                  <div className="py-20 text-center text-slate-300 italic font-serif">수신된 알림이 없습니다.</div>
                )}
              </div>
            </div>
          )}

          {view === 'settings' && (
            <div className="space-y-10 animate-in slide-in-from-right-4 pb-12">
              <h3 className="text-3xl font-serif-luxury font-bold text-[#1A3C34] px-2">Profile Settings</h3>
              <div className="bg-white p-10 rounded-[48px] border luxury-shadow space-y-8">
                <h4 className="text-[10px] font-bold text-[#A58E6F] uppercase tracking-[0.4em] mb-4">Personal Information</h4>
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
                <button onClick={() => setShowPwdModal(true)} className="w-full py-5 bg-[#F9F9F7] text-[#1A3C34] rounded-3xl font-bold uppercase text-[10px] tracking-widest border shadow-sm">비밀번호 변경</button>
              </div>
              <button onClick={onLogout} className="w-full py-6 bg-rose-50 text-rose-400 rounded-[32px] font-bold uppercase text-[11px] tracking-widest border border-rose-100 shadow-sm transition-all active:scale-95">Sign Out from The Hannam</button>
            </div>
          )}
        </main>

        {/* Tab Navigation */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/90 backdrop-blur-3xl border-t flex justify-around items-center px-6 py-6 z-50">
          {[
            { id: 'dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: 'Home' },
            { id: 'care', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: 'Care' },
            { id: 'membership', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', label: 'Usage' },
            { id: 'settings', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', label: 'Profile' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setView(tab.id as any)} className="relative group transition-all duration-300">
              <div className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${view === tab.id ? 'scale-110' : 'opacity-40 hover:opacity-100'}`}>
                <div className={`p-4 rounded-[22px] transition-all border-2 ${view === tab.id ? 'bg-[#1A3C34] text-white border-[#1A3C34] shadow-xl' : 'text-slate-400 border-transparent'}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={tab.icon} /></svg>
                </div>
                {view === tab.id && <span className="text-[8px] font-bold text-[#1A3C34] uppercase tracking-widest">{tab.label}</span>}
              </div>
            </button>
          ))}
        </nav>

        {/* Signature Zoom Modal */}
        {zoomSignature && (
          <div className="fixed inset-0 bg-[#1A3C34]/98 backdrop-blur-3xl z-[1000] flex items-center justify-center p-8 animate-in fade-in" onClick={() => setZoomSignature(null)}>
            <div className="bg-white p-10 rounded-[48px] shadow-2xl relative w-full" onClick={e => e.stopPropagation()}>
              <h4 className="text-center font-serif-luxury italic text-xl text-[#1A3C34] mb-8 uppercase tracking-widest opacity-40">Verified Signature</h4>
              <img src={zoomSignature} className="w-full h-auto object-contain bg-[#F9F9F7] rounded-3xl p-6 shadow-inner" alt="Zoomed Signature" />
              <button onClick={() => setZoomSignature(null)} className="w-full mt-8 py-5 bg-[#1A3C34] text-white rounded-3xl font-bold uppercase text-[10px] tracking-widest shadow-xl">Close View</button>
            </div>
          </div>
        )}

        {/* Password Reset Modal */}
        {showPwdModal && (
          <div className="fixed inset-0 bg-[#1A3C34]/95 backdrop-blur-3xl z-[100] flex items-center justify-center p-8 animate-in zoom-in-95 duration-500">
            <form onSubmit={handlePasswordChange} className="bg-white rounded-[56px] p-12 w-full space-y-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-[#A58E6F]"></div>
              <h3 className="text-2xl font-serif-luxury font-bold text-[#1A3C34] text-center mb-10">Security Reset</h3>
              <div className="space-y-4">
                <input type="password" placeholder="현재 비밀번호" className="w-full px-8 py-5 bg-[#F9F9F7] border rounded-3xl outline-none focus:border-[#1A3C34] transition-all" value={pwdForm.current} onChange={e => setPwdForm({ ...pwdForm, current: e.target.value })} required />
                <input type="password" placeholder="새 비밀번호" className="w-full px-8 py-5 bg-[#F9F9F7] border rounded-3xl outline-none focus:border-[#1A3C34] transition-all" value={pwdForm.new} onChange={e => setPwdForm({ ...pwdForm, new: e.target.value })} required />
                <input type="password" placeholder="새 비밀번호 확인" className="w-full px-8 py-5 bg-[#F9F9F7] border rounded-3xl outline-none focus:border-[#1A3C34] transition-all" value={pwdForm.confirm} onChange={e => setPwdForm({ ...pwdForm, confirm: e.target.value })} required />
                <div className="pt-2">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 pl-3">Security Verification</p>
                  <input type="text" placeholder="인증 번호를 입력하세요" className="w-full px-8 py-5 bg-[#F9F9F7] border rounded-3xl outline-none focus:border-[#1A3C34] transition-all" value={pwdForm.verificationCode} onChange={e => setPwdForm({ ...pwdForm, verificationCode: e.target.value })} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-6">
                <button type="button" onClick={() => setShowPwdModal(false)} className="py-5 border rounded-[28px] font-bold text-slate-300 uppercase text-[10px] tracking-widest">Cancel</button>
                <button type="submit" className="py-5 bg-[#1A3C34] text-white rounded-[28px] font-bold uppercase text-[10px] tracking-widest shadow-xl">Update Key</button>
              </div>
            </form>
          </div>
        )}

        {/* Global Popup Notifier */}
        {activeNotices.length > 0 && view === 'dashboard' && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-10 animate-in fade-in duration-700">
            <div className="bg-white rounded-[44px] w-full overflow-hidden shadow-2xl max-h-[75vh] flex flex-col relative">
              {activeNotices[0].imageUrl && <img src={activeNotices[0].imageUrl} className="w-full h-56 object-cover" alt="Popup" />}
              <div className="p-10 space-y-5 overflow-y-auto">
                <h4 className="text-2xl font-bold text-[#1A3C34] leading-tight">{activeNotices[0].title}</h4>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">{activeNotices[0].content}</p>
              </div>
              <button
                onClick={() => setActiveNotices(activeNotices.slice(1))}
                className="w-full py-6 bg-[#1A3C34] text-white font-bold uppercase text-[11px] tracking-[0.4em] shadow-inner"
              >
                오늘 하루 보지 않기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberPortal;
