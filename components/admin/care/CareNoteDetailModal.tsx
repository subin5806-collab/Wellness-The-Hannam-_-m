import React, { useState, useEffect } from 'react';
import { db } from '../../../db';
import { CareRecord } from '../../../types';

interface Props {
    record: CareRecord;
    currentManagerId?: string;
    currentAdminRole?: string;
    onClose: () => void;
    onUpdate: () => void;
    programName: string;
}

const CareNoteDetailModal: React.FC<Props> = ({ record, currentManagerId, currentAdminRole, onClose, onUpdate, programName }) => {
    const isMaster = currentAdminRole === 'SUPER' || currentAdminRole === 'STAFF';
    const isOwner = currentManagerId && record.managerId === currentManagerId;
    const isToday = record.date === new Date().toISOString().split('T')[0];

    // [Strict Restriction] MASTER can always edit. Instructor can only edit OWN record ON THE DAY.
    const canEdit = isMaster || (isOwner && isToday);
    const canSeeSecret = isMaster || isOwner;

    const [fullRecord, setFullRecord] = useState<CareRecord | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [notes, setNotes] = useState({
        summary: record.noteSummary || '',
        details: '', // Will be filled from full fetch
        recommendation: record.noteRecommendation || ''
    });

    useEffect(() => {
        loadFullDetails();
    }, [record.id]);

    const loadFullDetails = async () => {
        setIsLoading(true);
        try {
            const data = await db.careRecords.getById(record.id);
            if (data) {
                setFullRecord(data);
                setNotes({
                    summary: data.noteSummary || '',
                    details: data.noteDetails || '',
                    recommendation: data.noteRecommendation || ''
                });
            }
        } catch (e) {
            console.error('Failed to load clinical details', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!canEdit) return alert('권한이 없거나 수정 가능한 시간이 지났습니다.');
        if (!window.confirm('기록을 저장하시겠습니까?')) return;

        setIsSaving(true);
        try {
            await db.careRecords.update(record.id, {
                noteSummary: notes.summary,
                noteDetails: notes.details,
                noteRecommendation: notes.recommendation
            });
            alert('기록이 수정되었습니다.');
            setEditMode(false);
            onUpdate();
        } catch (e: any) {
            alert(`저장 실패: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-[#1A3C34]/40 backdrop-blur-sm z-[2000] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-[40px] w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
                {/* Header Backdrop */}
                <div className="absolute top-0 left-0 w-full h-32 bg-[#F9F9F7] -z-0"></div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 z-20 p-2 bg-white/80 hover:bg-white text-slate-400 rounded-full shadow-sm transition-all"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div className="relative z-10 flex flex-col flex-1 overflow-hidden">
                    {/* Modal Internal Header */}
                    <div className="p-10 pb-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="space-y-1">
                                <p className="text-[10px] text-[#A58E6F] font-bold uppercase tracking-[0.3em]">{record.date} Report</p>
                                <h3 className="text-3xl font-serif-luxury font-bold text-[#1A3C34]">{programName}</h3>
                            </div>
                            {canEdit && !editMode && (
                                <button
                                    onClick={() => setEditMode(true)}
                                    className="px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-[11px] font-bold text-slate-500 hover:text-[#1A3C34] hover:border-[#1A3C34] transition-all shadow-sm flex items-center gap-2"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    수정하기 (Edit)
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto px-10 pb-10 custom-scrollbar space-y-8">
                        {/* Section: Wellness Note (Public) */}
                        <div className="space-y-4">
                            <h4 className="text-[11px] font-bold text-[#1A3C34] uppercase tracking-widest flex items-center gap-2 pl-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Wellness Record (회원 공개)
                            </h4>
                            {editMode ? (
                                <textarea
                                    className="w-full bg-[#F9F9F7] rounded-3xl p-6 border border-transparent focus:border-[#1A3C34] focus:bg-white outline-none text-[15px] font-medium text-slate-600 leading-relaxed resize-none h-32 transition-all"
                                    value={notes.summary}
                                    onChange={e => setNotes({ ...notes, summary: e.target.value })}
                                    placeholder="회원님께 보여질 요약 내용을 입력하세요."
                                />
                            ) : (
                                <div className="bg-[#F9F9F7] rounded-3xl p-6 border border-slate-50 italic text-[15px] leading-relaxed text-slate-500">
                                    "{record.noteSummary || '기록된 내용이 없습니다.'}"
                                </div>
                            )}
                        </div>

                        {/* Section: Secret Note (Private) */}
                        <div className="space-y-4 pt-4">
                            <h4 className="text-[11px] font-bold text-[#A58E6F] uppercase tracking-widest flex items-center gap-2 pl-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#A58E6F]"></span> Secret Note (전문가용 비공개)
                            </h4>
                            {isLoading ? (
                                <div className="h-24 bg-slate-50 animate-pulse rounded-3xl" />
                            ) : !canSeeSecret ? (
                                <div className="bg-slate-50 rounded-3xl p-8 text-center border border-slate-100 italic text-[11px] text-slate-300">
                                    <svg className="w-5 h-5 mx-auto mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    작성자 및 마스터 관리자에게만 비공개된 메모입니다.
                                </div>
                            ) : editMode ? (
                                <textarea
                                    className="w-full bg-[#FFFBF7] rounded-3xl p-6 border border-transparent focus:border-[#A58E6F] focus:bg-white outline-none text-[15px] font-medium text-[#8E795D] leading-relaxed resize-none h-44 transition-all"
                                    value={notes.details}
                                    onChange={e => setNotes({ ...notes, details: e.target.value })}
                                    placeholder="신체 특이사항, 소견 등 고객에게 노출되지 않는 전문적인 의견을 남기세요."
                                />
                            ) : (
                                <div className="bg-[#FFFBF7] rounded-3xl p-6 border border-[#F2E8DA] text-[15px] leading-relaxed text-[#8E795D] font-medium min-h-[120px]">
                                    {notes.details || '기록된 비공개 메모가 없습니다.'}
                                </div>
                            )}
                            {canSeeSecret && !editMode && !isLoading && <p className="text-[10px] text-slate-300 font-medium pl-2 italic">* 이 메모는 회원 앱에서 조회할 수 없습니다.</p>}
                        </div>

                        {/* Section: Recommendation */}
                        <div className="space-y-4 pt-4">
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Next Recommendation (회원 공개)</h4>
                            {editMode ? (
                                <textarea
                                    className="w-full bg-slate-50 rounded-2xl p-5 border border-transparent focus:border-slate-200 outline-none text-[13px] font-medium text-slate-600 resize-none h-28 transition-all"
                                    value={notes.recommendation}
                                    onChange={e => setNotes({ ...notes, recommendation: e.target.value })}
                                    placeholder="다음 방문 시 제안할 생활 수칙이나 프로그램을 남기세요."
                                />
                            ) : (
                                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-[13px] text-slate-500 leading-relaxed font-medium">
                                    {record.noteRecommendation || '기록된 추천 사항이 없습니다.'}
                                </div>
                            )}
                        </div>

                        {/* Audit Info */}
                        {!editMode && record.noteAuthorName && (
                            <div className="pt-6 border-t border-slate-50 text-[10px] text-slate-300 font-bold uppercase tracking-widest">
                                Author: <span className="text-slate-400">{record.noteAuthorName}</span>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    {editMode && (
                        <div className="p-8 border-t border-slate-100 bg-white flex justify-end gap-3 animate-in slide-in-from-bottom-2 duration-300">
                            <button
                                onClick={() => setEditMode(false)}
                                className="px-6 py-3 rounded-2xl font-bold text-xs text-slate-400 hover:bg-slate-50 transition-all uppercase tracking-widest"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-10 py-3 bg-[#1A3C34] text-white rounded-2xl font-bold text-xs shadow-lg hover:shadow-xl hover:bg-[#152e28] active:scale-95 transition-all uppercase tracking-widest"
                            >
                                {isSaving ? 'Saving...' : '수정 완료 (Apply)'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CareNoteDetailModal;
