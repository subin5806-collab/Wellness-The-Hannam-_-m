-- [FINAL FIX] Master Script for Instructor Registration & Account Sync

-- 1. hannam_managers 테이블 구조 수정
ALTER TABLE hannam_managers 
  ALTER COLUMN linked_admin_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS admin_memo TEXT;

-- 2. hannam_admins 테이블 구조 수정
ALTER TABLE hannam_admins 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 3. 외래키 제약 조건 수정 (강사 삭제 시 계정 연결만 해제, 계정 삭제 시 강사 연결만 해제)
-- 기존 제약 조건 삭제 (이름은 다를 수 있으니 주의, 보통 hannam_managers_linked_admin_id_fkey)
ALTER TABLE hannam_managers DROP CONSTRAINT IF EXISTS hannam_managers_linked_admin_id_fkey;

-- 새로운 제약 조건 추가 (ON DELETE SET NULL)
ALTER TABLE hannam_managers 
  ADD CONSTRAINT hannam_managers_linked_admin_id_fkey 
  FOREIGN KEY (linked_admin_id) 
  REFERENCES hannam_admins(id) 
  ON DELETE SET NULL;

-- 4. RLS 정책 보강 (강사가 자신의 정보를 조회할 수 있도록)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'hannam_managers' AND policyname = 'Admins and linked instructors can view'
    ) THEN
        CREATE POLICY "Admins and linked instructors can view" ON hannam_managers
        FOR SELECT TO authenticated
        USING (
            (auth.jwt() ->> 'email') IN (SELECT email FROM hannam_admins WHERE role IN ('SUPER', 'STAFF'))
            OR 
            linked_admin_id = (SELECT id FROM hannam_admins WHERE email = auth.jwt() ->> 'email')
        );
    END IF;
END $$;

-- 5. 기존 데이터 정리 (is_active, is_deleted가 NULL인 경우 기본값으로 채움)
UPDATE hannam_managers SET is_active = TRUE WHERE is_active IS NULL;
UPDATE hannam_managers SET is_deleted = FALSE WHERE is_deleted IS NULL;
UPDATE hannam_admins SET is_active = TRUE WHERE is_active IS NULL;
UPDATE hannam_admins SET is_deleted = FALSE WHERE is_deleted IS NULL;
