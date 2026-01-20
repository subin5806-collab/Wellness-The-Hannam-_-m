import React, { useState, useEffect } from 'react';
import { db } from '../../../db';
import { AdminPrivateNote } from '../../../types';

interface Props {
    careRecordId: string;
    initialSummary?: string;
    initialRecommendation?: string;
    onUpdate?: () => void;
    className?: string;
}

const PrivateNoteEditor: React.FC<Props> = ({
    careRecordId,
    initialSummary = '',
    initialRecommendation = '',
    onUpdate,
    className
}) => {
    // 1. Local State for UI Fields
    const [summary, setSummary] = useState(initialSummary);
    const [recommendation, setRecommendation] = useState(initialRecommendation);
    const [privateContent, setPrivateContent] = useState('');

    // 2. Data State
    const [noteData, setNoteData] = useState<AdminPrivateNote | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // 3. Load Private Note on ID change
    useEffect(() => {
        loadData();
    }, [careRecordId]);

    // 4. Sync props to state when switching records
    useEffect(() => {
        setSummary(initialSummary || '');
        setRecommendation(initialRecommendation || '');
    }, [careRecordId, initialSummary, initialRecommendation]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await db.adminNotes.getByCareRecordId(careRecordId);
            setNoteData(data);
            setPrivateContent(data?.content || '');
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // A. Update Public Fields (CareRecord)
            await db.careRecords.update(careRecordId, {
                noteSummary: summary,
                noteRecommendation: recommendation
            });

            // B. Update Private Note (AdminPrivateNote)
            // Only upsert if there's content, or if we want to allow clearing it?
            // Existing logic matches db.adminNotes.upsert usage
            const savedNote = await db.adminNotes.upsert(careRecordId, privateContent);
            setNoteData(savedNote);

            alert('모든 내용이 저장되었습니다.');

            // C. Refresh Parent (Timeline)
            if (onUpdate) onUpdate();

        } catch (e: any) {
            console.error(e);
            alert(`저장 실패: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-10 text-center text-slate-400">Loading Control Tower...</div>;

    return (
        <div className={`flex flex-col gap-6 h-full ${className}`}>
            {/* [Top Row] Control Cards */}
            <div className="grid grid-cols-2 gap-6 h-[45%]">
                {/* 1. Management Summary Card */}
                <div className="bg-[#1A3C34] rounded-[32px] p-8 flex flex-col shadow-md relative overflow-hidden group">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-[13px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                            <span>📌</span> 관리 요약 (Timeline)
                        </h3>
                    </div>
                    <textarea
                        className="flex-1 w-full bg-white/10 rounded-2xl p-4 border border-white/10 outline-none text-sm leading-relaxed font-medium text-white placeholder-white/30 resize-none focus:bg-white/20 transition-all"
                        placeholder="타임라인에 표시될 핵심 관리 내용을 요약하세요..."
                        value={summary}
                        onChange={e => setSummary(e.target.value)}
                    />
                </div>

                {/* 2. Recommendation Card */}
                <div className="bg-[#F9F9FB] rounded-[32px] p-8 flex flex-col shadow-sm border border-slate-100 relative overflow-hidden group">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-[13px] font-bold text-[#A58E6F] uppercase tracking-widest flex items-center gap-2">
                            <span>💌</span> 다음 케어 추천
                        </h3>
                        <span className="text-[9px] font-bold text-slate-400 bg-white border px-2 py-1 rounded-lg">회원 공개</span>
                    </div>
                    <textarea
                        className="flex-1 w-full bg-white rounded-2xl p-4 border border-slate-200 outline-none text-sm leading-relaxed font-serif text-[#2F3A32] placeholder-slate-300 resize-none focus:border-[#A58E6F] transition-all"
                        placeholder="회원님께 제안할 다음 케어 방향이나 홈케어 팁을 작성하세요..."
                        value={recommendation}
                        onChange={e => setRecommendation(e.target.value)}
                    />
                </div>
            </div>

            {/* [Bottom Row] Private Note */}
            <div className="flex-1 bg-[#FFF9F2] rounded-[32px] p-8 border border-[#F2E8DA] flex flex-col shadow-md relative">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-[#2F3A32] flex items-center gap-2">
                        <span className="text-xl">🔒</span> 관리자 전용 비공개 노트
                    </h3>
                    {noteData?.updatedAt && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Last Updated: {new Date(noteData.updatedAt).toLocaleDateString()}
                        </span>
                    )}
                </div>

                <textarea
                    className="flex-1 w-full bg-white rounded-2xl p-6 border border-[#F2E8DA] outline-none text-sm leading-relaxed font-medium text-slate-600 focus:ring-2 focus:ring-[#A58E6F]/20 transition-all resize-none mb-6 shadow-inner"
                    placeholder="회원에게 공개되지 않는 관리자 전용 메모 공간입니다.&#13;&#10;케어 특이사항, 컴플레인 내역, 내부 공유 사항 등을 자유롭게 작성하세요."
                    value={privateContent}
                    onChange={(e) => setPrivateContent(e.target.value)}
                />

                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-10 py-4 bg-[#2F3A32] text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg hover:bg-[#1A3C34] hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 ring-1 ring-white/20"
                    >
                        {isSaving ? '저장 중...' : '전체 저장 (Save All)'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PrivateNoteEditor;
