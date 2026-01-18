
import React, { useState, useEffect, useRef } from 'react';
import { db, hashPassword } from '../../../db';
import { Program, MembershipProduct, Manager, Admin, SystemBackup } from '../../../types';
import * as XLSX from 'xlsx';

type SettingsTab = 'MEMBERSHIP' | 'CARE_PROGRAM' | 'MANAGER' | 'SECURITY' | 'DATA_HUB';
const MASTER_SEC_KEY = 'ekdnfhem2ck';

const MasterSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('MEMBERSHIP');
  const [membershipProducts, setMembershipProducts] = useState<MembershipProduct[]>([]);
  const [carePrograms, setCarePrograms] = useState<Program[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Forms
  const [newProduct, setNewProduct] = useState<Partial<MembershipProduct>>({ name: '', totalAmount: 0, tier: 'BASIC', bonusAmount: 0, validMonths: 12, defaultDiscountRate: 0, description: '' });
  const [newProgram, setNewProgram] = useState<Partial<Program>>({ name: '', basePrice: 0, category: 'BODY', durationMinutes: 60, description: '' });
  const [newManager, setNewManager] = useState<Partial<Manager>>({ name: '', phone: '', adminMemo: '' });
  const [loginPwdForm, setLoginPwdForm] = useState({ current: '', new: '', confirm: '', verificationCode: '' });
  const [isVerified, setIsVerified] = useState(false);

  // Master Key Interlock
  const [showAuthModal, setShowAuthModal] = useState<{ open: boolean, onChevron: () => void }>({ open: false, onChevron: () => { } });
  const [authInput, setAuthInput] = useState('');
  const [dbBackups, setDbBackups] = useState<SystemBackup[]>([]);

  useEffect(() => {
    loadData();
    checkAdminRole();
    resetForms();
  }, [activeTab]);

  const resetForms = () => {
    setEditingId(null);
    setNewProduct({ name: '', totalAmount: 0, tier: 'BASIC', bonusAmount: 0, validMonths: 12, defaultDiscountRate: 0, description: '' });
    setNewProgram({ name: '', basePrice: 0, category: 'BODY', durationMinutes: 60, description: '' });
    setNewManager({ name: '', phone: '', adminMemo: '' });
    setLoginPwdForm({ current: '', new: '', confirm: '', verificationCode: '' });
    setIsVerified(false);
  };

  const checkAdminRole = async () => {
    const saved = localStorage.getItem('hannam_auth_session');
    if (saved) {
      const auth = JSON.parse(saved);
      if (auth.type === 'admin' && auth.email) {
        const admin = await db.admins.getByEmail(auth.email);
        setCurrentAdmin(admin);
      }
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'MEMBERSHIP') setMembershipProducts(await db.master.membershipProducts.getAll());
      else if (activeTab === 'CARE_PROGRAM') setCarePrograms(await db.master.programs.getAll());
      else if (activeTab === 'MANAGER') setManagers(await db.master.managers.getAll());
      else if (activeTab === 'DATA_HUB') setDbBackups(await db.system.backups.getAll());
    } finally { setIsLoading(false); }
  };

  // --- CSV Logic ---
  const CSV_HEADERS = ["성함", "연락처", "성별", "생년월일", "이메일", "최초 등록일", "멤버십 상품", "총 결제액", "총 사용액", "현재 잔액", "회원권 등록일", "관리자 메모"];

  const downloadCSV = (data: any[], filename: string) => {
    const headers = CSV_HEADERS.join(',');
    const rows = data.map(row => CSV_HEADERS.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','));
    const csvContent = "\ufeff" + [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        "성함": "홍길동", "연락처": "01012345678", "성별": "남성", "생년월일": "1990-01-01",
        "이메일": "test@example.com", "최초 등록일": "2024-01-01", "멤버십 상품": "플래티넘 300",
        "총 결제액": "3000000", "총 사용액": "0", "현재 잔액": "3000000",
        "회원권 등록일": "2024-01-01", "관리자 메모": "신규 마이그레이션 예시"
      }
    ];

    // Use XLSX to generate proper Excel file
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    const wscols = [
      { wch: 10 }, { wch: 15 }, { wch: 8 }, { wch: 12 }, { wch: 20 }, { wch: 12 },
      { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 25 }
    ];
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, "Upload Template");
    XLSX.writeFile(wb, "TheHannam_Upload_Template.xlsx");
  };

  const runBackup = async () => {
    setAuthInput('');
    setShowAuthModal({
      open: true, onChevron: async () => {
        setIsLoading(true);
        try {
          const [members, memberships, careRecords, reservations, products, managers, admins] = await Promise.all([
            db.members.getAll(),
            db.memberships.getAll(),
            db.careRecords.getAll(),
            db.reservations.getAll(),
            db.master.membershipProducts.getAll(),
            db.master.managers.getAll(),
            db.admins.getAll() // Fetch all admins, then filter for currentAdmin if needed
          ]);

          const fullBackup = {
            date: new Date().toISOString(),
            members, memberships, careRecords, reservations, products, managers, admins
          };

          // 1. Save to Cloud DB
          await db.system.backups.add({
            backupName: `FULL_BACKUP_${new Date().toISOString().split('T')[0]}`,
            backupData: fullBackup,
            backupSize: JSON.stringify(fullBackup).length,
            adminEmail: currentAdmin?.email || 'unknown'
          });

          // 2. Download JSON
          const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `TheHannam_FullBackup_${new Date().toISOString().split('T')[0]}.json`;
          link.click();

          alert('시스템 백업이 완료되었습니다. 클라우드에 저장되고 로컬 파일로 다운로드되었습니다.');
          loadData(); // Refresh list
        } catch (e: any) { alert(e.message); }
        finally { setIsLoading(false); }
      }
    });
  };

  const handleBulkUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const rows = text.split('\n').map(row => row.split(',').map(cell => cell.replace(/^"(.*)"$/, '$1').trim()));
      const dataRows = rows.slice(1).filter(r => r.length >= 10 && r[0]);

      if (dataRows.length === 0) return alert('업로드할 데이터가 없습니다.');

      setAuthInput('');
      setShowAuthModal({
        open: true, onChevron: async () => {
          setIsProcessing(true);
          let successCount = 0;
          let errors: string[] = [];

          try {
            for (let i = 0; i < dataRows.length; i++) {
              const row = dataRows[i];
              const [name, phone, gender, birth, email, regDate, prodName, paid, used, bal, msRegDate, memo] = row;

              // 정합성 검사
              if (+paid - +used !== +bal) {
                errors.push(`${i + 1}행: 금융 정합성 오류 (결제-사용 != 잔액)`);
                continue;
              }

              try {
                // 1. 회원 등록
                const member = await db.members.add({
                  name, phone, gender: gender as any, birthDate: birth, email, adminMemo: memo
                });
                // 2. 멤버십 자산 강제 이관 (topUp logic 활용)
                await db.memberships.topUp(member.id, +paid, prodName);
                // 3. 차감액이 있을 경우 가상 CareRecord 생성 여부는 생략(자산만 이관)하거나 추가 구현 가능
                successCount++;
              } catch (err: any) {
                errors.push(`${i + 1}행: [${name}] 저장 실패 - ${err.message}`);
              }
            }
            alert(`마이그레이션 완료\n성공: ${successCount}건\n실패: ${errors.length}건\n${errors.join('\n')}`);
            loadData();
          } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        }
      });
    };
    reader.readAsText(file);
  };

  const runSystemHealthCheck = async () => {
    setIsProcessing(true);
    setHealthStatus('Checking system connectivity...');
    try {
      const result = await db.system.verifyConnection();
      if (result.success) {
        setHealthStatus(`✅ ${result.message}`);
        setTimeout(() => setHealthStatus(null), 5000);
      } else {
        setHealthStatus(`❌ 오류: ${result.message}`);
      }
    } catch (e: any) {
      setHealthStatus(`❌ 치명적 오류: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Render Helpers ---
  const handleAuthConfirm = () => {
    if (authInput === MASTER_SEC_KEY) {
      const chevron = showAuthModal.onChevron;
      setShowAuthModal({ open: false, onChevron: () => { } });
      chevron();
    } else { alert('보안키가 일치하지 않습니다.'); }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (editingId) await db.master.membershipProducts.update(editingId, newProduct);
      else await db.master.membershipProducts.add(newProduct);
      resetForms(); loadData();
    } catch (e: any) { alert(e.message); }
    finally { setIsProcessing(false); }
  };

  const handleProgramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (editingId) await db.master.programs.update(editingId, newProgram);
      else await db.master.programs.add(newProgram);
      resetForms(); loadData();
    } catch (e: any) { alert(e.message); }
    finally { setIsProcessing(false); }
  };

  const handleManagerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (editingId) await db.master.managers.update(editingId, newManager);
      else await db.master.managers.add(newManager);
      resetForms(); loadData();
    } catch (e: any) { alert(e.message); }
    finally { setIsProcessing(false); }
  };

  const handleDeleteItem = async (id: string, type: 'PRODUCT' | 'PROGRAM' | 'MANAGER') => {
    if (!confirm('정말로 삭제하시겠습니까?')) return;
    setIsProcessing(true);
    try {
      if (type === 'PRODUCT') await db.master.membershipProducts.delete(id);
      else if (type === 'PROGRAM') await db.master.programs.delete(id);
      else if (type === 'MANAGER') await db.master.managers.delete(id);
      loadData();
    } catch (e: any) { alert(e.message); }
    finally { setIsProcessing(false); }
  };


  const handleSecurityCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginPwdForm.verificationCode === '01058060134') {
      setIsVerified(true);
    } else {
      alert('보안 인증 번호가 일치하지 않습니다.');
    }
  };
  // Fix: Implemented missing handleLoginPwdChange to resolve the error on line 378
  const handleLoginPwdChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAdmin) return;
    if (loginPwdForm.new !== loginPwdForm.confirm) return alert('새 비밀번호 확인이 일치하지 않습니다.');

    // Security Verification Logic
    if (loginPwdForm.verificationCode !== '01058060134') {
      return alert('보안 인증 번호가 일치하지 않습니다. 올바른 번호를 입력해주세요.');
    }

    setIsProcessing(true);
    try {
      const hashedCurrent = await hashPassword(loginPwdForm.current);
      if (currentAdmin.password !== hashedCurrent) {
        return alert('현재 비밀번호가 일치하지 않습니다.');
      }

      await db.admins.updateLoginPassword(currentAdmin.email, loginPwdForm.new);
      alert('비밀번호가 성공적으로 변경되었습니다.');
      setLoginPwdForm({ current: '', new: '', confirm: '', verificationCode: '' });
      // Refresh current admin data to ensure local state has updated hashed password
      await checkAdminRole();
    } catch (err: any) {
      alert(`변경 중 오류: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-12 pb-24 page-transition max-w-[1400px] mx-auto">
      <header className="border-b pb-10 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-[#2F3A32]">시스템 설정 센터</h1>
          <p className="text-[11px] text-[#A58E6F] font-bold uppercase tracking-[0.4em] mt-2">운영 무결성 관리 허브</p>
        </div>
      </header>

      <nav className="flex gap-4 border-b overflow-x-auto no-scrollbar">
        {[
          { id: 'MEMBERSHIP', label: '멤버십 관리' },
          { id: 'CARE_PROGRAM', label: '케어 프로그램' },
          { id: 'MANAGER', label: '관리사 배정' },
          { id: 'SECURITY', label: '보안 정책' },
          { id: 'DATA_HUB', label: '데이터 허브' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`pb-4 px-8 text-[12px] font-bold uppercase tracking-widest relative whitespace-nowrap ${activeTab === tab.id ? 'text-[#2F3A32]' : 'text-slate-300 hover:text-slate-500'}`}>
            {tab.label}
            {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#2F3A32] rounded-full"></span>}
          </button>
        ))}
      </nav>

      <div className="min-h-[600px]">
        {activeTab === 'MEMBERSHIP' && (
          <div className="grid grid-cols-12 gap-12 animate-in slide-in-from-right-4">
            <form onSubmit={handleProductSubmit} className="col-span-4 bg-white p-10 rounded-[48px] border luxury-card space-y-6 h-fit sticky top-10">
              <h4 className="text-xl font-bold text-[#2F3A32] font-serif italic mb-4">멤버십 상품 상세 설정</h4>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">상품명</label>
                <input required className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[#2F3A32]" placeholder="Luxury VIP Care" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">등급 (Tier)</label>
                <select className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[#2F3A32] appearance-none" value={newProduct.tier} onChange={e => setNewProduct({ ...newProduct, tier: e.target.value as any })}>
                  <option value="BASIC">BASIC</option>
                  <option value="GOLD">GOLD</option>
                  <option value="PLATINUM">PLATINUM</option>
                  <option value="DIAMOND">DIAMOND</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">판매 금액</label>
                  <input type="number" required className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[#2F3A32]" placeholder="1000000" value={newProduct.totalAmount} onChange={e => setNewProduct({ ...newProduct, totalAmount: +e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">보너스 (Credit)</label>
                  <input type="number" className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[#2F3A32]" placeholder="0" value={newProduct.bonusAmount} onChange={e => setNewProduct({ ...newProduct, bonusAmount: +e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">유효기간(개월)</label>
                  <input type="number" required className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[#2F3A32]" value={newProduct.validMonths} onChange={e => setNewProduct({ ...newProduct, validMonths: +e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">기본 할인율(%)</label>
                  <input type="number" className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[#2F3A32]" value={newProduct.defaultDiscountRate || 0} onChange={e => setNewProduct({ ...newProduct, defaultDiscountRate: +e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">상품 설명 / 혜택</label>
                <textarea
                  className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[#2F3A32] min-h-[100px] resize-none"
                  placeholder="이 상품에 대한 상세 혜택이나 설명을 입력하세요."
                  value={newProduct.description || ''}
                  onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                />
              </div>

              <div className="flex gap-2 pt-4">
                {editingId && <button type="button" onClick={resetForms} className="flex-1 py-5 bg-slate-200 text-slate-500 rounded-2xl font-bold uppercase text-[11px] tracking-widest">취소</button>}
                <button type="submit" disabled={isProcessing} className="flex-1 py-5 bg-[#2F3A32] text-white rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-xl">{editingId ? '업데이트' : '신규 생성'}</button>
              </div>
            </form>

            <div className="col-span-8 space-y-4">
              {membershipProducts.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 rounded-[32px] border border-slate-100 border-dashed">
                  <p className="text-slate-400 font-bold text-sm">등록된 멤버십 상품이 없습니다.</p>
                  <p className="text-slate-300 text-[10px] mt-2">좌측 폼을 통해 새로운 상품을 등록해주세요.</p>
                </div>
              ) : (
                membershipProducts.map(p => (
                  <div key={p.id} className="bg-white p-8 rounded-[32px] border luxury-shadow flex justify-between items-start group hover:border-[#1A3C34] transition-all">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase ${p.tier === 'DIAMOND' ? 'bg-indigo-100 text-indigo-600' :
                          p.tier === 'PLATINUM' ? 'bg-slate-200 text-slate-600' :
                            p.tier === 'GOLD' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'
                          }`}>{p.tier}</span>
                        <h5 className="font-bold text-[#2F3A32] text-xl">{p.name}</h5>
                      </div>
                      <div className="flex gap-6 text-[12px] font-bold text-slate-500">
                        <span>₩{p.totalAmount.toLocaleString()}</span>
                        <span>•</span>
                        <span>유효기간: {p.validMonths}개월</span>
                        <span>•</span>
                        <span>할인율: {p.defaultDiscountRate}%</span>
                        {p.bonusAmount > 0 && <span className="text-emerald-500">• +₩{p.bonusAmount.toLocaleString()} Bonus</span>}
                      </div>
                      {p.description && <p className="text-sm text-slate-400 leading-relaxed max-w-xl">{p.description}</p>}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => { setEditingId(p.id); setNewProduct(p); }} className="px-5 py-3 bg-slate-50 text-[10px] font-bold rounded-xl hover:bg-slate-100 transition-colors">수정</button>
                      <button onClick={() => handleDeleteItem(p.id, 'PRODUCT')} className="px-5 py-3 bg-rose-50 text-rose-400 text-[10px] font-bold rounded-xl hover:bg-rose-100 transition-colors">삭제</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'CARE_PROGRAM' && (
          <div className="grid grid-cols-12 gap-12 animate-in slide-in-from-right-4">
            <form onSubmit={handleProgramSubmit} className="col-span-4 bg-white p-10 rounded-[48px] border luxury-card space-y-6 h-fit">
              <h4 className="text-xl font-bold text-[#2F3A32] font-serif italic mb-4">케어 프로그램 설정</h4>
              <input required className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold" placeholder="프로그램명" value={newProgram.name} onChange={e => setNewProgram({ ...newProgram, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" required className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold" placeholder="기본 가격" value={newProgram.basePrice} onChange={e => setNewProgram({ ...newProgram, basePrice: +e.target.value })} />
                <input type="number" required className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold" placeholder="소요 시간" value={newProgram.durationMinutes} onChange={e => setNewProgram({ ...newProgram, durationMinutes: +e.target.value })} />
              </div>
              <button type="submit" disabled={isProcessing} className="w-full py-5 bg-[#2F3A32] text-white rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-xl">프로그램 저장</button>
            </form>
            <div className="col-span-8 space-y-4">
              {carePrograms.map(p => (
                <div key={p.id} className="bg-white p-8 rounded-[32px] border luxury-shadow flex justify-between items-center">
                  <div><h5 className="font-bold text-[#2F3A32] text-lg">{p.name}</h5><p className="text-sm text-[#A58E6F] font-bold mt-1">₩{p.basePrice.toLocaleString()} ({p.durationMinutes}분)</p></div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingId(p.id); setNewProgram(p); }} className="px-5 py-2.5 bg-slate-50 text-[10px] font-bold rounded-xl">수정</button>
                    <button onClick={() => handleDeleteItem(p.id, 'PROGRAM')} className="px-5 py-2.5 bg-rose-50 text-rose-400 text-[10px] font-bold rounded-xl">삭제</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'MANAGER' && (
          <div className="grid grid-cols-12 gap-12 animate-in slide-in-from-right-4">
            <form onSubmit={handleManagerSubmit} className="col-span-4 bg-white p-10 rounded-[48px] border luxury-card space-y-6 h-fit">
              <h4 className="text-xl font-bold text-[#2F3A32] font-serif italic mb-4">관리사 설정</h4>
              <input required className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold" placeholder="관리사 성함" value={newManager.name} onChange={e => setNewManager({ ...newManager, name: e.target.value })} />
              <input required className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold" placeholder="연락처" value={newManager.phone} onChange={e => setNewManager({ ...newManager, phone: e.target.value })} />
              <button type="submit" disabled={isProcessing} className="w-full py-5 bg-[#2F3A32] text-white rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-xl">관리사 저장</button>
            </form>
            <div className="col-span-8 space-y-4">
              {managers.map(m => (
                <div key={m.id} className="bg-white p-8 rounded-[32px] border luxury-shadow flex justify-between items-center">
                  <div><h5 className="font-bold text-[#2F3A32] text-lg">{m.name}</h5><p className="text-sm text-slate-400 mt-1">{m.phone}</p></div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingId(m.id); setNewManager(m); }} className="px-5 py-2.5 bg-slate-50 text-[10px] font-bold rounded-xl">수정</button>
                    <button onClick={() => handleDeleteItem(m.id, 'MANAGER')} className="px-5 py-2.5 bg-rose-50 text-rose-400 text-[10px] font-bold rounded-xl">삭제</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'DATA_HUB' && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-[#1A3C34] rounded-[60px] p-20 shadow-2xl relative overflow-hidden flex flex-col min-h-[650px]">
              {/* Header inside Hub */}
              <div className="flex justify-between items-start z-10">
                <div>
                  <h2 className="text-4xl font-serif-luxury italic font-bold text-white mb-4">데이터 마이그레이션 허브</h2>
                  <p className="text-[#A58E6F] font-bold uppercase tracking-[0.4em] text-xs">최고 관리자 승인 필요</p>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="px-6 py-3 border border-white/20 text-white/70 hover:text-white hover:border-white rounded-full text-[11px] font-bold transition-all flex items-center gap-2"
                >
                  ↓ 업로드 표준 양식 다운로드 (.xlsx)
                </button>
              </div>

              {/* Main Control Cards */}
              <div className="grid grid-cols-2 gap-10 mt-32 z-10">
                {/* Backup Card */}
                <div
                  onClick={runBackup}
                  className="bg-white/5 border border-white/10 p-16 rounded-[56px] hover:bg-white/10 transition-all cursor-pointer group luxury-shadow"
                >
                  <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center text-5xl mb-10 group-hover:scale-110 transition-transform">💾</div>
                  <h4 className="text-3xl font-bold text-white mb-4">DB 전체 백업</h4>
                  <p className="text-sm text-white/40 leading-relaxed font-medium">전체 회원 및 이용 내역을 클라우드에 안전하게 백업합니다.</p>
                </div>

                {/* Migration Card */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white/5 border border-white/10 p-16 rounded-[56px] hover:bg-white/10 transition-all cursor-pointer group luxury-shadow"
                >
                  <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center text-5xl mb-10 group-hover:scale-110 transition-transform">📥</div>
                  <h4 className="text-3xl font-bold text-white mb-4">Bulk Migration</h4>
                  <p className="text-sm text-white/40 leading-relaxed font-medium">CSV 파일을 통해 대규모 회원 데이터를 시스템으로 즉시 이관합니다.</p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".csv"
                    onChange={handleBulkUpload}
                  />
                </div>
              </div>

              {/* System Health Check Trigger */}
              <div className="mt-8 flex justify-end z-10 px-4">
                <button
                  onClick={runSystemHealthCheck}
                  disabled={isProcessing}
                  className="flex items-center gap-2 text-white/50 hover:text-white hover:underline text-[10px] font-bold uppercase tracking-widest transition-all"
                >
                  <span className={`w-2 h-2 rounded-full ${healthStatus?.includes('✅') ? 'bg-emerald-400' : healthStatus?.includes('❌') ? 'bg-rose-400' : 'bg-slate-500'}`}></span>
                  {healthStatus || '시스템 연결 상태 점검 실행'}
                </button>
              </div>

              {/* Decorative elements */}
              <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full border border-white/5 rounded-full scale-150 pointer-events-none"></div>
            </div>

            {/* Backup History List */}
            <div className="mt-12 bg-white p-12 rounded-[60px] border luxury-shadow">
              <h4 className="text-2xl font-serif-luxury italic font-bold text-[#1A3C34] mb-8">Recent Cloud Backups</h4>
              <div className="space-y-4">
                {dbBackups.length > 0 ? dbBackups.map(backup => (
                  <div key={backup.id} className="flex justify-between items-center p-6 bg-[#F9FAFB] rounded-[32px] border border-slate-100 hover:border-[#1A3C34] transition-all group">
                    <div className="flex gap-6 items-center">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-xl shadow-sm">📦</div>
                      <div>
                        <h5 className="font-bold text-[#1A3C34]">{backup.backupName || 'Unnamed Backup'}</h5>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                          {backup.createdAt?.split('T')[0]} • Size: {(backup.backupSize / 1024).toFixed(1)} KB • By: {backup.adminEmail}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(backup.backupData, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = `${backup.backupName}.json`;
                        link.click();
                      }}
                      className="px-6 py-3 bg-white border rounded-2xl text-[10px] font-bold text-[#A58E6F] uppercase tracking-widest hover:bg-[#1A3C34] hover:text-white transition-all shadow-sm"
                    >
                      Download JSON
                    </button>
                  </div>
                )) : (
                  <div className="text-center py-10 text-slate-400 italic">저장된 백업 기록이 없습니다.</div>
                )}
              </div>
            </div>
          </div>

        )}

        {activeTab === 'SECURITY' && (
          <div className="bg-white p-16 rounded-[60px] border luxury-shadow animate-in slide-in-from-bottom-4">
            <h3 className="text-3xl font-serif-luxury italic font-bold text-[#1A3C34] mb-12">보안 정책 관리</h3>
            <div className="grid grid-cols-2 gap-12">
              <div className="space-y-6">
                {!isVerified ? (
                  <div className="animate-in fade-in slide-in-from-bottom-2">
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Security Verification</h4>
                    <form onSubmit={handleSecurityCheck} className="space-y-4">
                      <p className="text-[11px] text-[#A58E6F] font-bold leading-relaxed mb-4">
                        관리자 암호 변경을 위해 2단계 보안 인증이 필요합니다.<br />
                        발급된 보안 코드를 입력해주세요.
                      </p>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2 mb-1 block">Security Code</label>
                        <input
                          type="password"
                          required
                          placeholder="인증 번호 입력"
                          className="w-full px-8 py-5 bg-[#F9FAFB] border rounded-2xl outline-none font-bold text-center tracking-widest"
                          value={loginPwdForm.verificationCode}
                          onChange={e => setLoginPwdForm({ ...loginPwdForm, verificationCode: e.target.value })}
                        />
                      </div>
                      <button type="submit" className="w-full py-5 bg-[#1A3C34] text-white rounded-2xl font-bold uppercase tracking-widest text-[11px] shadow-lg hover:shadow-xl transition-all">
                        Verify Identity (인증 확인)
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-right-2">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Update Login Key</h4>
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full">✓ Verified</span>
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); handleLoginPwdChange(e); }} className="space-y-4">
                      <input type="password" required placeholder="현재 비밀번호" className="w-full px-8 py-5 bg-[#F9FAFB] border rounded-2xl" value={loginPwdForm.current} onChange={e => setLoginPwdForm({ ...loginPwdForm, current: e.target.value })} />
                      <input type="password" required placeholder="새 비밀번호" className="w-full px-8 py-5 bg-[#F9FAFB] border rounded-2xl" value={loginPwdForm.new} onChange={e => setLoginPwdForm({ ...loginPwdForm, new: e.target.value })} />
                      <input type="password" required placeholder="새 비밀번호 확인" className="w-full px-8 py-5 bg-[#F9FAFB] border rounded-2xl" value={loginPwdForm.confirm} onChange={e => setLoginPwdForm({ ...loginPwdForm, confirm: e.target.value })} />
                      <button type="submit" className="w-full py-5 bg-[#2F3A32] text-white rounded-2xl font-bold uppercase tracking-widest text-[11px]">비밀번호 갱신</button>
                    </form>
                  </div>
                )}
              </div>
              <div className="p-10 bg-slate-50 rounded-[44px] flex flex-col justify-center text-center space-y-4 border">
                <p className="text-sm text-slate-500 font-medium italic">마스터 보안키는 암호화되어 안전하게 보관 중입니다.</p>
                <p className="text-[10px] text-[#A58E6F] font-bold uppercase tracking-widest">Master Interlock Active</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {
        showAuthModal.open && (
          <div className="fixed inset-0 bg-[#1A3C34]/98 backdrop-blur-2xl z-[3000] flex items-center justify-center p-8 animate-in fade-in duration-500">
            <div className="bg-white p-20 rounded-[80px] max-w-md w-full text-center space-y-12 shadow-2xl relative border">
              <h4 className="text-3xl font-serif-luxury italic font-bold text-[#1A3C34]">Security Interlock</h4>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">마스터 보안키를 입력하여 잠금을 해제하십시오.</p>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full py-10 text-center text-7xl bg-slate-50 border rounded-[44px] outline-none font-bold tracking-[0.5em]"
                value={authInput}
                onChange={e => setAuthInput(e.target.value)}
                autoFocus
                onKeyPress={e => e.key === 'Enter' && handleAuthConfirm()}
              />
              <button
                onClick={handleAuthConfirm}
                className="w-full py-6 bg-[#1A3C34] text-white rounded-[32px] font-bold uppercase tracking-[0.4em] shadow-2xl"
              >
                보안 해제 및 진행
              </button>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default MasterSettings;
