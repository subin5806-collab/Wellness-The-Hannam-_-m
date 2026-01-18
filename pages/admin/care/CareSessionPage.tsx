
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../../../db';
import { Member, Membership, Program, MembershipProduct } from '../../../types';
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
  const [msProducts, setMsProducts] = useState<MembershipProduct[]>([]);
  /* --------------------------------------------------------------------------------
   * State Management
   * -------------------------------------------------------------------------------- */
  // Records & Notes
  const [notes, setNotes] = useState({ summary: '', details: '', recommendation: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);

  const [customOriginalPrice, setCustomOriginalPrice] = useState<number | ''>('');

  useEffect(() => {
    if (memberId) loadInitialData();
  }, [memberId]);

  const loadInitialData = async () => {
    try {
      const [m, msList, allProgs, allProducts] = await Promise.all([
        db.members.getById(memberId!),
        db.memberships.getAllByMemberId(memberId!),
        db.master.programs.getAll(),
        db.master.membershipProducts.getAll()
      ]);
      if (m) setMember(m);
      setMemberships(msList || []);
      setMsProducts(allProducts || []);

      const pList = (allProgs || []).filter(p => p.isActive && !p.isDeleted);
      setPrograms(pList);

      if (msList.length > 0) {
        setSelectedMembershipId(msList[0].id);
        const p = allProducts?.find(x => x.id === msList[0].productId || x.name === msList[0].productName);
        setDiscountRate(Math.floor(p?.defaultDiscountRate ?? msList[0].defaultDiscountRate ?? 0));
      }

      if (progId) {
        const p = pList.find(x => x.id === progId);
        if (p) setCustomOriginalPrice(p.basePrice);
      }
    } catch (e) { console.error(e); }
  };

  const selectedProgram = programs.find(p => p.id === selectedProgramId);
  const selectedMembership = memberships.find(ms => ms.id === selectedMembershipId);

  const originalPrice = customOriginalPrice !== '' ? customOriginalPrice : (selectedProgram?.basePrice || 0);
  const discountAmount = Math.floor(originalPrice * (Math.floor(discountRate) / 100));
  const finalAmount = originalPrice - discountAmount;

  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);

  const handleCompleteSession = async () => {
    if (!member || !selectedProgram || !selectedMembership) return alert('필수 정보 누락');
    if (Math.floor(selectedMembership.remainingAmount) < finalAmount) return alert('잔액 부족');
    if (!notes.summary.trim()) return alert('웰니스 케어 요약을 입력해 주세요.');

    setIsProcessing(true);
    try {
      // 1단계: 즉시 차감 및 알림 전송 (서명은 회원이 함)
      await db.careRecords.completeCareSession({
        memberId: member!.id,
        membershipId: selectedMembershipId,
        programId: selectedProgramId,
        reservationId: resId,
        originalPrice: Math.floor(originalPrice),
        discountRate: discountRate,
        finalPrice: finalAmount,
        noteSummary: notes.summary,
        noteDetails: notes.details,
        noteRecommendation: notes.recommendation,
        noteFutureRef: ''
      });// 예약 상태 변경
      try {
        if (resId) await db.reservations.updateStatus(resId, 'COMPLETED');
      } catch (err) {
        console.warn('Reservation status update failed:', err);
      }

      // 2단계: 완료 알림 및 페이지 이동
      alert(`[정산 완료] ${finalAmount.toLocaleString()}원이 차감되었습니다.\n회원 앱으로 서명 요청 알림을 발송했습니다.`);
      navigate(`/admin/members/${member!.id}`);

    } catch (e: any) {
      console.error('Care Session Completion Error:', e);
      alert(`정산 처리 중 오류가 발생했습니다: ${e.message || JSON.stringify(e)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!member) return <div className="p-20 text-center font-serif-luxury italic text-slate-300 text-2xl">Wellness Data Syncing...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-12 page-transition pb-24">
      <header className="flex justify-between items-end border-b border-slate-100 pb-10">
        <div>
          <h2 className="text-3xl font-bold text-[#2F3A32]">웰니스 케어 완료 및 즉시 정산</h2>
          <p className="text-[11px] text-[#A58E6F] font-bold mt-2 uppercase tracking-[0.4em]">Integrated Settlement Center</p>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-10">
        {/* 좌측: 회원 및 멤버십 정보 */}
        <section className="col-span-4 bg-white rounded-[40px] p-8 border border-slate-100 luxury-shadow space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full mx-auto flex items-center justify-center text-2xl mb-4 shadow-inner border border-white">👤</div>
            <h3 className="text-lg font-bold text-[#1A3C34]">{member.name}님</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Hannam Premium Membership</p>
          </div>
          <div className="space-y-4 pt-8 border-t border-slate-50">
            {memberships.map(ms => (
              <label key={ms.id} className={`flex items-center justify-between p-5 rounded-2xl border cursor-pointer transition-all duration-300 ${selectedMembershipId === ms.id ? 'bg-[#1A3C34] text-white border-[#1A3C34] shadow-lg scale-[1.02]' : 'bg-[#F9F9F7] text-slate-400 border-transparent hover:border-slate-200'}`}>
                <input type="radio" checked={selectedMembershipId === ms.id} onChange={() => {
                  setSelectedMembershipId(ms.id);
                  const p = msProducts.find(x => x.id === ms.productId || x.name === ms.productName);
                  setDiscountRate(Math.floor(p?.defaultDiscountRate ?? ms.defaultDiscountRate ?? 0));
                }} className="hidden" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold">{ms.productName}</span>
                  <span className="text-[8px] opacity-60 font-medium uppercase tracking-tighter mt-0.5">Available Balance</span>
                  {selectedMembershipId === ms.id && (
                    <div className="mt-2 inline-flex px-2 py-0.5 bg-white/20 rounded-full items-center gap-1.5 animate-in fade-in duration-500">
                      <span className="w-1 h-1 rounded-full bg-emerald-400"></span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-[#A58E6F]">
                        DC: {(() => {
                          const p = msProducts.find(x => x.id === ms.productId || x.name === ms.productName);
                          return Math.floor(p?.defaultDiscountRate ?? ms.defaultDiscountRate ?? 0);
                        })()}%
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-[13px] font-black tabular-nums">₩{Math.floor(ms.remainingAmount).toLocaleString()}</span>
              </label>
            ))}
          </div>
        </section>

        {/* 우측: 케어 기록 및 정산 */}
        <section className="col-span-8 bg-white rounded-[48px] p-10 shadow-xl border border-slate-100 space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-2">Selected Program</label>
              <select
                className="w-full px-6 py-4 bg-[#F9F9F7] rounded-[24px] border border-transparent outline-none font-bold text-[#1A3C34] text-sm focus:bg-white focus:border-[#1A3C34] transition-all"
                value={selectedProgramId}
                onChange={e => {
                  setSelectedProgramId(e.target.value);
                  const p = programs.find(x => x.id === e.target.value);
                  if (p) setCustomOriginalPrice(p.basePrice);
                }}
              >
                <option value="">프로그램을 선택해 주세요</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold text-[#A58E6F] uppercase tracking-widest ml-2">Calculation</label>
              <div className="bg-[#1A3C34] p-5 rounded-[20px] text-white space-y-3 shadow-md relative overflow-hidden group border border-white/10">
                <div className="flex justify-between items-center text-[10px] font-medium opacity-70">
                  <span>원금 (입력 가능)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      className="bg-transparent text-right font-bold outline-none w-16 border-b border-white/20 focus:border-white transition-colors text-sm"
                      value={originalPrice}
                      onChange={e => setCustomOriginalPrice(e.target.value === '' ? '' : +e.target.value)}
                    />
                    <span className="text-[10px]">원</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[7px] opacity-40 font-bold uppercase tracking-widest">Discount Rate</span>
                    <div className="flex items-center gap-0.5">
                      <input
                        type="number"
                        className="bg-transparent text-left text-base font-bold outline-none w-8 border-b border-white/20 focus:border-white transition-colors"
                        value={discountRate}
                        onChange={e => setDiscountRate(+e.target.value)}
                      />
                      <span className="text-sm font-bold opacity-40">%</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[7px] opacity-40 font-bold uppercase tracking-widest">Deduction Amount</span>
                    <p className="text-xl font-black tabular-nums tracking-tight text-emerald-400">₩{finalAmount.toLocaleString()}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 flex justify-between items-center text-[8px] font-bold uppercase tracking-widest opacity-50">
                  <span>Discount Applied</span>
                  <span>-₩{discountAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-50">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5 col-span-2">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-2">Detailed Note (Private)</label>
                <textarea className="w-full px-4 py-3 bg-[#F9F9F7] rounded-[20px] h-32 outline-none border border-transparent focus:border-[#1A3C34] focus:bg-white transition-all text-xs leading-relaxed font-medium resize-none" placeholder="케어 상세 내용 및 특이사항..." value={notes.details} onChange={e => setNotes({ ...notes, details: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-2">Summary (Visible)</label>
                <textarea className="w-full px-4 py-3 bg-[#F9F9F7] rounded-[20px] h-20 outline-none border border-transparent focus:border-[#1A3C34] focus:bg-white transition-all text-xs leading-relaxed font-medium resize-none" placeholder="고객에게 보여질 요약..." value={notes.summary} onChange={e => setNotes({ ...notes, summary: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-2">Future Recs</label>
                <textarea className="w-full px-4 py-3 bg-[#F9F9F7] rounded-[20px] h-20 outline-none border border-transparent focus:border-[#1A3C34] focus:bg-white transition-all text-xs leading-relaxed font-medium resize-none" placeholder="추천 프로그램..." value={notes.recommendation} onChange={e => setNotes({ ...notes, recommendation: e.target.value })} />
              </div>
            </div>
          </div>

          <button onClick={handleCompleteSession} disabled={isProcessing} className="w-full py-4 bg-[#1A3C34] text-white rounded-[24px] font-bold uppercase text-[11px] tracking-[0.2em] shadow-lg active:scale-[0.98] transition-all hover:bg-[#1A4C40] flex items-center justify-center gap-2">
            {isProcessing ? '처리 중...' : '이용 완료 및 즉시 차감 (서명 요청 발송)'}
          </button>
        </section>
      </div>
    </div>
  );
};

export default CareSessionPage;
