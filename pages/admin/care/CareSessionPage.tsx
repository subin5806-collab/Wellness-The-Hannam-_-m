
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../../db';
import { Member, Membership, Program } from '../../../types';
import SignaturePad from '../../../components/common/SignaturePad';

const CareSessionPage: React.FC = () => {
  const { memberId } = useParams();
  const [searchParams] = useSearchParams();
  const resId = searchParams.get('resId');
  const progId = searchParams.get('progId');

  const navigate = useNavigate();
  const [member, setMember] = useState<Member | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [selectedMembershipId, setSelectedMembershipId] = useState('');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState(progId || '');
  const [discountRate, setDiscountRate] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);

  const [notes, setNotes] = useState({ summary: '', details: '', futureRef: '', recommendation: '' });

  useEffect(() => {
    if (memberId) loadInitialData();
  }, [memberId]);

  const loadInitialData = async () => {
    try {
      const [m, msList, allProgs] = await Promise.all([
        db.members.getById(memberId!),
        db.memberships.getAllByMemberId(memberId!),
        db.master.programs.getAll()
      ]);
      if (m) setMember(m);
      setMemberships(msList || []);
      if (msList.length > 0) setSelectedMembershipId(msList[0].id);
      setPrograms((allProgs || []).filter(p => p.isActive && !p.isDeleted));
    } catch (e) { console.error(e); }
  };

  const selectedProgram = programs.find(p => p.id === selectedProgramId);
  const selectedMembership = memberships.find(ms => ms.id === selectedMembershipId);
  const finalAmount = Math.floor((selectedProgram?.basePrice || 0) * (1 - Math.floor(discountRate) / 100));

  const handlePreProcess = () => {
    if (!member || !selectedProgram || !selectedMembership) return alert('필수 정보 누락');
    if (Math.floor(selectedMembership.remainingAmount) < finalAmount) return alert('잔액 부족');
    if (!notes.summary.trim()) return alert('관리 요약 필수');
    setShowSignModal(true);
  };

  const handleSignSave = async (signatureData: string) => {
    setIsProcessing(true);
    try {
      const recordId = await db.careRecords.completeCareSession({
        memberId: member!.id,
        membershipId: selectedMembershipId,
        programId: selectedProgramId,
        reservationId: resId,
        originalPrice: selectedProgram!.basePrice,
        discountRate: Math.floor(discountRate),
        finalPrice: finalAmount,
        noteSummary: notes.summary,
        noteDetails: notes.details,
        noteFutureRef: notes.futureRef,
        noteRecommendation: notes.recommendation
      });

      await db.careRecords.updateSignature(recordId, signatureData);
      if (resId) await db.reservations.updateStatus(resId, 'COMPLETED');
      alert('관리가 완료되었습니다. 서명 이미지가 안전하게 보관되었습니다.');
      navigate('/admin');
    } catch (e: any) { alert(e.message); }
    finally { setIsProcessing(false); setShowSignModal(false); }
  };

  if (!member) return <div className="p-20 text-center font-serif-luxury italic text-slate-300 text-2xl">Syncing Wellness...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-12 page-transition pb-24">
      <header className="flex justify-between items-end border-b pb-10">
        <div>
          <h2 className="text-3xl font-bold text-[#2F3A32]">케어 완료 및 정산 처리</h2>
          <p className="text-[11px] text-[#A58E6F] font-bold mt-2 uppercase tracking-[0.4em]">Integrated Settlement Center</p>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-10">
        <section className="col-span-4 bg-white rounded-[56px] p-12 border luxury-shadow space-y-10">
          <div className="text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full mx-auto flex items-center justify-center text-3xl mb-6 shadow-inner">👤</div>
            <h3 className="text-2xl font-bold text-[#1A3C34]">{member.name}님</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Hannam Membership</p>
          </div>
          <div className="space-y-4 pt-8 border-t">
            {memberships.map(ms => (
              <label key={ms.id} className={`flex items-center justify-between p-6 rounded-3xl border-2 cursor-pointer transition-all ${selectedMembershipId === ms.id ? 'bg-[#1A3C34] text-white border-[#1A3C34] shadow-xl scale-105' : 'bg-[#F9F9F7] text-slate-400 border-transparent'}`}>
                <input type="radio" checked={selectedMembershipId === ms.id} onChange={() => setSelectedMembershipId(ms.id)} className="hidden" />
                <span className="text-[13px] font-bold">{ms.productName}</span>
                <span className="text-[13px] font-bold tabular-nums">₩{Math.floor(ms.remainingAmount).toLocaleString()}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="col-span-8 bg-white rounded-[60px] p-16 shadow-2xl border space-y-12 luxury-card">
          <div className="grid grid-cols-2 gap-10">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">Selected Program</label>
              <select className="w-full px-8 py-5 bg-[#F9F9F7] rounded-[28px] border outline-none font-bold" value={selectedProgramId} onChange={e => setSelectedProgramId(e.target.value)}>
                <option value="">프로그램 선택</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#A58E6F] uppercase tracking-widest ml-4">Final Settlement</label>
              <div className="bg-[#1A3C34] p-8 rounded-[36px] text-white flex justify-between items-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12"></div>
                <p className="text-3xl font-bold tabular-nums">₩{finalAmount.toLocaleString()}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] opacity-40 font-bold uppercase">DC</span>
                  <input type="number" className="w-16 bg-white/10 rounded-xl px-2 py-1 text-center font-bold outline-none" value={discountRate} onChange={e => setDiscountRate(+e.target.value)} />
                  <span className="text-xs opacity-40">%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-10 pt-10 border-t">
            <div className="grid grid-cols-2 gap-10">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">Care Summary (Visible)</label>
                <textarea className="w-full px-8 py-6 bg-[#F9F9F7] rounded-[32px] h-44 outline-none border focus:border-[#1A3C34] transition-all text-sm leading-relaxed" placeholder="오늘 진행된 케어의 핵심을 입력해 주세요." value={notes.summary} onChange={e => setNotes({ ...notes, summary: e.target.value })} />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">Recommendation (Visible)</label>
                <textarea className="w-full px-8 py-6 bg-[#F9F9F7] rounded-[32px] h-44 outline-none border focus:border-[#1A3C34] transition-all text-sm leading-relaxed" placeholder="다음 방문 시 추천하는 케어를 입력해 주세요." value={notes.recommendation} onChange={e => setNotes({ ...notes, recommendation: e.target.value })} />
              </div>
            </div>
          </div>

          <button onClick={handlePreProcess} className="w-full py-6 bg-[#1A3C34] text-white rounded-[32px] font-bold uppercase tracking-[0.4em] shadow-2xl active:scale-95 transition-all">관리 완료 및 승인 요청</button>
        </section>
      </div>

      {showSignModal && (
        <div className="fixed inset-0 bg-[#1A3C34]/98 backdrop-blur-3xl z-[600] flex items-center justify-center p-10 animate-in zoom-in-95">
          <div className="w-full max-w-sm text-center">
            <div className="mb-10 text-white">
              <h3 className="text-3xl font-serif-luxury font-bold mb-4 italic tracking-widest">Electronic Approval</h3>
              <p className="text-xs opacity-60 font-bold uppercase tracking-widest">"위 관리 내역에 동의하고 확인합니다."</p>
            </div>
            <SignaturePad onSave={handleSignSave} onCancel={() => setShowSignModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default CareSessionPage;
