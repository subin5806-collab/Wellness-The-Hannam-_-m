-- [관리자 이메일 강제 인증 SQL]
-- Supabase Dashboard -> SQL Editor에 붙여넣고 실행(Run)하세요.

UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'help@thehannam.com';

-- 확인용 쿼리 (실행 후 결과에 email_confirmed_at 날짜가 찍히면 성공)
SELECT email, email_confirmed_at 
FROM auth.users 
WHERE email = 'help@thehannam.com';
