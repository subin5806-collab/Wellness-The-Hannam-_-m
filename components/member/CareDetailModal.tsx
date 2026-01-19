import React, { ReactNode } from 'react';
import { CareRecord } from '../../types';

interface CareDetailModalProps {
    record: CareRecord;
    onClose: () => void;
    currentBalance?: number; // [Single Source of Truth]
    adminNode?: ReactNode;
}

const CareDetailModal: React.FC<CareDetailModalProps> = ({ record, onClose, adminNode, currentBalance }) => {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className={`bg-[#FFFCF8] rounded-[24px] shadow-2xl w-full overflow-hidden flex flex-col max-h-[90vh] transition-all relative ${adminNode ? 'max-w-6xl' : 'max-w-[480px]'}`} onClick={e => e.stopPropagation()}>

                {/* Close Button - Absolute Positioned */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 z-[50] w-10 h-10 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-slate-500 transition-colors pointer-events-auto cursor-pointer"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div className={`flex-1 overflow-y-auto ${adminNode ? 'grid grid-cols-2 divide-x divide-stone-100' : ''}`}>
                    {/* LEFT: Member View - Letter Style */}
                    <div className="flex flex-col h-full">
                        {/* 1. Header (Minimal - Date Only) */}
                        <div className="pt-10 px-8 pb-0 text-center relative z-20">
                            <p className="text-[11px] text-[#A58E6F] font-bold uppercase tracking-[0.1em]">{record.date}</p>
                        </div>

                        {/* 2. Content (Two Main Sections: Summary & Recs) */}
                        <div className="flex-1 px-10 py-8 overflow-y-auto flex flex-col space-y-12">

                            {/* Section 1: Summary */}
                            <div className="space-y-6 text-center">
                                <label className="text-[11px] text-[#A58E6F] font-bold uppercase tracking-[0.2em] block border-b border-[#F2EFE9] pb-3 mx-10">오늘의 케어 요약</label>
                                <h2 className="text-2xl md:text-3xl font-serif-luxury font-medium text-[#1A3C34] leading-relaxed break-keep whitespace-pre-wrap">
                                    {record.noteSummary || "요약 내용이 없습니다."}
                                </h2>
                            </div>

                            {/* Section 2: Recommendation */}
                            <div className="space-y-6 text-center">
                                <label className="text-[11px] text-[#A58E6F] font-bold uppercase tracking-[0.2em] block border-b border-[#F2EFE9] pb-3 mx-10">향후 추천 사항</label>
                                <p className="text-[18px] text-[#5C544B] font-serif leading-loose whitespace-pre-wrap">
                                    {record.noteRecommendation || "추천 사항이 없습니다."}
                                </p>
                            </div>
                        </div>

                        {/* 3. Footer (Financials & Signature) */}
                        <div className="bg-white/50 border-t border-[#F2EFE9] p-6 space-y-6">
                            {/* Signature Area */}
                            <div className="flex flex-col items-center justify-center space-y-2">
                                {record.signatureData ? (
                                    <div className="relative">
                                        <img src={record.signatureData} alt="Signature" className="h-10 opacity-80" />
                                        <div className="absolute -bottom-2 w-full h-[1px] bg-[#E5E0D8]"></div>
                                    </div>
                                ) : (
                                    <div className="text-[10px] text-stone-300 tracking-widest uppercase border-b border-stone-200 pb-1">Waiting for Signature</div>
                                )}
                            </div>

                            {/* Financial Info (Subtle) */}
                            <div className="flex justify-between items-end text-[10px] text-[#B0A69B] px-4">
                                <div className="flex flex-col">
                                    <span className="uppercase tracking-wider opacity-70">Used</span>
                                    <span className="font-medium">-₩{record.finalPrice.toLocaleString()}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="uppercase tracking-wider opacity-70">Remaining Balance</span>
                                    <span className="text-sm font-serif text-[#5C544B]">{currentBalance !== undefined ? `₩${currentBalance.toLocaleString()}` : (record.balanceAfter ? `₩${record.balanceAfter.toLocaleString()}` : '-')}</span>
                                </div>
                            </div>
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
