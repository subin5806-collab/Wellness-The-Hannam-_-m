import React, { useState, useEffect } from 'react';
import { db } from '../../../db';
import { Notice } from '../../../types';

const NoticeManagement: React.FC = () => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [form, setForm] = useState({
    title: '',
    content: '',
    category: 'GENERAL',
    isPopup: false,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    imageUrl: ''
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    loadNotices();
  }, []);

  const loadNotices = async () => {
    const data = await db.notices.getAll();
    setNotices(data);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) return alert('이미지 크기는 10MB 이하만 가능합니다.');
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      let finalImageUrl = form.imageUrl;

      if (selectedFile) {
        const path = `notices/${Date.now()}_${selectedFile.name}`;
        finalImageUrl = await db.system.uploadFile('hannam', path, selectedFile);
      }

      await db.notices.add({
        ...form,
        imageUrl: finalImageUrl,
        isAlertOn: true
      });

      alert('공지사항이 등록되었습니다.');
      setShowAddModal(false);
      setForm({
        title: '',
        content: '',
        category: 'GENERAL',
        isPopup: false,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        imageUrl: ''
      });
      setSelectedFile(null);
      loadNotices();
    } catch (e: any) {
      console.error(e);
      alert('등록 중 오류 발생: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await db.notices.delete(id);
      loadNotices();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="w-full space-y-8 pb-32">
      <header className="flex justify-between items-end border-b pb-10">
        <div>
          <h2 className="text-4xl font-bold text-[#2F3A32]">공지 및 팝업 관리</h2>
          <p className="text-[11px] text-[#A58E6F] font-bold mt-2 uppercase tracking-[0.5em]">Notification & Popup Control</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-8 py-4 bg-[#2F3A32] text-white text-[12px] font-bold rounded-2xl hover:bg-[#1A3C34] transition-all uppercase tracking-widest shadow-lg flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
          신규 공지 등록
        </button>
      </header>

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#F9FAFB] border-b text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            <tr>
              <th className="px-10 py-8">구분</th>
              <th className="px-10 py-8">제목</th>
              <th className="px-10 py-8">게시 기간</th>
              <th className="px-10 py-8 text-center">팝업</th>
              <th className="px-10 py-8 text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {notices.map(notice => (
              <tr key={notice.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-10 py-8">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${notice.category === 'URGENT' ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500'}`}>
                    {notice.category}
                  </span>
                </td>
                <td className="px-10 py-8">
                  <div className="flex items-center gap-4">
                    {notice.imageUrl && <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden border"><img src={notice.imageUrl} className="w-full h-full object-cover" /></div>}
                    <div>
                      <h4 className="font-bold text-[#2F3A32]">{notice.title}</h4>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{notice.content}</p>
                    </div>
                  </div>
                </td>
                <td className="px-10 py-8 text-[13px] font-medium text-slate-500 tabular-nums">
                  {notice.startDate} ~ {notice.endDate}
                </td>
                <td className="px-10 py-8 text-center">
                  {notice.isPopup ? (
                    <span className="text-emerald-500 font-bold text-[10px] bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">ON</span>
                  ) : <span className="text-slate-300 font-bold text-[10px]">OFF</span>}
                </td>
                <td className="px-10 py-8 text-right">
                  <button onClick={() => handleDelete(notice.id)} className="text-rose-400 hover:text-rose-600 font-bold text-[11px] uppercase tracking-widest">Delete</button>
                </td>
              </tr>
            ))}
            {notices.length === 0 && (
              <tr><td colSpan={5} className="py-24 text-center text-slate-300 italic">등록된 공지사항이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[2000] flex items-center justify-center p-8">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <header className="px-10 py-8 border-b flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-2xl font-bold text-[#2F3A32]">공지사항 등록</h3>
                <p className="text-[10px] text-[#A58E6F] font-bold uppercase tracking-widest mt-1">Register New Announcement</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-[#2F3A32]"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </header>

            <form onSubmit={handleSubmit} className="p-10 space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">제목</label>
                  <input
                    className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold placeholder:font-normal"
                    placeholder="제목을 입력하세요"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">카테고리</label>
                  <select
                    className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold"
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                  >
                    <option value="GENERAL">일반 공지</option>
                    <option value="PRODUCT">신규 상품 안내</option>
                    <option value="URGENT">긴급 공지</option>
                    <option value="EVENT">이벤트/프로모션</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">내용</label>
                <textarea
                  className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-medium min-h-[140px] resize-none"
                  placeholder="공지 내용을 상세히 입력하세요..."
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">시작 일자</label>
                  <input
                    type="date"
                    className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold"
                    value={form.startDate}
                    onChange={e => setForm({ ...form, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">종료 일자</label>
                  <input
                    type="date"
                    className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-bold"
                    value={form.endDate}
                    onChange={e => setForm({ ...form, endDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-6 bg-slate-50 border rounded-2xl">
                <div className="space-y-0.5">
                  <p className="text-[13px] font-bold text-[#2F3A32]">팝업 노출 활성화</p>
                  <p className="text-[10px] text-slate-400 font-medium">체크 시 멤버 앱 접속 시 팝업으로 노출됩니다.</p>
                </div>
                <input
                  type="checkbox"
                  className="w-6 h-6 border-slate-300 accent-[#1A3C34] rounded-lg cursor-pointer"
                  checked={form.isPopup}
                  onChange={e => setForm({ ...form, isPopup: e.target.checked })}
                />
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">이미지 첨부 (500x500 권장)</label>
                <div className="flex items-center gap-4">
                  <label className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-[#A58E6F]/50 transition-all">
                    <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 00-2 2z" /></svg>
                    <span className="text-[13px] font-bold text-slate-400">{selectedFile ? selectedFile.name : '이미지 파일 선택 (Max 10MB)'}</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                  {selectedFile && (
                    <button type="button" onClick={() => setSelectedFile(null)} className="p-4 bg-slate-100 rounded-2xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all font-bold text-[11px]">X</button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-5 bg-[#2F3A32] text-white rounded-[20px] font-bold text-lg shadow-xl hover:bg-[#1A3C34] hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
              >
                {isProcessing ? '처리 중...' : '공지 및 팝업 저장하기'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoticeManagement;
