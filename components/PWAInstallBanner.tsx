import React, { useEffect, useState } from 'react';

export default function PWAInstallBanner() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isKakao, setIsKakao] = useState(false);
    const [showIOSGuide, setShowIOSGuide] = useState(false);

    useEffect(() => {
        const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
        const isKakaoTalk = /KAKAOTALK/i.test(ua);
        const isIphone = /iPhone|iPad|iPod/i.test(ua);

        setIsKakao(isKakaoTalk);
        setIsIOS(isIphone);

        if (localStorage.getItem('pwa_banner_closed') === 'true') {
            setIsVisible(false);
            return;
        }

        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            if (!isKakaoTalk) {
                setIsVisible(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handler);

        // iOS Logic: Always show banner if not in standalone (and not Kakao)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

        if (isIphone && !isStandalone && !isKakaoTalk) {
            setIsVisible(true);
        }

        // Kakao Logic: Always show warning/banner
        if (isKakaoTalk) {
            setIsVisible(true);
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        localStorage.setItem('pwa_banner_closed', 'true');
    };

    const handleInstallClick = async () => {
        if (isKakao) {
            alert("카카오톡 인앱 브라우저에서는 설치가 제한됩니다.\n화면 우측 하단 [더보기] -> [다른 브라우저로 열기]를 눌러 사파리나 크롬에서 실행해주세요.");
            return;
        }

        if (isIOS) {
            setShowIOSGuide(true);
            return;
        }

        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response: ${outcome}`);
            setDeferredPrompt(null);
            setIsVisible(false);
        } else {
            // Fallback for unexpected cases
            alert("브라우저 메뉴의 [홈 화면에 추가] 또는 [앱 설치]를 이용해주세요.");
        }
    };

    if (!isVisible) return null;

    return (
        <>
            <div className="fixed top-0 left-0 w-full z-[9999] bg-white border-b border-slate-200 shadow-md">
                <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-lg border border-slate-100 flex items-center justify-center shadow-sm overflow-hidden shrink-0">
                            <img src="/pwa-icon-v3.png" alt="App Icon" className="w-full h-full object-contain p-1" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Official App</span>
                            <span className="text-sm font-bold text-[#2F3A32]">
                                {isKakao ? "사파리/크롬에서 열어주세요" : "웰니스 더 한남 멤버십"}
                            </span>
                            <span className="text-[9px] text-slate-400">(Wellness,The Hannam)</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleInstallClick}
                            className="bg-[#2F3A32] text-white px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap hover:bg-[#1A3C34] transition-colors flex items-center gap-1"
                        >
                            <span>⬇</span> 설치
                        </button>
                        <button
                            onClick={handleClose}
                            className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* iOS Guide Popup */}
            {showIOSGuide && (
                <div className="fixed inset-0 z-[10000] bg-black/60 flex items-end justify-center pb-8 animate-in fade-in duration-200" onClick={() => setShowIOSGuide(false)}>
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-[90%] mx-auto shadow-2xl relative" onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-[#2F3A32] mb-2">홈 화면에 추가하는 방법</h3>
                            <p className="text-sm text-slate-600 mb-6">
                                하단의 <span className="inline-block p-1 bg-slate-100 rounded-md mx-1">공유</span> 버튼을 누르고<br />
                                <span className="font-bold text-black">"홈 화면에 추가"</span>를 선택해주세요.
                            </p>
                            <div className="flex justify-center items-center gap-4 mb-6">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-10 h-10 border border-slate-200 rounded-lg flex items-center justify-center text-blue-500">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                                    </div>
                                    <span className="text-xs text-slate-400">1. 공유</span>
                                </div>
                                <div className="text-slate-300">→</div>
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-10 h-10 border border-slate-200 rounded-lg flex items-center justify-center text-slate-700 bg-slate-50">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                                    </div>
                                    <span className="text-xs text-slate-400">2. 홈에 추가</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowIOSGuide(false)}
                            className="w-full bg-[#2F3A32] text-white py-3 rounded-xl font-bold"
                        >
                            확인했습니다
                        </button>

                        {/* Pointing Arrow Animation */}
                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-white animate-bounce">
                            ↓
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
