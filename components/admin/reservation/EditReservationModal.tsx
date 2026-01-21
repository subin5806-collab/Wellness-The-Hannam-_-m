import React, { useState, useEffect } from 'react';
import { db } from '../../../db';
import { Member, Program, Manager, Reservation, Category } from '../../../types';

interface EditReservationModalProps {
    reservation: Reservation;
    onClose: () => void;
    onSuccess: () => void;
}

const EditReservationModal: React.FC<EditReservationModalProps> = ({ reservation, onClose, onSuccess }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [resData, setResData] = useState({
        date: reservation.date,
        time: reservation.time,
        programId: reservation.programId,
        managerId: reservation.managerId || '',
        status: reservation.status
    });

    const [programs, setPrograms] = useState<Program[]>([]);
    const [managers, setManagers] = useState<Manager[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedParent, setSelectedParent] = useState<string | null>(null);
    const [selectedSubgroup, setSelectedSubgroup] = useState<string | null>(null);

    useEffect(() => {
        loadOptions();
    }, []);

    // Initialize selection based on existing program
    useEffect(() => {
        if (programs.length > 0 && categories.length > 0 && resData.programId && !selectedSubgroup) {
            const prog = programs.find(p => p.id === resData.programId);
            if (prog?.categoryId) {
                const sub = categories.find(c => c.id === prog.categoryId);
                if (sub) {
                    setSelectedSubgroup(sub.id);
                    if (sub.parentId) setSelectedParent(sub.parentId);
                }
            }
        }
    }, [programs, categories, resData.programId]);

    const loadOptions = async () => {
        const [p, m, c] = await Promise.all([
            db.master.programs.getAll(),
            db.master.managers.getAll(),
            db.categories.getAll()
        ]);
        setPrograms(p);
        setManagers(m);
        setCategories(c);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            await db.system.logAdminAction('UPDATE_RESERVATION', reservation.memberId, `Reservation Updated: ${reservation.id}`, 'reservation', reservation, resData);
            await db.reservations.update(reservation.id, resData);
            alert('예약 수정이 완료되었습니다.');
            onSuccess();
            onClose();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-10">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h2 className="text-2xl font-bold text-[#2F3A32]">Edit Reservation</h2>
                            <p className="text-[10px] text-[#A58E6F] font-bold uppercase tracking-widest mt-1">예약 정보 수정</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">예약 날짜</label>
                                <input type="date" required className="w-full px-5 py-4 bg-slate-50 border rounded-2xl outline-none font-bold" value={resData.date} onChange={e => setResData({ ...resData, date: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">예약 시간</label>
                                <input type="time" required className="w-full px-5 py-4 bg-slate-50 border rounded-2xl outline-none font-bold" value={resData.time} onChange={e => setResData({ ...resData, time: e.target.value })} />
                            </div>
                        </div>

                        {/* Category & Program Selection */}
                        <div className="space-y-3 bg-slate-50 p-5 rounded-3xl border border-slate-100">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2 mb-2 block">프로그램 찾기 (카테고리)</label>
                                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                                    <button type="button" onClick={() => setSelectedParent(null)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${!selectedParent ? 'bg-[#2F3A32] text-white' : 'bg-white border text-slate-500 hover:bg-slate-100'}`}>전체</button>
                                    {categories.filter(c => !c.parentId).map(c => (
                                        <button key={c.id} type="button" onClick={() => { setSelectedParent(c.id); setSelectedSubgroup(null); }} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${selectedParent === c.id ? 'bg-[#2F3A32] text-white' : 'bg-white border text-slate-500 hover:bg-slate-100'}`}>
                                            {c.name}
                                        </button>
                                    ))}
                                </div>
                                {selectedParent && (
                                    <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1">
                                        <button type="button" onClick={() => setSelectedSubgroup(null)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${!selectedSubgroup ? 'bg-emerald-100 text-emerald-700' : 'bg-white border text-slate-400 hover:bg-slate-50'}`}>전체</button>
                                        {categories.filter(c => c.parentId === selectedParent).map(c => (
                                            <button key={c.id} type="button" onClick={() => setSelectedSubgroup(c.id)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${selectedSubgroup === c.id ? 'bg-emerald-100 text-emerald-700' : 'bg-white border text-slate-400 hover:bg-slate-50'}`}>
                                                {c.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-4 pt-2">
                                <div className="space-y-1">
                                    <select
                                        required
                                        className="w-full px-5 py-4 bg-white border rounded-2xl outline-none font-bold text-sm shadow-sm focus:ring-2 focus:ring-[#2F3A32]/20"
                                        value={resData.programId}
                                        onChange={e => setResData({ ...resData, programId: e.target.value })}
                                    >
                                        <option value="">
                                            {selectedSubgroup ? `선택된 소그룹 프로그램 (${programs.filter(p => p.categoryId === selectedSubgroup).length})` :
                                                selectedParent ? `선택된 분류 프로그램 (${programs.filter(p => !p.categoryId || categories.find(c => c.id === p.categoryId)?.parentId === selectedParent).length})` :
                                                    '프로그램 선택 (전체)'}
                                        </option>
                                        {programs
                                            .filter(p => {
                                                if (selectedSubgroup) return p.categoryId === selectedSubgroup;
                                                if (selectedParent) {
                                                    // Show programs in this parent (via subgroup)
                                                    if (!p.categoryId) return false;
                                                    const cat = categories.find(c => c.id === p.categoryId);
                                                    return cat?.parentId === selectedParent;
                                                }
                                                return true;
                                            })
                                            .map(p => <option key={p.id} value={p.id}>{p.name} ({p.durationMinutes}분)</option>)
                                        }
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">배정 관리사</label>
                            <select required className="w-full px-5 py-4 bg-slate-50 border rounded-2xl outline-none font-bold" value={resData.managerId} onChange={e => setResData({ ...resData, managerId: e.target.value })}>
                                <option value="">관리사 선택</option>
                                {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">진행 상태</label>
                            <select required className="w-full px-5 py-4 bg-slate-50 border rounded-2xl outline-none font-bold" value={resData.status} onChange={e => setResData({ ...resData, status: e.target.value as any })}>
                                <option value="RESERVED">예약 확정</option>
                                <option value="COMPLETED">이용 완료</option>
                                <option value="CANCELLED">취소됨</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            disabled={isProcessing}
                            className="w-full py-5 bg-[#2F3A32] text-white rounded-[24px] font-bold uppercase tracking-widest text-[11px] shadow-xl hover:bg-[#1A3C34] transition-all"
                        >
                            {isProcessing ? '수정 중...' : '변경사항 저장하기'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EditReservationModal;
