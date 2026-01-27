import React, { useState, useEffect } from 'react';
import { db } from '../../../db';
import { Member } from '../../../types';
import { FcmService } from '../../../src/firebase';

export default function NotificationCenter() {
    const [activeTab, setActiveTab] = useState<'COMPOSE' | 'AUTO' | 'HISTORY'>('COMPOSE');
    const [members, setMembers] = useState<Member[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Compose State
    const [composeForm, setComposeForm] = useState({
        title: '',
        body: '',
        imageUrl: '',
        linkUrl: '',
        channels: { push: true, notice: false, popup: false },
        targetMode: 'ALL' as 'ALL' | 'INDIVIDUAL',
        selectedMemberIds: new Set<string>()
    });

    // Auto Config State
    const [autoConfig, setAutoConfig] = useState({
        visitReminder: { enabled: true, time: '09:00', timing: '1_DAY_BEFORE' },
        etiquette: { enabled: true, start: '22:00', end: '08:00' }
    });

    useEffect(() => {
        fetchData();
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const { data } = await supabase.from('hannam_system_settings').select('value').eq('key', 'NOTIFICATION_CONFIG').single();
        if (data?.value) {
            setAutoConfig(data.value);
        }
    };

    const saveSettings = async (newConfig: any) => {
        const { error } = await supabase.from('hannam_system_settings').upsert({
            key: 'NOTIFICATION_CONFIG',
            value: newConfig,
            updated_at: new Date().toISOString()
        });
        if (error) alert('설정 저장 실패: ' + error.message);
        else alert('설정이 저장되었습니다.');
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const allMembers = await db.members.getAll();
            setMembers(allMembers || []);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async () => {
        const { title, body, channels, selectedMemberIds, targetMode, linkUrl, imageUrl } = composeForm;
        if (!title || !body) return alert('제목과 내용을 입력해주세요.');
        if (targetMode === 'INDIVIDUAL' && selectedMemberIds.size === 0) return alert('대상 회원을 선택해주세요.');

        if (confirm('정말로 발송하시겠습니까?')) {
            try {
                // 1. Send Push
                if (channels.push) {
                    const tokensToUse = ['mock-token']; // Replace with real selection logic
                    await fetch('/api/push/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title, body, tokens: tokensToUse, data: { url: linkUrl, image: imageUrl } })
                    });
                }

                // 2. Create Notice / Popup
                if (channels.notice || channels.popup) {
                    const noticeData = {
                        title,
                        content: body, // Simplified
                        isPopup: channels.popup,
                        // ... other fields
                    };
                    // await db.notices.add(noticeData); // Mock call
                }

                alert('발송 처리가 완료되었습니다.');
                setComposeForm(prev => ({ ...prev, title: '', body: '' }));
            } catch (e) {
                alert('발송 중 오류가 발생했습니다.');
            }
        }
    };

    const toggleMemberSelection = (id: string) => {
        const newSet = new Set(composeForm.selectedMemberIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setComposeForm(prev => ({ ...prev, selectedMemberIds: newSet }));
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-[#2F3A32]">통합 알림 센터</h2>
                    <p className="text-xs text-[#A58E6F] font-bold mt-1 uppercase tracking-widest">Integrated Notification Command Center</p>
                </div>
                <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-100">
                    {['COMPOSE', 'AUTO', 'HISTORY'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-6 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === tab ? 'bg-[#2F3A32] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {tab === 'COMPOSE' ? '통합 발송' : tab === 'AUTO' ? '자동화 설정' : '발송 이력'}
                        </button>
                    ))}
                </div>
            </header>

            {activeTab === 'COMPOSE' && (
                <div className="grid grid-cols-12 gap-8">
                    {/* Left: Compose Form */}
                    <div className="col-span-8 space-y-6">
                        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 space-y-8">

                            {/* Channel Selector */}
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">발송 채널 선택</label>
                                <div className="flex gap-4">
                                    {[
                                        { id: 'push', label: '📱 앱 푸시 (App Push)', desc: '상단바 알림' },
                                        { id: 'notice', label: '📢 공지사항 (Notice)', desc: '앱 내 게시판' },
                                        { id: 'popup', label: '🔔 팝업 (Popup)', desc: '메인 팝업 띄우기' }
                                    ].map(ch => (
                                        <div key={ch.id}
                                            onClick={() => setComposeForm(prev => ({ ...prev, channels: { ...prev.channels, [ch.id]: !prev.channels[ch.id as keyof typeof prev.channels] } }))}
                                            className={`flex-1 p-4 rounded-2xl border-2 cursor-pointer transition-all ${composeForm.channels[ch.id as keyof typeof composeForm.channels] ? 'border-[#2F3A32] bg-[#F9FAFB]' : 'border-slate-50 hover:border-slate-200'}`}
                                        >
                                            <div className="flex items-center gap-3 mb-1">
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${composeForm.channels[ch.id as keyof typeof composeForm.channels] ? 'bg-[#2F3A32] text-white' : 'bg-slate-100 text-slate-300'}`}>
                                                    {composeForm.channels[ch.id as keyof typeof composeForm.channels] && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                                                </div>
                                                <span className={`font-bold ${composeForm.channels[ch.id as keyof typeof composeForm.channels] ? 'text-[#2F3A32]' : 'text-slate-400'}`}>{ch.label}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 pl-8">{ch.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Target Selector */}
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">수신 대상</label>
                                <div className="flex gap-6 p-1 bg-slate-50 rounded-xl w-fit">
                                    <button
                                        onClick={() => setComposeForm(prev => ({ ...prev, targetMode: 'ALL' }))}
                                        className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${composeForm.targetMode === 'ALL' ? 'bg-white shadow-sm text-[#2F3A32]' : 'text-slate-400'}`}
                                    >
                                        전체 회원 ({members.length})
                                    </button>
                                    <button
                                        onClick={() => setComposeForm(prev => ({ ...prev, targetMode: 'INDIVIDUAL' }))}
                                        className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${composeForm.targetMode === 'INDIVIDUAL' ? 'bg-white shadow-sm text-[#2F3A32]' : 'text-slate-400'}`}
                                    >
                                        개별 선택 ({composeForm.selectedMemberIds.size})
                                    </button>
                                </div>

                                {/* Individual Selector */}
                                {composeForm.targetMode === 'INDIVIDUAL' && (
                                    <div className="h-48 overflow-y-auto border border-slate-100 rounded-2xl p-4 bg-slate-50/50 mt-4">
                                        {members.map(m => (
                                            <div key={m.id} onClick={() => toggleMemberSelection(m.id)} className="flex items-center justify-between py-2 px-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${composeForm.selectedMemberIds.has(m.id) ? 'bg-[#2F3A32] border-[#2F3A32]' : 'border-slate-300'}`}>
                                                        {composeForm.selectedMemberIds.has(m.id) && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-600">{m.name}</span>
                                                    <span className="text-xs text-slate-400">{m.phone}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Content Form */}
                            <div className="space-y-6 pt-4 border-t border-slate-50">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">제목</label>
                                    <input
                                        type="text"
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-bold text-lg outline-none focus:ring-2 focus:ring-[#2F3A32]/10"
                                        placeholder="알림 제목을 입력하세요"
                                        value={composeForm.title}
                                        onChange={e => setComposeForm(prev => ({ ...prev, title: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">내용</label>
                                    <textarea
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-medium text-sm outline-none focus:ring-2 focus:ring-[#2F3A32]/10 h-32 resize-none leading-relaxed"
                                        placeholder="전달할 내용을 입력하세요..."
                                        value={composeForm.body}
                                        onChange={e => setComposeForm(prev => ({ ...prev, body: e.target.value }))}
                                    />
                                </div>

                                {/* Advanced Fields */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Deep Link (이동 URL) <span className="text-xs italic normal-case opacity-50 ml-1">* Optional</span></label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-mono outline-none"
                                            placeholder="https:// or /admin/..."
                                            value={composeForm.linkUrl}
                                            onChange={e => setComposeForm(prev => ({ ...prev, linkUrl: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">이미지 URL <span className="text-xs italic normal-case opacity-50 ml-1">* Optional</span></label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-mono outline-none"
                                            placeholder="https://..."
                                            value={composeForm.imageUrl}
                                            onChange={e => setComposeForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Preview & Action */}
                    <div className="col-span-4 space-y-6">
                        <div className="bg-[#111] text-white p-6 rounded-[40px] shadow-2xl relative overflow-hidden min-h-[500px]">
                            <div className="absolute top-0 left-0 w-full h-8 bg-black/50 backdrop-blur-md z-10 flex justify-center items-center">
                                <div className="w-20 h-5 bg-black rounded-b-xl"></div>
                            </div>

                            {/* Push Preview */}
                            <div className="mt-12 mx-2 bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/5 relative overflow-hidden">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-5 h-5 bg-[#D4AF37] rounded-md flex items-center justify-center text-[10px] font-bold">W</div>
                                    <span className="text-[10px] uppercase font-bold text-white/80">Wellness Hannam</span>
                                    <span className="text-[9px] text-white/40 ml-auto">Now</span>
                                </div>
                                <h4 className="text-sm font-bold text-white mb-1">{composeForm.title || '(제목 미리보기)'}</h4>
                                <p className="text-xs text-white/70 leading-snug">{composeForm.body || '(내용이 여기에 표시됩니다)'}</p>
                                {composeForm.imageUrl && (
                                    <div className="mt-3 rounded-lg overflow-hidden h-24 bg-cover bg-center" style={{ backgroundImage: `url(${composeForm.imageUrl})` }}></div>
                                )}
                            </div>

                            <div className="mt-auto absolute bottom-8 left-0 w-full text-center px-8">
                                <button
                                    onClick={handleSend}
                                    className="w-full py-4 bg-white text-black rounded-2xl font-bold hover:bg-[#D4AF37] hover:text-white transition-all shadow-lg active:scale-95"
                                >
                                    발송하기 (SEND)
                                </button>
                                <p className="text-[9px] text-white/30 mt-4 font-mono">
                                    예상 발송 건수: {composeForm.targetMode === 'ALL' ? members.length : composeForm.selectedMemberIds.size}건
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'AUTO' && (
                                className="px-4 py-2 bg-slate-50 rounded-xl text-sm font-bold text-[#2F3A32] border border-slate-200 outline-none"
                                value={autoConfig.visitReminder.timing}
                                onChange={e => setAutoConfig(prev => ({ ...prev, visitReminder: { ...prev.visitReminder, timing: e.target.value } }))}
                            >
                                <option value="1_DAY_BEFORE">1일 전 (하루 전)</option>
                                <option value="1_HOUR_BEFORE">1시간 전</option>
                            </select>
                            <button
                                onClick={() => setAutoConfig(prev => ({ ...prev, visitReminder: { ...prev.visitReminder, enabled: !prev.visitReminder.enabled } }))}
                                className={`w-14 h-8 rounded-full transition-colors relative ${autoConfig.visitReminder.enabled ? 'bg-[#2F3A32]' : 'bg-slate-200'}`}
                            >
                                <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all shadow-sm ${autoConfig.visitReminder.enabled ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div >
                    </div >

        {/* Etiquette Mode */ }
        < div className = "flex items-start justify-between pt-8 border-t border-slate-50" >
                        <div className="space-y-1">
                            <h4 className="text-xl font-bold text-[#2F3A32]">🌙 에티켓 모드 (야간 발송 제한)</h4>
                            <p className="text-sm text-slate-400">설정된 시간대에는 자동 알림 발송을 제한합니다.</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                                <input type="time" value={autoConfig.etiquette.start} onChange={e => setAutoConfig(prev => ({ ...prev, etiquette: { ...prev.etiquette, start: e.target.value } }))} className="px-3 py-2 bg-slate-50 rounded-lg outline-none" />
                                <span>~</span>
                                <input type="time" value={autoConfig.etiquette.end} onChange={e => setAutoConfig(prev => ({ ...prev, etiquette: { ...prev.etiquette, end: e.target.value } }))} className="px-3 py-2 bg-slate-50 rounded-lg outline-none" />
                            </div>
                            <button
                                onClick={() => setAutoConfig(prev => ({ ...prev, etiquette: { ...prev.etiquette, enabled: !prev.etiquette.enabled } }))}
                                className={`w-14 h-8 rounded-full transition-colors relative ${autoConfig.etiquette.enabled ? 'bg-[#2F3A32]' : 'bg-slate-200'}`}
                            >
                                <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all shadow-sm ${autoConfig.etiquette.enabled ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>
                    </div >

        {/* Save Button */ }
        < div className = "pt-8 text-right" >
            <button onClick={() => saveSettings(autoConfig)} className="px-8 py-4 bg-[#2F3A32] text-white rounded-2xl font-bold shadow-lg hover:bg-[#1A3C34] transition-all">설정 저장 (Save Config)</button>
                    </div >
                </div >
            )
}

{
    activeTab === 'HISTORY' && (
        <div className="bg-white p-8 rounded-[32px] border border-slate-100">
            <table className="w-full text-left">
                <thead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50">
                    <tr>
                        <th className="pb-4">발송 일시</th>
                        <th className="pb-4">채널</th>
                        <th className="pb-4">제목</th>
                        <th className="pb-4 text-right">수신자 수</th>
                    </tr>
                </thead>
                <tbody className="text-sm font-medium text-slate-600">
                    <tr>
                        <td colSpan={4} className="py-20 text-center text-slate-300 italic">아직 발송된 이력이 없습니다.</td>
                    </tr>
                </tbody>
            </table>
        </div>
    )
}
        </div >
    );
}
