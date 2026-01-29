import React, { useState, useEffect } from 'react';
import { db } from '../../../db';
import { AdminPrivateNote } from '../../../types';

interface Props {
    careRecordId: string;
    initialSummary?: string;
    initialRecommendation?: string;
    programName?: string;
    date?: string;
    onUpdate?: () => void;
    className?: string;
}

const PrivateNoteEditor: React.FC<Props> = ({
    careRecordId,
    initialSummary = '',
    initialRecommendation = '',
    programName = '-',
    date = '-',
    onUpdate,
    className
}) => {
    // 1. Local State for UI Fields
    const [summary, setSummary] = useState(initialSummary);
    const [recommendation, setRecommendation] = useState(initialRecommendation);
    const [privateContent, setPrivateContent] = useState('');

    // 2. Control State
    const [publicEditMode, setPublicEditMode] = useState(false);
    const [noteData, setNoteData] = useState<AdminPrivateNote | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSavingPublic, setIsSavingPublic] = useState(false);
    const [isSavingPrivate, setIsSavingPrivate] = useState(false);

    // 3. Load Private Note on ID change
    useEffect(() => {
        loadData();
        checkAdmin();
    }, [careRecordId]);

    // 4. Sync props to state when switching records (only if not editing)
    useEffect(() => {
        if (!publicEditMode) {
            setSummary(initialSummary || '');
            setRecommendation(initialRecommendation || '');
        }
    }, [careRecordId, initialSummary, initialRecommendation]);

    const [currentAdmin, setCurrentAdmin] = useState<{ name: string, phone: string } | null>(null);

    const checkAdmin = async () => {
        const saved = localStorage.getItem('hannam_auth_session');
        if (saved) {
            const auth = JSON.parse(saved);
            if (auth.email) {
                const admin = await db.admins.getByEmail(auth.email);
                setCurrentAdmin({ name: admin.name, phone: admin.phone || '-' });
            }
        }
    };

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

    const handleSavePublic = async () => {
        if (!window.confirm('웰니스 케어 노트(공개용)가 변경됩니다.\n회원 앱에 즉시 반영됩니다. 저장하시겠습니까?')) return;

        setIsSavingPublic(true);
        try {
            await db.careRecords.update(careRecordId, {
                noteSummary: summary,
                noteRecommendation: recommendation
            });
            alert('공개용 웰니스 노트가 저장되었습니다.');
            setPublicEditMode(false);
            if (onUpdate) onUpdate();
        } catch (e: any) {
            alert(`저장 실패: ${e.message}`);
        } finally {
            setIsSavingPublic(false);
        }
    };

    const handleSavePrivate = async () => {
        if (!currentAdmin) return alert('관리자 정보를 불러오지 못했습니다.');

        // [IMMUTABLE STAMP LOGIC]
        const timestamp = new Date().toLocaleString('ko-KR', { hour12: false });
        const stamp = `\n\n[Recorded by ${currentAdmin.name}(${currentAdmin.phone}) on ${timestamp}]`;
        const finalContent = privateContent.trim() + stamp;

        setIsSavingPrivate(true);
        try {
            const savedNote = await db.adminNotes.upsert(careRecordId, finalContent);
            setNoteData(savedNote);
            setPrivateContent(savedNote.content); // Update with stamped content
            alert('관리자 비공개 노트가 저장되었습니다. (작성자 서명 포함)');
            if (onUpdate) onUpdate();
        } catch (e: any) {
            alert(`저장 실패: ${e.message}`);
        } finally {
            setIsSavingPrivate(false);
        }
    };

    if (isLoading) return <div className="p-10 text-center text-slate-400">Loading Editor...</div>;

    return (
        <div className={`flex flex-col gap-8 h-full ${className}`}>

            {/* CARD 1: PUBLIC WELLNESS NOTE (Visual Separation) */}
            <div className={`rounded-[32px] p-8 flex flex-col shadow-sm border transition-all relative group h-[45%] ${publicEditMode ? 'bg-white border-[#A58E6F] ring-1 ring-[#A58E6F]/20' : 'bg-[#F9F9FB] border-slate-100'}`}>
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-[13px] font-bold text-[#1A3C34] uppercase tracking-widest flex items-center gap-2">
                            <span>🌿</span> WELLNESS CARE NOTE (공개용)
                        </h3>
                        <p className="text-[10px] text-slate-400 font-medium mt-1 pl-6">작성된 내용은 회원 앱 '리포트'란에 표시됩니다.</p>
                    </div>

                    {!publicEditMode ? (
                        <button
                            onClick={() => setPublicEditMode(true)}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-500 hover:text-[#1A3C34] hover:border-[#1A3C34] transition-all shadow-sm"
                        >
                            수정하기 (Edit)
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setPublicEditMode(false);
                                    setSummary(initialSummary || '');
                                    setRecommendation(initialRecommendation || '');
                                }}
                                className="px-4 py-2 bg-slate-100 rounded-xl text-[11px] font-bold text-slate-400 hover:bg-slate-200"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSavePublic}
                                disabled={isSavingPublic}
                                className="px-5 py-2 bg-[#A58E6F] text-white rounded-xl text-[11px] font-bold shadow-md hover:bg-[#8E795D] transition-all"
                            >
                                {isSavingPublic ? '저장 중...' : '변경 저장'}
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex-1 grid grid-cols-2 gap-8 min-h-0">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest pl-1">관리 요약</label>
                        {publicEditMode ? (
                            <textarea
                                className="flex-1 w-full bg-slate-50 rounded-2xl p-4 border border-slate-200 outline-none text-sm leading-relaxed font-medium text-[#2F3A32] placeholder-slate-300 resize-none focus:bg-white focus:border-[#A58E6F] transition-all"
                                placeholder="관리 내용 요약..."
                                value={summary}
                                onChange={e => setSummary(e.target.value)}
                            />
                        ) : (
                            <div className="flex-1 bg-white/50 border border-slate-100 rounded-2xl p-4 overflow-y-auto">
                                <p className={`text-sm leading-relaxed whitespace-pre-wrap ${!summary ? 'text-slate-300 italic' : 'text-slate-600 font-medium'}`}>
                                    {summary || '작성된 요약이 없습니다.'}
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest pl-1">홈케어 추천</label>
                        {publicEditMode ? (
                            <textarea
                                className="flex-1 w-full bg-slate-50 rounded-2xl p-4 border border-slate-200 outline-none text-sm leading-relaxed font-serif text-[#2F3A32] placeholder-slate-300 resize-none focus:bg-white focus:border-[#A58E6F] transition-all"
                                placeholder="추천 멘트 작성..."
                                value={recommendation}
                                onChange={e => setRecommendation(e.target.value)}
                            />
                        ) : (
                            <div className="flex-1 bg-white/50 border border-slate-100 rounded-2xl p-4 overflow-y-auto">
                                <p className={`text-sm leading-relaxed whitespace-pre-wrap ${!recommendation ? 'text-slate-300 italic' : 'text-slate-600 font-serif'}`}>
                                    {recommendation || '작성된 추천 내용이 없습니다.'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* CARD 2: PRIVATE ADMIN NOTE (Distinct Logic) */}
            <div className="flex-1 bg-[#FFF9F2] rounded-[32px] p-8 border border-[#F2E8DA] flex shadow-md relative overflow-hidden gap-8">
                {/* Visual Accent */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-[#1A3C34]"></div>

                {/* Left: Reference Box (Read-Only Context) */}
                <div className="w-1/3 flex flex-col gap-4 border-r border-[#F2E8DA] pr-8">
                    <div>
                        <h3 className="text-lg font-bold text-[#1A3C34] flex items-center gap-2 mb-1">
                            <span>🔒</span> SECRET NOTE
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Administrator Access Only</p>
                    </div>

                    <div className="bg-white/60 rounded-2xl p-5 border border-[#F2E8DA]">
                        <h4 className="text-[10px] font-bold text-[#A58E6F] uppercase tracking-widest mb-3">Reference Info</h4>
                        <div className="space-y-3">
                            <div>
                                <span className="block text-[9px] text-slate-400 font-bold uppercase">Date</span>
                                <span className="text-xs font-bold text-[#2F3A32]">{date}</span>
                            </div>
                            <div>
                                <span className="block text-[9px] text-slate-400 font-bold uppercase">Program</span>
                                <span className="text-xs font-bold text-[#2F3A32]">{programName}</span>
                            </div>
                            <div className="pt-2 border-t border-slate-100">
                                <span className="block text-[9px] text-slate-400 font-bold uppercase mb-1">Public Note Snapshot</span>
                                <p className="text-[10px] text-slate-500 line-clamp-4 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-50 italic">
                                    {initialSummary || '(내용 없음)'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Input Area */}
                <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">비공개 메모 작성</span>
                        {noteData?.updatedAt && (
                            <span className="text-[9px] text-emerald-600/60 font-bold bg-[#E8F5E9] px-2 py-0.5 rounded-md">
                                저장됨: {new Date(noteData.updatedAt).toLocaleTimeString()}
                            </span>
                        )}
                    </div>
                    <textarea
                        className="flex-1 w-full bg-white rounded-2xl p-6 border border-[#F2E8DA] outline-none text-sm leading-relaxed font-medium text-slate-600 focus:ring-2 focus:ring-[#1A3C34]/10 transition-all resize-none mb-4 shadow-sm"
                        placeholder="이곳에 작성된 내용은 회원에게 절대 공개되지 않습니다.&#13;&#10;관리 이력, 특이사항, 내부 공유 메모를 자유롭게 남기세요."
                        value={privateContent}
                        onChange={(e) => setPrivateContent(e.target.value)}
                    />
                    <div className="flex justify-end">
                        <button
                            onClick={handleSavePrivate}
                            disabled={isSavingPrivate}
                            className="px-8 py-3 bg-[#1A3C34] text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg hover:shadow-xl hover:bg-[#152e28] active:scale-[0.98] transition-all"
                        >
                            {isSavingPrivate ? '저장 중...' : '비공개 노트 저장'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrivateNoteEditor;
