import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../../../db';
import { AuditLog } from '../../../types';

interface Props {
    memberId: string;
    initialMemo: string;
}

const MemberMemoSection: React.FC<Props> = ({ memberId, initialMemo }) => {
    const [memo, setMemo] = useState(initialMemo);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedMemo, setLastSavedMemo] = useState(initialMemo);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<AuditLog[]>([]);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        setMemo(initialMemo);
        setLastSavedMemo(initialMemo);
    }, [initialMemo]);

    const saveMemo = useCallback(async (newMemo: string) => {
        if (newMemo === lastSavedMemo) return;

        setIsSaving(true);
        try {
            await db.members.update(memberId, { adminMemo: newMemo });
            await db.system.logAdminAction(
                'UPDATE_MEMO',
                memberId,
                '관리자 메모 수정',
                'adminMemo',
                lastSavedMemo,
                newMemo
            );
            setLastSavedMemo(newMemo);
        } catch (e) {
            console.error(e);
            alert('메모 저장 실패');
        } finally {
            setIsSaving(false);
        }
    }, [memberId, lastSavedMemo]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newVal = e.target.value;
        setMemo(newVal);

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            saveMemo(newVal);
        }, 1000); // Auto-save after 1 second of inactivity
    };

    const handleBlur = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        saveMemo(memo);
    };

    const fetchHistory = async () => {
        if (!showHistory) {
            const logs = await db.system.getMemoHistory(memberId);
            setHistory(logs);
        }
        setShowHistory(!showHistory);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h5 className="text-[12px] font-bold text-[#A58E6F] uppercase tracking-widest flex items-center gap-2">
                    Admin Narrative
                    {isSaving && <span className="text-rose-400 animate-pulse">● Saving...</span>}
                    {!isSaving && memo === lastSavedMemo && <span className="text-emerald-500">● Saved</span>}
                </h5>
                <button
                    onClick={fetchHistory}
                    className="text-[10px] font-bold text-slate-300 hover:text-[#1A3C34] uppercase tracking-widest transition-colors"
                >
                    {showHistory ? 'Close History' : 'View Revisions'}
                </button>
            </div>

            <textarea
                className="w-full bg-transparent outline-none text-[16px] font-medium text-[#2F3A32] placeholder:text-[#A58E6F]/30 min-h-[80px] leading-relaxed resize-none p-4 rounded-2xl focus:bg-white/50 transition-colors"
                placeholder="관리자 메모를 입력하세요 (자동 저장됨)"
                value={memo}
                onChange={handleChange}
                onBlur={handleBlur}
            />

            {showHistory && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                    <h6 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Revision History</h6>
                    {history.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">수정 이력이 없습니다.</p>
                    ) : (
                        <div className="space-y-6">
                            {history.map(log => (
                                <div key={log.id} className="relative pl-6 border-l border-slate-100 last:border-0">
                                    <div className="absolute left-[-3px] top-0 w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-[10px] font-bold text-[#1A3C34]">{log.adminEmail}</span>
                                        <span className="text-[9px] text-slate-300 font-bold tabular-nums">{new Date(log.createdAt).toLocaleString()}</span>
                                    </div>
                                    <div className="text-[12px] text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        {log.newValue || '(내용 없음)'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MemberMemoSection;
