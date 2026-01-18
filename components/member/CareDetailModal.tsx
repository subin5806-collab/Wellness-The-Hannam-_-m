import React, { ReactNode } from 'react';
import { CareRecord } from '../../types';

interface CareDetailModalProps {
    record: CareRecord;
    onClose: () => void;
    adminNode?: ReactNode; // Optional right pane for Admins
}

const CareDetailModal: React.FC<CareDetailModalProps> = ({ record, onClose, adminNode }) => {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[2000] flex items-center justify-center p-8 animate-in fade-in duration-200">
            <div className={`bg-white rounded-[40px] shadow-2xl w-full overflow-hidden flex flex-col max-h-[90vh] transition-all ${adminNode ? 'max-w-6xl' : 'max-w-lg'}`}>
                <header className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <p className="text-[10px] font-bold text-[#A58E6F] uppercase tracking-widest">{record.date}</p>
                        <h3 className="text-xl font-bold text-[#1A3C34] mt-1">{record.noteSummary}</h3>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-[#1A3C34] transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>

                <div className={`flex-1 overflow-y-auto ${adminNode ? 'grid grid-cols-2 divide-x divide-slate-100' : ''}`}>
                    {/* LEFT: Member View */}
                    <div className="p-8 space-y-8">
                        <div className="space-y-3">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Detail Note</label>
                            <div className="p-6 bg-[#F9F9FB] rounded-2xl text-[14px] text-[#2F3A32] leading-relaxed font-medium whitespace-pre-wrap">
                                {record.noteDetails || '상세 기록이 없습니다.'}
                            </div>
                        </div>

                        {record.noteRecommendation && (
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Recommendation</label>
                                <p className="text-sm text-slate-600">{record.noteRecommendation}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">결제 금액</label>
                                <p className="text-lg font-bold text-[#2F3A32]">₩{record.finalPrice.toLocaleString()}</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">사용 후 잔액</label>
                                <p className="text-lg font-bold text-emerald-600">₩{(record.balanceAfter || 0).toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-50 space-y-4">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">Member Signature</label>
                            {record.signatureData ? (
                                <div className="border border-slate-100 rounded-2xl p-4 bg-white flex justify-center">
                                    <img src={record.signatureData} className="h-16 object-contain" />
                                </div>
                            ) : (
                                <div className="p-4 bg-slate-50 rounded-2xl text-center text-[11px] text-slate-300 font-bold">서명 없음</div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: Admin Secret View */}
                    {adminNode && (
                        <div className="p-8 bg-[#FFF9F2] h-full overflow-y-auto">
                            {adminNode}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CareDetailModal;
