-- [SECURITY] Add audit column to hannam_admins if it doesn't exist
ALTER TABLE public.hannam_admins 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- [SUMMARY] Verify columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'hannam_admins';
