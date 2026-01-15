
import React, { useState, useEffect } from 'react';
import { db } from '../../../db';
import { Notice } from '../../../types';

const NoticeManagement: React.FC = () => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [newNotice, setNewNotice] = useState<{
    title: string; content: string; isPopup: boolean; isAlertOn: boolean;
    startDate: string; endDate: string; imageFile: File | null;
  }>({
    title: '', content: '', isPopup: false, isAlertOn: true,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    imageFile: null
  });

  useEffect(() => { fetchNotices(); }, []);

  const fetchNotices = async () => {
    setIsLoading(true);
    try {
      const res = await db.notices.getAll();
      setNotices(res);
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setNewNotice({ ...newNotice, imageFile: file });
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      let imageUrl = '';
      if (newNotice.imageFile) {
        const safeName = `notice_${Date.now()}_${newNotice.imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        imageUrl = await db.system.uploadFile('contracts', `notices/${safeName}`, newNotice.imageFile);
      }

      await db.notices.add({
        title: newNotice.title.trim(),
        content: newNotice.content.trim(),
        isPopup: newNotice.isPopup,
        isAlertOn: newNotice.isAlertOn,
        startDate: newNotice.startDate,
        endDate: newNotice.endDate,
        imageUrl: imageUrl
      });

      alert('공지사항이 정상적으로 배포되었습니다. 이제 사용자 화면에서 이미지를 확인하실 수 있습니다.');
      setShowAddModal(false);
      setPreviewUrl(null);
      setNewNotice({
        title: '', content: '', isPopup: false, isAlertOn: true,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        imageFile: null
      });
      await fetchNotices();
    } catch (error: any) {
      alert(`배포 중 오류 발생: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('해당 공지를 삭제하시겠습니까?')) return;
    try {
      await db.notices.delete(id);
      await fetchNotices();
    } catch (e) {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="space-y-10 page-transition">
      <header className="flex justify-between items-end border-b border-slate-100 pb-10">
        <div>
          <h2 className="text-3xl font-bold text-[#2F3A32]">공지 및 알림 제어</h2>
          <p className="text-[11px] text-[#A58E6F] font-bold mt-2 uppercase tracking-[0.4em]">Announcement & Media Terminal</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[#2F3A32] text-white px-10 py-4 rounded-2xl font-bold text-[13px] shadow-lg hover:bg-black transition-all active:scale-95 uppercase tracking-widest"
        >
          + New Post
        </button>
      </header>

      {isLoading ? (
        <div className="py-24 text-center text-slate-300 font-bold animate-pulse tracking-widest uppercase">Fetching Data...</div>
      ) : (
        <div className="grid grid-cols-2 gap-10">
          {notices.map(n => (
            <div key={n.id} className="bg-white rounded-[40px] shadow-sm border border-[#E5E8EB] overflow-hidden hover:border-[#2F3A32] transition-all group flex flex-col">
              {n.imageUrl && (
                <div className="h-48 overflow-hidden bg-slate-100">
                  <img src={n.imageUrl} alt={n.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
              )}
              <div className="p-10 space-y-5 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    {n.isPopup && <span className="px-3 py-1 bg-[#2F3A32] text-white text-[9px] font-bold rounded-lg uppercase tracking-widest">Main Popup</span>}
                    <h3 className="font-bold text-[#2F3A32] text-xl truncate">{n.title}</h3>
                  </div>
                  <p className="text-[14px] text-slate-500 leading-relaxed line-clamp-3 font-medium">{n.content}</p>
                </div>
                <div className="pt-8 border-t border-slate-50 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-6">
                  <span className="tabular-nums">Term: {n.startDate} — {n.endDate}</span>
                  <button onClick={() => handleDelete(n.id)} className="text-rose-300 hover:text-rose-500 transition-colors">Delete</button>
                </div>
              </div>
            </div>
          ))}
          {notices.length === 0 && (
            <div className="col-span-2 py-32 text-center text-slate-300 italic font-serif text-lg">
              현재 등록된 공지사항이 없습니다.
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-8 z-[100]">
          <div className="bg-white rounded-[56px] w-full max-w-2xl p-16 shadow-2xl relative animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto no-scrollbar">
            <button type="button" onClick={() => setShowAddModal(false)} className="absolute top-12 right-12 text-3xl text-slate-200 hover:text-[#2F3A32]">×</button>
            <h3 className="text-3xl font-bold text-[#2F3A32] mb-12 font-serif italic tracking-tight uppercase">New Announcement</h3>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#A58E6F] uppercase tracking-widest ml-4">Title</label>
                <input required className="w-full px-10 py-5 bg-[#F9FAFB] border border-slate-100 rounded-[28px] outline-none font-bold" placeholder="공지 제목을 입력해 주세요" value={newNotice.title} onChange={e => setNewNotice({ ...newNotice, title: e.target.value })} />
              </div>

              <div className="flex gap-8 px-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" className="w-5 h-5 accent-[#2F3A32]" checked={newNotice.isPopup} onChange={e => setNewNotice({ ...newNotice, isPopup: e.target.checked })} />
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-[#2F3A32]">메인 팝업 노출</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" className="w-5 h-5 accent-[#2F3A32]" checked={newNotice.isAlertOn} onChange={e => setNewNotice({ ...newNotice, isAlertOn: e.target.checked })} />
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-[#2F3A32]">상단 알림바 표시</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">Start Date</label>
                  <input type="date" required className="w-full px-10 py-5 bg-[#F9FAFB] border rounded-[28px] text-xs font-bold" value={newNotice.startDate} onChange={e => setNewNotice({ ...newNotice, startDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">End Date</label>
                  <input type="date" required className="w-full px-10 py-5 bg-[#F9FAFB] border rounded-[28px] text-xs font-bold" value={newNotice.endDate} onChange={e => setNewNotice({ ...newNotice, endDate: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#A58E6F] uppercase tracking-widest ml-4">Image Attachment (Optional)</label>
                <input type="file" accept="image/*" className="w-full px-10 py-4 bg-[#F9FAFB] border rounded-[28px] text-[12px] font-bold" onChange={handleFileChange} />
                {previewUrl && (
                  <div className="mt-4 rounded-2xl overflow-hidden border border-slate-200 shadow-sm max-h-40 flex items-center justify-center bg-slate-50">
                    <img src={previewUrl} alt="Preview" className="h-full object-contain" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-4">Content Body</label>
                <textarea required className="w-full px-10 py-6 bg-[#F9FAFB] border border-slate-100 rounded-[28px] h-48 outline-none leading-relaxed" placeholder="상세 공지 내용을 입력해 주세요" value={newNotice.content} onChange={e => setNewNotice({ ...newNotice, content: e.target.value })} />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-6 bg-[#2F3A32] text-white rounded-[32px] font-bold uppercase text-[11px] tracking-[0.4em] shadow-2xl transition-all active:scale-95 disabled:opacity-50"
              >
                {isProcessing ? '배포 중...' : '공지사항 즉시 배포'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoticeManagement;
