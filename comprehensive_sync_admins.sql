-- 1. 암호화 확장기능 활성화
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. 없는 계정만 골라서 새로 만들기 (문제가 된 is_active, is_deleted 제외)
INSERT INTO public.hannam_admins (id, name, phone, email, role, password)
SELECT 
    'MGR_ACC_' || m.id,
    m.name,
    replace(m.phone, '-', ''),
    replace(m.phone, '-', '') || '@instructor.thehannam.com',
    'INSTRUCTOR',
    encode(digest(right(replace(m.phone, '-', ''), 4), 'sha256'), 'hex')
FROM public.hannam_managers m
WHERE m.is_deleted = false
  AND NOT EXISTS (
    SELECT 1 FROM public.hannam_admins a 
    WHERE a.name = m.name OR a.phone = replace(m.phone, '-', '')
  );

-- 3. 기존 계정 정보 업데이트 (번호랑 직책 맞추기)
UPDATE public.hannam_admins a
SET 
  phone = replace(m.phone, '-', ''),
  role = 'INSTRUCTOR'
FROM public.hannam_managers m
WHERE a.name = m.name 
  AND (a.phone IS NULL OR a.phone = '010-0000-0000')
  AND a.role = 'INSTRUCTOR';

-- 4. 명단과 로그인 계정 연결고리 만들기
UPDATE public.hannam_managers m
SET linked_admin_id = a.id
FROM public.hannam_admins a
WHERE (m.name = a.name OR replace(m.phone, '-', '') = a.phone)
  AND (m.linked_admin_id IS NULL OR m.linked_admin_id = '');

-- 5. 결과 확인
SELECT id, name, phone, email, role FROM public.hannam_admins ORDER BY role, name;
