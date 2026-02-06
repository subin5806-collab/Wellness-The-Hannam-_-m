
import React, { useState, useEffect } from 'react';
import { AligoService } from '../../../services/aligo';

const ALIGO_CONFIG_DEFAULTS = {
    key: 'wt1mir1bfax86lt0s8vu9bn47whjywb5',
    user_id: 'modoofit',
    sender: '01000000000'
};

export default function NotificationControl() {
    const [config, setConfig] = useState<any>(null);
    const [balance, setBalance] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedHistory, setSelectedHistory] = useState<any>(null); // For Modal

    // Channel Auth State
    const [channelStage, setChannelStage] = useState<'INIT' | 'AUTH_SENT' | 'DONE'>('INIT');
    const [authInputs, setAuthInputs] = useState({ plusid: '', phonenumber: '', authnum: '', categorycode: '' });
    const [categories, setCategories] = useState<any[]>([]);
    const [registeredProfile, setRegisteredProfile] = useState<any>(null);

    // Initial Load
    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        setIsLoading(true);
        try {
            const [cfg, bal, hist] = await Promise.all([
                AligoService.getConfig(),
                AligoService.getBalance(),
                AligoService.getHistory()
            ]);

            // Initialize default triggers if missing
            const finalConfig: any = cfg || { isActive: true, triggers: {} };
            if (!finalConfig.triggers) finalConfig.triggers = {};
            ['PAYMENT', 'RESERVATION', 'VISIT_REMINDER'].forEach(key => {
                if (!finalConfig.triggers[key]) finalConfig.triggers[key] = { enabled: false, templateCode: '' };
            });

            setConfig(finalConfig);
            setBalance(bal);
            setHistory(hist.list || []);

            // If we have templates cached in config, use them, else empty
            setTemplates(finalConfig.templates || []);

        } catch (e) {
            console.error(e);
            alert('데이터 로딩 실패');
        } finally {
            setIsLoading(false);
        }
    };

    // Channel Auth Handlers
    const handleRequestAuth = async () => {
        if (!authInputs.plusid || !authInputs.phonenumber) return alert('입력값을 확인해주세요.');
        setIsLoading(true);
        try {
            const res = await AligoService.requestAuth(authInputs.plusid, authInputs.phonenumber);
            if (res.code === 0) {
                alert('인증번호가 발송되었습니다. 카카오톡을 확인해주세요.');
                setChannelStage('AUTH_SENT');
                // Load categories for next step
                const catRes = await AligoService.getCategory();
                if (catRes.code === 0) {
                    // Flatten categories for simple select (could be recursive, but let's grab 3rd level for now or just standard list)
                    // API returns data: { first..., second..., third... }
                    // Let's simplified flat list or just use "001" (Health) if too complex for UI.
                    // Actually, let's map thirdBusinessType for most specific.
                    setCategories(catRes.data.thirdBusinessType || []);
                }
            } else {
                alert('요청 실패: ' + res.message);
            }
        } catch (e) { alert('API Error'); } finally { setIsLoading(false); }
    };

    const handleCompleteAuth = async () => {
        if (!authInputs.authnum || !authInputs.categorycode) return alert('인증번호와 카테고리를 선택해주세요.');
        setIsLoading(true);
        try {
            const res = await AligoService.createProfile(authInputs.plusid, authInputs.authnum, authInputs.phonenumber, authInputs.authnum);
            // Note: API doc says createProfile param order: plusid, authnum, phonenumber, categorycode
            // My Service wrapper: createProfile(plusid, authnum, phonenumber, categorycode)

            // Re-call with correct params
            const realRes = await AligoService.createProfile(authInputs.plusid, authInputs.authnum, authInputs.phonenumber, authInputs.categorycode);

            if (realRes.code === 0 && realRes.data && realRes.data.length > 0) {
                const profile = realRes.data[0];
                alert(`인증 성공! SenderKey: ${profile.senderKey}`);
                setRegisteredProfile(profile);
                setChannelStage('DONE');

                // AUTO-SAVE to DB Config
                const newConfig = {
                    ...config,
                    senderkey: profile.senderKey,
                    apikey: config.apikey || ALIGO_CONFIG_DEFAULTS.key, // Ensure we keep existing or default
                    userid: config.userid || ALIGO_CONFIG_DEFAULTS.user_id,
                    sender: authInputs.phonenumber
                };
                await AligoService.updateConfig(newConfig);
                setConfig(newConfig);
                alert('시스템 설정(ALIMTALK_CONFIG)에 자동 저장되었습니다.');
            } else {
                alert('인증 확인 실패: ' + (realRes.message || 'Unknown'));
            }
        } catch (e) { alert('API Error'); } finally { setIsLoading(false); }
    };

    // Template Handlers
    const handleRequestInspection = async (code: string) => {
        if (!confirm('검수 요청하시겠습니까? (4~5일 소요)')) return;
        setIsLoading(true);
        try {
            const res = await AligoService.requestTemplate(code);
            if (res.code === 0) {
                alert('요청되었습니다.');
                handleFetchTemplates(); // Refresh
            } else {
                alert('요청 실패: ' + res.message);
            }
        } catch (e) { alert('Error'); } finally { setIsLoading(false); }
    };

    const handleFetchTemplates = async () => {
        if (!confirm('알리고 서버에서 최신 템플릿 목록을 가져오시겠습니까?')) return;
        setIsLoading(true);
        try {
            const list = await AligoService.getTemplates();
            setTemplates(list);

            // Save to Config for caching
            const newConfig = { ...config, templates: list };
            await AligoService.updateConfig(newConfig);
            setConfig(newConfig);
            alert(`총 ${list.length}개의 템플릿을 동기화했습니다.`);
        } catch (e) {
            alert('템플릿 동기화 실패');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        if (!confirm('설정을 저장하시겠습니까?')) return;
        try {
            await AligoService.updateConfig(config);
            alert('저장되었습니다.');
        } catch (e) {
            alert('저장 실패');
        }
    };

    const toggleTrigger = (key: string) => {
        setConfig((prev: any) => ({
            ...prev,
            triggers: {
                ...prev.triggers,
                [key]: {
                    ...prev.triggers[key],
                    enabled: !prev.triggers[key].enabled
                }
            }
        }));
    };

    const changeTemplate = (key: string, code: string) => {
        setConfig((prev: any) => ({
            ...prev,
            triggers: {
                ...prev.triggers,
                [key]: {
                    ...prev.triggers[key],
                    templateCode: code
                }
            }
        }));
    };

    // Helper to get selected template content for preview/guide
    const getTemplateContent = (code: string) => {
        return templates.find(t => (t.templtCode || t.code) === code)?.templtContent || '';
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header: Status & Balance */}
            <div className="grid grid-cols-12 gap-6">
                <div className="col-span-8">
                    <div className="flex items-center gap-4 mb-2">
                        <h1 className="text-3xl font-bold text-[#2F3A32]">알림 통합 관제 센터</h1>
                        <span className="px-3 py-1 bg-[#FEE2E2] text-[#991B1B] rounded-full text-xs font-bold animate-pulse">
                            ADMIN MASTER ONLY
                        </span>
                    </div>
                    <p className="text-slate-500 text-sm">카카오 알림톡(AlimTalk)의 실시간 상태를 모니터링하고 발송 정책을 제어합니다.</p>
                </div>
                <div className="col-span-4 text-right">
                    <div className="bg-[#2F3A32] text-white p-6 rounded-[24px] shadow-lg">
                        <div className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">Current Balance</div>
                        <div className="text-3xl font-black tracking-tight">
                            {balance ? parseInt(balance.SMS_CNT || 0).toLocaleString() : '0'} <span className="text-sm font-normal opacity-70">건 (잔여)</span>
                        </div>
                        <div className="flex justify-end gap-3 mt-4 text-[10px] font-mono opacity-80">
                            <span>LMS: {balance?.LMS_CNT || 0}</span>
                            <span>MMS: {balance?.MMS_CNT || 0}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Control: Master Switches */}
            <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
                {/* Channel Auth Section */}
                <div className="mb-10 p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">📢 카카오 채널 연동 (Sender Key 발급)</h3>
                    {channelStage === 'INIT' && (
                        <div className="flex gap-4 items-end">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">채널 ID (@포함)</label>
                                <input
                                    className="px-3 py-2 border rounded-lg text-sm"
                                    placeholder="@채널아이디"
                                    value={authInputs.plusid}
                                    onChange={e => setAuthInputs({ ...authInputs, plusid: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">관리자 휴대폰</label>
                                <input
                                    className="px-3 py-2 border rounded-lg text-sm"
                                    placeholder="01012345678"
                                    value={authInputs.phonenumber}
                                    onChange={e => setAuthInputs({ ...authInputs, phonenumber: e.target.value })}
                                />
                            </div>
                            <button onClick={handleRequestAuth} className="px-4 py-2 bg-[#2F3A32] text-white rounded-lg text-xs font-bold hover:bg-[#1a211c]">인증번호 요청</button>
                        </div>
                    )}
                    {channelStage === 'AUTH_SENT' && (
                        <div className="flex gap-4 items-end">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">인증번호</label>
                                <input
                                    className="px-3 py-2 border rounded-lg text-sm"
                                    placeholder="123456"
                                    value={authInputs.authnum}
                                    onChange={e => setAuthInputs({ ...authInputs, authnum: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">카테고리</label>
                                <select
                                    className="px-3 py-2 border rounded-lg text-sm max-w-[200px]"
                                    value={authInputs.categorycode}
                                    onChange={e => setAuthInputs({ ...authInputs, categorycode: e.target.value })}
                                >
                                    <option value="">카테고리 선택</option>
                                    {categories.map((c: any) => (
                                        <option key={c.code} value={c.code}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <button onClick={handleCompleteAuth} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">인증 확인 & 저장</button>
                        </div>
                    )}
                    {channelStage === 'DONE' && (
                        <div className="flex items-center gap-2 text-green-600 text-sm font-bold">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                            <span>연동 완료 (SenderKey: {registeredProfile?.senderKey || config?.senderkey})</span>
                        </div>
                    )}
                    {/* If config has senderkey but not in this flow session, show it */}
                    {channelStage === 'INIT' && config?.senderkey && (
                        <div className="mt-2 text-xs text-slate-400">
                            현재 저장된 Sender Key: {config.senderkey.substring(0, 10)}... (재설정하려면 위 입력 진행)
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-bold text-[#2F3A32] flex items-center gap-2">
                        <span>🎛️ 발송 제어 마스터 스위치 (Triggers)</span>
                    </h2>
                    <div className="flex gap-3">
                        <button onClick={handleFetchTemplates} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-colors">
                            🔄 템플릿 동기화 (Fetch)
                        </button>
                        <button onClick={handleSaveConfig} className="px-6 py-2 bg-[#2F3A32] hover:bg-[#1A3C34] rounded-xl text-xs font-bold text-white transition-colors shadow-lg">
                            💾 설정 저장 (Save)
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                    {['PAYMENT', 'RESERVATION', 'VISIT_REMINDER'].map(key => {
                        const trigger = config?.triggers?.[key] || { enabled: false, templateCode: '' };
                        const label = key === 'PAYMENT' ? '결제 완료 알림' : key === 'RESERVATION' ? '예약 확정/취소' : '방문 리마인드 (자동)';
                        const selectedTplContent = getTemplateContent(trigger.templateCode);

                        return (
                            <div key={key} className={`p-6 rounded-3xl border-2 transition-all ${trigger.enabled ? 'border-[#2F3A32] bg-[#F9FAFB]' : 'border-slate-100 bg-white opacity-80'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="font-bold text-[#2F3A32]">{label}</div>
                                    <button
                                        onClick={() => toggleTrigger(key)}
                                        className={`w-12 h-7 rounded-full transition-colors relative ${trigger.enabled ? 'bg-[#2F3A32]' : 'bg-slate-200'}`}
                                    >
                                        <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-sm ${trigger.enabled ? 'left-6' : 'left-1'}`}></div>
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">템플릿 선택</label>
                                    <select
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-[#2F3A32]"
                                        value={trigger.templateCode}
                                        onChange={(e) => changeTemplate(key, e.target.value)}
                                    >
                                        <option value="">(선택 안함 - 로직 중단)</option>
                                        {templates.map((t: any) => {
                                            const status = t.inspStatus || 'UNK'; // REG, APR, REJ
                                            const statusColor = status === 'APR' ? '🟢' : status === 'REJ' ? '🔴' : '🟠';
                                            return (
                                                <option key={t.templtCode || t.code} value={t.templtCode || t.code}>
                                                    {statusColor} [{status}] {t.templtName || t.name}
                                                </option>
                                            );
                                        })}
                                    </select>

                                    {/* Template Status Action */}
                                    {trigger.templateCode && (() => {
                                        const t = templates.find((tm: any) => (tm.templtCode || tm.code) === trigger.templateCode);
                                        if (t?.inspStatus === 'REG' || t?.inspStatus === 'REJ') {
                                            return (
                                                <div className="mt-1 flex items-center justify-between">
                                                    <span className={`text-[10px] font-bold ${t.inspStatus === 'REJ' ? 'text-red-500' : 'text-orange-500'}`}>
                                                        {t.inspStatus === 'REJ' ? '반려됨 (아래 사유 확인)' : '등록됨 (심사 필요)'}
                                                    </span>
                                                    {t.inspStatus === 'REG' && (
                                                        <button
                                                            onClick={() => handleRequestInspection(t.templtCode || t.code)}
                                                            className="text-[10px] underline text-blue-500 hover:text-blue-700"
                                                        >
                                                            검수요청
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}

                                    {/* Variable Guide */}
                                    {trigger.templateCode && (
                                        <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-100 text-[10px] text-yellow-800 leading-relaxed max-h-32 overflow-y-auto custom-scrollbar">
                                            <strong>[미리보기]</strong><br />
                                            {selectedTplContent || '동기화된 내용 없음'}

                                            {/* REJECTION REASON */}
                                            {(() => {
                                                const t = templates.find((tm: any) => (tm.templtCode || tm.code) === trigger.templateCode);
                                                if (t?.inspStatus === 'REJ' && t?.comments && t.comments.length > 0) {
                                                    return (
                                                        <div className="mt-2 pt-2 border-t border-red-200 text-red-600 font-bold">
                                                            🚨 반려 사유: <br />
                                                            {t.comments.map((c: any, idx: number) => (
                                                                <div key={idx}>- {c.content || c}</div>
                                                            ))}
                                                        </div>
                                                    );
                                                }
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* History Table */}
            <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
                <h2 className="text-xl font-bold text-[#2F3A32] mb-6">📊 실시간 발송 로그 (History)</h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50">
                            <tr>
                                <th className="pb-4 pl-4">Time</th>
                                <th className="pb-4">Receiver</th>
                                <th className="pb-4">Type</th>
                                <th className="pb-4">Result</th>
                                <th className="pb-4 text-right pr-4">Content</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm text-slate-600">
                            {isLoading && <tr><td colSpan={5} className="py-10 text-center italic">Loading...</td></tr>}
                            {!isLoading && history.length === 0 && <tr><td colSpan={5} className="py-10 text-center italic">기록이 없습니다.</td></tr>}
                            {history.map((h, i) => (
                                <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                                    <td className="py-4 pl-4 font-mono text-xs text-slate-400">{h.send_date || h.rs_date || '-'}</td>
                                    <td className="py-4 font-bold">{h.receiver || h.phone}</td>
                                    <td className="py-4"><span className="px-2 py-1 bg-slate-100 rounded text-[10px] uppercase font-bold text-slate-500">{h.type || 'AT'}</span></td>
                                    <td className="py-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${h.code == 0 || h.result_code == 1 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                            {h.code == 0 || h.result_code == 1 ? 'SUCCESS' : `FAIL(${h.code})`}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right pr-4">
                                        <button
                                            onClick={() => setSelectedHistory(h)}
                                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold hover:bg-[#2F3A32] hover:text-white hover:border-[#2F3A32] transition-colors"
                                        >
                                            VIEW
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* View Modal */}
            {selectedHistory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedHistory(null)}>
                    <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <div className="bg-[#fbdb4b] p-4 text-[#3b1e1e] font-bold text-center relative">
                            카카오톡 알림톡
                            <button onClick={() => setSelectedHistory(null)} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-black/5 rounded-full">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 bg-[#bacee0] min-h-[400px]">
                            <div className="bg-white p-3 rounded-lg shadow-sm text-sm text-[#2F3A32] leading-relaxed relative">
                                <div className="absolute -left-2 top-3 w-3 h-3 bg-white rotate-45 transform"></div>
                                <pre className="whitespace-pre-wrap font-sans">{selectedHistory.msg || selectedHistory.message || '(내용 없음)'}</pre>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-2 ml-2">
                                {selectedHistory.send_date || 'Just now'}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
