import React, { useEffect, useState } from 'react';
import { db } from '../../../db';
import { Admin } from '../../../types';

const AccountManagement = () => {
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [managers, setManagers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [adminList, managerList] = await Promise.all([
                db.admins.getAll(),
                db.master.managers.getAll()
            ]);
            setAdmins(adminList);
            setManagers(managerList);
        } catch (e) {
            alert('데이터 로딩 실패');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);

    const handleRoleUpdate = async (id: string, newRole: 'SUPER' | 'STAFF' | 'INSTRUCTOR') => {
        if (!confirm(`권한을 ${newRole}로 변경하시겠습니까?`)) return;
        try {
            await db.admins.update(id, { role: newRole });
            alert('권한이 변경되었습니다.');
            loadData();
        } catch (e: any) {
            alert(`변경 실패: ${e.message}`);
        }
    };

    const handleUpdateAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAdmin) return;
        try {
            await db.admins.update(editingAdmin.id, {
                name: editingAdmin.name,
                email: editingAdmin.email,
                phone: editingAdmin.phone
            });
            alert('정보가 수정되었습니다.');
            setEditingAdmin(null);
            loadData();
        } catch (e: any) {
            alert(`수정 실패: ${e.message}`);
        }
    };

    const handlePasswordReset = async (admin: Admin) => {
        if (!admin.phone) {
            alert('휴대폰 번호가 등록되지 않은 계정은 초기화할 수 없습니다.');
            return;
        }
        const last4 = admin.phone.replace(/[^0-9]/g, '').slice(-4);
        if (!confirm(`${admin.name} 강사님의 비밀번호를 휴대폰 끝 4자리(${last4})로 초기화하시겠습니까?`)) return;

        try {
            await db.admins.resetInstructorPassword(admin.id, admin.phone);
            alert('비밀번호가 초기화되었습니다.');
        } catch (e: any) {
            alert(`초기화 실패: ${e.message}`);
        }
    };

    const handleBulkSync = async () => {
        setIsLoading(true);
        try {
            const count = await db.admins.bulkSyncInstructors();
            if (count > 0) {
                alert(`${count}개의 강사 계정이 성공적으로 생성/연동되었습니다.`);
            } else {
                alert('이미 모든 강사님의 계정이 생성되어 있습니다.');
            }
            loadData();
        } catch (e: any) {
            console.error(e);
            alert(`동기화 실패: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAccount = async (admin: Admin) => {
        if (admin.role === 'SUPER') {
            alert('마스터 계정은 삭제할 수 없습니다.');
            return;
        }
        if (!confirm(`${admin.name} 계정을 삭제하시겠습니까?`)) return;

        try {
            await db.admins.delete(admin.id);
            alert('계정이 삭제되었습니다.');
            loadData();
        } catch (e: any) {
            alert(`삭제 실패: ${e.message}`);
        }
    };

    const handleToggleStatus = async (admin: Admin) => {
        const newStatus = !admin.isActive;
        try {
            await db.admins.update(admin.id, { isActive: newStatus });
            alert(`계정이 ${newStatus ? '활성화' : '비활성화'}되었습니다.`);
            loadData();
        } catch (e: any) {
            alert(`상태 변경 실패: ${e.message}`);
        }
    };

    const getLinkedManager = (admin: Admin) => {
        // [STRICT] First priority: DB Column link
        const viaId = managers.find(m => m.linkedAdminId === admin.id);
        if (viaId) return viaId;

        // [FALLBACK] Second priority: Phone Number match (clean digits)
        if (!admin.phone) return null;
        const cleanAdminPhone = admin.phone.replace(/[^0-9]/g, '');
        return managers.find(m => m.phone.replace(/[^0-9]/g, '') === cleanAdminPhone);
    };

    // [SYNC FIX] Show both existing admins and pending managers
    const displayList = [
        ...admins.map(a => ({ ...a, type: 'ADMIN' })),
        ...managers
            .filter(m => !admins.some(a => a.id === m.linkedAdminId || a.phone === m.phone.replace(/[^0-9]/g, '')))
            .map(m => ({
                id: `PENDING_${m.id}`,
                name: m.name,
                phone: m.phone,
                email: '(계정이 생성되지 않음)',
                role: 'INSTRUCTOR' as const,
                isActive: m.isActive,
                isDeleted: false,
                lastLoginAt: null,
                isPending: true,
                managerId: m.id
            }))
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-[#2F3A32]">계정 및 권한 관리</h1>
                    <p className="text-gray-500 text-sm mt-1">시스템 권한 현황입니다. 강사 계정은 등록 즉시 여기에 나타납니다.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleBulkSync}
                        className="px-4 py-2 bg-[#2F3A32] text-white rounded-lg hover:bg-black text-sm font-bold shadow-sm"
                    >
                        신규 계정 일괄 생성
                    </button>
                    <button onClick={loadData} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">새로고침</button>
                </div>
            </header>

            <div className="bg-white rounded-3xl shadow-sm border border-[#E5E8EB] overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-[#F9FAFB] text-gray-500 font-medium border-b border-[#E5E8EB]">
                        <tr>
                            <th className="px-6 py-4 text-[11px] uppercase tracking-wider">이름 / 연락처</th>
                            <th className="px-6 py-4 text-[11px] uppercase tracking-wider">이메일 (ID)</th>
                            <th className="px-6 py-4 text-[11px] uppercase tracking-wider">권한</th>
                            <th className="px-6 py-4 text-[11px] uppercase tracking-wider">강사 연동</th>
                            <th className="px-6 py-4 text-[11px] uppercase tracking-wider">상태</th>
                            <th className="px-6 py-4 text-[11px] uppercase tracking-wider text-center">최근 로그인</th>
                            <th className="px-6 py-4 text-center text-[11px] uppercase tracking-wider">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E8EB]">
                        {displayList.map(admin => {
                            const linkedMgr = (admin as any).isPending ? managers.find(m => m.id === (admin as any).managerId) : getLinkedManager(admin as any);
                            const isActive = admin.isActive !== false;
                            const isPending = (admin as any).isPending;

                            return (
                                <tr key={admin.id} className={`hover:bg-slate-50 transition-colors ${!isActive ? 'opacity-60 bg-gray-50' : ''} ${isPending ? 'bg-amber-50/30' : ''}`}>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-[#2F3A32]">{admin.name}</div>
                                        <div className="text-xs text-gray-400">{admin.phone}</div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 font-mono text-[11px]">{admin.email}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${admin.role === 'SUPER' ? 'bg-purple-100 text-purple-700' :
                                            admin.role === 'INSTRUCTOR' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                                            }`}>
                                            {admin.role || 'NONE'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {linkedMgr ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-50 text-green-700 border border-green-100">✔ {linkedMgr.name}</span>
                                        ) : (
                                            <span className="text-xs text-rose-300 italic font-bold">미연동 (정보 불일치)</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => !isPending && handleToggleStatus(admin as any)}
                                            disabled={isPending}
                                            className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${isPending ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' :
                                                admin.isActive !== false
                                                    ? 'bg-green-500 text-white border-green-600 hover:bg-green-600'
                                                    : 'bg-gray-200 text-gray-500 border-gray-300 hover:bg-gray-300'
                                                }`}
                                        >
                                            {isPending ? '생성 대기' : (admin.isActive !== false ? '정상 활성' : '비활성(잠금)')}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-gray-400 text-xs text-center">{admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : '-'}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-2">
                                            {!isPending ? (
                                                <>
                                                    <select
                                                        className="text-[10px] border rounded p-1 outline-none bg-white"
                                                        value={admin.role || 'INSTRUCTOR'}
                                                        onChange={(e) => handleRoleUpdate(admin.id, e.target.value as any)}
                                                    >
                                                        <option value="INSTRUCTOR">강사</option>
                                                        <option value="STAFF">직원</option>
                                                        <option value="SUPER">원장</option>
                                                    </select>
                                                    <button onClick={() => setEditingAdmin(admin as any)} className="px-2 py-1 text-[10px] text-blue-500 border border-blue-100 rounded hover:bg-blue-50 bg-white">수정</button>
                                                    {admin.role !== 'SUPER' && <button onClick={() => handlePasswordReset(admin as any)} className="px-2 py-1 text-[10px] font-bold text-rose-500 border border-rose-100 rounded hover:bg-rose-50 bg-white">초기화</button>}
                                                    {admin.role !== 'SUPER' && (
                                                        <button
                                                            onClick={() => handleDeleteAccount(admin as any)}
                                                            className="px-2 py-1 text-[10px] text-gray-400 border border-gray-200 rounded hover:bg-rose-100 hover:text-rose-600 transition-colors bg-white"
                                                            title="완전 삭제 (추천하지 않음)"
                                                        >
                                                            삭제
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-[10px] text-amber-500 font-bold italic">계정 생성 대기 중...</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {admins.length === 0 && !isLoading && (
                    <div className="p-10 text-center text-gray-400">등록된 계정이 없습니다.</div>
                )}
            </div>

            {editingAdmin && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl p-10 max-w-md w-full animate-in fade-in zoom-in duration-200">
                        <h2 className="text-xl font-bold text-[#2F3A32] mb-6">계정 정보 수정</h2>
                        <form onSubmit={handleUpdateAdmin} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">이름</label>
                                <input type="text" className="w-full px-4 py-3 bg-gray-50 border rounded-2xl outline-none focus:border-[#2F3A32]" value={editingAdmin.name} onChange={e => setEditingAdmin({ ...editingAdmin, name: e.target.value })} required />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">연락처</label>
                                <input type="text" className="w-full px-4 py-3 bg-gray-50 border rounded-2xl outline-none focus:border-[#2F3A32]" value={editingAdmin.phone || ''} onChange={e => setEditingAdmin({ ...editingAdmin, phone: e.target.value })} required />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">이메일 (ID)</label>
                                <input type="email" className="w-full px-4 py-3 bg-gray-50 border rounded-2xl outline-none focus:border-[#2F3A32]" value={editingAdmin.email} onChange={e => setEditingAdmin({ ...editingAdmin, email: e.target.value })} required />
                            </div>
                            <div className="pt-4 flex gap-2">
                                <button type="submit" className="flex-1 py-3 bg-[#2F3A32] text-white rounded-2xl font-bold shadow-lg hover:bg-black transition-all">저장하기</button>
                                <button type="button" onClick={() => setEditingAdmin(null)} className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-2xl font-bold hover:bg-gray-200 transition-all">취소</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccountManagement;
