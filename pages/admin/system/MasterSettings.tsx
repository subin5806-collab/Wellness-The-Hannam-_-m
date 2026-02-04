
import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, Filter, Search, Plus, Calendar, Settings, Shield, UserX, Download, Upload, Lock, Key, ShieldCheck, X, FileSpreadsheet } from 'lucide-react';
import { db, hashPassword } from '../../../db';
import { Program, MembershipProduct, Manager, Admin, SystemBackup, Category } from '../../../types';
import * as XLSX from 'xlsx';
import { AligoService } from '../../../services/aligo';
import { MessageSquare, Clock, Send, PlayCircle, StopCircle, RefreshCw, AlertCircle, Trash2 } from 'lucide-react';

type SettingsTab = 'MEMBERSHIP' | 'CARE_PROGRAM' | 'MANAGER' | 'SECURITY' | 'DATA_HUB' | 'ALIMTALK';
const MASTER_SEC_KEY = 'ekftnq0134!';

const MasterSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('MEMBERSHIP');
  const [membershipProducts, setMembershipProducts] = useState<MembershipProduct[]>([]);
  const [carePrograms, setCarePrograms] = useState<Program[]>([]);
  const [categories, setCategories] = useState<Category[]>([]); // New State
  const [managers, setManagers] = useState<Manager[]>([]);
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Forms
  const [newProduct, setNewProduct] = useState<Partial<MembershipProduct>>({ name: '', totalAmount: 0, tier: 'BASIC', bonusAmount: 0, validMonths: 12, defaultDiscountRate: 0, description: '' });
  // Updated Program Form Initial State
  const [newProgram, setNewProgram] = useState<Partial<Program>>({ name: '', basePrice: 0, categoryId: '', durationMinutes: 60, description: '' });
  const [newManager, setNewManager] = useState<Partial<Manager>>({ name: '', phone: '', adminMemo: '' });
  const [loginPwdForm, setLoginPwdForm] = useState({ current: '', new: '', confirm: '' });
  // [NEW] Master Interlock State
  const [securityConfig, setSecurityConfig] = useState({ masterPassword: '', authNumber: '' });
  const [masterLockVerified, setMasterLockVerified] = useState(false);
  const [masterInput, setMasterInput] = useState({ password: '', authCode: '' });
  const [newMasterForm, setNewMasterForm] = useState({ password: '', authCode: '' });

  // [Excel Export]
  const handleExcelExport = async (type: 'MEMBERS' | 'RESERVATIONS' | 'SALES' | 'CONSULTATIONS') => {
    if (!masterLockVerified) {
      setAuthInput('');
      setShowAuthModal({
        open: true,
        onChevron: () => handleExcelExport(type)
      });
      return;
    }
    setIsProcessing(true);
    try {
      // Common: Member Lookup Map
      const members = await db.members.getAll();
      const memberMap = new Map(members.map(m => [m.id, m]));
      const getMemberName = (id: string) => memberMap.get(id)?.name || '삭제된 회원';
      const getMemberPhone = (id: string) => memberMap.get(id)?.phone || '-';

      let data: any[] = [];
      let filename = '';
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

      if (type === 'MEMBERS') {
        filename = `회원명단_${timestamp}.xlsx`;
        // Enhance with Balance
        const memberships = await db.memberships.getAll();
        const balanceMap = new Map();
        memberships.forEach(ms => {
          const current = balanceMap.get(ms.memberId) || 0;
          balanceMap.set(ms.memberId, current + ms.remainingAmount);
        });

        data = members.map(m => ({
          '회원명': m.name,
          '전화번호': m.phone,
          '성별': m.gender,
          '생년월일': m.birthDate,
          '등급': '일반',
          '잔액': (balanceMap.get(m.id) || 0).toLocaleString(),
          '관리자메모': m.adminMemo
        }));

      } else if (type === 'RESERVATIONS') {
        filename = `예약내역_${timestamp}.xlsx`;
        const [res, progs, mgrs] = await Promise.all([
          db.reservations.getAll(),
          db.master.programs.getAll(),
          db.master.managers.getAll()
        ]);
        const progMap = new Map(progs.map(p => [p.id, p]));
        const mgrMap = new Map(mgrs.map(m => [m.id, m]));

        data = res.map((r: any) => ({
          '예약일자': r.date,
          '예약시간': r.time,
          '회원명': getMemberName(r.memberId),
          '전화번호': getMemberPhone(r.memberId),
          '프로그램': progMap.get(r.programId)?.name || '알 수 없음',
          '담당관리사': mgrMap.get(r.managerId)?.name || '-',
          '상태': r.status,
          '메모': r.adminMemo || ''
        }));
      } else if (type === 'SALES') {
        filename = `매출(멤버십)_${timestamp}.xlsx`;
        const sales = await db.memberships.getAll();
        data = sales.map(s => ({
          '회원명': getMemberName(s.memberId),
          '전화번호': getMemberPhone(s.memberId),
          '상품명': s.productName,
          '결제금액': s.totalAmount,
          '사용금액': s.usedAmount,
          '잔액': s.remainingAmount,
          '등록일': s.createdAt,
          '만료일': s.expiryDate
        }));
      } else if (type === 'CONSULTATIONS') {
        filename = `상담메모(Private)_${timestamp}.xlsx`;
        const notes = await db.adminNotes.getAll();
        data = notes.map((n: any) => ({
          '작성일시': n.createdAt,
          '회원명': getMemberName(n.memberId),
          '전화번호': getMemberPhone(n.memberId),
          '내용': n.content,
          '작성자': n.adminEmail
        }));
      }

      // Download
      if (data.length === 0) return alert('다운로드할 데이터가 없습니다.');

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      // Set col width auto
      const max_width = data.reduce((w, r) => Math.max(w, Object.values(r).join('').length), 10);
      ws['!cols'] = Object.keys(data[0]).map(() => ({ wch: 20 })); // Simple fixed width

      XLSX.writeFile(wb, filename);

    } catch (e: any) {
      alert('엑셀 다운로드 실패: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Master Key Interlock (Legacy Modal - Keeping for Data Hub compat until refactored)
  const [showAuthModal, setShowAuthModal] = useState<{ open: boolean, onChevron: () => void }>({ open: false, onChevron: () => { } });
  const [authInput, setAuthInput] = useState('');
  const [dbBackups, setDbBackups] = useState<SystemBackup[]>([]);

  // Category Filtering State
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedSubgroupId, setSelectedSubgroupId] = useState<string | null>(null);

  // [AlimTalk State]
  const [alimTalkConfig, setAlimTalkConfig] = useState<any>(null);
  const [alimTalkTemplates, setAlimTalkTemplates] = useState<any[]>([]);
  const [manualMsg, setManualMsg] = useState({ receiver: '', templateCode: '', content: '' });
  const [msgStatus, setMsgStatus] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    checkAdminRole();
    resetForms();
  }, [activeTab]);

  useEffect(() => {
    // Determine default parent category selection
    if (activeTab === 'CARE_PROGRAM' && categories.length > 0 && !selectedParentId) {
      const firstParent = categories.find(c => !c.parentId);
      if (firstParent) setSelectedParentId(firstParent.id);
    }
  }, [categories, activeTab]);

  const resetForms = () => {
    setEditingId(null);
    setNewProduct({ name: '', totalAmount: 0, tier: 'BASIC', bonusAmount: 0, validMonths: 12, defaultDiscountRate: 0, description: '' });
    setNewProgram({ name: '', basePrice: 0, categoryId: '', durationMinutes: 60, description: '' });
    setNewManager({ name: '', phone: '', adminMemo: '' });
    setLoginPwdForm({ current: '', new: '', confirm: '' });
    setMasterInput({ password: '', authCode: '' });
    // Keep verified state? No, reset on tab change for security.
    setMasterLockVerified(false);
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
      else if (activeTab === 'CARE_PROGRAM') {
        // Parallel Fetch
        const [progs, cats] = await Promise.all([
          db.master.programs.getAll(),
          db.categories.getAll()
        ]);
        setCarePrograms(progs);
        setCategories(cats);
      }
      else if (activeTab === 'MANAGER') setManagers(await db.master.managers.getAll());
      else if (activeTab === 'DATA_HUB') {
        const [backups, config] = await Promise.all([
          db.system.backups.getAll(),
          db.system.getSecurityConfig()
        ]);
        setDbBackups(backups);
        if (config) setSecurityConfig(config);
      }
      else if (activeTab === 'SECURITY') {
        const config = await db.system.getSecurityConfig();
        if (config) {
          setSecurityConfig(config);
          // Pre-fill update form with current values for convenience
          setNewMasterForm({ password: config.masterPassword, authCode: config.authNumber });
        }
      }
      else if (activeTab === 'ALIMTALK') {
        const [config, templates] = await Promise.all([
          db.system.getAlimTalkConfig(),
          AligoService.getTemplates()
        ]);
        setAlimTalkConfig(config);
        setAlimTalkTemplates(templates);
      }
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
          // [NEW] Trigger Backup via Serverless Function
          const res = await fetch('/api/cron/daily-backup');
          const result = await res.json();

          if (result.success) {
            alert(`시스템 백업 완료\n클라우드 저장: 성공\n파일명: ${result.fileName}`);
            loadData();
          } else {
            throw new Error(result.error || 'Backup Failed');
          }
        } catch (e: any) { alert(e.message); }
        finally { setIsLoading(false); }
      } catch(e: any) { alert(e.message); }
        finally { setIsLoading(false); }
    }
    });
};

const handleBulkUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  setAuthInput('');
  setShowAuthModal({
    open: true, onChevron: async () => {
      setIsProcessing(true);
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;

          // [RESTORE MODE] JSON File
          if (file.name.endsWith('.json')) {
            const backupData = JSON.parse(content);
            if (!confirm(`[경고] 전체 시스템 복구를 시작하시겠습니까?\n백업 파일: ${file.name}\n\n주의: 기존 데이터와 충돌할 경우 덮어쓰거나 무시됩니다.`)) return;

            await db.system.restoreFromBackup(backupData);
            alert('시스템 복구가 완료되었습니다.');
            window.location.reload();
            return;
          }

          // [MIGRATION MODE] CSV File
          const rows = content.split('\n').map(row => row.split(',').map(cell => cell.replace(/^"(.*)"$/, '$1').trim()));
          const dataRows = rows.slice(1).filter(r => r.length >= 10 && r[0]);

          if (dataRows.length === 0) return alert('업로드할 데이터가 없습니다.');

          const result = await db.system.processCsvMigration(dataRows);

          alert(`마이그레이션 결과 리포트\n\n[성공]: ${result.successCount}건\n[실패]: ${result.errors.length}건\n\n` + (result.errors.length > 0 ? `--- 실패 내역 ---\n${result.errors.join('\n')}` : '모든 데이터가 완벽하게 이관되었습니다.'));
          loadData();

        } catch (err: any) {
          alert(`작업 실패: ${err.message}`);
        } finally {
          setIsProcessing(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };

      if (file.name.endsWith('.json')) {
        reader.readAsText(file);
      } else {
        // Assume CSV (Text)
        reader.readAsText(file); // Encoding issue? default UTF-8 usually fine for web
      }
    }
  });
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


const handleCategorySubmit = async (name: string, parentId: string | null) => {
  if (!name) return;
  try {
    await db.categories.add({ name, parentId, type: 'service' });
    loadData();
  } catch (e: any) { alert(e.message); }
};

const handleCategoryDelete = async (id: string) => {
  if (!confirm('카테고리를 삭제하시겠습니까? 하위 카테고리도 모두 삭제됩니다.')) return;
  try {
    await db.categories.delete(id);
    if (selectedParentId === id) setSelectedParentId(null);
    if (selectedSubgroupId === id) setSelectedSubgroupId(null);
    loadData();
  } catch (e: any) { alert(e.message); }
};

/* Security Handlers */
const handleSecurityCheck = (e: React.FormEvent) => {
  e.preventDefault();
  if (masterInput.password === securityConfig.masterPassword && masterInput.authCode === securityConfig.authNumber) {
    setMasterLockVerified(true);
    // Pre-fill update form
    setNewMasterForm({ password: securityConfig.masterPassword, authCode: securityConfig.authNumber });
  } else {
    alert('보안 인증 정보가 일치하지 않습니다.\n(초기값: ekftnq0134! / ekftnq0134!)');
  }
};

const handleMasterUpdate = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!masterLockVerified) return;
  if (!newMasterForm.password || !newMasterForm.authCode) return alert('모든 필드를 입력해주세요.');

  if (!confirm('경고: 마스터 보안키를 변경하시겠습니까?\n이 변경사항은 시스템 전체(백업/이관 포함)에 즉시 적용됩니다.')) return;

  try {
    await db.system.updateSecurityConfig(newMasterForm.password, newMasterForm.authCode);
    setSecurityConfig({ masterPassword: newMasterForm.password, authNumber: newMasterForm.authCode });
    alert('마스터 보안키가 성공적으로 변경되었습니다.\n새로운 키를 안전하게 보관해주세요.');
  } catch (err: any) {
    alert('변경 실패: ' + err.message);
  }
};

const handleLoginPwdChange = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!currentAdmin) return;
  if (loginPwdForm.new !== loginPwdForm.confirm) return alert('새 비밀번호 확인이 일치하지 않습니다.');

  // Strict Interlock
  if (!masterLockVerified) return alert('마스터 잠금이 해제되지 않았습니다. 우측 패널에서 보안 인증을 먼저 진행해주세요.');

  try {
    if (currentAdmin.role === 'SUPER') {
      const adminConfig = await db.admins.getByEmail(currentAdmin.email);
      if (adminConfig && adminConfig.password) {
        // Verify current password logic skipped for now as per user legacy code style, or check if needed.
        // Legacy code didn't verify current. We assume Master Lock is the verification.
      }
    }
    await db.admins.updateLoginPassword(currentAdmin.email, loginPwdForm.new);
    await checkAdminRole();
  } catch (err: any) {
    alert(`변경 중 오류: ${err.message}`);
  } finally {
    setIsProcessing(false);
  }
};

const handleAuthConfirm = () => {
  // Legacy Modal (Data Hub Access) - Verify against Master Password
  if (authInput === securityConfig.masterPassword) {
    setMasterLockVerified(true);
    showAuthModal.onChevron();
    setShowAuthModal({ ...showAuthModal, open: false });
    setAuthInput('');
  } else {
    alert('마스터 보안키가 일치하지 않습니다.\n(초기값: ekftnq0134!)');
  }
};

/* AlimTalk Handlers */
const handleAlimTalkConfigSave = async () => {
  if (!alimTalkConfig) return;
  try {
    await db.system.updateAlimTalkConfig(alimTalkConfig);
    alert('알림톡 설정이 저장되었습니다.\n(스마트 크론: 매시간 정각 체크)');
  } catch (e: any) { alert(e.message); }
};

const handleManualAlimTalkSend = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!manualMsg.receiver || !manualMsg.content) return alert('수신번호와 내용을 입력해주세요.');
  setMsgStatus('Sending...');
  try {
    const res = await AligoService.sendDirect(manualMsg.receiver, manualMsg.content, manualMsg.templateCode);
    if (res.code === 0) {
      setMsgStatus('✅ 발송 성공');
      setManualMsg({ ...manualMsg, content: '' });
    } else {
      setMsgStatus(`❌ 실패: ${res.message}`);
    }
  } catch (e: any) {
    setMsgStatus(`❌ 오류: ${e.message}`);
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
        { id: 'MANAGER', label: '강사 관리' },
        { id: 'ALIMTALK', label: '알림톡 센터' },
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
        <div className="flex flex-col gap-8 animate-in slide-in-from-right-4">
          {/* 1. Parent Categories (Top Tabs) */}
          <div className="flex items-center gap-4 overflow-x-auto pb-4 no-scrollbar border-b border-slate-100">
            <button
              onClick={() => setSelectedParentId(null)}
              className={`px-8 py-4 rounded-[28px] text-[13px] font-bold transition-all shadow-sm ${!selectedParentId ? 'bg-[#2F3A32] text-white shadow-xl scale-105' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}
            >
              ALL
            </button>
            {categories.filter(c => !c.parentId).map(cat => (
              <div key={cat.id} className="relative group">
                <button
                  onClick={() => setSelectedParentId(cat.id)}
                  className={`px-8 py-4 rounded-[28px] text-[13px] font-bold transition-all whitespace-nowrap shadow-sm pr-10 ${selectedParentId === cat.id ? 'bg-[#2F3A32] text-white shadow-xl scale-105' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100'}`}
                >
                  {cat.name}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCategoryDelete(cat.id); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-full bg-black/10 hover:bg-rose-500 text-white transition-all text-[10px]"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() => { const name = prompt('새 대분류(Parent Category) 이름을 입력하세요:'); if (name) handleCategorySubmit(name, null); }}
              className="px-6 py-4 rounded-[28px] text-[12px] font-bold bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 border border-dashed border-slate-300 hover:border-emerald-300 transition-all"
            >
              + 분류 추가
            </button>
          </div>

          <div className="grid grid-cols-12 gap-8 min-h-[600px]">
            {/* 2. Subgroups (Left Sidebar) */}
            <div className="col-span-3 flex flex-col gap-3">
              <h3 className="text-[11px] font-bold text-[#A58E6F] uppercase tracking-widest px-4 mb-2 flex justify-between items-center">
                <span>{selectedParentId ? categories.find(c => c.id === selectedParentId)?.name : '전체 목록'}</span>
                <span className="text-slate-300">{categories.filter(c => selectedParentId ? c.parentId === selectedParentId : !!c.parentId).length}</span>
              </h3>

              {/* Subgroup List */}
              {categories.filter(c => (selectedParentId ? c.parentId === selectedParentId : !!c.parentId)).map(sub => (
                <div key={sub.id} className="relative group">
                  <button
                    onClick={() => setSelectedSubgroupId(sub.id)}
                    className={`w-full p-5 rounded-[24px] text-left text-[13px] font-bold transition-all flex justify-between items-center ${selectedSubgroupId === sub.id ? 'bg-[#1A3C34] text-white shadow-lg ring-2 ring-[#1A3C34]/10' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100'}`}
                  >
                    <span>{sub.name}</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCategoryDelete(sub.id); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-[10px] px-2 py-1 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 font-bold transition-all"
                  >
                    삭제
                  </button>
                </div>
              ))}

              {selectedParentId ? (
                <button
                  onClick={() => { const name = prompt(`[${categories.find(c => c.id === selectedParentId)?.name}] 하위에 추가할 소그룹 이름을 입력하세요:`); if (name) handleCategorySubmit(name, selectedParentId); }}
                  className="p-5 rounded-[24px] text-center text-[12px] font-bold bg-slate-50 text-slate-400 hover:bg-white hover:text-[#1A3C34] border border-dashed border-slate-200 hover:border-[#1A3C34] transition-all"
                >
                  + 소그룹 추가
                </button>
              ) : (
                <div className="p-8 text-center text-slate-300 text-[11px] font-medium border border-dashed rounded-[24px]">
                  대분류를 선택하면<br />소그룹을 추가할 수 있습니다.
                </div>
              )}
            </div>

            {/* 3. Program List (Right) */}
            <div className="col-span-9 space-y-6">
              {/* Header & Add Button */}
              <div className="flex justify-between items-center bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#F9F9FB] rounded-2xl flex items-center justify-center text-xl shadow-inner">
                    {selectedSubgroupId ? '📂' : '📑'}
                  </div>
                  <div>
                    <h4 className="font-bold text-[#2F3A32] text-lg">
                      {selectedSubgroupId ? categories.find(c => c.id === selectedSubgroupId)?.name : '전체 프로그램'}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                      Total Items: {carePrograms.filter(p => !selectedSubgroupId || p.categoryId === selectedSubgroupId).length}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!selectedSubgroupId) return alert('프로그램을 등록할 소그룹(카테고리)을 먼저 왼쪽에서 선택해주세요.');
                    resetForms();
                    setNewProgram({ ...newProgram, categoryId: selectedSubgroupId });
                    setEditingId('NEW_ITEM_MODE');
                  }}
                  className="px-8 py-4 bg-[#2F3A32] text-white rounded-[20px] text-[11px] font-bold uppercase tracking-widest shadow-lg hover:bg-[#1A3C34] hover:scale-105 active:scale-95 transition-all text-shadow"
                >
                  + 프로그램 등록
                </button>
              </div>

              {/* Edit/Create Form */}
              {editingId && (
                <div className="bg-white p-10 rounded-[40px] border-2 border-[#1A3C34] shadow-[0_20px_60px_rgba(0,0,0,0.1)] animate-in zoom-in-95 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-[#1A3C34]"></div>
                  <h5 className="font-serif-luxury italic font-bold text-[#1A3C34] mb-8 text-2xl">
                    {editingId === 'NEW_ITEM_MODE' ? 'New Program Registration' : 'Edit Program Details'}
                  </h5>

                  <form onSubmit={(e) => {
                    if (editingId === 'NEW_ITEM_MODE') {
                      e.preventDefault();
                      setIsProcessing(true);
                      db.master.programs.add(newProgram)
                        .then(() => { resetForms(); loadData(); })
                        .catch((err: any) => alert(err.message))
                        .finally(() => setIsProcessing(false));
                    } else {
                      handleProgramSubmit(e);
                    }
                  }}>
                    <div className="grid grid-cols-2 gap-6 mb-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">프로그램명</label>
                        <input required className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[#2F3A32] focus:bg-white focus:border-[#1A3C34] transition-all" placeholder="Program Name" value={newProgram.name} onChange={e => setNewProgram({ ...newProgram, name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">카테고리</label>
                        <select className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[#2F3A32] appearance-none focus:bg-white focus:border-[#1A3C34]" value={newProgram.categoryId} onChange={e => setNewProgram({ ...newProgram, categoryId: e.target.value })}>
                          <option value="">카테고리 선택</option>
                          {categories.filter(c => c.parentId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">가격 (KRW)</label>
                        <input type="number" required className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[#2F3A32]" placeholder="Price" value={newProgram.basePrice} onChange={e => setNewProgram({ ...newProgram, basePrice: +e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">소요시간 (분)</label>
                        <input type="number" required className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[#2F3A32]" placeholder="Duration" value={newProgram.durationMinutes} onChange={e => setNewProgram({ ...newProgram, durationMinutes: +e.target.value })} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => setEditingId(null)} className="px-8 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold uppercase text-[11px] tracking-widest hover:bg-slate-200">취소</button>
                      <button type="submit" disabled={isProcessing} className="px-10 py-4 bg-[#1A3C34] text-white rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-xl hover:bg-[#2F3A32]">저장하기</button>
                    </div>
                  </form>
                </div>
              )}

              {/* List */}
              <div className="grid grid-cols-1 gap-4">
                {carePrograms.filter(p => !selectedSubgroupId || p.categoryId === selectedSubgroupId).map(p => (
                  <div key={p.id} className="bg-white p-6 rounded-[32px] border border-slate-100 hover:border-[#1A3C34] transition-all flex justify-between items-center group shadow-sm hover:shadow-md">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-[#F2E8DA]/30 rounded-3xl flex items-center justify-center text-2xl text-[#A58E6F]">
                        {/* Dynamic Icon based on Category? For now static */}
                        💆‍♀️
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h5 className="font-bold text-[#2F3A32] text-lg">{p.name}</h5>
                          {/* Category Badge */}
                          <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-400">
                            {categories.find(c => c.id === p.categoryId)?.name || '기타'}
                          </span>
                        </div>
                        <p className="text-[12px] text-slate-400 font-bold flex gap-3">
                          <span>⏱ {p.durationMinutes}분</span>
                          <span className="text-slate-200">|</span>
                          <span>₩{p.basePrice.toLocaleString()}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                      <button onClick={() => { setEditingId(p.id); setNewProgram(p); }} className="px-6 py-3 bg-slate-50 text-slate-600 text-[11px] font-bold rounded-2xl hover:bg-slate-100 uppercase tracking-wider">수정</button>
                      <button onClick={() => handleDeleteItem(p.id, 'PROGRAM')} className="px-6 py-3 bg-rose-50 text-rose-500 text-[11px] font-bold rounded-2xl hover:bg-rose-100 uppercase tracking-wider">삭제</button>
                    </div>
                  </div>
                ))}
                {carePrograms.filter(p => !selectedSubgroupId || p.categoryId === selectedSubgroupId).length === 0 && !editingId && (
                  <div className="py-20 text-center text-slate-300 font-bold text-sm italic border-2 border-dashed border-slate-100 rounded-[40px]">
                    등록된 프로그램이 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'MANAGER' && (
        <div className="grid grid-cols-12 gap-12 animate-in slide-in-from-right-4">
          <form onSubmit={handleManagerSubmit} className="col-span-4 bg-white p-10 rounded-[48px] border luxury-card space-y-6 h-fit">
            <h4 className="text-xl font-bold text-[#2F3A32] font-serif italic mb-4">강사(Instructor) 계정 관리</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
              강사 등록 시 <strong>로그인 계정이 자동 생성</strong>됩니다.<br />
              - 아이디: 휴대폰 번호<br />
              - 초기 비밀번호: 휴대폰 뒤 4자리
            </p>
            <input required className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold" placeholder="강사 성함" value={newManager.name} onChange={e => setNewManager({ ...newManager, name: e.target.value })} />
            <input required className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold" placeholder="연락처 (- 없이 입력)" value={newManager.phone} onChange={e => setNewManager({ ...newManager, phone: e.target.value })} />
            <div className="flex gap-2">
              {editingId && <button type="button" onClick={resetForms} className="w-1/3 py-5 bg-slate-100 text-slate-500 rounded-2xl font-bold uppercase text-[11px] tracking-widest">취소</button>}
              <button type="submit" disabled={isProcessing} className="flex-1 py-5 bg-[#2F3A32] text-white rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-xl">
                {editingId ? '정보 수정' : '강사 등록'}
              </button>
            </div>
          </form>
          <div className="col-span-8 space-y-4">
            {managers.map(m => (
              <div key={m.id} className={`bg-white p-8 rounded-[32px] border luxury-shadow flex justify-between items-center ${m.isActive === false ? 'opacity-60 grayscale' : ''}`}>
                <div className="flex items-center gap-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${m.isActive !== false ? 'bg-[#2F3A32] text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {m.isActive !== false ? '👩‍🏫' : '💤'}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h5 className="font-bold text-[#2F3A32] text-lg">{m.name}</h5>
                      {m.isActive === false && <span className="px-2 py-0.5 bg-slate-100 text-slate-400 text-[10px] font-bold rounded">비활동</span>}
                      {m.isActive !== false && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded">활동중</span>}
                    </div>
                    <p className="text-sm text-slate-400 mt-1 font-bold tracking-wide">{m.phone}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingId(m.id); setNewManager(m); }} className="px-5 py-2.5 bg-slate-50 text-[#2F3A32] text-[10px] font-bold rounded-xl hover:bg-slate-100 transition-colors">수정</button>
                  {m.isActive !== false ? (
                    <button
                      onClick={async () => {
                        if (!confirm(`${m.name} 강사님을 비활성화하시겠습니까?`)) return;
                        await db.master.managers.update(m.id, { isActive: false });
                        loadData();
                      }}
                      className="px-5 py-2.5 bg-slate-50 text-slate-400 text-[10px] font-bold rounded-xl hover:bg-slate-100 transition-colors"
                    >
                      비활성화
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        await db.master.managers.update(m.id, { isActive: true });
                        loadData();
                      }}
                      className="px-5 py-2.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-xl hover:bg-emerald-100 transition-colors"
                    >
                      활성화
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteItem(m.id, 'MANAGER')}
                    className="px-5 py-2.5 bg-rose-50 text-rose-500 text-[10px] font-bold rounded-xl hover:bg-rose-100 transition-colors"
                    title="완전 삭제 (모든 연동 계정 및 정보 삭제)"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
            {managers.length === 0 && (
              <div className="py-20 text-center text-slate-300 font-bold italic border-2 border-dashed border-slate-100 rounded-[40px]">
                등록된 강사가 없습니다. 좌측 폼을 통해 첫 강사를 등록해주세요.
              </div>
            )}
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

              {/* Excel Export Card (New) */}
              <div className="bg-white/5 border border-white/10 p-16 rounded-[56px] hover:bg-white/10 transition-all luxury-shadow col-span-2 mt-8">
                <div className="flex items-center gap-6 mb-10">
                  <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center text-emerald-400">
                    <FileSpreadsheet size={40} />
                  </div>
                  <div>
                    <h4 className="text-3xl font-bold text-white mb-2">Excel Data Center</h4>
                    <p className="text-sm text-white/40 leading-relaxed font-medium">주요 운영 데이터를 엑셀(XLSX) 형식으로 즉시 추출합니다.<br />마스터 보안 인증(2차)이 완료된 상태에서만 접근 가능합니다.</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  {[
                    { type: 'MEMBERS', label: '회원 명단', icon: '👥' },
                    { type: 'RESERVATIONS', label: '예약 전체', icon: '📅' },
                    { type: 'SALES', label: '매출 현황', icon: '💳' },
                    { type: 'CONSULTATIONS', label: '상담 메모', icon: '📝' },
                  ].map(item => (
                    <button
                      key={item.type}
                      onClick={() => handleExcelExport(item.type as any)}
                      disabled={isProcessing}
                      className={`py-8 rounded-[24px] border border-white/10 flex flex-col items-center gap-3 transition-all ${!masterLockVerified
                        ? 'bg-white/5 opacity-70 hover:bg-white/10 hover:opacity-100'
                        : 'bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95'
                        }`}
                    >
                      <span className="text-3xl filter drop-shadow-lg">{item.icon}</span>
                      <span className="text-sm font-bold text-white tracking-widest">{item.label}</span>
                      {!masterLockVerified && <Lock size={12} className="text-rose-400 mt-1" />}
                    </button>
                  ))}
                </div>
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

      {activeTab === 'ALIMTALK' && alimTalkConfig && (
        <div className="animate-in slide-in-from-right-4 space-y-12">
          {/* 1. Smart Cron Control */}
          <div className="bg-white p-10 rounded-[48px] border luxury-shadow flex justify-between items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-[#FAE100]"></div>
            <div>
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-[#FAE100]/20 rounded-2xl flex items-center justify-center text-[#3B1E1E]">
                  <Clock size={24} />
                </div>
                <h3 className="text-2xl font-bold text-[#3B1E1E]">Smart Cron Automation</h3>
              </div>
              <p className="text-slate-400 font-medium text-sm pl-16">
                매일 지정된 시간에 <span className="text-[#3B1E1E] font-bold">
                  {alimTalkConfig.daysBefore === 0 ? '당일 예약 고객' :
                    alimTalkConfig.daysBefore === 2 ? '모레 예약 고객' : '내일 예약 고객'}
                </span>에게 리마인드 알림톡을 자동 발송합니다.<br />
                <span className="text-[10px] text-slate-300">Powered by Vercel Serverless Cron (Hourly Check)</span>
              </p>
            </div>

            <div className="flex items-center gap-8 bg-slate-50 p-6 rounded-[32px] border border-slate-100">
              <div className="text-center">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">AUTO SENDING</label>
                <button
                  onClick={() => setAlimTalkConfig({ ...alimTalkConfig, isActive: !alimTalkConfig.isActive })}
                  className={`w-16 h-8 rounded-full relative transition-all ${alimTalkConfig.isActive ? 'bg-[#3B1E1E]' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm ${alimTalkConfig.isActive ? 'left-9' : 'left-1'}`}></div>
                </button>
              </div>

              <div className="h-10 w-[1px] bg-slate-200"></div>

              <div className="text-center">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">SEND DAY</label>
                <select
                  className="bg-transparent font-bold text-xl text-[#3B1E1E] outline-none cursor-pointer text-center"
                  value={alimTalkConfig.daysBefore?.toString() || '1'}
                  onChange={e => setAlimTalkConfig({ ...alimTalkConfig, daysBefore: parseInt(e.target.value) })}
                  disabled={!alimTalkConfig.isActive}
                >
                  <option value="0">당일 (Today)</option>
                  <option value="1">1일 전 (D-1)</option>
                  <option value="2">2일 전 (D-2)</option>
                </select>
              </div>

              <div className="h-10 w-[1px] bg-slate-200"></div>

              <div className="text-center">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">SEND TIME (KST)</label>
                <select
                  value={alimTalkConfig.sendTime}
                  onChange={(e) => setAlimTalkConfig({ ...alimTalkConfig, sendTime: e.target.value })}
                  className="bg-transparent font-bold text-xl text-[#3B1E1E] outline-none cursor-pointer text-center"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 9).map(h => (
                    <option key={h} value={`${h}:00`}>{h}:00</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleAlimTalkConfigSave}
                className="px-6 py-3 bg-[#3B1E1E] text-white rounded-xl text-[11px] font-bold shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                설정 저장
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-8">
            {/* 2. Manual Console */}
            <div className="col-span-6 bg-white p-10 rounded-[48px] border luxury-shadow">
              <div className="flex items-center gap-3 mb-8">
                <MessageSquare className="text-[#3B1E1E]" />
                <h4 className="text-xl font-bold text-[#3B1E1E]">Manual Console</h4>
              </div>

              <form onSubmit={handleManualAlimTalkSend} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">수신 번호</label>
                  <input
                    className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[#3B1E1E]"
                    placeholder="01012345678"
                    value={manualMsg.receiver}
                    onChange={e => setManualMsg({ ...manualMsg, receiver: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">템플릿 선택</label>
                  <select
                    className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[#3B1E1E]"
                    value={manualMsg.templateCode}
                    onChange={e => {
                      const tpl = alimTalkTemplates.find(t => t.code === e.target.value);
                      setManualMsg({
                        ...manualMsg,
                        templateCode: e.target.value,
                        content: tpl ? tpl.content : manualMsg.content
                      });
                    }}
                  >
                    <option value="">(직접 입력)</option>
                    {alimTalkTemplates.map(t => (
                      <option key={t.code} value={t.code}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">메시지 내용</label>
                  <textarea
                    className="w-full px-6 py-4 bg-[#FAE100]/10 border border-[#FAE100]/20 rounded-2xl outline-none font-medium text-[#3B1E1E] min-h-[150px] resize-none"
                    value={manualMsg.content}
                    onChange={e => setManualMsg({ ...manualMsg, content: e.target.value })}
                    placeholder="메시지 내용을 입력하세요."
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-emerald-600">{msgStatus}</span>
                  <button type="submit" className="px-8 py-4 bg-[#3B1E1E] text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-black transition-all shadow-xl">
                    <Send size={16} />
                    즉시 발송
                  </button>
                </div>
              </form>
            </div>

            {/* 3. Logic Guide & Info */}
            <div className="col-span-6 space-y-6">
              <div className="bg-[#3B1E1E] p-10 rounded-[48px] text-white relative overflow-hidden">
                <AlertCircle className="w-20 h-20 text-white/5 absolute -right-2 -bottom-2" />
                <h4 className="text-xl font-bold mb-4 font-serif italic">Logic Guide</h4>
                <ul className="space-y-4 text-sm text-white/70">
                  <li className="flex gap-3">
                    <span className="bg-white/10 px-2 py-1 rounded text-xs">Rule 1</span>
                    <span>
                      자동 리마인드는 <strong>
                        {alimTalkConfig.daysBefore === 0 ? '당일 예약자' :
                          alimTalkConfig.daysBefore === 2 ? '이틀 전(모레) 예약자' : '하루 전(내일) 예약자'}
                      </strong>에게만 발송됩니다.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-white/10 px-2 py-1 rounded text-xs">Rule 2</span>
                    <span>Vercel Cron은 UTC 기준이나, 시스템이 <strong>KST 시간대</strong>를 자동 계산하여 설정된 시간에 동작합니다.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-white/10 px-2 py-1 rounded text-xs">Tip</span>
                    <span>템플릿 변수(Example: #{"{이름}"})는 실제 발송 시 고객 정보로 자동 치환됩니다.</span>
                  </li>
                </ul>
              </div>

              <div className="bg-white p-8 rounded-[40px] border border-dashed border-slate-200">
                <div className="flex justify-between items-center mb-6">
                  <h5 className="font-bold text-[#3B1E1E] text-sm uppercase tracking-wider">Template Management</h5>
                  <button
                    onClick={() => {
                      const name = prompt('템플릿명');
                      const content = prompt('템플릿 내용');
                      if (name && content) {
                        AligoService.addTemplate(name, content).then(res => {
                          if (res.code === 0) { alert('등록 요청되었습니다.'); setActiveTab('ALIMTALK'); }
                          else alert('Error: ' + res.message);
                        });
                      }
                    }}
                    className="px-3 py-1 bg-[#FAE100] text-[#3B1E1E] text-xs font-bold rounded-lg hover:bg-yellow-400"
                  >
                    + 신규 등록
                  </button>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {alimTalkTemplates.map((t: any) => {
                    const isApproved = t.status === 'R'; // R: Ready/Approved
                    const isActive = alimTalkConfig.reminderTemplateCode === t.code;

                    return (
                      <div key={t.code} className={`p-5 rounded-2xl border transition-all ${isActive ? 'bg-[#3B1E1E] border-[#3B1E1E] text-white ring-4 ring-[#FAE100]/20' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm truncate">{t.name}</span>
                            {isActive && <span className="bg-[#FAE100] text-[#3B1E1E] text-[10px] px-2 py-0.5 rounded-full font-bold">사용 중 (Active)</span>}
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isApproved ? 'bg-emerald-100 text-emerald-600' : 'bg-yellow-100 text-yellow-700'}`}>
                            {isApproved ? '승인 완료 (Approved)' : '검수 대기 (Inspection)'}
                          </span>
                        </div>
                        <p className="text-xs opacity-80 whitespace-pre-wrap mb-4 leading-relaxed line-clamp-3">{t.content}</p>

                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[10px] opacity-50">{t.code}</span>
                          <div className="flex gap-2">
                            {!isActive && (
                              <button
                                onClick={() => {
                                  if (!isApproved) return alert('검수 중인 템플릿은 발송 설정할 수 없습니다.\n승인이 완료된 후 설정해 주세요.');
                                  setAlimTalkConfig({ ...alimTalkConfig, reminderTemplateCode: t.code, reminderBody: t.content });
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isApproved ? 'bg-white/20 hover:bg-white/30 text-current' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                              >
                                이걸로 설정
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (isActive) return alert('현재 사용 중인 템플릿은 삭제할 수 없습니다.');
                                if (confirm('정말 삭제하시겠습니까?')) {
                                  AligoService.deleteTemplate(t.code).then(() => loadData());
                                }
                              }}
                              className="text-white/40 hover:text-red-400"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'SECURITY' && (
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1A3C34] mb-8 font-serif italic">보안 정책 관리</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Left Panel: Login Password */}
            <div className="relative p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
              {!masterLockVerified && (
                <div className="absolute inset-0 z-20 bg-gray-50/80 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center p-6 text-center">
                  <Lock className="w-12 h-12 text-slate-400 mb-4" />
                  <h3 className="text-lg font-bold text-slate-600">MASTER INTERLOCK ACTIVE</h3>
                  <p className="text-sm text-slate-500 mt-2">우측 패널에서 보안 인증을 완료해야<br />로그인 비밀번호를 변경할 수 있습니다.</p>
                </div>
              )}
              <h3 className="text-xl font-bold text-[#1A3C34] mb-6 flex items-center gap-2">
                <Key className="w-5 h-5" /> UPDATE LOGIN KEY
              </h3>
              <form onSubmit={handleLoginPwdChange} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500">현재 비밀번호</label>
                  <input
                    type="password"
                    value={loginPwdForm.current}
                    onChange={(e) => setLoginPwdForm({ ...loginPwdForm, current: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#1A3C34]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500">새 비밀번호</label>
                  <input
                    type="password"
                    value={loginPwdForm.new}
                    onChange={(e) => setLoginPwdForm({ ...loginPwdForm, new: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#1A3C34]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500">새 비밀번호 확인</label>
                  <input
                    type="password"
                    value={loginPwdForm.confirm}
                    onChange={(e) => setLoginPwdForm({ ...loginPwdForm, confirm: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#1A3C34]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!masterLockVerified}
                  className="w-full py-4 bg-[#2F3A32] text-white rounded-xl font-bold hover:bg-[#1A3C34] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  비밀번호 갱신
                </button>
              </form>
            </div>

            {/* Right Panel: Master Security */}
            <div className="p-8 bg-slate-50 rounded-3xl border border-slate-200 h-fit">
              <h3 className="text-xl font-bold text-[#1A3C34] mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> MASTER SECURITY</div>
                {masterLockVerified && <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full font-bold">✓ VERIFIED</span>}
              </h3>

              {!masterLockVerified ? (
                <form onSubmit={handleSecurityCheck} className="space-y-5">
                  <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                    <p className="text-xs text-slate-500 mb-4 font-medium text-center">마스터 잠금 해제를 위해<br />2차 보안키와 인증 번호를 입력해주세요.</p>
                    <div className="space-y-3">
                      <input type="password" value={masterInput.password} onChange={e => setMasterInput({ ...masterInput, password: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="2차 보안 비밀번호" />
                      <input type="password" value={masterInput.authCode} onChange={e => setMasterInput({ ...masterInput, authCode: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="인증 번호" />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-3 bg-[#1A3C34] text-white rounded-xl font-bold hover:bg-[#2F3A32] shadow-lg shadow-[#1A3C34]/20 transition-all">마스터 잠금 해제</button>
                </form>
              ) : (
                <form onSubmit={handleMasterUpdate} className="space-y-5">
                  <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                    <p className="text-xs text-yellow-800 font-medium leading-relaxed">⚠️ 여기서 변경하는 보안키는 시스템 전체(백업/복구/이관)의 <strong>유일한 마스터키</strong>가 됩니다. 변경 후 반드시 안전하게 기록해두세요.</p>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 ml-1">새 2차 보안 비밀번호</label>
                      <input type="text" value={newMasterForm.password} onChange={e => setNewMasterForm({ ...newMasterForm, password: e.target.value })} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-mono text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 ml-1">새 인증 번호</label>
                      <input type="text" value={newMasterForm.authCode} onChange={e => setNewMasterForm({ ...newMasterForm, authCode: e.target.value })} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-mono text-sm" />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-3 bg-white border-2 border-[#1A3C34] text-[#1A3C34] rounded-xl font-bold hover:bg-slate-50 transition-colors">보안키 변경 저장</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>

    {showAuthModal.open && (
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
    )}
  </div >
);
};

export default MasterSettings;
