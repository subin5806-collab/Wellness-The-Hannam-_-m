import React, { useState, useEffect } from 'react';
import { db } from '../../../db';
import { AdminPrivateNote } from '../../../types';

interface Props {
    careRecordId: string;
    className?: string;
}

const PrivateNoteEditor: React.FC<Props> = ({ careRecordId, className }) => {
    const [note, setNote] = useState<AdminPrivateNote | null>(null);
    const [content, setContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadNote();
    }, [careRecordId]);

    const loadNote = async () => {
        setIsLoading(true);
        try {
            const data = await db.adminNotes.getByCareRecordId(careRecordId);
            setNote(data);
            setContent(data?.content || '');
        } catch (e) {
            console.error(e);
            alert('비공개 노트를 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const saved = await db.adminNotes.upsert(careRecordId, content);
            setNote(saved);
            alert('비공개 노트가 저장되었습니다.');
        } catch (e: any) {
            console.error(e);
            alert(`저장 실패: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-10 text-center text-slate-400">Loading Note...</div>;

    return (
        <div className={`bg-[#FFF9F2] rounded-[32px] p-8 border border-[#F2E8DA] flex flex-col h-full ${className}`}>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-[#2F3A32] flex items-center gap-2">
                    <span className="text-xl">🔒</span> 관리자 전용 비공개 노트
                </h3>
                {note?.updatedAt && (
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Last Updated: {new Date(note.updatedAt).toLocaleString()}
                    </span>
                )}
            </div>

            <textarea
                className="flex-1 w-full bg-white rounded-2xl p-6 border border-[#F2E8DA] outline-none text-sm leading-relaxed font-medium text-slate-600 focus:ring-2 focus:ring-[#A58E6F]/20 transition-all resize-none mb-6"
                placeholder="회원에게 공개되지 않는 관리자 전용 메모 공간입니다.&#13;&#10;케어 특이사항, 컴플레인 내역, 내부 공유 사항 등을 자유롭게 작성하세요."
                value={content}
                onChange={(e) => setContent(e.target.value)}
            />

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-8 py-4 bg-[#2F3A32] text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg hover:bg-[#1A3C34] hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50"
                >
                    {isSaving ? '저장 중...' : '노트 저장하기'}
                </button>
            </div>
        </div>
    );
};

export default PrivateNoteEditor;
