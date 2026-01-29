
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../../../db';
import { Member, CareRecord, Program, Manager } from '../../../types';
import CareNoteDetailModal from '../../../components/admin/care/CareNoteDetailModal';

const WellnessHistoryReportPage: React.FC = () => {
    const { memberId } = useParams();
    const [searchParams] = useSearchParams();
    const resId = searchParams.get('resId');
    const progId = searchParams.get('progId');
    const navigate = useNavigate();

    const [member, setMember] = useState<Member | null>(null);
    const [history, setHistory] = useState<Partial<CareRecord>[]>([]);
    const [programs, setPrograms] = useState<Program[]>([]);
    const [currentManager, setCurrentManager] = useState<Manager | null>(null);
    const [currentAdmin, setCurrentAdmin] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRecord, setSelectedRecord] = useState<Partial<CareRecord> | null>(null);

    useEffect(() => {
        if (memberId) loadData();
    }, [memberId]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Resolve Current Admin Role first to choose the right query
            let role = 'INSTRUCTOR';
            let myMgrId = '';
            const saved = localStorage.getItem('hannam_auth_session');
            if (saved) {
                const auth = JSON.parse(saved);
                if (auth.email) {
                    const admin = await db.admins.getByEmail(auth.email);
                    if (admin) {
                        setCurrentAdmin(admin);
                        role = admin.role;
                    }
                }
                if (auth.id) {
                    const myMgr = await db.master.managers.getByPhone(auth.id);
                    if (myMgr) {
                        setCurrentManager(myMgr);
                        myMgrId = myMgr.id;
                    }
                }
            }

            // [SECURITY] Choose query based on role
            const isMaster = role === 'SUPER' || role === 'STAFF';
            const historyPromise = isMaster
                ? db.careRecords.getByMemberId(memberId!)
                : db.careRecords.getHistoryForInstructor(memberId!);

            const [m, h, p] = await Promise.all([
                db.members.getById(memberId!),
                historyPromise,
                db.master.programs.getAll()
            ]);

            setMember(m);
            setHistory(h || []);
            setPrograms(p || []);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleWriteCare = () => {
        const path = `/admin/care/${memberId}?resId=${resId || ''}&progId=${progId || ''}`;
        navigate(path);
    };

    if (isLoading && !member) return (
        <div className="min-h-screen flex items-center justify-center bg-[#F9F9F7]">
            <div className="text-center space-y-4">
                <div className="w-12 h-12 border-4 border-[#1A3C34] border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="font-serif italic text-[#1A3C34] text-xl">Wellness Report Syncing...</p>
            </div>
        </div>
    );

    if (!member) return <div className="p-20 text-center">회원 정보를 찾을 수 없습니다.</div>;

    return (
        <div className="min-h-screen bg-[#F9F9F7] pb-20 page-transition">
            {/* Header section with Member info & Action Button */}
            <div className="max-w-4xl mx-auto px-6 pt-12 space-y-10">
                <header className="flex justify-between items-start border-b border-slate-200 pb-10">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <h1 className="text-4xl font-serif-luxury font-bold text-[#1A3C34] mb-1">{member.name}님</h1>
                            <span className="px-3 py-1 bg-[#A58E6F]/10 text-[#A58E6F] text-[10px] font-bold rounded-full uppercase tracking-widest border border-[#A58E6F]/20">VIP History</span>
                        </div>
                        <p className="text-sm text-slate-400 font-medium leading-relaxed">
                            {member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')} <span className="mx-2 text-slate-200">|</span>
                            {member.birthDate} <span className="mx-2 text-slate-200">|</span>
                            통합 웰니스 기록 보고서
                        </p>
                    </div>
                    <button
                        onClick={() => navigate(-1)}
                        className="p-3 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-[#1A3C34] hover:border-[#1A3C34] transition-all"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>

                {/* Primary Action Button: Write Today's Care */}
                <section className="animate-in slide-in-from-top-4 duration-700">
                    <button
                        onClick={handleWriteCare}
                        className="w-full bg-[#1A3C34] rounded-[32px] p-6 text-white shadow-xl flex items-center justify-between group active:scale-[0.98] transition-all relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center border border-white/10 group-hover:bg-white/20 transition-all">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                            </div>
                            <div className="text-left">
                                <p className="text-[10px] font-bold text-[#A58E6F] uppercase tracking-[0.3em] mb-1">Today's Session</p>
                                <h3 className="text-lg font-bold leading-none tracking-tight">오늘의 케어 리포트 신규 작성하기</h3>
                            </div>
                        </div>
                        <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center group-hover:border-white/50 transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </div>
                    </button>
                </section>

                {/* History Timeline section */}
                <section className="space-y-12">
                    <div className="flex justify-between items-center px-4">
                        <h4 className="text-[12px] font-bold text-[#A58E6F] uppercase tracking-[0.4em]">Historical timeline</h4>
                        <span className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">{history.length} Records Found</span>
                    </div>

                    <div className="relative ml-8 border-l border-slate-200 pl-10 pb-20 space-y-16">
                        {history.map((record, index) => {
                            const programName = programs.find(p => p.id === record.programId)?.name || 'Wellness Care';
                            return (
                                <div key={record.id} className="relative animate-in fade-in slide-in-from-left-4 duration-700" style={{ animationDelay: `${index * 100}ms` }}>
                                    {/* Timeline Node */}
                                    <div className="absolute -left-[45px] top-4 w-4 h-4 rounded-full bg-white border-2 border-[#A58E6F] shadow-sm z-10"></div>

                                    {/* History Card */}
                                    <div
                                        onClick={() => setSelectedRecord(record)}
                                        className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm hover:border-[#1A3C34] hover:shadow-md transition-all cursor-pointer group space-y-6"
                                    >
                                        <div className="flex justify-between items-center">
                                            <div className="space-y-1">
                                                <p className="text-[10px] text-[#A58E6F] font-bold uppercase tracking-widest">{record.date}</p>
                                                <h4 className="text-xl font-bold text-[#1A3C34] group-hover:text-[#A58E6F] transition-colors">{programName}</h4>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest border border-slate-100 border-dashed px-3 py-1 rounded-full group-hover:border-[#1A3C34]/20 transition-all">
                                                    Verified Care
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-5">
                                            <div className="bg-[#F9F9F7] p-6 rounded-2xl border border-slate-50 relative overflow-hidden">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-[#1A3C34]/20 group-hover:bg-[#1A3C34] transition-all"></div>
                                                <h5 className="text-[11px] font-bold text-[#1A3C34] uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <span>🌿</span> Wellness Note (공개)
                                                </h5>
                                                <p className="text-[13px] text-slate-500 font-medium leading-relaxed italic line-clamp-2">
                                                    "{record.noteSummary || '기록된 내용이 없습니다.'}"
                                                </p>
                                            </div>

                                            {record.noteDetails && (
                                                <div className="bg-[#FFF9F2] p-6 rounded-2xl border border-[#F2E8DA] relative overflow-hidden opacity-80 group-hover:opacity-100 transition-opacity">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-[#A58E6F]"></div>
                                                    <h5 className="text-[11px] font-bold text-[#A58E6F] uppercase tracking-widest mb-3 flex items-center gap-2">
                                                        <span>🔒</span> Secret Note (비공개)
                                                    </h5>
                                                    <p className="text-[13px] text-[#8E795D] font-medium leading-relaxed line-clamp-2">
                                                        {record.noteDetails}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex justify-between items-center pt-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px]">👤</div>
                                                <span className="text-[11px] font-bold text-slate-400 capitalize">Expert Care Team</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] font-bold text-[#1A3C34] border-b border-[#1A3C34] pb-0.5 group-hover:text-[#A58E6F] group-hover:border-[#A58E6F] transition-colors">
                                                    View Detail Report (상세보기) →
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {history.length === 0 && (
                            <div className="py-24 text-center space-y-4">
                                <div className="text-4xl">🗒️</div>
                                <p className="text-slate-300 italic font-serif text-lg">아직 기록된 케어 히스토리가 없습니다.</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {/* Detail Modal */}
            {selectedRecord && (
                <CareNoteDetailModal
                    record={selectedRecord as CareRecord}
                    currentManagerId={currentManager?.id}
                    currentAdminRole={currentAdmin?.role}
                    onClose={() => setSelectedRecord(null)}
                    onUpdate={loadData}
                    programName={programs.find(p => p.id === selectedRecord.programId)?.name || 'Wellness Care'}
                />
            )}
        </div>
    );
};

export default WellnessHistoryReportPage;
