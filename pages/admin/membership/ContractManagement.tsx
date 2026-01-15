
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../../db';
import { Member, Contract, Membership, ContractTemplate, MembershipProduct } from '../../../types';
import SignaturePad from '../../../components/common/SignaturePad';
import ContractFlow from '../../../components/admin/ContractFlow';

type ContractStep = 'LIST' | 'SEARCH_OR_NEW' | 'INPUT_MEMBER_DETAIL' | 'INPUT_PAYMENT' | 'SELECT_TEMPLATE' | 'WIZARD' | 'CONFIRM';

const ContractManagement: React.FC = () => {
  const [step, setStep] = useState<ContractStep>('LIST');
  const [contracts, setContracts] = useState<any[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [membershipProducts, setMembershipProducts] = useState<MembershipProduct[]>([]);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [foundMembers, setFoundMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Partial<Member>>({ gender: '여성', email: '' });
  const [selectedProduct, setSelectedProduct] = useState<MembershipProduct | null>(null);
  const [customAmount, setCustomAmount] = useState<number>(0);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [lastContract, setLastContract] = useState<any>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [allContracts, memberList, products, templateList] = await Promise.all([
        db.contracts.getAll(),
        db.members.getAll(),
        db.master.membershipProducts.getAll(),
        db.master.contractTemplates.getAll()
      ]);

      const mapped = (allContracts || []).map(c => {
        const m = memberList.find(mem => mem.id === c.memberId);
        return {
          ...c,
          memberName: m?.name || '알수없음',
          memberPhone: m?.phone || '',
          productName: c.contractName || '멤버십 계약'
        };
      });

      setContracts(mapped);
      setMembers(memberList || []);
      setMembershipProducts(products || []);
      setTemplates(templateList || []);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const handleMemberSearch = () => {
    const query = searchQuery.trim();
    if (query.length < 2) return alert('2자 이상 입력해 주세요.');
    const results = members.filter(m =>
      (m.name || '').includes(query) || (m.phone && m.phone.slice(-4) === query)
    );
    setFoundMembers(results);
  };

  const handleFinalizeContract = async (compositeImage: string, signatureOnly: string, agreements: any) => {
    if (!selectedMember.name || !selectedTemplate) return;

    setIsLoading(true);
    try {
      let memberId = selectedMember.id;

      if (!memberId) {
        // 필수 정보 최종 벨리데이션 확인
        if (!selectedMember.name?.trim() || !selectedMember.phone?.trim() || !selectedMember.email?.trim() || !selectedMember.gender) {
          throw new Error('필수 정보(성함, 성별, 연락처, 이메일)가 누락되었습니다.');
        }
        const newM = await db.members.add(selectedMember);
        memberId = newM.id;
      }

      const dbDate = new Date().toISOString().split('T')[0];
      const productName = selectedProduct?.name || '커스텀 멤버십 결제';

      const contractData = {
        memberId: memberId,
        contractName: productName,
        contractAmount: customAmount,
        paymentMethod: 'CREDIT_CARD',
        pdfData: selectedTemplate.pdfData,
        signatureData: signatureOnly,
        contractImageFull: compositeImage,
        isChecklistConfirmed: true,
        agreeTerms: agreements.terms,
        agreeRefund: agreements.refund,
        agreePrivacy: agreements.privacy,
        agreeLegal: agreements.legal,
        date: dbDate
      };

      const saved = await db.contracts.add(contractData);
      await db.memberships.topUp(memberId!, customAmount, productName);

      setLastContract(saved);
      setStep('CONFIRM');
      await fetchInitialData();
    } catch (e: any) {
      alert(`계약 최종 저장 실패: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-12 page-transition pb-24">
      <header className="flex justify-between items-end border-b border-slate-100 pb-10">
        <div>
          <h1 className="text-3xl font-bold text-[#2F3A32]">계약 체결 및 관리</h1>
          <p className="text-[11px] text-[#A58E6F] font-bold uppercase tracking-[0.4em] mt-2">Digital Contract Management</p>
        </div>
        {step === 'LIST' && (
          <button onClick={() => setStep('SEARCH_OR_NEW')} className="px-10 py-4 bg-[#2F3A32] text-white rounded-2xl font-bold text-[12px] uppercase tracking-widest shadow-xl transition-all">
            + 신규 계약 진행
          </button>
        )}
      </header>

      {step === 'LIST' && (
        <div className="bg-white rounded-[48px] border border-slate-100 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-[#F9FAFB] text-[10px] font-bold text-slate-400 uppercase border-b">
              <tr>
                <th className="px-12 py-7">체결일</th>
                <th className="px-12 py-7">회원명</th>
                <th className="px-12 py-7">계약 내용</th>
                <th className="px-12 py-7">결제 금액</th>
                <th className="px-12 py-7 text-right">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {contracts.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-12 py-8 text-slate-400 tabular-nums">{c.date}</td>
                  <td className="px-12 py-8 font-bold text-[#2F3A32]">{c.memberName}</td>
                  <td className="px-12 py-8 text-slate-600">{c.productName}</td>
                  <td className="px-12 py-8 font-bold text-[#2F3A32] tabular-nums">₩{c.contractAmount.toLocaleString()}</td>
                  <td className="px-12 py-8 text-right">
                    <button onClick={() => window.open(c.contractImageFull || c.pdfData, '_blank')} className="px-6 py-2 bg-slate-50 text-[10px] font-bold text-[#A58E6F] uppercase tracking-widest rounded-xl">조회</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {step === 'SEARCH_OR_NEW' && (
        <div className="max-w-2xl mx-auto py-10">
          <div className="bg-white rounded-[48px] p-12 shadow-2xl border border-slate-100 space-y-12">
            <h3 className="text-2xl font-bold text-[#2F3A32] mb-10 font-serif italic text-center uppercase">대상 회원 선택</h3>
            <div className="space-y-6">
              <div className="flex gap-4">
                <input className="flex-1 px-8 py-5 bg-[#F9FAFB] border rounded-[24px] outline-none font-bold" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="성함 또는 휴대폰 끝 4자리" />
                <button onClick={handleMemberSearch} className="px-10 py-5 bg-[#2F3A32] text-white rounded-2xl font-bold uppercase text-[11px] tracking-widest">검색</button>
              </div>
              <div className="space-y-3 max-h-48 overflow-y-auto no-scrollbar">
                {foundMembers.map(m => (
                  <div key={m.id} onClick={() => { setSelectedMember(m); setStep('INPUT_PAYMENT'); }} className="p-5 bg-slate-50 border rounded-2xl flex justify-between items-center cursor-pointer hover:border-[#2F3A32] transition-all">
                    <span className="font-bold text-[#2F3A32]">{m.name}</span>
                    <span className="text-slate-400 text-xs tabular-nums">{m.phone}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-8 border-t text-center">
              <button onClick={() => { setSelectedMember({ gender: '여성', email: '' }); setStep('INPUT_MEMBER_DETAIL'); }} className="w-full py-6 border-2 border-dashed border-slate-200 text-slate-400 rounded-3xl font-bold text-[11px] uppercase tracking-widest hover:border-[#2F3A32] hover:text-[#2F3A32] transition-all">
                + 신규 회원 정보로 진행
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'INPUT_MEMBER_DETAIL' && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-[48px] p-12 shadow-2xl border border-slate-100 space-y-8">
            <h3 className="text-2xl font-bold text-[#2F3A32] mb-10 font-serif italic text-center uppercase">회원 기본 정보</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 ml-4 uppercase tracking-widest">성함 <span className="text-rose-500">*</span></label>
                <input className="w-full px-8 py-4 bg-[#F9FAFB] border rounded-2xl outline-none font-bold" placeholder="성함" value={selectedMember.name} onChange={e => setSelectedMember({ ...selectedMember, name: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 ml-4 uppercase tracking-widest">성별 <span className="text-rose-500">*</span></label>
                <select className="w-full px-8 py-4 bg-[#F9FAFB] border rounded-2xl outline-none font-bold" value={selectedMember.gender} onChange={e => setSelectedMember({ ...selectedMember, gender: e.target.value as any })}>
                  <option value="여성">여성</option>
                  <option value="남성">남성</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 ml-4 uppercase tracking-widest">연락처 (- 제외) <span className="text-rose-500">*</span></label>
              <input className="w-full px-8 py-4 bg-[#F9FAFB] border rounded-2xl outline-none font-bold" placeholder="연락처" value={selectedMember.phone} onChange={e => setSelectedMember({ ...selectedMember, phone: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 ml-4 uppercase tracking-widest">생년월일</label>
                <input type="date" className="w-full px-8 py-4 bg-[#F9FAFB] border rounded-2xl outline-none font-bold text-sm" value={selectedMember.birthDate} onChange={e => setSelectedMember({ ...selectedMember, birthDate: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 ml-4 uppercase tracking-widest">이메일 <span className="text-rose-500">*</span></label>
                <input type="email" className="w-full px-8 py-4 bg-[#F9FAFB] border rounded-2xl outline-none font-bold text-sm" placeholder="example@thehannam.com" value={selectedMember.email} onChange={e => setSelectedMember({ ...selectedMember, email: e.target.value })} required />
              </div>
            </div>
            <button onClick={() => {
              if (!selectedMember.name?.trim() || !selectedMember.phone?.trim() || !selectedMember.email?.trim() || !selectedMember.gender) {
                return alert('성함, 연락처, 이메일, 성별은 필수 입력 사항입니다.');
              }
              if (!selectedMember.email.includes('@')) return alert('이메일 형식이 올바르지 않습니다.');
              setStep('INPUT_PAYMENT');
            }} className="w-full py-5 bg-[#2F3A32] text-white rounded-[28px] font-bold uppercase tracking-widest shadow-xl">다음: 결제 설정</button>
          </div>
        </div>
      )}

      {step === 'INPUT_PAYMENT' && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-[48px] p-12 shadow-2xl border border-slate-100 space-y-10">
            <h3 className="text-2xl font-bold text-[#2F3A32] font-serif italic text-center">{selectedMember.name}님 멤버십 설정</h3>
            <div className="space-y-6">
              <select className="w-full px-8 py-5 bg-[#F9FAFB] border rounded-3xl outline-none font-bold" onChange={e => {
                const p = membershipProducts.find(prod => prod.id === e.target.value);
                setSelectedProduct(p || null);
                if (p) setCustomAmount(p.totalAmount);
              }}>
                <option value="">상품 선택</option>
                {membershipProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" className="w-full px-8 py-5 bg-[#F9FAFB] border rounded-3xl outline-none font-bold text-3xl text-rose-500 text-center" value={customAmount} onChange={e => setCustomAmount(+e.target.value)} />
            </div>
            <button onClick={() => setStep('SELECT_TEMPLATE')} className="w-full py-6 bg-[#2F3A32] text-white rounded-3xl font-bold uppercase tracking-widest shadow-xl">서식 선택</button>
          </div>
        </div>
      )}

      {step === 'SELECT_TEMPLATE' && (
        <div className="max-w-4xl mx-auto grid grid-cols-2 gap-8">
          {templates.map(t => (
            <div key={t.id} onClick={() => { setSelectedTemplate(t); setStep('WIZARD'); }} className="bg-white p-12 rounded-[48px] border border-slate-100 shadow-sm hover:border-[#2F3A32] cursor-pointer transition-all flex justify-between items-center group">
              <h4 className="text-xl font-bold text-[#2F3A32]">{t.name}</h4>
              <span className="text-[#2F3A32] font-bold text-2xl group-hover:translate-x-2 transition-transform">→</span>
            </div>
          ))}
        </div>
      )}

      {step === 'WIZARD' && selectedTemplate && (
        <ContractFlow member={selectedMember} template={selectedTemplate} program={{ name: selectedProduct?.name || '커스텀', basePrice: customAmount } as any} onComplete={handleFinalizeContract} onCancel={() => setStep('SELECT_TEMPLATE')} />
      )}

      {step === 'CONFIRM' && (
        <div className="max-w-xl mx-auto py-20 text-center space-y-12">
          <div className="w-24 h-24 bg-[#2F3A32] text-white rounded-full flex items-center justify-center mx-auto text-4xl shadow-2xl">✓</div>
          <h2 className="text-4xl font-bold text-[#2F3A32] font-serif italic">계약 체결 완료</h2>
          <button onClick={() => setStep('LIST')} className="px-24 py-5 bg-[#2F3A32] text-white rounded-[28px] font-bold uppercase tracking-widest shadow-xl">목록으로 이동</button>
        </div>
      )}
    </div>
  );
};

export default ContractManagement;
