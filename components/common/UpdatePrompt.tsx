import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { X, RefreshCw } from 'lucide-react';

const CHECK_INTERVAL = 60 * 1000; // Check every 1 minute

export const UpdatePrompt: React.FC = () => {
    const [hasUpdate, setHasUpdate] = useState(false);
    const [visible, setVisible] = useState(false);
    const location = useLocation();

    // Busy paths where we should NOT interrupt
    const BUSY_PATHS = ['/payment', '/reservation', '/care'];

    useEffect(() => {
        // 1. Initial Version Store
        const init = async () => {
            try {
                const res = await fetch('/version.json?t=' + Date.now());
                if (res.ok) {
                    const data = await res.json();
                    sessionStorage.setItem('hannam_app_version', data.version);
                }
            } catch (e) {
                // version.json might not exist in dev, ignore
            }
        };
        init();

        // 2. Poll for updates
        const interval = setInterval(async () => {
            try {
                const res = await fetch('/version.json?t=' + Date.now());
                if (res.ok) {
                    const data = await res.json();
                    const current = sessionStorage.getItem('hannam_app_version');

                    if (current && data.version !== current) {
                        setHasUpdate(true);
                    }
                }
            } catch (e) {
                // Ignore network errors
            }
        }, CHECK_INTERVAL);

        return () => clearInterval(interval);
    }, []);

    // 3. Show/Hide based on Busy State
    useEffect(() => {
        if (hasUpdate) {
            const isBusy = BUSY_PATHS.some(path => location.pathname.includes(path));
            if (!isBusy) {
                setVisible(true);
            } else {
                setVisible(false); // Hide if entered busy zone (optional, or just keep hidden until exit)
            }
        }
    }, [hasUpdate, location.pathname]);

    const handleUpdate = () => {
        // Hard Reload
        window.location.reload();
    };

    const handleLater = () => {
        setVisible(false);
        // Will remind again on next session (sessionStorage cleared)
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#F9F9F7] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-[#A58E6F]/20 animate-slide-up">

                {/* Header */}
                <div className="bg-[#1A3C34] px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 text-[#A58E6F] animate-spin-slow" />
                        <h3 className="text-white font-serif italic text-lg">New Update Available</h3>
                    </div>
                    <button onClick={handleLater} className="text-white/60 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 text-center">
                    <h4 className="text-[#1A3C34] font-bold text-lg mb-2 text-center">
                        더 좋아진 웰니스 더 한남
                    </h4>
                    <p className="text-[#666] text-sm leading-relaxed mb-6 font-light">
                        새로운 기능과 개선사항이 앱에 적용되었습니다.<br />
                        지금 바로 업데이트하여 최신 환경을 경험해보세요.
                    </p>

                    <div className="flex gap-3">
                        <button
                            onClick={handleLater}
                            className="flex-1 py-3 px-4 rounded-xl bg-[#E8E8E4] text-[#666] font-medium text-sm hover:bg-[#d0d0cc] transition-colors"
                        >
                            나중에
                        </button>
                        <button
                            onClick={handleUpdate}
                            className="flex-1 py-3 px-4 rounded-xl bg-[#1A3C34] text-white font-medium text-sm hover:bg-[#142e28] transition-colors shadow-lg shadow-[#1A3C34]/20"
                        >
                            업데이트하기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
