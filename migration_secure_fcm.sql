-- [SECURITY UPGRADE] Secure FCM Tokens & RLS - 수정 버전
-- 아래 코드를 통째로 복사해서 실행하세요.

-- 1. 컬럼 추가
ALTER TABLE hannam_fcm_tokens 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. 주인 없는 옛날 데이터 삭제 (보안을 위해 청소)
DELETE FROM hannam_fcm_tokens WHERE user_id IS NULL;

-- 3. RLS(보안 기능) 활성화
ALTER TABLE hannam_fcm_tokens ENABLE ROW LEVEL SECURITY;

-- 4. 기존에 있던 규칙들 싹 지우기 (충돌 방지)
DROP POLICY IF EXISTS "Public can insert own token" ON hannam_fcm_tokens;
DROP POLICY IF EXISTS "Users can read own tokens" ON hannam_fcm_tokens;
DROP POLICY IF EXISTS "Users can delete own tokens" ON hannam_fcm_tokens;
DROP POLICY IF EXISTS "Users can view own tokens" ON hannam_fcm_tokens;
DROP POLICY IF EXISTS "Users can update own tokens" ON hannam_fcm_tokens;
DROP POLICY IF EXISTS "Admins can view all tokens" ON hannam_fcm_tokens;

-- 5. 새로운 보안 규칙 설치
CREATE POLICY "Users can insert own token" ON hannam_fcm_tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own tokens" ON hannam_fcm_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tokens" ON hannam_fcm_tokens FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own tokens" ON hannam_fcm_tokens FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. 관리자 전용 규칙 (이름 충돌 해결 버전)
CREATE POLICY "Admins can view all tokens" ON hannam_fcm_tokens FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM hannam_admins WHERE email = auth.jwt() ->> 'email'));
