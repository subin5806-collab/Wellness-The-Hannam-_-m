-- [EMERGENCY RECOVERY] Sync Auth Users to Admin Table
-- This script ensures all registered Auth users have a generic 'SUPER' admin record
-- so you can log in and fix details later.

INSERT INTO public.hannam_admins (id, email, password, name, phone, role, created_at)
SELECT 
  id::text, -- Use Auth UUID as the Admin ID (safe for TEXT column)
  email,
  encrypted_password, -- Keep existing (hashed) or null
  COALESCE(raw_user_meta_data->>'name', 'Recovered Admin'),
  COALESCE(raw_user_meta_data->>'phone', '010-0000-0000'), -- Fallback
  'SUPER', -- Grant SUPER access to everyone for recovery (Change later!)
  created_at
FROM auth.users
ON CONFLICT (id) DO UPDATE 
SET 
  role = 'SUPER', -- Force SUPER role
  email = EXCLUDED.email;

-- Verify
SELECT * FROM hannam_admins;
