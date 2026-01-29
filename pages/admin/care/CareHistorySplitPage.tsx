import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../../../db';
import { Member, CareRecord } from '../../../types';
import PrivateNoteEditor from '../../../components/admin/care/PrivateNoteEditor';
import { useBalanceEngine } from '../../../hooks/useBalanceEngine';

const CareHistorySplitPage: React.FC = () => {
    const { memberId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const recordId = searchParams.get('recordId');
    const navigate = useNavigate();

    const [member, setMember] = useState<Member | null>(null);
    const [history, setHistory] = useState<CareRecord[]>([]);
    const [programs, setPrograms] = useState<any[]>([]);
    const [managers, setManagers] = useState<any[]>([]);

    useEffect(() => {
        if (memberId) loadData();
    }, [memberId]);

    const loadData = async () => {
        const m = await db.members.getById(memberId!);
        setMember(m);
        const h = await db.careRecords.getByMemberId(memberId!);
        setHistory(h);
        const p = await db.master.programs.getAll();
        setPrograms(p || []);
        const mgrs = await db.master.managers.getAll();
        setManagers(mgrs || []);
    };

    const selectedRecord = history.find(h => h.id === recordId);

    if (!member) return <div className="p-20 text-center">Loading...</div>;

    return (
        <div className="max-w-[1600px] mx-auto p-8 h-screen flex flex-col gap-8 bg-[#F5F5F3]">
            <header className="flex justify-between items-center bg-white p-6 rounded-[24px] shadow-sm shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-[#2F3A32]">케어 이력 및 비공개 노트 관리</h2>
                    <p className="text-[11px] text-[#A58E6F] font-bold uppercase tracking-[0.2em] mt-1">{member.name} 회원님</p>
                </div>
                <button onClick={() => navigate(-1)} className="px-6 py-3 bg-slate-100 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 uppercase tracking-widest">
                    돌아가기
                </button>
            </header>

            <div className="flex-1 grid grid-cols-12 gap-8 min-h-0">
                {/* Left: History List (Scrollable) */}
                <div className="col-span-5 bg-white rounded-[32px] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/50">
                        <h3 className="text-sm font-bold text-[#2F3A32] uppercase tracking-widest">History Timeline</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {history.map(h => {
                            const isActive = h.id === recordId;
                            const progName = programs.find(p => p.id === h.programId)?.name || '프로그램 정보 없음';
                            const mgrName = managers.find(m => m.id === h.managerId)?.name || '강사 미지정';

                            return (
                                <div
                                    key={h.id}
                                    onClick={() => setSearchParams({ recordId: h.id })}
                                    className={`p-5 rounded-[20px] border cursor-pointer transition-all hover:scale-[1.01] ${isActive ? 'bg-[#1A3C34] border-[#1A3C34] text-white shadow-lg' : 'bg-white border-slate-100 hover:border-[#1A3C34]/30'}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className={`text-[13px] font-bold ${isActive ? 'text-white' : 'text-[#2F3A32]'}`}>{h.date}</div>
                                            <div className={`text-[11px] font-bold mt-1 ${isActive ? 'text-emerald-400' : 'text-[#1A3C34]'}`}>
                                                {progName}
                                            </div>
                                            <div className={`text-[9px] font-medium mt-0.5 ${isActive ? 'text-white/60' : 'text-slate-400'}`}>
                                                담당 강사: {mgrName}
                                            </div>
                                        </div>
                                        <div className={`text-[13px] font-black ${isActive ? 'text-emerald-400' : 'text-slate-800'}`}>
                                            -₩{h.finalPrice?.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className={`mt-3 pt-3 border-t text-[12px] font-medium leading-relaxed line-clamp-2 ${isActive ? 'border-white/10 text-slate-300' : 'border-slate-50 text-slate-500'}`}>
                                        {h.noteSummary || '내용 없음'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Private Note Editor */}
                <div className="col-span-7 h-full">
                    {selectedRecord ? (
                        <PrivateNoteEditor
                            careRecordId={selectedRecord.id}
                            initialSummary={selectedRecord.noteSummary || ''}
                            initialRecommendation={selectedRecord.noteRecommendation || ''}
                            programName={programs.find(p => p.id === selectedRecord.programId)?.name || 'Wellness Care'}
                            date={selectedRecord.date}
                            onUpdate={loadData}
                            className="h-full shadow-md"
                        />
                    ) : (
                        <div className="h-full bg-white rounded-[32px] border border-slate-100 flex items-center justify-center text-slate-300 font-bold italic">
                            좌측 목록에서 케어 기록을 선택해주세요.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CareHistorySplitPage;
