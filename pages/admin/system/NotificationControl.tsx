
import React, { useState, useEffect } from 'react';
import { AligoService } from '../../../services/aligo';

export default function NotificationControl() {
    const [config, setConfig] = useState<any>(null);
    const [balance, setBalance] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedHistory, setSelectedHistory] = useState<any>(null); // For Modal

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
            const finalConfig = cfg || { isActive: true, triggers: {} };
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
                                        {templates.map((t: any) => (
                                            <option key={t.templtCode || t.code} value={t.templtCode || t.code}>
                                                {t.templtName || t.name} ({t.templtCode || t.code})
                                            </option>
                                        ))}
                                    </select>

                                    {/* Variable Guide */}
                                    {trigger.templateCode && (
                                        <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-100 text-[10px] text-yellow-800 leading-relaxed max-h-32 overflow-y-auto custom-scrollbar">
                                            <strong>[미리보기]</strong><br />
                                            {selectedTplContent || '동기화된 내용 없음'}
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
