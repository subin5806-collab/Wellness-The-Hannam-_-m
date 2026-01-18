import React, { useState, useEffect } from 'react';
import { db } from '../../../db';
import { Gender, MembershipProduct, Member } from '../../../types';

interface MemberRegistrationModalProps {
    onClose: () => void;
    onSuccess: () => void;
    initialData?: Member | null;
}

const MemberRegistrationModal: React.FC<MemberRegistrationModalProps> = ({ onClose, onSuccess, initialData }) => {
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        gender: '여성' as Gender,
        birthDate: '',
        email: '',
        adminMemo: ''
    });
    const [selectedProductId, setSelectedProductId] = useState<string>('');
    const [products, setProducts] = useState<MembershipProduct[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        db.master.membershipProducts.getAll().then(setProducts).catch(console.error);

        if (initialData) {
            setFormData({
                name: initialData.name,
                phone: initialData.phone,
                gender: initialData.gender,
                birthDate: initialData.birthDate,
                email: initialData.email,
                adminMemo: initialData.adminMemo || ''
            });
        }
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            if (!formData.name || !formData.phone) return alert('필수 정보를 입력해주세요.');

            if (initialData) {
                // Update Mode
                await db.members.update(initialData.id, formData);
                alert('회원 정보가 수정되었습니다.');
            } else {
                // Create Mode
                const newMember = await db.members.add({
                    ...formData,
                    initialPasswordSet: false
                });

                // If membership product selected, add membership
                if (selectedProductId) {
                    const product = products.find(p => p.id === selectedProductId);
                    if (product) {
                        await db.memberships.topUp(newMember.id, product.totalAmount, product.name);
                    }
                }
                alert('회원이 성공적으로 등록되었습니다.');
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            alert(`처리 실패: ${err.message}`);
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
                        <h3 className="text-2xl font-bold text-[#2F3A32]">{initialData ? '회원 정보 수정' : '신규 회원 등록'}</h3>
                        <p className="text-[11px] text-[#A58E6F] font-bold uppercase tracking-widest mt-1">
                            {initialData ? 'Edit Profile' : 'Quick Registration'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-[#2F3A32] transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-2">성함 (Name)</label>
                        <input
                            required
                            type="text"
                            placeholder="회원 성함"
                            className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[#2F3A32] focus:border-[#A58E6F] transition-colors"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-2">연락처 (Phone)</label>
                            <input
                                required
                                type="tel"
                                placeholder="010-0000-0000"
                                className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[#2F3A32] focus:border-[#A58E6F] transition-colors"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-2">성별 (Gender)</label>
                            <select
                                className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[#2F3A32] focus:border-[#A58E6F] transition-colors appearance-none"
                                value={formData.gender}
                                onChange={e => setFormData({ ...formData, gender: e.target.value as Gender })}
                            >
                                <option value="여성">여성</option>
                                <option value="남성">남성</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-2">생년월일 (Birth Date)</label>
                            <input
                                type="date"
                                className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[#2F3A32] focus:border-[#A58E6F] transition-colors"
                                value={formData.birthDate}
                                onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-2">이메일 (Email)</label>
                            <input
                                type="email"
                                placeholder="email@example.com"
                                className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[#2F3A32] focus:border-[#A58E6F] transition-colors"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    </div>

                    {!initialData && (
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-2">초기 멤버십 (Optional)</label>
                            <select
                                className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[#2F3A32] focus:border-[#A58E6F] transition-colors appearance-none"
                                value={selectedProductId}
                                onChange={e => setSelectedProductId(e.target.value)}
                            >
                                <option value="">멤버십 선택 안함</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} (₩{p.totalAmount.toLocaleString()})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-2">관리자 메모 (Admin Memo)</label>
                        <textarea
                            placeholder="특이사항 메모 (선택)"
                            className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[#2F3A32] min-h-[80px] resize-none focus:border-[#A58E6F] transition-colors"
                            value={formData.adminMemo}
                            onChange={e => setFormData({ ...formData, adminMemo: e.target.value })}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isProcessing}
                        className="w-full py-5 bg-[#2F3A32] text-white rounded-2xl font-bold uppercase tracking-widest text-[12px] hover:bg-[#1A3C34] active:scale-[0.98] transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? '처리 중...' : (initialData ? '수정 완료' : '회원 등록 완료')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default MemberRegistrationModal;
