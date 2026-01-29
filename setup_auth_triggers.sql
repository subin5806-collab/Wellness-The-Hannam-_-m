-- [AUTOMATION] Auth & Data Sync Triggers
-- This script sets up database triggers to automatically handle:
-- 1. Creating a 'hannam_admins' record when a new User signs up.
-- 2. Linking that Admin record to an existing 'hannam_managers' record (by Phone).

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_admin_user() 
RETURNS TRIGGER AS $$
DECLARE
  clean_phone TEXT;
BEGIN
  -- Extract and clean phone number from metadata or use default
  clean_phone := REGEXP_REPLACE(COALESCE(NEW.raw_user_meta_data->>'phone', ''), '[^0-9]', '', 'g');

  -- 1. Insert into hannam_admins
  INSERT INTO public.hannam_admins (id, email, role, phone, name, created_at)
  VALUES (
    NEW.id, 
    NEW.email, 
    'INSTRUCTOR', -- Default Role
    COALESCE(clean_phone, '010-0000-0000'), 
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email; -- Just ensure email is current

  -- 2. Auto-Link to Manager Table if Phone matches
  IF clean_phone <> '' THEN
    UPDATE public.hannam_managers
    SET linked_admin_id = NEW.id
    WHERE replace(phone, '-', '') = clean_phone;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger Definition
-- Note: Requires permissions on auth schema (Run in Supabase SQL Editor)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_admin_user();

-- [OPTIONAL] Backfill/Resync Logic for existing users
-- (Run this once to sync existing unlinked accounts)
UPDATE hannam_managers m
SET linked_admin_id = a.id
FROM hannam_admins a
WHERE m.linked_admin_id IS NULL
  AND replace(m.phone, '-', '') = replace(a.phone, '-', '');
