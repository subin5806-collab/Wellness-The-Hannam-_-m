
import React, { useState, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Program, ContractTemplate, Member } from '../../types';

interface ContractFlowProps {
  member: Partial<Member>;
  template: ContractTemplate;
  program: Program;
  onComplete: (compositeImage: string, signatureOnly: string, agreements: any) => Promise<void>;
  onCancel: () => void;
}

const ContractFlow: React.FC<ContractFlowProps> = ({ member, template, program, onComplete, onCancel }) => {
  const [step, setStep] = useState<'VIEW' | 'CHECK' | 'SIGN'>('VIEW');
  const [checks, setChecks] = useState({ terms: false, privacy: false, refund: false, legal: false });
  const [isProcessing, setIsProcessing] = useState(false);
  const sigCanvas = useRef<any>(null);
  
  const isAllChecked = checks.terms && checks.privacy && checks.refund && checks.legal;
  const imageUrl = template.pdfData || '';

  // 이미지 합성 메인 로직
  const compositeContract = async (signatureDataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('Canvas context fail');

      const bgImg = new Image();
      bgImg.crossOrigin = "anonymous";
      bgImg.src = imageUrl;

      bgImg.onload = () => {
        // 1. 캔버스 사이즈를 배경 이미지에 맞춤
        canvas.width = bgImg.naturalWidth;
        canvas.height = bgImg.naturalHeight;

        // 2. 배경 이미지 그리기
        ctx.drawImage(bgImg, 0, 0);

        // 3. 텍스트 정보 오버레이 (위치 및 폰트 설정)
        ctx.font = `bold ${Math.floor(canvas.width * 0.02)}px "Noto Sans KR"`;
        ctx.fillStyle = "#2F3A32";
        
        const xOffset = canvas.width * 0.15;
        const yBase = canvas.height * 0.15;
        const lineSpacing = canvas.height * 0.035;

        ctx.fillText(`회원명: ${member.name || '미입력'}`, xOffset, yBase);
        ctx.fillText(`연락처: ${member.phone || '미입력'}`, xOffset, yBase + lineSpacing);
        ctx.fillText(`프로그램: ${program.name}`, xOffset, yBase + lineSpacing * 2);
        ctx.fillText(`계약일자: ${new Date().toLocaleDateString()}`, xOffset, yBase + lineSpacing * 3);

        // 4. 서명 이미지 오버레이
        const sigImg = new Image();
        sigImg.src = signatureDataUrl;
        sigImg.onload = () => {
          // 서명란 위치 (하단 영역 60% 지점쯤으로 가정, 필요시 조정)
          const sigWidth = canvas.width * 0.3;
          const sigHeight = (sigWidth * 9) / 16;
          const sigX = canvas.width * 0.6;
          const sigY = canvas.height * 0.75;
          
          ctx.drawImage(sigImg, sigX, sigY, sigWidth, sigHeight);
          
          // 최종 DataURL 반환
          resolve(canvas.toDataURL('image/png', 0.9));
        };
      };
      bgImg.onerror = () => reject('Background image load fail');
    });
  };

  const handleFinalSign = async () => {
    if (sigCanvas.current?.isEmpty()) return alert("서명을 진행해 주세요.");
    
    setIsProcessing(true);
    try {
      const signatureOnly = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
      const compositeImage = await compositeContract(signatureOnly);
      await onComplete(compositeImage, signatureOnly, checks);
    } catch (e: any) {
      alert(`합성 처리 중 오류: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[600] flex items-center justify-center p-4 animate-in fade-in duration-500">
      <div className="bg-white rounded-[60px] w-full max-w-6xl h-[94vh] shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-12 py-8 bg-[#2F3A32] text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-bold font-serif italic tracking-tight">{template.name}</h2>
            <p className="text-[10px] font-bold opacity-40 uppercase tracking-[0.3em] mt-1">Digital Contract Wizard</p>
          </div>
          <div className="flex gap-4">
            {['VIEW', 'CHECK', 'SIGN'].map(s => (
              <div key={s} className={`w-3 h-3 rounded-full transition-all duration-500 ${step === s ? 'bg-[#A58E6F] scale-150' : 'bg-white/20'}`}></div>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden bg-[#F2F4F6] relative flex flex-col">
          {step === 'VIEW' && (
            <div className="flex-1 flex flex-col p-8 overflow-hidden">
              <div className="flex-1 overflow-auto rounded-[32px] bg-white border-4 border-slate-200 shadow-inner no-scrollbar flex justify-center relative">
                  <div className="bg-white p-4 w-full flex justify-center">
                    <img src={imageUrl} className="max-w-full h-auto shadow-2xl block" alt="양식 원본" />
                  </div>
              </div>
              <div className="pt-8 flex justify-between items-center px-4 shrink-0">
                <button onClick={onCancel} className="px-10 py-4 text-slate-400 font-bold uppercase text-[11px] tracking-widest">중단</button>
                <button onClick={() => setStep('CHECK')} className="px-16 py-4 bg-[#2F3A32] text-white rounded-2xl font-bold text-[11px] uppercase tracking-widest shadow-xl">내용 숙지 완료 및 동의</button>
              </div>
            </div>
          )}

          {step === 'CHECK' && (
            <div className="max-w-2xl mx-auto space-y-8 py-16 animate-in slide-in-from-right-8 duration-500 overflow-y-auto no-scrollbar w-full">
              <div className="text-center space-y-4 mb-4">
                <h3 className="text-3xl font-bold text-[#2F3A32] font-serif italic">법적 고지 및 필수 동의</h3>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">전자 서명법 제3조에 의거, 아래 모든 항목에 동의가 필요합니다.</p>
              </div>
              <div className="space-y-4 px-4">
                {[
                  { id: 'terms', label: '1. 웰니스 더 한남 서비스 이용 약관에 동의합니다.' },
                  { id: 'privacy', label: '2. 멤버십 관리를 위한 개인정보 수집 및 이용에 동의합니다.' },
                  { id: 'refund', label: '3. 환불 규정 및 노쇼 차감 정책을 명확히 인지했습니다.' },
                  { id: 'legal', label: '4. 본인은 위 내용을 모두 숙지하였으며, 본인이 직접 작성한 전자 서명이 법적으로 유효한 증거로 사용됨에 동의합니다.' }
                ].map((item) => (
                  <label key={item.id} className="flex items-start gap-5 p-7 bg-white border border-slate-100 rounded-[28px] cursor-pointer hover:border-[#2F3A32] transition-all group shadow-sm">
                    <input type="checkbox" className="w-6 h-6 mt-1 accent-[#2F3A32] rounded-lg cursor-pointer shrink-0" checked={(checks as any)[item.id]} onChange={e => setChecks({...checks, [item.id]: e.target.checked})} />
                    <span className="font-bold text-[#2F3A32] text-[15px] leading-snug">{item.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-between items-center pt-8 px-4">
                <button onClick={() => setStep('VIEW')} className="px-10 py-4 text-slate-400 font-bold uppercase text-[11px] tracking-widest">이전</button>
                <button disabled={!isAllChecked} onClick={() => setStep('SIGN')} className="px-20 py-5 bg-[#2F3A32] text-white rounded-[24px] font-bold text-[12px] uppercase tracking-widest shadow-xl disabled:opacity-20 transition-all">최종 서명 단계로</button>
              </div>
            </div>
          )}

          {step === 'SIGN' && (
            <div className="flex-1 flex flex-col items-center justify-center p-10 animate-in zoom-in-95 duration-500 bg-white relative">
               {/* 배경 미리보기 위에 서명 패드를 겹친 UI (Overlay 느낌 구현) */}
               <div className="relative w-full max-w-2xl aspect-[3/4] bg-slate-50 border-4 border-slate-200 rounded-[40px] overflow-hidden shadow-2xl flex flex-col">
                  <div className="flex-1 relative overflow-hidden bg-white">
                    <img src={imageUrl} className="absolute inset-0 w-full h-full object-contain opacity-20 pointer-events-none" alt="배경 힌트" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                       <p className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.3em] mb-4">Sign inside the box</p>
                       <div className="bg-white/50 border-2 border-dashed border-slate-200 rounded-3xl overflow-hidden w-[90%] aspect-[16/9]">
                          <SignatureCanvas 
                            ref={sigCanvas}
                            canvasProps={{ width: 800, height: 450, className: 'w-full h-full cursor-crosshair' }}
                            penColor="#2F3A32"
                          />
                       </div>
                    </div>
                  </div>
                  <div className="p-8 bg-slate-50 border-t flex gap-4">
                    <button onClick={() => sigCanvas.current?.clear()} className="flex-1 py-4 bg-white border text-slate-400 font-bold rounded-2xl text-[11px] uppercase tracking-widest">지우기</button>
                    <button onClick={handleFinalSign} disabled={isProcessing} className="flex-2 px-12 py-4 bg-[#2F3A32] text-white font-bold rounded-2xl text-[11px] uppercase tracking-widest shadow-xl">
                      {isProcessing ? '합성 중...' : '계약 완료 및 저장'}
                    </button>
                  </div>
               </div>
               <button onClick={() => setStep('CHECK')} className="mt-8 text-[10px] text-slate-300 font-bold uppercase tracking-widest">이전 단계</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractFlow;
