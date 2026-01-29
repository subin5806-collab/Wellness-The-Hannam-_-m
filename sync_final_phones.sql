-- [DATA SYNC] Update hannam_admins with real phone numbers from hannam_managers
-- This ensures db.admins.getByPhone() works after authentication.

-- 1. Update by matching Name (Preferred for accuracy in this context)
UPDATE public.hannam_admins a
SET phone = m.phone
FROM public.hannam_managers m
WHERE a.name = m.name
  AND (a.phone = '010-0000-0000' OR a.phone IS NULL OR a.phone = '');

-- 2. Clean up any formatting (Remove hyphens to match login input logic)
UPDATE public.hannam_admins
SET phone = replace(phone, '-', '')
WHERE phone LIKE '%-%';

-- 3. Verify the result
SELECT id, name, email, phone, role FROM public.hannam_admins ORDER BY role;
