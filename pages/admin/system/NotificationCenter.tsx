import React, { useState, useEffect } from 'react';
import { db, supabase } from '../../../db';
import { Member } from '../../../types';
import { FcmService } from '../../../src/firebase';

export default function NotificationCenter() {
    const [activeTab, setActiveTab] = useState<'COMPOSE' | 'AUTO' | 'HISTORY'>('COMPOSE');
    const [members, setMembers] = useState<Member[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [pushTokens, setPushTokens] = useState<Set<string>>(new Set());

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

    // Filtered Members Logic
    const filteredMembers = members.filter(m =>
        m.name.includes(searchTerm) ||
        (m.phone && m.phone.includes(searchTerm))
    );

    useEffect(() => {
        fetchData();
        loadSettings();
    }, []);

    useEffect(() => {
        if (activeTab === 'HISTORY') {
            setIsLoading(true);
            (db.notifications as any).getAllAdmin().then((data: any) => {
                setHistory(data || []);
                setIsLoading(false);
            });
        }
    }, [activeTab]);

    const loadSettings = async () => {
        const { data } = await supabase.from('hannam_system_settings').select('setting_value').eq('setting_key', 'NOTIFICATION_CONFIG').single();
        if (data?.setting_value) {
            setAutoConfig(data.setting_value);
        }
    };

    const saveSettings = async (newConfig: any) => {
        const { error } = await supabase.from('hannam_system_settings').upsert({
            setting_key: 'NOTIFICATION_CONFIG',
            setting_value: newConfig,
            updated_at: new Date().toISOString()
        });
        if (error) alert('설정 저장 실패: ' + error.message);
        else alert('설정이 저장되었습니다.');
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [allMembers, tokens] = await Promise.all([
                db.members.getAll(),
                db.fcmTokens.getAllAdmin()
            ]);
            setMembers(allMembers || []);
            setPushTokens(new Set(tokens || []));
        } finally {
            setIsLoading(false);
        }
    };

    const [isUploading, setIsUploading] = useState(false);
    const [previewMode, setPreviewMode] = useState<'PUSH' | 'POPUP'>('PUSH');

    // ... (toggleMemberSelection)

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            // [Sanitization] Force English/Numeric Filename
            const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
            const cleanFileName = `notice_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

            // Upload to 'uploads' folder in 'notifications' bucket
            const url = await db.system.uploadFile('notifications', `uploads/${cleanFileName}`, file);
            if (url) {
                setComposeForm(prev => ({ ...prev, imageUrl: url }));
            }
        } catch (error) {
            console.error('Image upload failed:', error);
            alert('이미지 업로드에 실패했습니다. (스토리지 설정을 확인해주세요)');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSend = async () => {
        const { title, body, channels, selectedMemberIds, targetMode, linkUrl, imageUrl } = composeForm;

        // Validation
        if (!Object.values(channels).some(v => v)) return alert('최소 하나의 발송 채널을 선택해주세요.');
        if (!title || !body) return alert('제목과 내용을 입력해주세요.');
        if (targetMode === 'INDIVIDUAL' && selectedMemberIds.size === 0) return alert('대상 회원을 선택해주세요.');

        const targetCount = targetMode === 'ALL' ? members.length : selectedMemberIds.size;
        const channelNames = Object.entries(channels).filter(([_, v]) => v).map(([k]) => k.toUpperCase()).join(', ');

        if (confirm(`[${channelNames}] 채널로 총 ${targetCount}명에게 발송하시겠습니까?`)) {
            try {
                let noticeId = null;

                // 1. Create Notice / Popup (DB Persistence)
                // If Notice or Popup is selected, we create a record in 'hannam_notices'
                if (channels.notice || channels.popup) {
                    const noticeData = {
                        title,
                        content: body,
                        imageUrl: imageUrl || null,
                        category: 'NOTICE', // Default category
                        isPopup: channels.popup, // If popup is selected, mark as popup
                        isAlertOn: channels.push, // Logic: If push is also selected, we mark it. (Optional logic)
                        startDate: new Date().toISOString().split('T')[0],
                        endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0], // Default 1 month
                    };

                    const newNotice = await db.notices.add(noticeData);
                    noticeId = newNotice?.id;
                }

                // 2. Send App Push (API Dispatch)
                if (channels.push) {
                    let targets: { token: string, memberId: string }[] = [];

                    try {
                        if (targetMode === 'ALL') {
                            // [BULK] Fetch ALL tokens with Member IDs
                            const { data } = await supabase.from('hannam_fcm_tokens').select('token, member_id');
                            if (data) targets = data.map(r => ({ token: r.token, memberId: r.member_id }));
                            console.log(`[Push] Fetched ${targets.length} targets for ALL members.`);
                        } else {
                            // [INDIVIDUAL] Fetch tokens for specific members
                            const selectedIds = Array.from(selectedMemberIds);
                            // We need to query by member_id
                            const { data } = await supabase.from('hannam_fcm_tokens')
                                .select('token, member_id')
                                .in('member_id', selectedIds);

                            if (data) targets = data.map(r => ({ token: r.token, memberId: r.member_id }));
                        }

                        if (targets.length === 0) {
                            console.warn("No FCM tokens found for selected targets.");
                        } else {
                            // [PERSISTENCE] Save to 'hannam_notifications' for Personal Alarm Center (Client Side)
                            // Note: The API also logs to 'notification_logs' (Server Side Audit), 
                            // but 'hannam_notifications' is for the User App's list view.
                            let targetMemberIds = Array.from(new Set(targets.map(t => t.memberId)));

                            if (targetMemberIds.length > 0) {
                                // Filter out 'UNKNOWN' if any
                                targetMemberIds = targetMemberIds.filter(id => id && id !== 'UNKNOWN');

                                const notiRows = targetMemberIds.map(mid => ({
                                    id: `NOTI-${Date.now()}-${mid.slice(-4)}`, // Unique ID
                                    member_id: mid,
                                    type: 'PUSH',
                                    title,
                                    content: body,
                                    is_read: false,
                                    created_at: new Date().toISOString()
                                }));

                                // Clean up old notifications logic if needed? 
                                // No, just insert.
                                await supabase.from('hannam_notifications').insert(notiRows);
                            }

                            // [API CALL]
                            const res = await fetch('/api/push/send', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    title,
                                    body,
                                    targets: targets, // [NEW] Send Full Target Info
                                    data: {
                                        url: linkUrl,
                                        image: imageUrl,
                                        noticeId: noticeId
                                    }
                                })
                            });

                            const resJson = await res.json();
                            console.log('[Push API Result]', resJson);
                        }

                    } catch (err: any) {
                        console.error("Token Fetch Error:", err);
                        alert(`토큰 조회 중 오류: ${err.message}`);
                    }
                }

                alert('통합 발송 처리가 완료되었습니다.');
                // Reset Form
                setComposeForm(prev => ({
                    ...prev,
                    title: '',
                    body: '',
                    imageUrl: '',
                    linkUrl: '',
                    selectedMemberIds: new Set()
                }));
            } catch (e: any) {
                console.error(e);
                alert('발송 중 오류가 발생했습니다: ' + e.message);
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
            {/* ... Header ... */}

            {activeTab === 'COMPOSE' && (
                <div className="grid grid-cols-12 gap-8">
                    {/* Left: Compose Form */}
                    <div className="col-span-8 space-y-6">
                        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 space-y-8">

                            {/* Channel Selector */}
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">발송 채널 선택 (다중 선택 가능)</label>
                                <div className="flex gap-4">
                                    {[
                                        { id: 'push', label: '📱 앱 푸시 (App Push)', desc: '스마트폰 상단바 알림' },
                                        { id: 'notice', label: '📢 공지사항 (Notice)', desc: '앱 내 공지 게시판 등록' },
                                        { id: 'popup', label: '🔔 인앱 팝업 (Popup)', desc: '앱 실행 시 메인 팝업' }
                                    ].map(ch => (
                                        <div key={ch.id}
                                            onClick={() => setComposeForm(prev => ({ ...prev, channels: { ...prev.channels, [ch.id]: !prev.channels[ch.id as keyof typeof prev.channels] } }))}
                                            className={`flex-1 p-4 rounded-2xl border-2 cursor-pointer transition-all ${composeForm.channels[ch.id as keyof typeof composeForm.channels] ? 'border-[#2F3A32] bg-[#F9FAFB]' : 'border-slate-50 hover:border-slate-200'}`}
                                        >
                                            <div className="flex items-center gap-3 mb-1">
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${composeForm.channels[ch.id as keyof typeof composeForm.channels] ? 'bg-[#2F3A32] text-white' : 'bg-slate-100 text-slate-300'}`}>
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
                                <div className="flex justify-between items-center">
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
                                    {composeForm.targetMode === 'INDIVIDUAL' && (
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="이름 또는 전화번호 검색..."
                                                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-[#2F3A32] transition-colors w-64"
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                            />
                                            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        </div>
                                    )}
                                </div>

                                {/* Individual Selector */}
                                {composeForm.targetMode === 'INDIVIDUAL' && (
                                    <div className="h-64 overflow-y-auto border border-slate-100 rounded-2xl p-2 bg-slate-50/50 mt-4 custom-scrollbar">
                                        {filteredMembers.length > 0 ? (
                                            filteredMembers.map(m => (
                                                <div key={m.id} onClick={() => toggleMemberSelection(m.id)} className="flex items-center justify-between py-3 px-4 hover:bg-white rounded-xl cursor-pointer transition-all group mb-1">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${composeForm.selectedMemberIds.has(m.id) ? 'bg-[#2F3A32] border-[#2F3A32] shadow-sm' : 'border-slate-300 bg-white group-hover:border-[#2F3A32]'}`}>
                                                            {composeForm.selectedMemberIds.has(m.id) && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-sm font-bold ${composeForm.selectedMemberIds.has(m.id) ? 'text-[#2F3A32]' : 'text-slate-600'}`}>{m.name}</span>
                                                                {pushTokens.has(m.id) && (
                                                                    <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold border border-indigo-100 flex items-center gap-1">
                                                                        🔔 APP
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-xs text-slate-400 font-mono tracking-wide">{m.phone}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-2">
                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                <span className="text-xs font-bold">검색 결과가 없습니다.</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Content Form */}
                            <div className="space-y-6 pt-4 border-t border-slate-50">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">제목</label>
                                    <input
                                        type="text"
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-bold text-lg outline-none focus:ring-2 focus:ring-[#2F3A32]/10 transition-shadow"
                                        placeholder="알림 제목을 입력하세요"
                                        value={composeForm.title}
                                        onChange={e => setComposeForm(prev => ({ ...prev, title: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">내용</label>
                                    <textarea
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-medium text-sm outline-none focus:ring-2 focus:ring-[#2F3A32]/10 h-32 resize-none leading-relaxed transition-shadow"
                                        placeholder="전달할 내용을 입력하세요..."
                                        value={composeForm.body}
                                        onChange={e => setComposeForm(prev => ({ ...prev, body: e.target.value }))}
                                    />
                                </div>

                                {/* Advanced Fields */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">이미지 첨부 (Image Upload)</label>
                                        <div className="relative">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                id="image-upload"
                                                className="hidden"
                                                onChange={handleImageUpload}
                                            />
                                            <label
                                                htmlFor="image-upload"
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-50 hover:border-[#2F3A32] transition-all flex items-center justify-between group"
                                            >
                                                <span className="truncate">{composeForm.imageUrl ? '이미지가 선택되었습니다' : '클릭하여 이미지를 업로드하세요...'}</span>
                                                <svg className="w-4 h-4 text-slate-400 group-hover:text-[#2F3A32]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            </label>
                                        </div>
                                        {isUploading && <p className="text-[10px] text-[#2F3A32] font-bold animate-pulse mt-1">이미지 업로드 중...</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Deep Link (이동 URL) <span className="text-xs italic normal-case opacity-50 ml-1">* Optional</span></label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-[#2F3A32] transition-colors"
                                            placeholder="https://..."
                                            value={composeForm.linkUrl}
                                            onChange={e => setComposeForm(prev => ({ ...prev, linkUrl: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Preview & Action */}
                    <div className="col-span-4 space-y-6">
                        <div className="bg-[#111] text-white p-6 rounded-[40px] shadow-2xl relative overflow-hidden min-h-[600px] flex flex-col">
                            {/* Device Notch */}
                            <div className="absolute top-0 left-0 w-full h-8 bg-black/50 backdrop-blur-md z-10 flex justify-center items-center">
                                <div className="w-20 h-5 bg-black rounded-b-xl"></div>
                            </div>

                            {/* Preview Mode Toggle */}
                            <div className="absolute top-10 right-4 z-20 flex bg-white/10 rounded-lg p-0.5 backdrop-blur-sm">
                                <button
                                    onClick={() => setPreviewMode('PUSH')}
                                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${previewMode === 'PUSH' ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'}`}
                                >
                                    PUSH
                                </button>
                                <button
                                    onClick={() => setPreviewMode('POPUP')}
                                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${previewMode === 'POPUP' ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'}`}
                                >
                                    POPUP
                                </button>
                            </div>

                            {/* Preview Content */}
                            <div className="flex-1 mt-16 px-2 relative">
                                {previewMode === 'PUSH' ? (
                                    <>
                                        {/* Lock Screen Time */}
                                        <div className="text-center mb-8">
                                            <div className="text-5xl font-thin tracking-tighter text-white/90">09:41</div>
                                            <div className="text-sm font-medium text-white/60 mt-1">Wednesday, October 15</div>
                                        </div>

                                        {/* Push Notification Card */}
                                        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/5 shadow-2xl">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-5 h-5 bg-[#D4AF37] rounded-md flex items-center justify-center text-[10px] font-bold text-black border border-[#C5A027]">W</div>
                                                <span className="text-[10px] uppercase font-bold text-white/90 tracking-wide">웰니스, 더 한남</span>
                                                <span className="text-[9px] text-white/40 ml-auto">Now</span>
                                            </div>
                                            <h4 className="text-sm font-bold text-white mb-1 leading-snug">{composeForm.title || '(제목 미리보기)'}</h4>
                                            <p className="text-xs text-white/80 leading-relaxed opacity-90">{composeForm.body || '(내용이 여기에 표시됩니다)'}</p>
                                            {composeForm.imageUrl && (
                                                <div className="mt-3 rounded-lg overflow-hidden h-32 bg-cover bg-center border border-white/5 shadow-inner" style={{ backgroundImage: `url(${composeForm.imageUrl})` }}></div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    /* Popup Preview */
                                    <div className="absolute inset-0 flex items-center justify-center p-4">
                                        <div className="w-full bg-white text-black rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                                            {composeForm.imageUrl ? (
                                                <div className="h-40 bg-cover bg-center" style={{ backgroundImage: `url(${composeForm.imageUrl})` }}></div>
                                            ) : (
                                                <div className="h-20 bg-slate-100 flex items-center justify-center text-slate-300 text-xs">No Image</div>
                                            )}
                                            <div className="p-5 text-center">
                                                <h4 className="text-lg font-bold text-[#2F3A32] mb-2">{composeForm.title || '(제목)'}</h4>
                                                <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap">{composeForm.body || '(내용...)'}</p>
                                                <button className="mt-5 w-full py-3 bg-[#2F3A32] text-white rounded-xl text-sm font-bold">확인</button>
                                                <div className="mt-3 flex justify-between text-[10px] text-slate-400">
                                                    <span>오늘 하루 보지 않기</span>
                                                    <span>닫기</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="absolute inset-x-0 bottom-full h-full bg-black/40 -z-10 backdrop-blur-sm"></div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-auto pt-6 pb-2 px-4">
                                <button
                                    onClick={handleSend}
                                    disabled={isUploading}
                                    className="w-full py-4 bg-white text-black rounded-2xl font-bold hover:bg-[#D4AF37] hover:text-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    <span className="group-hover:scale-105 inline-block transition-transform">
                                        {isUploading ? '업로드 중...' : '통합 발송하기 (SEND)'}
                                    </span>
                                </button>
                                <p className="text-[9px] text-white/30 mt-4 font-mono text-center">
                                    선택된 채널: {Object.entries(composeForm.channels).filter(([_, v]) => v).map(([k]) => k.toUpperCase()).join(' + ')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'AUTO' && (
                <div className="bg-white p-12 rounded-[40px] border border-slate-100 space-y-12">
                    {/* Visit Reminder */}
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <h4 className="text-xl font-bold text-[#2F3A32]">📅 예약 방문 자동 알림</h4>
                            <p className="text-sm text-slate-400">예약일 하루 전, 자동으로 방문 리마인드 푸시를 발송합니다.</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <select
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
                        </div>
                    </div>

                    {/* Etiquette Mode */}
                    <div className="flex items-start justify-between pt-8 border-t border-slate-50">
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
                    </div>

                    {/* Save Button */}
                    <div className="pt-8 text-right">
                        <button onClick={() => saveSettings(autoConfig)} className="px-8 py-4 bg-[#2F3A32] text-white rounded-2xl font-bold shadow-lg hover:bg-[#1A3C34] transition-all">설정 저장 (Save Config)</button>
                    </div>
                </div>
            )}

            {activeTab === 'HISTORY' && (
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
                            {isLoading ? (
                                <tr><td colSpan={4} className="py-20 text-center text-slate-300 italic">로딩 중...</td></tr>
                            ) : history.length === 0 ? (
                                <tr><td colSpan={4} className="py-20 text-center text-slate-300 italic">아직 발송된 이력이 없습니다.</td></tr>
                            ) : (
                                history.map((item: any) => (
                                    <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                                        <td className="py-4 font-bold text-[#2F3A32] tabular-nums text-xs">
                                            {item.createdAt?.replace('T', ' ').slice(0, 16)}
                                        </td>
                                        <td className="py-4">
                                            <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-500 uppercase">{item.type || 'PUSH'}</span>
                                        </td>
                                        <td className="py-4">
                                            <div className="font-bold text-[#2F3A32] text-sm">{item.title}</div>
                                            <div className="text-xs text-slate-400 line-clamp-1">{item.content}</div>
                                        </td>
                                        <td className="py-4 text-right">
                                            <div className="flex items-center justify-end gap-4">
                                                <div className="text-right">
                                                    <div className="text-xs font-bold text-[#1A3C34]">{item.member?.name || (item.memberId === 'ALL' ? '전체' : item.memberId)}</div>
                                                    <div className="text-[10px] text-slate-300">{item.member?.phone}</div>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        if (confirm('이 알림을 삭제하시겠습니까?\n(회원 앱에서도 즉시 삭제됩니다)')) {
                                                            try {
                                                                await db.notifications.delete(item.id);
                                                                setHistory(prev => prev.filter((h: any) => h.id !== item.id));
                                                            } catch (e) {
                                                                alert('삭제 실패');
                                                            }
                                                        }
                                                    }}
                                                    className="p-2 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
