import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, hashPassword } from '../../../db';
import { Member, Membership, MembershipProduct, CareRecord, Reservation, AuditLog } from '../../../types';
import SignaturePad from '../../../components/common/SignaturePad';
import ContractManagement from './ContractManagement';

import NotificationModal from '../../../components/admin/member/NotificationModal';
import MemberMemoSection from '../../../components/admin/member/MemberMemoSection';
import MemberRegistrationModal from '../../../components/admin/member/MemberRegistrationModal';

type DetailTab = 'USAGE' | 'AUDIT' | 'SECURITY';
const SECONDARY_PWD_REQUIRED = 'ekdnfhem2ck';

const MemberManagement: React.FC = () => {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [allMemberships, setAllMemberships] = useState<Membership[]>([]);
  const [membershipProducts, setMembershipProducts] = useState<MembershipProduct[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<number | ''>('');

  const [isLoading, setIsLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('USAGE');
  const [historyFilterId, setHistoryFilterId] = useState('all');
  const [zoomSignature, setZoomSignature] = useState<string | null>(null);
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<CareRecord | null>(null);


  const [details, setDetails] = useState<{
    history: CareRecord[],
    memberships: Membership[],
    auditLogs: AuditLog[]
  }>({ history: [], memberships: [], auditLogs: [] });

  const [showGrantMembershipModal, setShowGrantMembershipModal] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null); // State for Edit Mode
  const [grantForm, setGrantForm] = useState({
    regDate: new Date().toISOString().split('T')[0],
    startDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
    durationMonths: '12',
    productName: '',
    productId: '',
    amount: 0,
    discountRate: 0
  });

  const [showAuthModal, setShowAuthModal] = useState<{ open: boolean, onChevron: () => void }>({ open: false, onChevron: () => { } });
  const [authInput, setAuthInput] = useState('');

  // Bulk Action State
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [showNotiModal, setShowNotiModal] = useState(false);

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const [allMembers, allMps, allMsProducts] = await Promise.all([
        db.members.getAll(),
        db.memberships.getAll(),
        db.master.membershipProducts.getAll()
      ]);
      setMembers(allMembers || []);
      setAllMemberships(allMps || []);
      setMembershipProducts(allMsProducts || []);
    } catch (e: any) { alert(e.message); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // Handle URL deep linking for member details
  useEffect(() => {
    if (memberId && members.length > 0) {
      const m = members.find(m => m.id === memberId);
      if (m && (!selectedMember || selectedMember.id !== memberId)) {
        handleViewDetails(m);
      }
    }
  }, [memberId, members]);

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.phone.includes(searchTerm) ||
        m.phone.slice(-4).includes(searchTerm);

      const memberMs = allMemberships.filter(ms => ms.memberId === m.id && ms.status === 'active');
      const latestExpiry = memberMs.length > 0
        ? memberMs.reduce((prev, curr) => (prev.expiryDate || '') > (curr.expiryDate || '') ? prev : curr).expiryDate
        : '';
      const totalBalance = memberMs.reduce((sum, ms) => sum + ms.remainingAmount, 0);

      const matchExpiry = expiryFilter ? (latestExpiry && latestExpiry <= expiryFilter) : true;
      const matchBalance = balanceFilter !== '' ? totalBalance <= balanceFilter : true;

      return matchSearch && matchExpiry && matchBalance;
    });
  }, [members, allMemberships, searchTerm, expiryFilter, balanceFilter]);

  const handleViewDetails = async (m: Member) => {
    setIsLoading(true);
    try {
      const [h, allMs, logs] = await Promise.all([
        db.careRecords.getByMemberId(m.id),
        db.memberships.getAllByMemberId(m.id),
        db.system.getAuditLogsByMemberId(m.id)
      ]);
      setDetails({ history: h, memberships: allMs, auditLogs: logs });
      setSelectedMember(m);
      setActiveTab('USAGE');
      setHistoryFilterId('all');
    } finally { setIsLoading(false); }
  };

  const requestDownloadAuth = (onSuccess: () => void) => {
    setAuthInput('');
    setShowAuthModal({ open: true, onChevron: onSuccess });
  };

  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) return alert('데이터가 없습니다.');
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csvContent = "\ufeff" + [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  };

  const handleAuthConfirm = () => {
    if (authInput === SECONDARY_PWD_REQUIRED) {
      setShowAuthModal({ open: false, onChevron: () => { } });
      showAuthModal.onChevron();
    } else {
      alert('비밀번호가 일치하지 않습니다.');
    }
  };

  const toggleSelectAll = () => {
    if (selectedMemberIds.size === filteredMembers.length) {
      setSelectedMemberIds(new Set());
    } else {
      setSelectedMemberIds(new Set(filteredMembers.map(m => m.id)));
    }
  };

  const toggleSelectMember = (id: string) => {
    const newSet = new Set(selectedMemberIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedMemberIds(newSet);
  };

  const handleNotificationSend = async (message: string) => {
    const recipients = selectedMember ? [selectedMember.id] : Array.from(selectedMemberIds);
    if (recipients.length === 0) return alert('대상 회원이 없습니다.');

    try {
      // Send notifications one by one
      await Promise.all(recipients.map(memberId =>
        db.notifications.add({
          memberId,
          title: '관리자 알림',
          content: message,
          isRead: false
          // Note: 'type' or 'category' omitted to avoid schema issues, defaulting to DB default or allowed null
        })
      ));

      alert(`${recipients.length}명에게 알림이 전송되었습니다.`);
      setSelectedMemberIds(new Set());
      setShowNotiModal(false);
    } catch (e: any) {
      console.error('Notification Error:', e);
      alert(`알림 전송 실패: ${e.message}`);
    }
  };

  if (selectedMember) {
    const totalPaid = details.memberships.reduce((sum, m) => sum + m.totalAmount, 0);
    const totalUsed = details.memberships.reduce((sum, m) => sum + m.usedAmount, 0);
    const currentBalance = details.memberships.reduce((sum, m) => sum + m.remainingAmount, 0);

    const activeMs = details.memberships.filter(ms => ms.status === 'active');
    const expiredMs = details.memberships.filter(ms => ms.status === 'expired');

    return (
      <div className="flex gap-10 page-transition pb-20 min-h-screen bg-[#F9F9F7]">
        {/* Left Sidebar: Profile & Info */}
        <aside className="w-[340px] bg-white rounded-[40px] border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.03)] p-12 flex flex-col sticky top-10 self-start">
          <div className="mb-12">
            <h3 className="text-3xl font-bold text-[#2F3A32] mb-2">{selectedMember.name}</h3>
            <p className="text-[11px] text-[#A58E6F] font-bold uppercase tracking-[0.2em]">Member Profile Details</p>
          </div>

          <div className="w-full space-y-7">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">성함</span>
              <span className="text-[16px] font-bold text-[#2F3A32]">{selectedMember.name}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">연락처</span>
              <span className="text-[16px] font-bold text-[#2F3A32] tabular-nums">{selectedMember.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">생년월일</span>
              <span className="text-[16px] font-bold text-[#2F3A32] tabular-nums">{selectedMember.birthDate || '미등록'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">성별</span>
              <span className="text-[16px] font-bold text-[#2F3A32]">{selectedMember.gender}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">주소</span>
              <span className="text-[14px] font-medium text-slate-600 leading-relaxed">{selectedMember.address || '미등록 주소'}</span>
            </div>

            <div className="pt-6 border-t border-slate-50 space-y-2">
              <span className="text-[10px] font-bold text-[#A58E6F] uppercase tracking-widest">Wellness Care Goal</span>
              <textarea
                className="w-full text-[13px] font-medium text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border-none outline-none focus:ring-2 focus:ring-[#A58E6F]/20 min-h-[100px] resize-none"
                placeholder="회원님과 상담한 정기 케어 목표를 입력하세요..."
                value={selectedMember.goal || ''}
                onBlur={async (e) => {
                  try {
                    await db.members.update(selectedMember.id, { goal: e.target.value });
                  } catch (err) { console.error('Goal update failed', err); }
                }}
                onChange={(e) => setSelectedMember({ ...selectedMember, goal: e.target.value })}
              />
            </div>

            <div className="pt-8 border-t border-slate-50">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">최초 등록일</span>
                <span className="text-[16px] font-bold text-[#2F3A32] tabular-nums">{selectedMember.createdAt?.split('T')[0] || '미확인'}</span>
              </div>
            </div>
          </div>

          <div className="mt-20 w-full flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setEditingMember(selectedMember); setShowRegistrationModal(true); }} className="py-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-bold text-[#2F3A32] hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                수정
              </button>
              <button onClick={() => { setSelectedMember(null); navigate('/admin/members'); }} className="py-4 bg-[#2F3A32] text-white rounded-2xl text-[11px] font-bold hover:bg-[#1A3C34] transition-all shadow-lg hover:shadow-xl">뒤로가기</button>
            </div>
            <button
              onClick={async () => {
                if (confirm('정말로 이 회원을 삭제하시겠습니까? 데이터는 즉시 아카이브됩니다.')) {
                  try {
                    await db.members.update(selectedMember.id, { isDeleted: true });
                    alert('회원이 삭제되었습니다.');
                    setSelectedMember(null);
                    fetchMembers();
                  } catch (e: any) { alert(e.message); }
                }
              }}
              className="w-full py-4 text-[9px] font-bold text-rose-300 hover:text-rose-500 transition-colors uppercase tracking-[0.2em]"
            >
              회원 탈퇴 및 정보 아카이브
            </button>
          </div>
        </aside>

        {/* Right Dashboard: Detail Ops */}
        <main className="flex-1 space-y-8">
          {/* Top Bar with Stats & Notifications */}
          <header className="flex justify-between items-center bg-white rounded-[40px] px-12 py-10 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
            <div className="flex gap-12 items-center">
              <div className="flex flex-col gap-1 pr-10 border-r border-slate-50">
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">이용 중인 멤버십</p>
                <h4 className="text-xl font-bold text-[#1A3C34]">{activeMs[0]?.productName || '가입 정보 없음'}</h4>
              </div>
              <div className="flex flex-col gap-1 pr-10 border-r border-slate-50">
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">적용 할인율</p>
                <h4 className="text-xl font-bold text-emerald-600">
                  {activeMs[0] ? `${membershipProducts.find(p => p.id === activeMs[0].productId)?.defaultDiscountRate || 0}%` : '0%'}
                </h4>
              </div>
              <div className="flex gap-12">
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">총 결제</p>
                  <h4 className="text-xl font-bold text-[#2F3A32]">₩{totalPaid.toLocaleString()}</h4>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">총 사용</p>
                  <h4 className="text-xl font-bold text-rose-400">₩{totalUsed.toLocaleString()}</h4>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">현재 잔액</p>
                  <h4 className="text-xl font-bold text-emerald-600">₩{currentBalance.toLocaleString()}</h4>
                </div>
              </div>
            </div>
            <button onClick={() => setShowNotiModal(true)} className="w-14 h-14 rounded-2xl bg-[#F9F9FB] border border-slate-100 flex items-center justify-center text-slate-400 hover:text-[#1A3C34] hover:bg-white transition-all shadow-sm hover:shadow-md">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </button>
          </header>

          {/* Navigation Tabs */}
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] overflow-hidden">
            <nav className="flex px-12 border-b border-slate-50 gap-12">
              {[
                { id: 'USAGE', label: '멤버십 관리' },
                { id: 'SECURITY', label: '이용 내역' },
                { id: 'AUDIT', label: '업무 로그' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-8 text-[15px] font-bold relative transition-all ${activeTab === tab.id ? 'text-[#1A3C34]' : 'text-slate-300 hover:text-slate-400'}`}
                >
                  {tab.label}
                  {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#1A3C34] rounded-full"></span>}
                </button>
              ))}
            </nav>

            <div className="p-12 min-h-[600px]">
              {/* Membership Product Cards */}
              {activeTab === 'USAGE' && (
                <div className="space-y-12">
                  <div className="space-y-6">
                    <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">이용 가능 멤버십 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span></h5>
                    {activeMs.length === 0 ? (
                      <div className="py-20 text-center border-2 border-dashed rounded-[32px] text-slate-300 italic font-medium">활성화된 멤버십 정보가 없습니다.</div>
                    ) : (
                      <div className="grid grid-cols-2 gap-6">
                        {activeMs.map(ms => (
                          <div key={ms.id} className="p-8 bg-white border border-slate-100 rounded-[32px] shadow-sm hover:border-[#1A3C34]/30 transition-all group relative overflow-hidden">
                            <div className="flex justify-between items-start mb-6">
                              <div className="space-y-1">
                                <h6 className="text-xl font-bold text-[#2F3A32]">{ms.productName}</h6>
                                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                  더한남80 가산
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium pt-1">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 00-2 2z" /></svg>
                                  {ms.createdAt?.split('T')[0]} ~ {ms.expiryDate}
                                </div>
                              </div>
                              <div className="px-4 py-2 bg-slate-50 border rounded-full text-[12px] font-bold text-[#A58E6F] tabular-nums">
                                {ms.remainingAmount.toLocaleString()} / {ms.totalAmount.toLocaleString()}
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <button onClick={() => {
                                const newExp = prompt('새로운 만료일을 입력하세요 (YYYY-MM-DD)', ms.expiryDate || '');
                                if (newExp) {
                                  const adminSession = localStorage.getItem('hannam_auth_session');
                                  const adminEmail = adminSession ? JSON.parse(adminSession).email : 'unknown';
                                  db.memberships.updateExpiry(ms.id, newExp, adminEmail).then(() => {
                                    alert('만료일이 수정되었습니다.');
                                    fetchMembers(); // Refresh data
                                  });
                                }
                              }} className="text-[10px] font-bold text-slate-300 hover:text-[#1A3C34] uppercase tracking-widest underline decoration-slate-100 underline-offset-4">기간 수정</button>
                              <div className="text-[11px] font-bold text-emerald-500 uppercase tracking-widest ml-4">사용중</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-6 pt-10">
                    <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">이용 불가 멤버십 <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span></h5>
                    {expiredMs.length === 0 ? (
                      <div className="py-20 text-center border rounded-[32px] bg-slate-50/30 text-slate-300 italic font-medium">만료되거나 소진된 멤버십 정보가 없습니다.</div>
                    ) : (
                      <div className="grid grid-cols-2 gap-6">
                        {expiredMs.map(ms => (
                          <div key={ms.id} className="p-8 bg-[#F9F9FB] border border-slate-50 rounded-[32px] opacity-60">
                            <div className="flex justify-between items-start mb-6">
                              <div className="space-y-1">
                                <h6 className="text-xl font-bold text-slate-400">{ms.productName}</h6>
                                <p className="text-[11px] text-slate-300 font-medium">만료일: {ms.expiryDate}</p>
                              </div>
                              <div className="px-4 py-2 bg-slate-50 rounded-full text-[12px] font-bold text-slate-300">소진됨</div>
                            </div>
                            <div className="text-right text-[11px] font-bold text-slate-400 uppercase tracking-widest">완료</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Usage History Table */}
              {activeTab === 'SECURITY' && (
                <div className="space-y-10">
                  <div className="flex justify-between items-center bg-[#F9F9FB] p-8 rounded-[30px] border border-slate-50">
                    <div className="flex gap-10 items-center">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">이력 필터링</span>
                        <select
                          className="bg-transparent text-sm font-bold text-[#1A3C34] outline-none cursor-pointer"
                          value={historyFilterId}
                          onChange={(e) => setHistoryFilterId(e.target.value)}
                        >
                          <option value="all">전체 이용 멤버십 보기</option>
                          {details.memberships.map(m => (
                            <option key={m.id} value={m.id}>{m.productName} ({m.expiryDate})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button onClick={() => {
                      const visibleHistory = historyFilterId === 'all' ? details.history : details.history.filter(h => h.membershipId === historyFilterId);
                      const data = visibleHistory.map(h => ({ 이용일: h.date, 상품명: h.noteSummary, 이용금액: h.finalPrice, 잔액: h.balanceAfter }));
                      downloadCSV(data, `${selectedMember.name}_이용내역_${new Date().toISOString().split('T')[0]}.csv`);
                    }} className="px-6 py-3 bg-white border border-slate-100 rounded-2xl text-[11px] font-bold text-[#A58E6F] hover:text-[#1A3C34] shadow-sm transition-all">EXCEL 다운로드</button>
                  </div>

                  <div className="overflow-hidden border border-slate-50 rounded-[32px] bg-white">
                    <table className="w-full text-left">
                      <thead className="bg-[#F9FAFB] text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50">
                        <tr>
                          <th className="px-10 py-7">이용일시</th>
                          <th className="px-10 py-7">프로그램 명</th>
                          <th className="px-10 py-7 text-right">차감 금액</th>
                          <th className="px-10 py-7 text-center">동의 서명</th>
                          <th className="px-10 py-7 text-center">조회</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(() => {
                          const filtered = historyFilterId === 'all' ? details.history : details.history.filter(h => h.membershipId === historyFilterId);
                          if (filtered.length === 0) return <tr><td colSpan={5} className="py-40 text-center text-slate-300 italic font-bold">검색된 이용 기록이 없습니다.</td></tr>;
                          return filtered.map(h => (
                            <tr key={h.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => setSelectedHistoryRecord(h)}>
                              <td className="px-10 py-8">
                                <div className="text-[15px] font-bold text-[#2F3A32] tabular-nums">{h.date}</div>
                                <div className="text-[11px] text-slate-300 font-bold tabular-nums mt-1">{h.createdAt?.split('T')[1].slice(0, 5)}</div>
                              </td>
                              <td className="px-10 py-8">
                                <div className="text-[15px] font-bold text-[#1A3C34]">{h.noteSummary}</div>
                                <p className="text-[11px] text-slate-400 mt-1 lines-clamp-1">{h.noteDetails || '상세 내용 없음'}</p>
                              </td>
                              <td className="px-10 py-8 text-right">
                                <div className="text-[15px] font-bold text-rose-400 tabular-nums">-₩{h.finalPrice.toLocaleString()}</div>
                                <div className="text-[11px] text-emerald-600 font-bold tabular-nums mt-1">잔액 ₩{(h.balanceAfter || 0).toLocaleString()}</div>
                              </td>
                              <td className="px-10 py-8 text-center">
                                {h.signatureData ? (
                                  <img src={h.signatureData} className="inline-block h-10 w-16 object-contain grayscale hover:grayscale-0 transition-all opacity-50 hover:opacity-100" />
                                ) : <span className="text-[9px] text-slate-200 uppercase font-bold">미서명</span>}
                              </td>
                              <td className="px-10 py-8 text-center">
                                <div className="w-10 h-10 rounded-2xl bg-[#F9F9FB] flex items-center justify-center text-slate-300 group-hover:bg-[#1A3C34] group-hover:text-white transition-all shadow-sm">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                                </div>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Memo Section */}
              {activeTab === 'AUDIT' && (
                <div className="space-y-10">
                  <div className="bg-[#FFF9F2] p-10 rounded-[32px] border border-[#F2E8DA]">
                    <MemberMemoSection memberId={selectedMember.id} initialMemo={selectedMember.adminMemo || ''} />
                  </div>

                  {/* Simplified Log List for 'Audit' Tab */}
                  <div className="space-y-6">
                    <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.2em]">최근 업무 로그 (Revision Streams)</h5>
                    <div className="bg-white rounded-[32px] border border-slate-50 overflow-hidden">
                      {details.auditLogs.slice(0, 10).map(log => (
                        <div key={log.id} className="p-6 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors flex justify-between items-center">
                          <div className="flex gap-10 items-center">
                            <div className="text-center min-w-[80px]">
                              <p className="text-[12px] font-bold text-[#1A3C34] tabular-nums">{log.createdAt.split('T')[0].slice(5)}</p>
                              <p className="text-[9px] text-slate-300 font-bold">{log.createdAt.split('T')[1].slice(0, 5)}</p>
                            </div>
                            <div>
                              <p className="text-[13px] font-bold text-[#2F3A32]">{log.action}</p>
                              <p className="text-[11px] text-slate-400">{log.details}</p>
                            </div>
                          </div>
                          <div className="text-right text-[10px] font-bold text-slate-200 uppercase tracking-widest">{log.adminEmail.split('@')[0]}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Floating Action Buttons */}
        <div className="fixed bottom-12 right-12 flex flex-col gap-4">
          <button onClick={() => setShowGrantMembershipModal(true)} className="w-20 h-20 bg-[#2F3A32] text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-[#1A3C34] hover:scale-105 transition-all group">
            <svg className="w-8 h-8 group-hover:rotate-90 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>

        {/* Auth Modal remains the same but with premium style */}
        {showAuthModal.open && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-2xl z-[2000] flex items-center justify-center p-8">
            <div className="bg-white p-20 rounded-[80px] max-w-md w-full text-center space-y-12 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2.5 bg-[#A58E6F]"></div>
              <h4 className="text-3xl font-serif-luxury italic font-bold text-[#1A3C34]">Security Verification</h4>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">2차 보안 암호를 입력하세요.</p>
              <input type="password" placeholder="••••••••" className="w-full py-10 text-center text-7xl bg-slate-50 border rounded-[40px] outline-none font-bold tracking-[0.5em]" value={authInput} onChange={e => setAuthInput(e.target.value)} autoFocus onKeyPress={e => e.key === 'Enter' && handleAuthConfirm()} />
              <button onClick={handleAuthConfirm} className="w-full py-6 bg-[#1A3C34] text-white rounded-[32px] font-bold uppercase tracking-widest">Unlock & Export</button>
            </div>
          </div>
        )}

        {/* Grant Membership Modal */}
        {showGrantMembershipModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[2000] flex items-center justify-center p-8">
            <div className="bg-white p-12 rounded-[50px] shadow-2xl max-w-2xl w-full space-y-8 relative animate-in zoom-in-95 duration-300">
              <button onClick={() => setShowGrantMembershipModal(false)} className="absolute top-8 right-8 text-slate-300 hover:text-[#1A3C34]"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
              <div className="space-y-2">
                <h4 className="text-3xl font-bold text-[#2F3A32]">멤버십 부여</h4>
                <p className="text-sm text-slate-400 font-medium">관리자 권한으로 새로운 멤버십을 할당합니다.</p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">상품 선택</label>
                  <select
                    className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold"
                    value={grantForm.productName}
                    onChange={e => {
                      const p = membershipProducts.find(mp => mp.name === e.target.value);
                      setGrantForm(prev => ({ ...prev, productId: p?.id, productName: e.target.value, amount: p?.totalAmount || 0, discountRate: p?.defaultDiscountRate || 0 }));
                    }}
                  >
                    <option value="">상품을 선택하세요</option>
                    {membershipProducts.map(p => <option key={p.id} value={p.name}>{p.name} (₩{p.totalAmount.toLocaleString()})</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">결제 금액</label>
                  <input
                    type="number"
                    className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold"
                    value={grantForm.amount}
                    onChange={e => setGrantForm(prev => ({ ...prev, amount: +e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#A58E6F] uppercase tracking-widest ml-1">기본 할인율 (%)</label>
                <input
                  type="number"
                  className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold"
                  value={grantForm.discountRate}
                  onChange={e => setGrantForm(prev => ({ ...prev, discountRate: +e.target.value }))}
                />
              </div>
              <button
                onClick={async () => {
                  if (!grantForm.productName) return alert('상품을 선택하세요.');
                  try {
                    await db.memberships.topUp(selectedMember.id, grantForm.amount, grantForm.productName, grantForm.discountRate, grantForm.productId);
                    alert('멤버십이 성공적으로 부여되었습니다.');
                    setShowGrantMembershipModal(false);
                    handleViewDetails(selectedMember); // Refresh
                  } catch (e: any) { alert(e.message); }
                }}
                className="w-full py-5 bg-[#1A3C34] text-white rounded-2xl font-bold text-lg shadow-lg hover:scale-[1.02] transition-all"
              >
                멤버십 저장 및 발급
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 pb-24 page-transition">
      <header className="flex justify-between items-end border-b pb-12">
        <div><h2 className="text-4xl font-bold text-[#2F3A32]">회원 통합 관리</h2><p className="text-[11px] text-[#A58E6F] font-bold mt-2 uppercase tracking-[0.5em]">Membership Archive Control Center</p></div>
        <button
          onClick={() => setShowRegistrationModal(true)}
          className="px-8 py-4 bg-[#2F3A32] text-white rounded-[24px] font-bold text-xs uppercase tracking-widest hover:bg-[#1A3C34] transition-all shadow-lg flex items-center gap-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
          신규 회원 등록 (Automatic ID)
        </button>
      </header>

      <section className="bg-white p-10 rounded-3xl border shadow-sm space-y-8">
        <div className="grid grid-cols-12 gap-8 items-end">
          <div className="col-span-4 space-y-3">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-4">성함 / 연락처</label>
            <input type="text" placeholder="검색어 입력..." className="w-full px-10 py-5 bg-slate-50 border rounded-[28px] outline-none font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="col-span-3 space-y-3">
            <label className="text-[11px] font-bold text-rose-400 uppercase tracking-widest ml-4">만료 예정 (~까지)</label>
            <input type="date" className="w-full px-10 py-5 bg-slate-50 border rounded-[28px] outline-none font-bold" value={expiryFilter} onChange={e => setExpiryFilter(e.target.value)} />
          </div>
          <div className="col-span-3 space-y-3">
            <label className="text-[11px] font-bold text-[#A58E6F] uppercase tracking-widest ml-4">잔액 부족 (~이하)</label>
            <input type="number" placeholder="금액 입력..." className="w-full px-10 py-5 bg-slate-50 border rounded-[28px] outline-none font-bold" value={balanceFilter} onChange={e => setBalanceFilter(e.target.value === '' ? '' : +e.target.value)} />
          </div>
          <div className="col-span-2"><button onClick={() => { setSearchTerm(''); setExpiryFilter(''); setBalanceFilter(''); }} className="w-full py-5 bg-slate-100 text-slate-400 rounded-[28px] font-bold uppercase text-[11px] tracking-widest">초기화</button></div>
        </div>
      </section>

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#F9FAFB] border-b text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            <tr>
              <th className="pl-12 py-10 w-[8%]">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded-lg border-slate-300 accent-[#1A3C34] cursor-pointer"
                  checked={filteredMembers.length > 0 && selectedMemberIds.size === filteredMembers.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-10 py-10 w-[22%]">회원명</th>
              <th className="px-10 py-10 w-[25%]">연락처</th>
              <th className="px-10 py-10 w-[30%]">잔액 / 만료일</th>
              <th className="px-12 py-10 text-right w-[15%]">
                {selectedMemberIds.size > 0 && (
                  <button
                    onClick={() => setShowNotiModal(true)}
                    className="px-6 py-2 bg-[#2F3A32] text-white text-[10px] font-bold rounded-xl hover:bg-[#1A3C34] transition-all uppercase tracking-widest shadow-md animate-in fade-in slide-in-from-right-2"
                  >
                    일괄 ({selectedMemberIds.size})
                  </button>
                )}
                {!selectedMemberIds.size && '관리'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredMembers.map(m => {
              const ms = allMemberships.filter(ms => ms.memberId === m.id && ms.status === 'active');
              const totalBal = ms.reduce((sum, curr) => sum + curr.remainingAmount, 0);
              const latestExp = ms.length > 0 ? ms.reduce((prev, curr) => (prev.expiryDate || '') > (curr.expiryDate || '') ? prev : curr).expiryDate : '-';
              return (
                <tr key={m.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="pl-12 py-10">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded-lg border-slate-300 accent-[#1A3C34] cursor-pointer"
                      checked={selectedMemberIds.has(m.id)}
                      onChange={() => toggleSelectMember(m.id)}
                    />
                  </td>
                  <td className="px-10 py-10">
                    <div className="font-bold text-[#2F3A32] text-2xl">{m.name}</div>
                    <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mt-1">HANNAM ID: {m.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-10 py-10 text-[18px] text-slate-500 font-bold tabular-nums">
                    {m.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}
                  </td>
                  <td className="px-10 py-10">
                    <p className={`text-xl font-black ${totalBal <= 300000 ? 'text-rose-400' : 'text-emerald-600'}`}>₩{totalBal.toLocaleString()}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-slate-300 font-bold uppercase">Latest Expiry</span>
                      <span className="text-[11px] text-[#A58E6F] font-bold tabular-nums">{latestExp}</span>
                    </div>
                  </td>
                  <td className="px-12 py-10 text-right">
                    <button onClick={() => handleViewDetails(m)} className="px-10 py-4 bg-[#F9F9FB] border border-slate-100 text-[12px] font-bold text-[#A58E6F] rounded-[24px] uppercase hover:bg-[#1A3C34] hover:text-white transition-all shadow-sm">상세 파일 조회</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showNotiModal && (
        <NotificationModal
          recipientCount={selectedMember ? 1 : selectedMemberIds.size}
          onClose={() => setShowNotiModal(false)}
          onSend={handleNotificationSend}
        />
      )}

      {showRegistrationModal && (
        <MemberRegistrationModal
          initialData={editingMember}
          onClose={() => {
            setShowRegistrationModal(false);
            setEditingMember(null);
          }}
          onSuccess={() => {
            setShowRegistrationModal(false);
            setEditingMember(null);
            fetchMembers();
          }}
        />
      )}

      {/* [NEW] History Detail Modal */}
      {selectedHistoryRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[2000] flex items-center justify-center p-8 animate-in fade-in duration-200">
          <div className="bg-white rounded-[40px] shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <header className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <p className="text-[10px] font-bold text-[#A58E6F] uppercase tracking-widest">{selectedHistoryRecord.date}</p>
                <h3 className="text-xl font-bold text-[#1A3C34] mt-1">{selectedHistoryRecord.noteSummary}</h3>
              </div>
              <button onClick={() => setSelectedHistoryRecord(null)} className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-[#1A3C34] transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </header>
            <div className="p-8 overflow-y-auto space-y-8">
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Detail Note (관리자 기록)</label>
                <div className="p-6 bg-[#F9F9FB] rounded-2xl text-[14px] text-[#2F3A32] leading-relaxed font-medium whitespace-pre-wrap">
                  {selectedHistoryRecord.noteDetails || '상세 기록이 없습니다.'}
                </div>
              </div>

              {selectedHistoryRecord.noteRecommendation && (
                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Recommendation</label>
                  <p className="text-sm text-slate-600">{selectedHistoryRecord.noteRecommendation}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">결제 금액</label>
                  <p className="text-lg font-bold text-[#2F3A32]">₩{selectedHistoryRecord.finalPrice.toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">차감 후 잔액</label>
                  <p className="text-lg font-bold text-emerald-600">₩{(selectedHistoryRecord.balanceAfter || 0).toLocaleString()}</p>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-50 space-y-4">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">Member Signature</label>
                {selectedHistoryRecord.signatureData ? (
                  <div className="border border-slate-100 rounded-2xl p-4 bg-white flex justify-center">
                    <img src={selectedHistoryRecord.signatureData} alt="Signature" className="max-h-32 object-contain" />
                  </div>
                ) : (
                  <div className="p-6 border-2 border-dashed border-slate-100 rounded-2xl text-center text-[11px] font-bold text-slate-300 uppercase tracking-widest">
                    서명 대기 중 (Pending)
                  </div>
                )}
                {selectedHistoryRecord.signedAt && (
                  <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">Signed at: {selectedHistoryRecord.signedAt?.split('T')[0]}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default MemberManagement;
