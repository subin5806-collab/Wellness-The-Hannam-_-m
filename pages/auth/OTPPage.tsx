
import React, { useState, useEffect } from 'react';

import { db } from '../../db';

interface OTPPageProps {
  email: string;
  onVerified: () => void;
}



const OTPPage: React.FC<OTPPageProps> = ({ email, onVerified }) => {
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [timeLeft, setTimeLeft] = useState(300);
  const [isSending, setIsSending] = useState(false);

  const sendEmail = async (code: string) => {
    setIsSending(true);
    // EmailJS removed as per request.
    // Logging to console to simulate sending in dev/demo mode, or simply doing nothing.
    console.log(`[System] OTP for ${email}: ${code}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Log intent to system db - maintaining this structure but removing emailjs specific params
    try {
        await db.system.logEmail({
          sender: 'System (Auth)',
          recipient: email,
          status: 'SKIPPED', // Changed status since we aren't sending
          subject: '로그인 2차 인증번호',
          message: '사용자 로그인 요청에 따른 OTP 발송 (EmailJS Removed)',
          templateId: 'REMOVED', 
          paramsJson: JSON.stringify({ otp_code: code, to_email: email })
        });
    } catch (e) {
        console.error("Failed to log OTP attempt", e);
    }

    setIsSending(false);
  };

  useEffect(() => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    sendEmail(code);
    const timer = setInterval(() => setTimeLeft(p => p > 0 ? p - 1 : 0), 1000);
    return () => clearInterval(timer);
  }, [email]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp === generatedOtp && timeLeft > 0) onVerified();
    else alert('인증 코드가 틀렸거나 만료되었습니다.');
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-6 font-sans page-transition">
      <div className="max-w-md w-full bg-white rounded-[60px] shadow-2xl p-12 py-20 border border-[#E5E8EB] text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-[#2F3A32]"></div>
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-serif italic text-[#2F3A32] uppercase tracking-[0.2em]">Security Verification</h2>
          <p className="text-[10px] text-[#A58E6F] mt-2 uppercase tracking-[0.4em] font-bold">Two-Factor Authentication</p>
        </div>
        <p className="text-[#6B7280] text-[13px] mb-10"><strong className="text-[#2F3A32]">{email}</strong> 로 전송된<br/>6자리 인증 코드를 입력해주세요.</p>
        <form onSubmit={handleSubmit} className="space-y-10">
          <input type="text" maxLength={6} className="w-full text-center text-4xl tracking-[0.5em] font-serif italic py-8 bg-[#F9FAFB] border border-[#E5E8EB] rounded-[32px] outline-none shadow-inner" value={otp} onChange={e => setOtp(e.target.value)} placeholder="000000" required />
          <div className="text-center text-rose-500 font-bold text-[12px] tracking-widest">남은 시간 {minutes}:{seconds < 10 ? `0${seconds}` : seconds}</div>
          <button type="submit" disabled={isSending} className="w-full py-6 bg-[#2F3A32] text-white font-bold rounded-[32px] shadow-xl text-[11px] tracking-[0.4em] uppercase disabled:opacity-50">인증 확인</button>
        </form>
      </div>
    </div>
  );
};

export default OTPPage;
