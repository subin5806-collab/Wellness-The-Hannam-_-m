import React, { useState, useEffect } from 'react';
import { db } from '../../../db';
import { Member, Program, Manager, Reservation } from '../../../types';

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

    useEffect(() => {
        loadOptions();
    }, []);

    const loadOptions = async () => {
        setPrograms(await db.master.programs.getAll());
        setManagers(await db.master.managers.getAll());
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

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">관리 프로그램</label>
                            <select required className="w-full px-5 py-4 bg-slate-50 border rounded-2xl outline-none font-bold" value={resData.programId} onChange={e => setResData({ ...resData, programId: e.target.value })}>
                                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
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
