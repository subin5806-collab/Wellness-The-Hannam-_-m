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

            // [NEW] Manager Map
            const allManagers = await db.master.managers.getAll();
            const managerMap = new Map(allManagers.map((mgr: any) => [mgr.id, mgr.name]));

            // [UX] Enhance History with Program Names & Map for Timeline
            // IMPORTANT: We filter out the current reservation ID if it exists in history (unlikely if strictly care records)
            // But if we want a "Timeline", we might mix them? 
            // For now, strictly use past Care Records.
            const enrichedHistory = (historyData || []).map((h: any) => ({
                ...h,
                programName: allProgs.find((prog: any) => prog.id === h.programId)?.name || h.programId,
                managerName: managerMap.get(h.managerId) || '미지정'
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

    const [newSecretNote, setNewSecretNote] = useState(''); // [NEW] Append-only input

    const handleSave = async () => {
        if (!reservation || !member || !currentAdmin) return;

        // [SECURITY] 2nd Confirmation for Secret Notes
        const hasNewSecretNote = newSecretNote.trim().length > 0;
        const confirmMsg = hasNewSecretNote
            ? "작성하신 비밀노트는 저장 후 '수정 및 삭제'가 불가능합니다. 저장하시겠습니까?"
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

            // [LOGIC] Append Only Logic
            let finalSecretDetails = notes.noteDetails;
            if (hasNewSecretNote) {
                const timestamp = new Date().toLocaleString('ko-KR', { hour12: false });
                const authorName = currentAdmin.name;
                const appendLog = `\n[${timestamp} ${authorName}]\n${newSecretNote.trim()}\n`;

                // If existing content exists, double newline separator
                if (finalSecretDetails) {
                    finalSecretDetails += `\n${appendLog}`;
                } else {
                    finalSecretDetails = appendLog;
                }
            }

            const updatedNotes = {
                ...notes,
                noteDetails: finalSecretDetails
            };

            // 1. Update Reservation (Always)
            await db.reservations.saveNotes(resId!, {
                ...updatedNotes,
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
                    noteDetails: finalSecretDetails, // [SYNC] Appended Note
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

            // [UX] Update Local State to reflect append immediately (for history view)
            setNotes(updatedNotes);
            setNewSecretNote(''); // Clear input

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

            {/* [HEADER] Instructor Portal Style - Slim Mobile */}
            <div className="bg-[#2F3A32] text-white px-6 pt-12 pb-20 rounded-b-[40px] shadow-xl relative overflow-hidden mb-[-40px]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="max-w-md mx-auto relative z-10 flex justify-between items-start">
                    <div>
                        <span className="text-[10px] text-[#A58E6F] font-bold uppercase tracking-widest block mb-2">Instructor Portal</span>
                        <h1 className="text-2xl font-serif italic text-white mb-1">{member.name} <span className="text-white/50 text-xl not-italic font-sans">회원님</span></h1>
                        <p className="text-white/60 text-xs font-bold">{program?.name}</p>
                    </div>
                    <button onClick={() => navigate(-1)} className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold text-white transition-all backdrop-blur-md">
                        나가기
                    </button>
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 relative z-20 pb-20">
                {/* [SECTION 1] Horizontal History (Cards) */}
                <div className="mb-8 overflow-visible">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 pl-2">Previous Wellness History</h3>
                    <div className="flex gap-4 overflow-x-auto pb-6 px-2 -mx-2 custom-scrollbar snap-x">
                        {history
                            .filter(h => h.id !== resId)
                            .slice(0, 10)
                            .map((h, idx) => (
                                <div key={idx} className="snap-start flex-shrink-0 w-[260px] bg-white rounded-[24px] p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-[13px] font-bold text-[#2F3A32]">{h.date}</span>
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{h.managerName}</span>
                                    </div>
                                    <h4 className="font-bold text-[#A58E6F] text-sm mb-3 line-clamp-1">{h.programName}</h4>

                                    {/* INFO GRID */}
                                    <div className="space-y-3">
                                        {/* 1. Summary */}
                                        <div className="bg-slate-50 p-3 rounded-xl">
                                            <p className="text-[10px] font-bold text-slate-400 mb-1">관리 요약</p>
                                            <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                                                {h.noteSummary || '내용 없음'}
                                            </p>
                                        </div>
                                        {/* 2. Recs (Shown only if exists) */}
                                        {h.noteRecommendation && (
                                            <div className="bg-[#FFFBF5] p-3 rounded-xl border border-[#EFE5D5]/50">
                                                <p className="text-[10px] font-bold text-[#B0A18E] mb-1">추천 프로그램</p>
                                                <p className="text-[11px] text-[#8C7B65] leading-relaxed line-clamp-2">
                                                    {h.noteRecommendation || h.wellnessRecommendation || '내용 없음'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
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

                {/* [SECTION 2] Single Column Layout (Mobile Focused) - Removed Timeline Split */}
                <div className="space-y-6">

                    {/* 1. Public Wellness Note */}
                    <div className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[12px] font-bold text-[#1A3C34] uppercase tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                Wellness Care Note
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-400 pl-2">관리 요약/코멘트</label>
                                <textarea
                                    disabled={!isEditable}
                                    className="w-full bg-[#F9F9F7] rounded-3xl p-5 border-transparent focus:bg-white focus:border-[#1A3C34] focus:ring-0 transition-all outline-none resize-none h-40 text-sm leading-relaxed text-slate-600 placeholder:text-slate-300"
                                    placeholder="회원 앱 리포트에 표시될 내용을 작성하세요."
                                    value={notes.noteSummary}
                                    onChange={e => setNotes({ ...notes, noteSummary: e.target.value })}
                                    style={{ fontSize: '16px' }} // Prevent iOS Zoom
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-400 pl-2">홈케어/프로그램 추천</label>
                                <textarea
                                    disabled={!isEditable}
                                    className="w-full bg-[#F9F9F7] rounded-3xl p-5 border-transparent focus:bg-white focus:border-[#1A3C34] focus:ring-0 transition-all outline-none resize-none h-32 text-sm leading-relaxed text-slate-600 placeholder:text-slate-300"
                                    placeholder="추천 프로그램이나 홈케어 가이드를 작성하세요."
                                    value={notes.noteRecommendation}
                                    onChange={e => setNotes({ ...notes, noteRecommendation: e.target.value })}
                                    style={{ fontSize: '16px' }} // Prevent iOS Zoom
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. Secret Note */}
                    <div className="bg-[#FFFBF5] rounded-[32px] p-6 md:p-8 shadow-sm border border-[#EFE5D5]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[12px] font-bold text-[#8C7B65] uppercase tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#8C7B65]"></span>
                                Secret Note
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-[#B0A18E] bg-[#EFE5D5]/50 px-3 py-1 rounded-full">
                                    관리자 전용
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-6">
                            {/* History View (Read-Only) */}
                            {notes.noteDetails && (
                                <div className="bg-[#FAF8F5] p-5 rounded-3xl border border-[#EFE5D5] mb-4 overflow-y-auto max-h-60">
                                    <h4 className="text-[10px] font-bold text-[#B0A18E] uppercase tracking-widest mb-3 sticky top-0 bg-[#FAF8F5] pb-2 border-b border-[#EFE5D5]/50">
                                        기존 작성 이력
                                    </h4>
                                    <div className="text-sm leading-relaxed text-[#5C5042] whitespace-pre-wrap font-serif">
                                        {notes.noteDetails}
                                    </div>
                                </div>
                            )}

                            {/* New Note Editor */}
                            <div className="flex-1">
                                <textarea
                                    disabled={!isEditable}
                                    className="w-full bg-white rounded-3xl p-5 border border-[#EFE5D5] focus:border-[#8C7B65] focus:ring-0 transition-all outline-none resize-none h-32 text-sm leading-relaxed text-[#5C5042] placeholder:text-[#B0A18E]/70"
                                    placeholder={notes.noteDetails ? "새로운 내용을 추가하세요. (기존 내용은 수정/삭제 불가능)" : "비밀노트 내용을 작성하세요."}
                                    value={newSecretNote}
                                    onChange={e => setNewSecretNote(e.target.value)}
                                    style={{ fontSize: '16px' }} // Prevent iOS Zoom
                                />
                                <div className="flex justify-end mt-4">
                                    {isEditable && (
                                        <button
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            className="w-full py-4 bg-[#2F3A32] text-white rounded-2xl font-bold text-sm shadow-lg hover:bg-[#1A261D] active:scale-95 transition-all tracking-wider"
                                        >
                                            {isSaving ? '저장 중...' : '모든 기록 저장 (SAVE ALL)'}
                                        </button>
                                    )}
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
