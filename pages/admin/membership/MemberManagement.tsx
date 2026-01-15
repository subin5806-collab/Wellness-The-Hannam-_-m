
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db, hashPassword } from '../../../db';
import { Member, Membership, MembershipProduct, CareRecord, Reservation, AuditLog } from '../../../types';
import SignaturePad from '../../../components/common/SignaturePad';
import ContractManagement from './ContractManagement';

type DetailTab = 'USAGE' | 'AUDIT' | 'SECURITY';
const SECONDARY_PWD_REQUIRED = 'ekdnfhem2ck';

const MemberManagement: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [allMemberships, setAllMemberships] = useState<Membership[]>([]);
  const [membershipProducts, setMembershipProducts] = useState<MembershipProduct[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<number | ''>('');

  const [isLoading, setIsLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('USAGE');
  const [zoomSignature, setZoomSignature] = useState<string | null>(null);

  const [details, setDetails] = useState<{
    history: CareRecord[],
    memberships: Membership[],
    auditLogs: AuditLog[]
  }>({ history: [], memberships: [], auditLogs: [] });

  const [showGrantMembershipModal, setShowGrantMembershipModal] = useState(false);
  const [grantForm, setGrantForm] = useState({
    regDate: new Date().toISOString().split('T')[0],
    startDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
    durationMonths: '12',
    productName: '',
    amount: 0
  });

  const [showAuthModal, setShowAuthModal] = useState<{ open: boolean, onChevron: () => void }>({ open: false, onChevron: () => { } });
  const [authInput, setAuthInput] = useState('');

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

  if (selectedMember) {
    const activeMs = details.memberships.find(ms => ms.status === 'active');
    const totalPaid = details.memberships.reduce((sum, m) => sum + m.totalAmount, 0);
    const totalUsed = details.memberships.reduce((sum, m) => sum + m.usedAmount, 0);
    const currentBalance = details.memberships.reduce((sum, m) => sum + m.remainingAmount, 0);

    return (
      <div className="space-y-10 page-transition pb-32 max-w-[1400px] mx-auto">
        <section className="bg-white px-12 py-10 rounded-[60px] border luxury-shadow flex items-center justify-between">
          <div className="flex items-center gap-10">
            <button onClick={() => setSelectedMember(null)} className="p-4 bg-white border rounded-[20px] text-slate-300 hover:text-[#1A3C34] transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div className="flex gap-16">
              <div>
                <p className="text-[10px] font-bold text-slate-300 uppercase mb-2">성함</p>
                <h3 className="text-[28px] font-bold text-[#1A3C34]">{selectedMember.name} <span className="text-xs font-normal text-slate-300 ml-2">등록: {selectedMember.createdAt?.split('T')[0]}</span></h3>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-300 uppercase mb-2">연락처</p>
                <h3 className="text-2xl font-bold text-[#1A3C34] tabular-nums">{selectedMember.phone}</h3>
              </div>
            </div>
          </div>
          <button className="px-10 py-4 bg-slate-50 border border-slate-100 text-slate-400 rounded-3xl font-bold text-[12px] hover:bg-[#1A3C34] hover:text-white transition-all">회원 정보 수정</button>
        </section>

        <section className="grid grid-cols-4 gap-6">
          <div className="bg-[#1A3C34] p-10 rounded-[44px] text-white shadow-xl flex flex-col justify-between min-h-[260px]">
            <div className="space-y-4">
              <p className="text-[11px] font-bold text-slate-300 opacity-60 uppercase tracking-widest">현재 멤버십</p>
              <h4 className="text-3xl font-serif-luxury italic font-bold tracking-tight">{activeMs?.productName || '가입 정보 없음'}</h4>
              <p className="text-[11px] opacity-40 font-bold tracking-widest">만료일: {activeMs?.expiryDate || 'N/A'}</p>
            </div>
            <button onClick={() => setShowGrantMembershipModal(true)} className="self-end p-4 bg-white/10 rounded-2xl border border-white/5 hover:bg-white/20 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>
          <div className="bg-white p-10 rounded-[44px] border border-slate-100 luxury-shadow flex flex-col justify-between min-h-[260px]">
            <div><p className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">결제 총액</p><h4 className="text-4xl font-bold text-[#1A3C34] mt-8 tabular-nums">₩{totalPaid.toLocaleString()}</h4></div>
            <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden"><div className="h-full bg-[#A58E6F]" style={{ width: '100%' }}></div></div>
          </div>
          <div className="bg-white p-10 rounded-[44px] border border-slate-100 luxury-shadow flex flex-col justify-between min-h-[260px]">
            <div><p className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">총 사용액</p><h4 className="text-4xl font-bold text-rose-400 mt-8 tabular-nums">₩{totalUsed.toLocaleString()}</h4></div>
            <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden"><div className="h-full bg-rose-400" style={{ width: `${(totalUsed / (totalPaid || 1)) * 100}%` }}></div></div>
          </div>
          <div className="bg-white p-10 rounded-[44px] border-2 border-[#1A3C34] luxury-shadow flex flex-col justify-between min-h-[260px]">
            <div><p className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">현재 잔액</p><h4 className="text-5xl font-serif-luxury font-bold text-[#1A3C34] italic mt-8 tabular-nums">₩{currentBalance.toLocaleString()}</h4></div>
            <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${(currentBalance / (totalPaid || 1)) * 100}%` }}></div></div>
          </div>
        </section>

        <section className="bg-[#FFF9F2] px-12 py-8 rounded-[50px] border border-[#F2E8DA] luxury-shadow">
          <textarea className="w-full bg-transparent outline-none text-[16px] font-medium text-[#2F3A32] placeholder:text-[#A58E6F]/30 min-h-[40px] leading-relaxed resize-none" placeholder="관리자 메모를 입력하세요..." defaultValue={selectedMember.adminMemo || ''} onBlur={(e) => db.members.update(selectedMember.id, { adminMemo: e.target.value })} />
        </section>

        <section>
          <nav className="flex gap-16 border-b px-10">
            {[{ id: 'USAGE', label: '자산 이용 내역' }, { id: 'AUDIT', label: '변경 이력' }, { id: 'SECURITY', label: '보안 및 설정' }].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`pb-5 text-[14px] font-bold relative transition-all ${activeTab === t.id ? 'text-[#1A3C34]' : 'text-slate-300 hover:text-slate-500'}`}>
                {t.label}{activeTab === t.id && <span className="absolute bottom-0 left-0 right-0 h-1.5 bg-[#1A3C34] rounded-full"></span>}
              </button>
            ))}
          </nav>

          <div className="py-12 min-h-[400px]">
            {activeTab === 'USAGE' && (
              <div className="space-y-8">
                {details.history.map(r => (
                  <div key={r.id} className="p-12 bg-white rounded-[60px] border border-[#E8E8E4] luxury-shadow flex justify-between items-center group hover:border-[#1A3C34] transition-all relative overflow-hidden">
                    <div className="flex gap-16 items-center">
                      <div className="text-center min-w-[140px] border-r pr-10 border-slate-50">
                        <p className="text-[13px] text-slate-400 font-bold tabular-nums">{r.date}</p>
                        <p className="text-[10px] text-slate-300 font-bold uppercase mt-1.5">REQ: {r.createdAt?.split('T')[0]}</p>
                      </div>
                      <div className="space-y-2">
                        <h5 className="font-bold text-[#1A3C34] text-[20px]">{r.noteSummary}</h5>
                        <div className="bg-slate-50/50 p-6 rounded-[24px] border border-slate-50 max-w-2xl">
                          <p className="text-[13px] text-slate-500 leading-relaxed font-medium">{r.noteDetails || '상세 내용 없음'}</p>
                        </div>
                        <p className="text-[9px] text-[#A58E6F] font-bold uppercase tracking-widest mt-2">WELLNESS CARE NARRATIVE • 전문 노출 최적화</p>
                      </div>
                    </div>
                    <div className="flex gap-16 items-center pr-10">
                      {r.signatureData && <div onClick={() => setZoomSignature(r.signatureData!)} className="w-24 h-24 rounded-[32px] bg-slate-50 border p-2 cursor-zoom-in grayscale group-hover:grayscale-0 transition-all"><img src={r.signatureData} className="w-full h-full object-contain" /></div>}
                      <div className="text-right">
                        <span className="text-[32px] font-bold text-rose-400 tabular-nums block">-₩{r.finalPrice.toLocaleString()}</span>
                        <span className="text-[12px] font-bold text-emerald-600 tabular-nums mt-1 block">잔액: ₩{(r.balanceAfter || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'SECURITY' && (
              <div className="grid grid-cols-2 gap-10">
                <div className="bg-white p-14 rounded-[60px] border luxury-shadow space-y-10">
                  <h4 className="text-2xl font-serif-luxury italic font-bold text-[#1A3C34]">Target Intelligence Hub</h4>
                  <p className="text-[14px] text-slate-400 leading-relaxed">특정 조건의 리포트를 추출합니다. 케어노트 전문이 포함됩니다.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => requestDownloadAuth(() => {
                      const lowBal = allMemberships.filter(ms => ms.remainingAmount <= 100000 && ms.status === 'active');
                      const data = lowBal.map(ms => {
                        const m = members.find(mem => mem.id === ms.memberId);
                        return { 회원명: m?.name, 연락처: m?.phone, 상품명: ms.productName, 잔액: ms.remainingAmount, 만료일: ms.expiryDate };
                      });
                      downloadCSV(data, `잔액부족_${new Date().toISOString().split('T')[0]}.csv`);
                    })} className="py-5 bg-[#1A3C34] text-white rounded-3xl font-bold uppercase text-[10px] tracking-widest shadow-xl">잔액 부족 리스트</button>
                    <button onClick={() => requestDownloadAuth(() => {
                      const today = new Date();
                      const next30 = new Date(today.getTime() + 30 * 86400000).toISOString().split('T')[0];
                      const expiring = allMemberships.filter(ms => ms.expiryDate && ms.expiryDate <= next30 && ms.status === 'active');
                      const data = expiring.map(ms => {
                        const m = members.find(mem => mem.id === ms.memberId);
                        return { 회원명: m?.name, 연락처: m?.phone, 상품명: ms.productName, 잔액: ms.remainingAmount, 만료일: ms.expiryDate };
                      });
                      downloadCSV(data, `만료예정_${new Date().toISOString().split('T')[0]}.csv`);
                    })} className="py-5 bg-slate-50 border text-[#A58E6F] rounded-3xl font-bold uppercase text-[10px] tracking-widest">만료 예정 리스트</button>
                  </div>
                </div>
                <div className="bg-white p-14 rounded-[60px] border luxury-shadow space-y-10">
                  <h4 className="text-2xl font-serif-luxury italic font-bold text-[#1A3C34]">Security Access</h4>
                  <p className="text-[14px] text-slate-400 leading-relaxed">민감 정보 제어 및 내역 전문을 추출합니다.</p>
                  <button onClick={() => requestDownloadAuth(async () => {
                    const history = await db.careRecords.getByMemberId(selectedMember.id);
                    const data = history.map(h => ({ 이용일: h.date, 항목: h.noteSummary, 케어노트: h.noteDetails, 차감액: h.finalPrice, 잔액: h.balanceAfter }));
                    downloadCSV(data, `${selectedMember.name}_케어노트전문.csv`);
                  })} className="w-full py-6 bg-[#1A3C34] text-white rounded-3xl font-bold uppercase text-[11px] tracking-widest">이 회원 케어노트 전문 추출</button>
                </div>
              </div>
            )}
          </div>
        </section>

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
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-24 page-transition max-w-[1400px] mx-auto">
      <header className="flex justify-between items-end border-b pb-12">
        <div><h2 className="text-4xl font-bold text-[#2F3A32]">회원 통합 관리</h2><p className="text-[11px] text-[#A58E6F] font-bold mt-2 uppercase tracking-[0.5em]">Membership Archive Control Center</p></div>
      </header>

      <section className="bg-white p-12 rounded-[50px] border luxury-shadow space-y-8">
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

      <div className="bg-white rounded-[60px] border luxury-shadow overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#F9FAFB] border-b text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            <tr>
              <th className="px-16 py-10">회원명</th><th className="px-16 py-10">연락처</th><th className="px-16 py-10">잔액 / 만료</th><th className="px-16 py-10 text-right">제어</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredMembers.map(m => {
              const ms = allMemberships.filter(ms => ms.memberId === m.id && ms.status === 'active');
              const totalBal = ms.reduce((sum, curr) => sum + curr.remainingAmount, 0);
              const latestExp = ms.length > 0 ? ms.reduce((prev, curr) => (prev.expiryDate || '') > (curr.expiryDate || '') ? prev : curr).expiryDate : '-';
              return (
                <tr key={m.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-16 py-10 font-bold text-[#2F3A32] text-xl">{m.name}</td>
                  <td className="px-16 py-10 text-[16px] text-slate-400 font-bold tabular-nums">{m.phone}</td>
                  <td className="px-16 py-10">
                    <p className={`text-sm font-bold ${totalBal <= 100000 ? 'text-rose-400' : 'text-emerald-600'}`}>₩{totalBal.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-300 font-bold mt-1 uppercase">EXP: {latestExp}</p>
                  </td>
                  <td className="px-16 py-10 text-right">
                    <button onClick={() => handleViewDetails(m)} className="px-10 py-4 bg-slate-50 border text-[12px] font-bold text-[#A58E6F] rounded-[24px] uppercase hover:bg-[#1A3C34] hover:text-white transition-all">Manage</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MemberManagement;
