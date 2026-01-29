-- [FINAL RESCUE SQL] safe for hannam_admins table structure
-- 1. Enable pgcrypto (Required for SHA256 hashing)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Populate Missing Admins (Essential columns only: id, name, phone, email, role, password)
INSERT INTO public.hannam_admins (id, name, phone, email, role, password)
SELECT 
    'DIR_' || m.id,
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
  )
ON CONFLICT (id) DO NOTHING;

-- 3. Link existing managers to admins
UPDATE public.hannam_managers m
SET linked_admin_id = a.id
FROM public.hannam_admins a
WHERE (m.name = a.name OR replace(m.phone, '-', '') = a.phone)
  AND (m.linked_admin_id IS NULL OR m.linked_admin_id = '');

-- 4. Audit result
SELECT id, name, phone, email, role FROM public.hannam_admins;
