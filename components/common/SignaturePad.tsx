
import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';

interface SignaturePadProps {
  onSave: (signatureData: string) => Promise<void>;
  onCancel: () => void;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onCancel }) => {
  const sigCanvas = useRef<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleClear = () => {
    sigCanvas.current?.clear();
  };

  const handleConfirm = async () => {
    if (sigCanvas.current?.isEmpty()) {
      alert("서명을 진행해 주세요.");
      return;
    }
    
    setIsProcessing(true);
    try {
      const dataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
      await onSave(dataUrl);
    } catch (e) {
      alert("서명 저장 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-slate-100 max-w-sm w-full animate-in fade-in zoom-in duration-300">
      <h3 className="text-lg font-bold text-[#2F3A32] mb-1">전자 서명 확약</h3>
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">Confirm Care Details & Sign</p>
      
      <div className="bg-[#F9FAFB] border-2 border-dashed border-slate-200 rounded-3xl overflow-hidden mb-6 h-48 flex items-center justify-center">
        <SignatureCanvas 
          ref={sigCanvas}
          canvasProps={{
            width: 320, 
            height: 192, 
            className: 'w-full h-full cursor-crosshair'
          }}
          penColor="#2F3A32"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={handleClear}
          className="py-4 bg-slate-50 text-slate-400 font-bold rounded-2xl text-[11px] uppercase tracking-widest"
        >
          지우기
        </button>
        <button 
          onClick={handleConfirm}
          disabled={isProcessing}
          className="py-4 bg-[#2F3A32] text-white font-bold rounded-2xl text-[11px] uppercase tracking-widest shadow-xl disabled:opacity-50"
        >
          {isProcessing ? '처리 중' : '확인 완료'}
        </button>
      </div>
      <button 
        onClick={onCancel}
        className="w-full mt-4 text-[10px] text-slate-300 font-bold uppercase tracking-widest hover:text-rose-500 transition-colors"
      >
        닫기
      </button>
    </div>
  );
};

export default SignaturePad;
