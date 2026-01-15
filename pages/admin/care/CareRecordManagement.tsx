
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../db';
import { CareRecord, Member } from '../../../types';

const SECONDARY_PWD_REQUIRED = 'ekdnfhem2ck';

const CareRecordManagement: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [zoomSignature, setZoomSignature] = useState<string | null>(null);

  const [showAuthModal, setShowAuthModal] = useState<{ open: boolean, onChevron: () => void }>({ open: false, onChevron: () => { } });
  const [authInput, setAuthInput] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [allRecords, members, programs] = await Promise.all([
        db.careRecords.getAll(),
        db.members.getAll(),
        db.master.programs.getAll()
      ]);

      const mapped = (allRecords || []).map(r => {
        const m = members.find(mem => mem.id === r.memberId);
        return {
          ...r,
          memberName: m?.name || '알수없음',
          memberPhone: m?.phone || '',
          programName: programs.find(p => p.id === r.programId)?.name || '알수없음',
          dateStr: r.date || '-'
        };
      });
      setRecords(mapped);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchText = (r.memberName || '').includes(searchTerm) || (r.memberPhone || '').includes(searchTerm) || (r.memberPhone?.slice(-4) === searchTerm);
      const matchDate = searchDate ? r.dateStr === searchDate : true;
      return matchText && matchDate;
    });
  }, [records, searchTerm, searchDate]);

  const requestDownloadAuth = (onSuccess: () => void) => {
    setAuthInput('');
    setShowAuthModal({ open: true, onChevron: onSuccess });
  };

  const downloadFilteredCSV = () => {
    requestDownloadAuth(() => {
      const data = filteredRecords.map(r => ({
        이용일자: r.dateStr,
        예약시간: r.reservationTime,
        회원명: r.memberName,
        연락처: r.memberPhone,
        항목: r.noteSummary,
        상세케어노트: r.noteDetails,
        추천내용: r.noteRecommendation,
        차감금액: r.finalPrice,
        차감후잔액: r.balanceAfter,
        생성일: r.createdAt
      }));

      const headers = Object.keys(data[0] || {}).join(',');
      const rows = data.map(row => Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
      const csvContent = "\ufeff" + [headers, ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `이용내역_전문_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    });
  };

  return (
    <div className="space-y-10 page-transition">
      <header className="flex justify-between items-end border-b border-slate-100 pb-10">
        <div>
          <h2 className="text-3xl font-bold text-[#2F3A32]">이용 내역 통합 관리</h2>
          <p className="text-[11px] text-[#A58E6F] font-bold mt-2 uppercase tracking-widest">Unified Usage Timeline Control</p>
        </div>
        <button onClick={downloadFilteredCSV} className="px-10 py-4 border border-slate-200 text-slate-400 rounded-2xl font-bold text-[12px] uppercase tracking-widest shadow-sm hover:bg-[#1A3C34] hover:text-white transition-all">
          검색 내역 다운로드 (노트 포함)
        </button>
      </header>

      <section className="bg-white p-10 rounded-[44px] border luxury-shadow grid grid-cols-12 gap-8 items-end">
        <div className="col-span-3 space-y-3">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-4">날짜별 조회</label>
          <input type="date" className="w-full px-8 py-4 bg-slate-50 border rounded-2xl outline-none font-bold" value={searchDate} onChange={e => setSearchDate(e.target.value)} />
        </div>
        <div className="col-span-7 space-y-3">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-4">회원 검색</label>
          <input type="text" placeholder="성함 또는 핸드폰 뒤 4자리..." className="w-full px-10 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-[15px]" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="col-span-2">
          <button onClick={() => { setSearchTerm(''); setSearchDate(''); }} className="w-full py-4 bg-slate-100 text-slate-400 rounded-2xl font-bold uppercase text-[11px] tracking-widest">초기화</button>
        </div>
      </section>

      <div className="space-y-6">
        {filteredRecords.map(r => (
          <div key={r.id} className="p-10 bg-white rounded-[50px] border border-[#E8E8E4] luxury-shadow flex justify-between items-center group hover:border-[#1A3C34] transition-all">
            <div className="flex gap-12 items-center">
              <div className="text-center min-w-[120px]">
                <p className="text-[12px] text-[#A58E6F] font-bold tabular-nums uppercase">{r.dateStr}</p>
                <p className="text-[10px] text-slate-300 font-bold mt-1 tracking-widest">[{r.reservationTime || '00:00'}]</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h5 className="font-bold text-[#1A3C34] text-[17px]">{r.memberName}님</h5>
                  <span className="text-[10px] text-slate-300 font-bold tabular-nums">({r.memberPhone})</span>
                </div>
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-50 max-w-2xl">
                  <p className="text-[13px] text-slate-500 font-bold leading-relaxed">{r.noteSummary}</p>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{r.noteDetails}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-12 items-center pr-6">
              {r.signatureData && (
                <div onClick={() => setZoomSignature(r.signatureData!)} className="w-16 h-16 rounded-[24px] bg-slate-50 border p-1 cursor-zoom-in grayscale transition-all"><img src={r.signatureData} className="w-full h-full object-contain" /></div>
              )}
              <div className="text-right">
                <span className="text-[20px] font-bold text-rose-400 tabular-nums block">-₩{r.finalPrice.toLocaleString()}</span>
                <span className="text-[10px] font-bold text-emerald-600 tabular-nums uppercase mt-1 block tracking-widest">잔액: ₩{(r.balanceAfter || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAuthModal.open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-2xl z-[2000] flex items-center justify-center p-8">
          <div className="bg-white p-16 rounded-[64px] max-w-md w-full text-center space-y-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-[#A58E6F]"></div>
            <h4 className="text-2xl font-serif-luxury italic font-bold text-[#1A3C34]">Security Access</h4>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">보안 암호를 입력하세요.</p>
            <input type="password" placeholder="••••••••" className="w-full py-8 text-center text-6xl bg-slate-50 border rounded-3xl outline-none tracking-[0.5em] font-bold" value={authInput} onChange={e => setAuthInput(e.target.value)} autoFocus onKeyPress={e => e.key === 'Enter' && (authInput === SECONDARY_PWD_REQUIRED ? (setShowAuthModal({ open: false, onChevron: () => { } }), showAuthModal.onChevron()) : alert('불일치'))} />
            <button onClick={() => { if (authInput === SECONDARY_PWD_REQUIRED) { setShowAuthModal({ open: false, onChevron: () => { } }); showAuthModal.onChevron(); } else alert('불일치'); }} className="w-full py-5 bg-[#1A3C34] text-white rounded-3xl font-bold uppercase text-[10px] shadow-xl">Unlock & Proceed</button>
          </div>
        </div>
      )}

      {zoomSignature && (
        <div className="fixed inset-0 bg-black/90 z-[3000] flex items-center justify-center p-8" onClick={() => setZoomSignature(null)}>
          <div className="bg-white p-4 rounded-[40px] max-w-lg w-full">
            <img src={zoomSignature} className="w-full h-auto object-contain" alt="Signature Zoom" />
          </div>
        </div>
      )}
    </div>
  );
};

export default CareRecordManagement;
