import React, { useState, useEffect } from 'react';
import { db } from '../../../db';
import { Member } from '../../../types';
import { FcmService } from '../../../src/firebase';

export default function NotificationCenter() {
    const [members, setMembers] = useState<Member[]>([]);
    const [tokensData, setTokensData] = useState<Record<string, boolean>>({}); // memberId -> hasToken
    const [isLoading, setIsLoading] = useState(false);

    // Form
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [targetMode, setTargetMode] = useState<'ALL' | 'INDIVIDUAL'>('ALL');
    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const allMembers = await db.members.getAll();
            setMembers(allMembers || []);

            // Check tokens for everyone (Simulated by bulk fetch or lazy load)
            // For efficiency, we just start empty and load status on demand or bulk?
            // Since fetch is expensive, we rely on a smart check.
            // Ideally, specific endpoint. Here we will iterate existing tokens if possible.
            // But we can't select all * from hannam_fcm_tokens due to RLS if we are not admin-privileged in DB?
            // "Admins can select all tokens" policy was added in migration! So we CAN fetch all.

            const { data: allTokens } = await (db.fcmTokens as any).getAllAdmin();
            // Need to implement getAllAdmin in db.ts or just use raw query if possible.
            // Assuming db.ts update or direct query. 
            // Wait, I haven't added `getAllAdmin` to db.ts yet. I will add it.

            // Placeholder for now
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async () => {
        if (!title || !body) return alert('제목과 내용을 입력해주세요.');
        if (targetMode === 'INDIVIDUAL' && selectedMembers.size === 0) return alert('대상 회원을 선택해주세요.');

        // 1. Filter Targets
        // For 'ALL', we need all tokens.
        // For 'INDIVIDUAL', we need selected tokens.

        // 2. Call API
        try {
            const res = await fetch('/api/push/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    body,
                    tokens: ['mock-token'] // Replace with real tokens logic
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('발송되었습니다.');
                setTitle('');
                setBody('');
            } else {
                alert('발송 실패: ' + data.message);
            }
        } catch (e) {
            alert('오류 발생');
        }
    };

    const handleTestSend = async () => {
        // Get current user ID from session
        const saved = localStorage.getItem('hannam_auth_session');
        if (!saved) return alert('로그인이 필요합니다.');
        const session = JSON.parse(saved);

        // Request permission again just in case
        const token = await FcmService.requestPermission(session.id);
        if (!token) return alert('토큰을 가져오지 못했습니다. 권한을 확인해주세요.');

        // Send to this token
        const res = await fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: '[테스트] Wellness 관리자 알림',
                body: '이것은 테스트 메시지입니다. 정상 수신 확인 완료!',
                tokens: [token]
            })
        });
        alert('테스트 발송 요청 완료');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-[#2F3A32]">알림 센터 (Notification Center)</h2>
                <button
                    onClick={handleTestSend}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-bold text-sm shadow-md"
                >
                    📱 내 폰으로 테스트 발송
                </button>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-[#E5E8EB]">
                <div className="space-y-6">
                    {/* Target Selection */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">발송 대상</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={targetMode === 'ALL'} onChange={() => setTargetMode('ALL')} className="w-4 h-4 text-[#2F3A32]" />
                                <span className="text-sm font-medium">전체 회원 (Broadcast)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={targetMode === 'INDIVIDUAL'} onChange={() => setTargetMode('INDIVIDUAL')} className="w-4 h-4 text-[#2F3A32]" />
                                <span className="text-sm font-medium">개별 회원</span>
                            </label>
                        </div>
                    </div>

                    {/* Member Selector (Conditional) */}
                    {targetMode === 'INDIVIDUAL' && (
                        <div className="h-48 overflow-y-auto border border-gray-200 rounded-xl p-4">
                            {/* Simplified Member List */}
                            {members.map(m => (
                                <div key={m.id} className="flex items-center justify-between py-2 border-b last:border-0">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedMembers.has(m.id)}
                                            onChange={(e) => {
                                                const newSet = new Set(selectedMembers);
                                                if (e.target.checked) newSet.add(m.id);
                                                else newSet.delete(m.id);
                                                setSelectedMembers(newSet);
                                            }}
                                        />
                                        <span className="font-bold text-gray-800">{m.name}</span>
                                        <span className="text-xs text-gray-500">{m.phone}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Message Content */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">알림 제목</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="예: [공지] 2월 예약 안내"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2F3A32] focus:border-transparent outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">알림 내용</label>
                        <textarea
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            placeholder="푸시 알림 내용을 입력하세요."
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2F3A32] focus:border-transparent outline-none h-32 resize-none"
                        />
                    </div>

                    {/* Send Button */}
                    <button
                        onClick={handleSend}
                        className="w-full py-4 bg-[#2F3A32] text-white rounded-xl font-bold text-lg hover:bg-[#1A3C34] transition shadow-lg"
                    >
                        발송하기 (SEND PUSH)
                    </button>
                </div>
            </div>
        </div>
    );
}
