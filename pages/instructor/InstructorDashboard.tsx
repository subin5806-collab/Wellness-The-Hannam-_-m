
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, supabase } from '../../db';
import { Reservation, Manager, Member } from '../../types';
import { Bell, Calendar, ChevronRight, Clock, LogOut, User, Menu } from 'lucide-react';

const InstructorDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [reservations, setReservations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [instructor, setInstructor] = useState<{ name: string, phone: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // 1. Get Current User (Instructor)
            const saved = localStorage.getItem('hannam_auth_session');
            if (saved) {
                const auth = JSON.parse(saved);
                // We need to resolve the Instructor Identity from the Admin Login
                const admin = await db.admins.getByEmail(auth.email || '');
                if (admin && admin.role === 'INSTRUCTOR') {
                    setInstructor({ name: admin.name, phone: admin.phone || '-' });

                    // 2. Fetch Reservations for THIS Instructor
                    // Using "Phone matching" logic if DB link is not fully established or robust
                    // Ideally we use `linked_admin_id` in `hannam_managers`.
                    // Let's find the Manager record linked to this Admin

                    // HACK: For now, if cleanPhone matches, it's them.
                    const cleanPhone = admin.phone?.replace(/[^0-9]/g, '') || '';
                    const allMgrs = await db.master.managers.getAll();
                    const myMgrProfile = allMgrs.find(m => m.phone.replace(/[^0-9]/g, '') === cleanPhone);

                    if (myMgrProfile) {
                        const today = new Date().toISOString().split('T')[0]; // KST logic needed
                        // Simplified "Today" logic
                        const allRes = await db.reservations.getAll();
                        const myTodayRes = allRes.filter(r =>
                            r.managerId === myMgrProfile.id &&
                            r.date === today
                        ).sort((a, b) => a.time.localeCompare(b.time));

                        // Enhance with Member Name (Assuming db.reservations returns minimal info, need member name)
                        // Wait, getAll returns Reservation[], which has memberId. We need names.
                        const members = await db.members.getAll();
                        const memberMap = new Map(members.map(m => [m.id, m]));

                        const enhancedRes = myTodayRes.map(r => ({
                            ...r,
                            memberName: memberMap.get(r.memberId)?.name || 'Unknown',
                            memberPhone: memberMap.get(r.memberId)?.phone || '',
                            isCompleted: r.status === 'COMPLETED'
                        }));

                        setReservations(enhancedRes);
                    }
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        if (confirm('로그아웃 하시겠습니까?')) {
            localStorage.removeItem('hannam_auth_session');
            supabase.auth.signOut();
            navigate('/login');
        }
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB] font-sans pb-20">
            {/* Header */}
            <div className="bg-[#2F3A32] text-white p-6 pb-12 rounded-b-[40px] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                <div className="flex justify-between items-center mb-6 relative z-10">
                    <div>
                        <h1 className="text-xl font-bold font-serif italic">The Hannam</h1>
                        <p className="text-[10px] text-[#A58E6F] font-bold uppercase tracking-widest mt-1">Instructor Portal</p>
                    </div>
                    <button onClick={handleLogout} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all">
                        <LogOut size={18} className="text-slate-200" />
                    </button>
                </div>

                <div className="mt-4 relative z-10">
                    <h2 className="text-2xl font-bold mb-1">안녕하세요, <span className="text-[#A58E6F]">{instructor?.name}</span> 강사님</h2>
                    <p className="text-white/60 text-sm font-medium">{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })} 일정입니다.</p>
                </div>
            </div>

            {/* Content */}
            <div className="px-6 -mt-8 relative z-20 space-y-6">
                {/* Stats Card */}
                <div className="bg-white p-6 rounded-[32px] shadow-lg border border-slate-100 flex justify-between items-center">
                    <div className="text-center w-1/2 border-r border-slate-100">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">오늘 예약</p>
                        <p className="text-2xl font-bold text-[#2F3A32]">{reservations.length}</p>
                    </div>
                    <div className="text-center w-1/2">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">케어 완료</p>
                        <p className="text-2xl font-bold text-[#A58E6F]">{reservations.filter(r => r.isCompleted).length}</p>
                    </div>
                </div>

                {/* Reservation List */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-[#2F3A32] px-2 flex items-center gap-2">
                        <Calendar size={18} className="text-[#A58E6F]" />
                        오늘의 예약
                    </h3>

                    {isLoading ? (
                        <div className="py-20 text-center text-slate-400 text-sm">로딩 중...</div>
                    ) : reservations.length > 0 ? (
                        reservations.map(res => (
                            <div
                                key={res.id}
                                onClick={() => navigate(`/instructor/record/${res.id}`)}
                                // [FIXED] Navigate to isolated Instructor Route
                                className={`bg-white p-6 rounded-[28px] border transition-all active:scale-95 shadow-sm hover:shadow-md flex items-center justify-between
                                    ${res.isCompleted ? 'border-[#A58E6F]/30 bg-[#A58E6F]/5' : 'border-slate-100'}
                                `}
                            >
                                <div className="flex items-center gap-5">
                                    <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center border font-bold ${res.isCompleted ? 'bg-[#A58E6F] text-white border-[#A58E6F]' : 'bg-white text-[#2F3A32] border-slate-200'}`}>
                                        <span className="text-[10px] uppercase opacity-70">{res.time.split(':')[0]}</span>
                                        <span className="text-sm">{res.time.split(':')[1]}</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-[#2F3A32] text-lg flex items-center gap-2">
                                            {res.memberName}
                                            {res.isCompleted && <span className="text-[9px] bg-[#A58E6F] text-white px-2 py-0.5 rounded-full">완료</span>}
                                        </h4>
                                        <p className="text-xs text-slate-400 mt-1 font-medium">{res.programId}</p> {/* Name needed */}
                                    </div>
                                </div>
                                <ChevronRight className="text-slate-300" />
                            </div>
                        ))
                    ) : (
                        <div className="py-20 text-center text-slate-300 font-bold italic border-2 border-dashed border-slate-100 rounded-[32px]">
                            오늘 예약된 일정이 없습니다.
                        </div>
                    )}
                </div>
            </div>

            {/* Fixed Bottom Nav (Optional, if multiple tabs needed) */}
        </div>
    );
};

export default InstructorDashboard;
