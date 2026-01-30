import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../../db';
import { Reservation, Member, Program } from '../../../types';

const InstructorRecordingPage: React.FC = () => {
    const { resId } = useParams();
    const navigate = useNavigate();

    const [reservation, setReservation] = useState<Reservation | null>(null);
    const [member, setMember] = useState<Member | null>(null);
    const [program, setProgram] = useState<Program | null>(null);
    const [currentAdmin, setCurrentAdmin] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [notes, setNotes] = useState({
        noteSummary: '',
        noteDetails: '',
        noteRecommendation: '',
        noteFutureRef: ''
    });

    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [history, setHistory] = useState<any[]>([]);

    const [linkedCareRecordId, setLinkedCareRecordId] = useState<string | null>(null);

    useEffect(() => {
        if (resId) loadData();
    }, [resId]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const res = await db.reservations.getById(resId!);
            if (!res) throw new Error('예약을 찾을 수 없습니다.');
            setReservation(res);

            // [SECURITY] Identify Current Instructor
            const saved = localStorage.getItem('hannam_auth_session');
            if (saved) {
                const session = JSON.parse(saved);
                if (session.email) {
                    const admin = await db.admins.getByEmail(session.email);
                    setCurrentAdmin(admin);
                }
            }

            const [m, p, allProgs, historyData, linkedRecord] = await Promise.all([
                db.members.getById(res.memberId),
                db.master.programs.getAll(),
                db.master.programs.getAll(),
                db.careRecords.getByMemberId(res.memberId),
                db.careRecords.getByReservationId(resId!) // [SYNC] Check for Linked Care Record
            ]);

            setMember(m);
            const targetProg = p.find(x => x.id === res.programId);
            setProgram(targetProg || null);

            // [UX] Enhance History with Program Names & Map for Timeline
            // IMPORTANT: We filter out the current reservation ID if it exists in history (unlikely if strictly care records)
            // But if we want a "Timeline", we might mix them? 
            // For now, strictly use past Care Records.
            const enrichedHistory = (historyData || []).map((h: any) => ({
                ...h,
                programName: allProgs.find((prog: any) => prog.id === h.programId)?.name || h.programId
            }));
            setHistory(enrichedHistory);

            // [SYNC LOGIC] Priority: CareRecord (Admin Deduction) > Reservation (Pre-notes)
            if (linkedRecord) {
                console.log('>>> [SYNC] Linked Care Record Found. Using its data.', linkedRecord);
                setLinkedCareRecordId(linkedRecord.id);
                setNotes({
                    noteSummary: linkedRecord.noteSummary || res.noteSummary || '',
                    noteDetails: linkedRecord.noteDetails || res.noteDetails || '',
                    noteRecommendation: linkedRecord.noteRecommendation || res.noteRecommendation || '',
                    noteFutureRef: linkedRecord.noteFutureRef || res.noteFutureRef || ''
                });
            } else {
                // No Care Record yet, load from Reservation
                setNotes({
                    noteSummary: res.noteSummary || '',
                    noteDetails: res.noteDetails || '',
                    noteRecommendation: res.noteRecommendation || '',
                    noteFutureRef: res.noteFutureRef || ''
                });
            }

        } catch (e) {
            console.error(e);
            alert('데이터 로딩 중 오류가 발생했습니다.');
            navigate('/instructor');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!reservation || !member || !currentAdmin) return;

        // [SECURITY] 2nd Confirmation for Secret Notes
        const hasSecretNote = notes.noteDetails.trim().length > 0;
        const confirmMsg = hasSecretNote
            ? "비밀노트는 저장 후 화면에서 즉시 숨겨지며, 더 이상 내용을 확인할 수 없습니다. 저장하시겠습니까?"
            : "케어 기록을 저장하시겠습니까?";

        if (!window.confirm(confirmMsg)) return;

        // Restriction: Instructor can only edit same-day
        const today = new Date().toISOString().split('T')[0];
        const isInstructor = currentAdmin.role === 'INSTRUCTOR';

        if (isInstructor && reservation.date !== today) {
            return alert('강사님은 당일 케어 기록만 작성/수정할 수 있습니다.');
        }

        setIsSaving(true);
        try {
            // [FIX] Sanitized UUID: Remove 'DIR_' prefix if present
            const safeAuthorId = currentAdmin.id.replace('DIR_', '');

            // 1. Update Reservation (Always)
            await db.reservations.saveNotes(resId!, {
                ...notes,
                // [SECURITY] Strict Author Tracking
                noteAuthorId: safeAuthorId,
                noteAuthorName: currentAdmin.name, // Name is safe as string
                noteUpdatedAt: new Date().toISOString()
            });

            // 2. [SYNC] Update Care Record (if exists) - REAL-TIME SYNC
            if (linkedCareRecordId) {
                console.log('>>> [SYNC] Updating Linked Care Record also.');
                await db.careRecords.update(linkedCareRecordId, {
                    noteSummary: notes.noteSummary,
                    noteDetails: notes.noteDetails,
                    noteRecommendation: notes.noteRecommendation,
                    noteFutureRef: notes.noteFutureRef
                    // Note: We don't overwrite financial data here, only notes
                });
            }

            // Notification logic...
            try {
                await db.notifications.add({
                    memberId: member.id,
                    type: 'CARE_REPORT',
                    title: '케어 리포트 업데이트',
                    content: `${reservation.date} ${program?.name || '웰니스'} 케어 리포트가 작성되었습니다.`,
                    isRead: false
                });
            } catch (notiErr) { console.warn(notiErr); }

            // [SECURITY/UX] Clear Secret Note from State immediately
            setNotes(prev => ({ ...prev, noteDetails: '' }));

            setShowSuccessModal(true);
        } catch (e: any) {
            alert(`저장 실패: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">Loading...</div>;
    if (!reservation || !member) return null;

    const isEditable = !currentAdmin || (currentAdmin.role === 'INSTRUCTOR' ? reservation.date === new Date().toISOString().split('T')[0] : true);

    // Hide secret note detail if it was cleared (length 0) OR purely for UI logic
    // Actually the user can see it while typing. Once saved, it is cleared.
    // So 'notes.noteDetails' contains text while typing.
    const isSecretNoteMasked = false; // We just rely on clearing the state on save.

    return (
        <div className="min-h-screen bg-[#F9FAFB] pb-20">
            {/* [UX] SUCCESS MODAL */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[40px] p-10 flex flex-col items-center shadow-2xl animate-in zoom-in-95 duration-300 max-w-sm w-full mx-6">
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 text-emerald-600">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h3 className="text-xl font-bold text-[#1A3C34] mb-2">저장 완료</h3>
                        <p className="text-slate-500 text-sm font-medium mb-8 text-center">
                            성공적으로 저장되었습니다.<br />
                            <span className="text-xs text-red-400 mt-2 block">(보안을 위해 비밀노트 내용은 화면에서 숨겨졌습니다.)</span>
                        </p>
                        <button
                            onClick={() => setShowSuccessModal(false)}
                            className="w-full py-4 bg-[#1A3C34] text-white rounded-2xl font-bold text-sm shadow-lg hover:bg-[#152e28] transition-all"
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}

            {/* [HEADER] Instructor Portal Style */}
            <div className="bg-[#2F3A32] text-white p-6 pb-20 rounded-b-[40px] shadow-xl relative overflow-hidden mb-[-40px]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="max-w-7xl mx-auto relative z-10 flex justify-between items-start">
                    <div>
                        <span className="text-[10px] text-[#A58E6F] font-bold uppercase tracking-widest block mb-2">Instructor Portal</span>
                        <h1 className="text-3xl font-serif italic text-white mb-1">{member.name} <span className="text-white/50 text-xl not-italic font-sans">회원님</span></h1>
                        <p className="text-white/60 text-sm">{program?.name}</p>
                    </div>
                    <button onClick={() => navigate(-1)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold text-white transition-all backdrop-blur-md">
                        나가기
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 relative z-20">
                {/* [SECTION 1] Horizontal History (Cards) */}
                <div className="mb-8 overflow-visible">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 pl-2">Previous Wellness History</h3>
                    <div className="flex gap-4 overflow-x-auto pb-6 px-2 -mx-2 custom-scrollbar snap-x">
                        {history
                            .filter(h => h.id !== resId)
                            .slice(0, 10)
                            .map((h, idx) => (
                                <div key={idx} className="snap-start flex-shrink-0 w-[280px] bg-white rounded-[20px] p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="text-[12px] font-bold text-[#2F3A32]">{h.date}</span>
                                        <span className="text-[10px] font-bold text-slate-400">₩{(h.finalPrice || 0).toLocaleString()}</span>
                                    </div>
                                    <h4 className="font-bold text-[#A58E6F] text-sm mb-2">{h.programName}</h4>
                                    {/* STRICTLY PUBLIC SUMMARY ONLY */}
                                    <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-3 bg-slate-50 p-3 rounded-xl">
                                        {h.noteSummary || '내용 없음'}
                                    </p>
                                </div>
                            ))
                        }
                        {history.length === 0 && (
                            <div className="w-full h-32 flex items-center justify-center bg-white/50 border border-dashed border-slate-300 rounded-[20px] text-slate-400 text-sm">
                                이전 케어 기록이 없습니다.
                            </div>
                        )}
                    </div>
                </div>

                {/* [SECTION 2] Split Layout: Timeline & Details */}
                <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">

                    {/* LEFT: Timeline Panel */}
                    <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 hidden lg:block sticky top-6">
                        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-6">History Timeline</h3>
                        <div className="space-y-6 relative">
                            <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-slate-100"></div>

                            {/* Current Session (Active) */}
                            <div className="relative pl-6">
                                <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-[#1A3C34] border-4 border-white shadow-sm z-10"></div>
                                <div className="p-4 bg-[#1A3C34] rounded-[20px] shadow-lg text-white">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold opacity-80">{reservation.date}</span>
                                        <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded text-white font-bold">Today</span>
                                    </div>
                                    <p className="font-bold text-sm mb-1">{program?.name}</p>
                                    <p className="text-[10px] opacity-60">담당: {currentAdmin?.name}</p>
                                </div>
                            </div>

                            {/* Past Sessions */}
                            {history.slice(0, 5).map((h, i) => (
                                <div key={i} className="relative pl-6 opacity-60 hover:opacity-100 transition-opacity cursor-default">
                                    <div className="absolute left-[3px] top-2 w-2.5 h-2.5 rounded-full bg-slate-300 z-10"></div>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-xs font-bold text-[#2F3A32] mb-0.5">{h.date}</p>
                                            <p className="text-xs text-slate-500 line-clamp-1">{h.programName}</p>
                                        </div>
                                        {h.finalPrice > 0 && (
                                            <span className="text-[10px] font-bold text-slate-400">-₩{h.finalPrice.toLocaleString()}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT: Detail Editor */}
                    <div className="space-y-6">

                        {/* 1. Public Wellness Note */}
                        <div className="bg-white rounded-[32px] p-10 shadow-sm border border-slate-100">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-[12px] font-bold text-[#1A3C34] uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    Wellness Care Note (공개용)
                                </h3>
                                {isEditable && <span className="text-[10px] font-bold text-slate-300 border border-slate-200 px-2 py-1 rounded-full">수정 가능</span>}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-400 pl-2">관리 요약</label>
                                    <textarea
                                        disabled={!isEditable}
                                        className="w-full bg-[#F9F9F7] rounded-3xl p-6 border-transparent focus:bg-white focus:border-[#1A3C34] focus:ring-0 transition-all outline-none resize-none h-48 text-sm leading-relaxed text-slate-600"
                                        placeholder="회원 앱 리포트에 표시될 내용을 작성하세요."
                                        value={notes.noteSummary}
                                        onChange={e => setNotes({ ...notes, noteSummary: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-400 pl-2">홈케어 추천</label>
                                    <textarea
                                        disabled={!isEditable}
                                        className="w-full bg-[#F9F9F7] rounded-3xl p-6 border-transparent focus:bg-white focus:border-[#1A3C34] focus:ring-0 transition-all outline-none resize-none h-48 text-sm leading-relaxed text-slate-600"
                                        placeholder="추천 프로그램이나 홈케어 가이드를 작성하세요."
                                        value={notes.noteRecommendation}
                                        onChange={e => setNotes({ ...notes, noteRecommendation: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. Secret Note */}
                        <div className="bg-[#FFFBF5] rounded-[32px] p-10 shadow-sm border border-[#EFE5D5]">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-[12px] font-bold text-[#8C7B65] uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-[#8C7B65]"></span>
                                    Secret Note ({currentAdmin?.name} 강사님 전용)
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-[#B0A18E] bg-[#EFE5D5]/50 px-3 py-1 rounded-full">
                                        ⚠️ 저장 후 자동 숨김 처리됨
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row gap-8">
                                {/* Left Info (Optional context) */}
                                <div className="hidden md:block w-56 space-y-4 pt-2">
                                    <div className="bg-white/50 p-6 rounded-2xl border border-[#EFE5D5]/50">
                                        <p className="text-[10px] font-bold text-[#B0A18E] mb-1">REFERENCE INFO</p>
                                        <p className="text-sm font-bold text-[#8C7B65] mb-4">{reservation.date}</p>
                                        <p className="text-[10px] font-bold text-[#B0A18E] mb-1">PROGRAM</p>
                                        <p className="text-xs font-bold text-[#8C7B65] mb-4">{program?.name}</p>
                                        {notes.noteSummary && (
                                            <>
                                                <p className="text-[10px] font-bold text-[#B0A18E] mb-1">PUBLIC SNAPSHOT</p>
                                                <p className="text-[10px] text-[#8C7B65] line-clamp-3 opacity-70">{notes.noteSummary}</p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Editor */}
                                <div className="flex-1">
                                    <textarea
                                        disabled={!isEditable}
                                        className="w-full bg-white rounded-3xl p-6 border border-[#EFE5D5] focus:border-[#8C7B65] focus:ring-0 transition-all outline-none resize-none h-64 text-sm leading-relaxed text-[#5C5042] placeholder:text-[#B0A18E]/70"
                                        placeholder={
                                            notes.noteDetails ?
                                                "이곳에 작성된 내용은 회원에게 절대 공개되지 않습니다. 관리 이력, 특이사항, 내부 공유 메모를 자유롭게 남기세요." :
                                                "비밀노트가 저장되어 숨겨졌거나 비어있습니다."
                                        }
                                        value={notes.noteDetails}
                                        onChange={e => setNotes({ ...notes, noteDetails: e.target.value })}
                                    />
                                    <div className="flex justify-end mt-4">
                                        {isEditable && (
                                            <button
                                                onClick={handleSave}
                                                disabled={isSaving}
                                                className="px-8 py-4 bg-[#2F3A32] text-white rounded-2xl font-bold text-xs shadow-lg hover:bg-[#1A261D] hover:scale-105 active:scale-95 transition-all tracking-wider"
                                            >
                                                {isSaving ? '저장 중...' : '비공개 노트 저장 (SCERET SAVE)'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[40px] p-10 flex flex-col items-center shadow-2xl animate-in zoom-in-95 duration-300 max-w-sm w-full mx-6">
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 text-emerald-600">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h3 className="text-xl font-bold text-[#1A3C34] mb-2">저장 완료</h3>
                        <p className="text-slate-500 text-sm font-medium mb-1 text-center">성공적으로 저장되었습니다.</p>
                        <p className="text-rose-400 text-xs font-bold mb-8 text-center text-balance">보안을 위해 비밀노트 내용은 화면에서 숨겨졌습니다.</p>
                        <button
                            onClick={() => setShowSuccessModal(false)}
                            className="w-full py-4 bg-[#1A3C34] text-white rounded-2xl font-bold text-sm shadow-lg hover:bg-[#152e28] transition-all"
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InstructorRecordingPage;
