import React, { useState } from 'react';

interface NotificationModalProps {
    recipientCount: number;
    onClose: () => void;
    onSend: (message: string) => Promise<void>;
}

const NotificationModal: React.FC<NotificationModalProps> = ({ recipientCount, onClose, onSend }) => {
    const [message, setMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSend = async () => {
        if (!message.trim()) return alert('메시지 내용을 입력해주세요.');
        if (!confirm(`${recipientCount}명에게 메시지를 전송하시겠습니까?`)) return;

        setIsProcessing(true);
        try {
            await onSend(message);
            onClose();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[40px] shadow-2xl p-10 w-full max-w-lg border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-[#2F3A32]"></div>

                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h3 className="text-2xl font-bold text-[#2F3A32]">Send Notification</h3>
                        <p className="text-[11px] text-[#A58E6F] font-bold uppercase tracking-widest mt-1">
                            To: <span className="text-[#2F3A32] text-lg tabular-nums">{recipientCount}</span> Members
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-[#2F3A32] transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="space-y-6">
                    <textarea
                        className="w-full h-40 bg-slate-50 border rounded-2xl p-6 outline-none font-medium text-[#2F3A32] resize-none focus:border-[#A58E6F] transition-colors"
                        placeholder="회원님께 전송할 메시지를 입력하세요..."
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                    />

                    <div className="flex gap-4">
                        <button
                            onClick={handleSend}
                            disabled={isProcessing}
                            className="flex-1 py-4 bg-[#2F3A32] text-white rounded-2xl font-bold uppercase tracking-widest text-[11px] hover:bg-[#1A3C34] active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                            {isProcessing ? 'Sending...' : 'Send Push / SMS'}
                        </button>
                    </div>

                    <p className="text-center text-[10px] text-slate-400 font-bold">* SMS 발송 시 비용이 발생할 수 있습니다.</p>
                </div>
            </div>
        </div>
    );
};

export default NotificationModal;
