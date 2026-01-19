
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, hashPassword, supabase } from '../../db';

interface LoginPageProps {
  onLogin: (type: 'admin' | 'member', id: string, email?: string) => void;
}

type AuthMode = 'MEMBER_LOGIN' | 'MEMBER_SIGNUP' | 'ADMIN_LOGIN';

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('MEMBER_LOGIN');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [adminEmailInput, setAdminEmailInput] = useState('');

  const [signupData, setSignupData] = useState({
    name: '', birthDate: '', gender: '여성' as '남성' | '여성',
    email: '', phone: '', password: '', confirmpassword: ''
  });

  const getErrorMessage = (err: any) => {
    if (!err) return '알 수 없는 오류가 발생했습니다.';
    if (typeof err === 'string') return err;
    return err.message || err.error_description || (err.error && err.error.message) || JSON.stringify(err);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!signupData.email || signupData.email.trim() === '' || !signupData.email.includes('@')) {
      setError('올바른 이메일 주소를 입력해 주세요.');
      setIsLoading(false);
      return;
    }

    if (signupData.password.trim() !== signupData.confirmpassword.trim()) {
      setError('비밀번호가 일치하지 않습니다.');
      setIsLoading(false);
      return;
    }

    try {
      const cleanPhone = signupData.phone.replace(/[^0-9]/g, '');
      const existing = await db.members.getByPhoneFromServer(cleanPhone);

      if (existing) {
        alert('이미 등록된 회원입니다. 로그인 페이지로 이동하여 초기 비밀번호(핸드폰 끝 4자리)로 접속해 주세요.');
        setPhone(cleanPhone);
        setMode('MEMBER_LOGIN');
        setIsLoading(false);
        return;
      }

      const newMember = await db.members.add({
        name: signupData.name.trim(),
        birthDate: signupData.birthDate,
        gender: signupData.gender,
        phone: cleanPhone,
        email: signupData.email.trim(),
        password: signupData.password.trim()
      });

      if (newMember && newMember.id) {
        alert('가입을 축하드립니다! 가입하신 정보로 로그인해 주세요.');
        setPhone(cleanPhone);
        setMode('MEMBER_LOGIN');
      } else {
        throw new Error("서버 저장에 실패했습니다.");
      }
    } catch (e: any) {
      setError(`[가입 오류] ${getErrorMessage(e)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMemberLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const member = await db.members.getByPhoneFromServer(cleanPhone);
      if (member) {
        // 입력받은 비밀번호 해싱
        const hashedInput = await hashPassword(password);
        // DB 저장된 비밀번호와 대조
        if (member.password === hashedInput) {
          onLogin('member', member.id);
          navigate('/member');
          return;
        } else {
          // 비밀번호가 틀렸을 때, 초기 비밀번호(폰 끝 4자리)인지 확인하는 힌트 제공 가능 (선택적)
          setError('비밀번호가 틀렸습니다. (처음 방문이시면 휴대폰 끝 4자리를 시도해보세요)');
        }
      } else {
        setError('회원 정보를 찾을 수 없습니다.');
      }
    } catch (err: any) {
      setError(`[로그인 오류] ${getErrorMessage(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const cleanPassword = password.trim();
      const cleanEmail = adminEmailInput.trim();

      // [FIX] 1. Attempt Supabase Auth Login (Primary Source of Truth for RLS)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword
      });

      if (authError) {
        // Fallback or specific error handling
        console.warn("Supabase Auth Error:", authError);
        if (authError.message === 'Invalid login credentials') {
          throw new Error('이메일이 없거나 비밀번호가 틀렸습니다.\n(초기 계정이 없다면 관리자에게 등록을 요청하세요)');
        }
        throw new Error(authError.message);
      }

      if (authData.user) {
        // [FIX] 2. Success - Session established.
        onLogin('admin', authData.user.id, authData.user.email);
        navigate('/admin');
      } else {
        throw new Error("로그인 세션을 획득하지 못했습니다.");
      }

    } catch (err: any) {
      // [SECURITY FIX] Removed hardcoded fallback. 
      // All admins MUST authenticate via Supabase to establish RLS session.
      console.error("Login Error:", err);
      setError(`[관리자 로그인 오류] ${getErrorMessage(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full px-10 py-6 bg-[#F9FAFB] border border-[#E5E8EB] rounded-[32px] outline-none shadow-inner text-sm focus:border-[#2F3A32] transition-all";
  const buttonBase = "w-full py-6 font-bold rounded-[32px] transition-all text-[12px] tracking-[0.45em] uppercase shadow-xl active:scale-95 disabled:opacity-50";
  const loginBtnStyle = `${buttonBase} bg-[#2F3A32] text-white hover:bg-black`;
  const signupBtnStyle = `${buttonBase} bg-[#A58E6F] text-white hover:bg-[#8C785D]`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-8 font-sans page-transition">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-[60px] shadow-sm border border-[#E5E8EB] p-12 py-16 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-[#2F3A32]"></div>
          {error && <div className="mb-10 p-5 bg-rose-50 text-rose-600 text-[11px] font-bold uppercase tracking-widest text-center rounded-2xl animate-pulse">{error}</div>}

          {mode === 'MEMBER_LOGIN' && (
            <form onSubmit={handleMemberLogin} className="space-y-8">
              <input type="text" placeholder="휴대폰 번호 (- 제외)" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} required />
              <input type="password" placeholder="비밀번호 (초기: 폰 끝 4자리)" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <div className="space-y-6">
                <button type="submit" disabled={isLoading} className={loginBtnStyle}>
                  {isLoading ? '인증 중...' : '회원 로그인'}
                </button>
                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                  <div className="relative flex justify-center text-[9px] uppercase tracking-widest font-bold text-slate-300"><span className="bg-white px-4">The Hannam</span></div>
                </div>
                <button type="button" onClick={() => setMode('MEMBER_SIGNUP')} className={signupBtnStyle}>
                  신규 회원 가입
                </button>
                <button type="button" onClick={() => setMode('ADMIN_LOGIN')} className="w-full text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4 text-center hover:text-[#2F3A32] transition-colors">
                  Staff / Concierge Portal
                </button>
              </div>
            </form>
          )}

          {mode === 'ADMIN_LOGIN' && (
            <form onSubmit={handleAdminLogin} className="space-y-8">
              <div className="text-center mb-4">
                <h2 className="text-[12px] font-bold text-[#A58E6F] uppercase tracking-[0.3em]">Administrator Access</h2>
              </div>
              <input type="email" placeholder="관리자 이메일" className={inputClass} value={adminEmailInput} onChange={(e) => setAdminEmailInput(e.target.value)} required />
              <input type="password" placeholder="비밀번호" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <div className="space-y-5">
                <button type="submit" disabled={isLoading} className={loginBtnStyle}>관리자 즉시 접속</button>
                <button type="button" onClick={() => setMode('MEMBER_LOGIN')} className="w-full text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">회원 로그인으로</button>
              </div>
            </form>
          )}

          {mode === 'MEMBER_SIGNUP' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <h2 className="text-2xl font-bold text-center text-[#2F3A32] mb-6 font-serif italic uppercase tracking-tight">Registration</h2>
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="성함" className="w-full px-6 py-4 bg-[#F9FAFB] border rounded-2xl outline-none text-sm" value={signupData.name} onChange={(e) => setSignupData({ ...signupData, name: e.target.value })} required />
                <div className="flex bg-[#F9FAFB] border rounded-2xl p-1">
                  <button type="button" onClick={() => setSignupData({ ...signupData, gender: '여성' })} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${signupData.gender === '여성' ? 'bg-[#2F3A32] text-white shadow-md' : 'text-slate-400'}`}>여성</button>
                  <button type="button" onClick={() => setSignupData({ ...signupData, gender: '남성' })} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${signupData.gender === '남성' ? 'bg-[#2F3A32] text-white shadow-md' : 'text-slate-400'}`}>남성</button>
                </div>
              </div>
              <input type="tel" placeholder="연락처 (- 제외)" className="w-full px-6 py-4 bg-[#F9FAFB] border rounded-2xl outline-none text-sm" value={signupData.phone} onChange={(e) => setSignupData({ ...signupData, phone: e.target.value })} required />
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#A58E6F] uppercase ml-4 tracking-widest">생년월일 (YYYY-MM-DD)</label>
                <input type="date" className="w-full px-6 py-4 bg-[#F9FAFB] border rounded-2xl outline-none text-sm" value={signupData.birthDate} onChange={(e) => setSignupData({ ...signupData, birthDate: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#A58E6F] uppercase ml-4 tracking-widest">이메일 주소</label>
                <input type="email" placeholder="example@thehannam.com" className="w-full px-6 py-4 bg-[#F9FAFB] border rounded-2xl outline-none text-sm" value={signupData.email} onChange={(e) => setSignupData({ ...signupData, email: e.target.value })} required />
              </div>
              <input type="password" placeholder="비밀번호" className="w-full px-6 py-4 bg-[#F9FAFB] border rounded-2xl outline-none text-sm" value={signupData.password} onChange={(e) => setSignupData({ ...signupData, password: e.target.value })} required />
              <input type="password" placeholder="비밀번호 확인" className="w-full px-6 py-4 bg-[#F9FAFB] border rounded-2xl outline-none text-sm" value={signupData.confirmpassword} onChange={(e) => setSignupData({ ...signupData, confirmpassword: e.target.value })} required />
              <div className="pt-6 space-y-4">
                <button type="submit" disabled={isLoading} className={signupBtnStyle}>
                  {isLoading ? '정보 저장 중...' : '가입 완료'}
                </button>
                <button type="button" onClick={() => setMode('MEMBER_LOGIN')} className="w-full text-[10px] text-slate-400 font-bold uppercase text-center tracking-widest">이전 단계로</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
