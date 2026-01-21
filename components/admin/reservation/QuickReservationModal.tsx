import React, { useState, useEffect } from 'react';
import { db } from '../../../db';
import { Member, Program, Manager, Category } from '../../../types';

interface QuickReservationModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const QuickReservationModal: React.FC<QuickReservationModalProps> = ({ onClose, onSuccess }) => {
    const [activeTab, setActiveTab] = useState<'EXISTING' | 'NEW'>('EXISTING');
    const [isProcessing, setIsProcessing] = useState(false);

    // Member Selection (Existing)
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Member[]>([]);
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);

    // New Guest Data
    const [newGuest, setNewGuest] = useState({ name: '', phone: '', gender: '여성' as any });

    // Reservation Common Data
    const [resData, setResData] = useState({
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        programId: '',
        managerId: ''
    });

    const [programs, setPrograms] = useState<Program[]>([]);
    const [managers, setManagers] = useState<Manager[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedParent, setSelectedParent] = useState<string | null>(null);
    const [selectedSubgroup, setSelectedSubgroup] = useState<string | null>(null);

    useEffect(() => {
        loadOptions();
    }, []);

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

    const handleSearch = async () => {
        if (!searchQuery) return;
        const allMembers = await db.members.getAll();
        const filtered = allMembers.filter(m =>
            m.name.includes(searchQuery) || m.phone.includes(searchQuery)
        );
        setSearchResults(filtered);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resData.programId) return alert('프로그램을 선택해주세요.');

        setIsProcessing(true);
        try {
            let targetMemberId = selectedMember?.id;

            if (activeTab === 'NEW') {
                if (!newGuest.name || !newGuest.phone) throw new Error('방문객 정보를 입력해주세요.');
                const newMember = await db.members.add({
                    ...newGuest,
                    initialPasswordSet: false
                });
                targetMemberId = newMember.id;
            }

            if (!targetMemberId) throw new Error('회원을 선택하거나 등록해야 합니다.');

            await db.reservations.add({
                memberId: targetMemberId,
                ...resData
            });

            alert('예약이 완료되었습니다.');
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
            <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-10">
                    <div className="flex justify-between items-start mb-10">
                        <div>
                            <h2 className="text-2xl font-bold text-[#2F3A32]">Quick Reservation</h2>
                            <p className="text-[10px] text-[#A58E6F] font-bold uppercase tracking-widest mt-1">간편 예약 시스템</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl mb-8">
                        <button
                            onClick={() => setActiveTab('EXISTING')}
                            className={`flex-1 py-3 rounded-xl text-[12px] font-bold transition-all ${activeTab === 'EXISTING' ? 'bg-white text-[#2F3A32] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >기존 회원 예약</button>
                        <button
                            onClick={() => setActiveTab('NEW')}
                            className={`flex-1 py-3 rounded-xl text-[12px] font-bold transition-all ${activeTab === 'NEW' ? 'bg-white text-[#2F3A32] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >신규 방문 예약</button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {activeTab === 'EXISTING' ? (
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 px-5 py-4 bg-slate-50 border rounded-2xl outline-none font-bold"
                                        placeholder="회원 성함 또는 연락처 검색"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                    <button type="button" onClick={handleSearch} className="px-6 bg-[#2F3A32] text-white rounded-2xl font-bold text-sm">검색</button>
                                </div>
                                {searchResults.length > 0 && !selectedMember && (
                                    <div className="max-h-40 overflow-y-auto border rounded-2xl bg-white shadow-inner divide-y">
                                        {searchResults.map(m => (
                                            <div
                                                key={m.id}
                                                onClick={() => { setSelectedMember(m); setSearchResults([]); }}
                                                className="p-5 hover:bg-[#FDFCFB] cursor-pointer transition-colors flex justify-between items-center group"
                                            >
                                                <div>
                                                    <span className="font-bold text-[#2F3A32]">{m.name}</span>
                                                    <span className="text-slate-400 text-xs ml-3">{m.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}</span>
                                                </div>
                                                <span className="text-[10px] font-bold text-[#A58E6F] opacity-0 group-hover:opacity-100 transition-opacity">선택하기 →</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {searchResults.length === 0 && searchQuery && !selectedMember && (
                                    <p className="text-center py-4 text-xs text-slate-400 italic">검색 결과가 없습니다.</p>
                                )}
                                {selectedMember && (
                                    <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex justify-between items-center animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">👤</div>
                                            <div>
                                                <span className="font-bold text-emerald-900 text-lg">{selectedMember.name}</span>
                                                <p className="text-emerald-600 text-[10px] font-bold uppercase tracking-widest mt-0.5">{selectedMember.phone}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedMember(null)} className="p-2 text-emerald-300 hover:text-emerald-500 transition-colors">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">방문객 성함</label>
                                    <input required className="w-full px-5 py-4 bg-slate-50 border rounded-2xl outline-none font-bold" placeholder="홍길동" value={newGuest.name} onChange={e => setNewGuest({ ...newGuest, name: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">연락처</label>
                                    <input required className="w-full px-5 py-4 bg-slate-50 border rounded-2xl outline-none font-bold" placeholder="010-0000-0000" value={newGuest.phone} onChange={e => setNewGuest({ ...newGuest, phone: e.target.value })} />
                                </div>
                            </div>
                        )}

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

                        <button
                            type="submit"
                            disabled={isProcessing}
                            className="w-full py-5 bg-[#2F3A32] text-white rounded-[24px] font-bold uppercase tracking-widest text-[11px] shadow-xl hover:bg-[#1A3C34] transition-all"
                        >
                            {isProcessing ? '처리 중...' : '예약 확정하기'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default QuickReservationModal;
