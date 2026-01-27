import React, { useEffect, useState } from 'react';

export default function PWAInstallBanner() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Update UI notify the user they can install the PWA
            setIsVisible(true);
            console.log("PWA Install Prompt captured");
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Optional: Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsVisible(false);
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);

        // We've used the prompt, and can't use it again, discard it
        setDeferredPrompt(null);
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed top-0 left-0 w-full z-[9999] bg-white border-b border-slate-200 shadow-md animate-in slide-in-from-top duration-500">
            <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-lg border border-slate-100 flex items-center justify-center shadow-sm overflow-hidden shrink-0">
                        <img src="/pwa-icon-v2.png" alt="App Icon" className="w-full h-full object-contain p-1" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Official App</span>
                        <span className="text-sm font-bold text-[#2F3A32]">웰니스 더 한남 전용 앱 설치하기</span>
                        <span className="text-[9px] text-slate-400">(Wellness,The Hannam)</span>
                    </div>
                </div>
                <button
                    onClick={handleInstallClick}
                    className="bg-[#2F3A32] text-white px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap hover:bg-[#1A3C34] transition-colors"
                >
                    설치 (Install)
                </button>
            </div>
        </div>
    );
}
