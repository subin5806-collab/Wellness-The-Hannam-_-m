-- [SYNC & FIX] Instructor Login & Roles
-- 1. Sync any new Auth Users to hannam_admins (Essential for Login/RLS)
INSERT INTO public.hannam_admins (id, email, role, phone, name, created_at)
SELECT 
  id::text, 
  email,
  'INSTRUCTOR', -- Default new users to INSTRUCTOR
  COALESCE(raw_user_meta_data->>'phone', '010-0000-0000'),
  COALESCE(raw_user_meta_data->>'name', 'Unknown'),
  now()
FROM auth.users
ON CONFLICT (id) DO UPDATE 
SET 
  email = EXCLUDED.email; -- Refresh Email

-- 2. Enforce Role Policy
-- All users -> INSTRUCTOR
UPDATE hannam_admins SET role = 'INSTRUCTOR';

-- Only 'help@thehannam.com' -> SUPER
UPDATE hannam_admins 
SET role = 'SUPER' 
WHERE email = 'help@thehannam.com';

-- 3. [CRITICAL] Link Managers to Admin Accounts (by Phone)
-- This enables "My Reservations" checks to work by linking the Manager Record to the Admin UUID
UPDATE hannam_managers m
SET linked_admin_id = a.id
FROM hannam_admins a
WHERE replace(m.phone, '-', '') = replace(a.phone, '-', '');

-- 4. Verification Output
SELECT id, name, email, phone, role FROM hannam_admins ORDER BY role, name;
