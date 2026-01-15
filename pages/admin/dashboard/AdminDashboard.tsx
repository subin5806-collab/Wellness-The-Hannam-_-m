
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../../db';
import { Member, Membership, CareRecord, Reservation } from '../../../types';

type ViewMode = 'ALL' | 'WEEK' | 'MONTH' | 'DATE';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('WEEK');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<{ res: Reservation[], members: Member[], progs: Program[], mgrs: Manager[] }>({
    res: [], members: [], progs: [], mgrs: []
  });
  const [stats, setStats] = useState({ todayCount: 0, pendingSigs: 0, lowBalanceCount: 0 });
  const [loading, setLoading] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [isNewMember, setIsNewMember] = useState(false);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [newRes, setNewRes] = useState({
    memberId: '', programId: '', managerId: '', date: selectedDate, time: '10:00',
    newName: '', newPhone: '', newGender: '여성' as '남성' | '여성', newBirth: '', newEmail: ''
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [res, pending, low, members, progs, mgrs] = await Promise.all([
        db.reservations.getAll(),
        db.careRecords.getPendingSignatureCount(),
        db.memberships.getLowBalanceCount(100000),
        db.members.getAll(),
        db.master.programs.getAll(),
        db.master.managers.getAll()
      ]);
      setData({ res: res || [], members: members || [], progs: progs || [], mgrs: mgrs || [] });
      setStats({
        todayCount: (res || []).filter(r => r.date === new Date().toISOString().split('T')[0]).length,
        pendingSigs: pending || 0,
        lowBalanceCount: low || 0
      });
    } finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  const filteredSearchMembers = useMemo(() => {
    if (!memberSearchTerm.trim()) return data.members;
    const term = memberSearchTerm.toLowerCase();
    return data.members.filter(m =>
      m.name.toLowerCase().includes(term) ||
      m.phone.slice(-4).includes(term)
    );
  }, [data.members, memberSearchTerm]);

  const timelineData = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    let filtered = data.res || [];

    if (viewMode === 'DATE') filtered = (data.res || []).filter(r => r.date === selectedDate);
    else if (viewMode === 'WEEK') {
      const nextWeek = new Date(); nextWeek.setDate(new Date().getDate() + 7);
      filtered = (data.res || []).filter(r => r.date >= todayStr && r.date <= nextWeek.toISOString().split('T')[0]);
    } else if (viewMode === 'MONTH') {
      const nextMonth = new Date(); nextMonth.setMonth(new Date().getMonth() + 1);
      filtered = (data.res || []).filter(r => r.date >= todayStr && r.date <= nextMonth.toISOString().split('T')[0]);
    }

    const groups: { [key: string]: any[] } = {};
    filtered.forEach(r => {
      if (!groups[r.date]) groups[r.date] = [];
      const m = data.members.find(mem => mem.id === r.memberId);
      const p = data.progs.find(prog => prog.id === r.programId);
      const mgr = data.mgrs.find(mg => mg.id === r.managerId);
      groups[r.date].push({ ...r, memberName: m?.name || '?', programName: p?.name || 'Wellness', managerName: mgr?.name || 'N/A' });
    });

    return Object.keys(groups).sort().map(date => {
      const d = new Date(date);
      const day = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
      return { date, label: `${d.getMonth() + 1}/${d.getDate()} (${day})`, list: groups[date].sort((a, b) => a.time.localeCompare(b.time)) };
    });
  }, [data, viewMode, selectedDate]);

  const handleAddRes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRes.programId || !newRes.date || !newRes.time) return alert('예약 정보(프로그램, 일시)를 입력해 주세요.');

    try {
      let mId = newRes.memberId;
      if (isNewMember) {
        if (!newRes.newName.trim() || !newRes.newPhone.trim() || !newRes.newEmail.trim() || !newRes.newGender) {
          return alert('신규 회원의 성함, 성별, 연락처, 이메일은 필수 입력 사항입니다.');
        }
        const m = await db.members.add({
          name: newRes.newName, phone: newRes.newPhone, gender: newRes.newGender, birthDate: newRes.newBirth, email: newRes.newEmail
        });
        mId = m.id;
      } else if (!mId) {
        return alert('기존 회원을 선택해 주세요.');
      }

      await db.reservations.add({ memberId: mId, programId: newRes.programId, managerId: newRes.managerId, date: newRes.date, time: newRes.time });
      alert('예약이 성공적으로 등록되었습니다.');
      setShowAddModal(false);
      loadAll();
      setMemberSearchTerm('');
      setNewRes({ ...newRes, memberId: '', newName: '', newPhone: '', newEmail: '', newBirth: '' });
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div className="space-y-10 page-transition">
      <header className="flex justify-between items-end border-b pb-8">
        <div>
          <h2 className="text-3xl font-bold text-[#2F3A32]">컨시어지 타임라인</h2>
          <p className="text-[10px] text-[#A58E6F] font-bold mt-1 uppercase tracking-[0.3em]">Operational Dashboard</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="px-8 py-4 bg-[#2F3A32] text-white rounded-2xl font-bold text-[11px] uppercase tracking-widest shadow-xl">신규 예약 등록</button>
      </header>

      <div className="grid grid-cols-3 gap-6">
        {[
          { l: 'Today Schedule', v: stats.todayCount, u: 'Sessions' },
          { l: 'Verify Pending', v: stats.pendingSigs, u: 'Reports' },
          { l: 'Low Balance', v: stats.lowBalanceCount, u: 'Members' }
        ].map((s, i) => (
          <div key={i} className="bg-white p-8 rounded-[32px] border shadow-sm">
            <p className="text-[10px] text-[#A58E6F] font-bold uppercase tracking-widest mb-3">{s.l}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#2F3A32] tabular-nums">{s.v}</span>
              <span className="text-[10px] text-slate-300 font-bold uppercase">{s.u}</span>
            </div>
          </div>
        ))}
      </div>

      <section className="bg-white rounded-[40px] border shadow-sm overflow-hidden">
        <div className="p-8 bg-slate-50 flex justify-between items-center border-b">
          <div className="flex gap-2">
            {['WEEK', 'MONTH', 'ALL'].map(m => (
              <button key={m} onClick={() => setViewMode(m as any)} className={`px-5 py-2 rounded-xl text-[10px] font-bold transition-all ${viewMode === m ? 'bg-[#2F3A32] text-white shadow-md' : 'bg-white border text-slate-400'}`}>{m === 'WEEK' ? '이번 주' : m === 'MONTH' ? '이번 달' : '전체'}</button>
            ))}
            <input type="date" className="ml-4 px-4 py-2 bg-white border rounded-xl text-[10px] font-bold outline-none" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setViewMode('DATE'); }} />
          </div>
        </div>

        <div className="divide-y min-h-[400px]">
          {timelineData.map(g => (
            <div key={g.date} className="p-8 space-y-6 animate-in slide-in-from-bottom-2">
              <h4 className="text-sm font-bold text-[#2F3A32] font-serif italic border-l-4 border-[#A58E6F] pl-4">{g.label}</h4>
              <div className="grid gap-3">
                {g.list.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-[24px] hover:bg-white border border-transparent hover:border-slate-200 transition-all group">
                    <div className="flex items-center gap-10">
                      <span className="text-[13px] font-bold text-[#A58E6F] tabular-nums w-12">{r.time}</span>
                      <div><p className="font-bold text-[#2F3A32] text-sm">{r.memberName}</p><p className="text-[9px] text-slate-400 uppercase tracking-widest">Mgr. {r.managerName}</p></div>
                      <span className="px-4 py-1.5 bg-white border rounded-full text-[10px] font-bold text-slate-500">{r.programName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[9px] font-bold px-3 py-1 rounded-lg uppercase ${r.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>{r.status}</span>
                      {r.status !== 'COMPLETED' && <button onClick={() => navigate(`/admin/care/${r.memberId}?resId=${r.id}&progId=${r.programId}`)} className="px-4 py-1.5 bg-[#2F3A32] text-white rounded-lg text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-all">CARE</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {timelineData.length === 0 && <div className="py-24 text-center text-slate-300 italic">표시할 예약 내역이 없습니다.</div>}
        </div>
      </section>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[150] p-6 animate-in fade-in">
          <form onSubmit={handleAddRes} className="bg-white rounded-[48px] w-full max-w-xl p-12 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar">
            <h3 className="text-xl font-bold text-[#2F3A32] font-serif italic text-center uppercase tracking-widest mb-4">Schedule New Session</h3>
            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button type="button" onClick={() => setIsNewMember(false)} className={`flex-1 py-3 text-[10px] font-bold rounded-xl transition-all ${!isNewMember ? 'bg-[#2F3A32] text-white shadow-sm' : 'text-slate-400'}`}>기존 회원 예약</button>
              <button type="button" onClick={() => setIsNewMember(true)} className={`flex-1 py-3 text-[10px] font-bold rounded-xl transition-all ${isNewMember ? 'bg-[#2F3A32] text-white shadow-sm' : 'text-slate-400'}`}>+ 신규 회원 등록</button>
            </div>

            {!isNewMember ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">회원 검색 (이름 또는 번호 끝자리)</label>
                  <input className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none text-sm font-bold" placeholder="성함 또는 번호 끝자리..." value={memberSearchTerm} onChange={e => setMemberSearchTerm(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">회원 선택 <span className="text-rose-500">*</span></label>
                  <select className="w-full px-6 py-4 bg-white border rounded-2xl outline-none text-sm font-bold" value={newRes.memberId} onChange={e => setNewRes({ ...newRes, memberId: e.target.value })}>
                    <option value="">회원 선택 (검색 결과: {filteredSearchMembers.length}명)</option>
                    {filteredSearchMembers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.phone.slice(-4)})</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in slide-in-from-right-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">성함 <span className="text-rose-500">*</span></label>
                    <input className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none text-sm" placeholder="성함" value={newRes.newName} onChange={e => setNewRes({ ...newRes, newName: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">성별 <span className="text-rose-500">*</span></label>
                    <select className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none text-sm" value={newRes.newGender} onChange={e => setNewRes({ ...newRes, newGender: e.target.value as any })}>
                      <option value="여성">여성</option>
                      <option value="남성">남성</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">연락처 (- 제외) <span className="text-rose-500">*</span></label>
                  <input className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none text-sm" placeholder="연락처" value={newRes.newPhone} onChange={e => setNewRes({ ...newRes, newPhone: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">이메일</label>
                    <input type="email" className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none text-sm" placeholder="example@thehannam.com" value={newRes.newEmail} onChange={e => setNewRes({ ...newRes, newEmail: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">생년월일</label>
                    <input type="date" className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none text-xs" value={newRes.newBirth} onChange={e => setNewRes({ ...newRes, newBirth: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">프로그램 <span className="text-rose-500">*</span></label>
                <select className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none text-sm font-bold" value={newRes.programId} onChange={e => setNewRes({ ...newRes, programId: e.target.value })}>
                  <option value="">프로그램 선택</option>
                  {(data.progs || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">전담 관리사</label>
                <select className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none text-sm font-bold" value={newRes.managerId} onChange={e => setNewRes({ ...newRes, managerId: e.target.value })}>
                  <option value="">미정 (현장 배정)</option>
                  {(data.mgrs || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">예약일 <span className="text-rose-500">*</span></label>
                <input type="date" className="w-full px-6 py-4 bg-slate-50 border rounded-2xl text-xs font-bold" value={newRes.date} onChange={e => setNewRes({ ...newRes, date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">예약 시간 <span className="text-rose-500">*</span></label>
                <input type="time" className="w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-bold" value={newRes.time} onChange={e => setNewRes({ ...newRes, time: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="w-full py-5 bg-[#2F3A32] text-white rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-all">예약 확정</button>
            <button type="button" onClick={() => setShowAddModal(false)} className="w-full text-[10px] text-slate-300 font-bold uppercase tracking-widest">닫기</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
