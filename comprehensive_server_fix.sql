-- [COMPREHENSIVE FIX] 2026-01-29
-- This script fixes ALL missing columns and RLS permissions preventing Note Saving and Sync.

-- 1. Add Note Columns to hannam_reservations (Fixes 400 Bad Request on Save)
ALTER TABLE public.hannam_reservations
ADD COLUMN IF NOT EXISTS note_summary TEXT,
ADD COLUMN IF NOT EXISTS note_details TEXT,
ADD COLUMN IF NOT EXISTS note_recommendation TEXT,
ADD COLUMN IF NOT EXISTS note_future_ref TEXT,
ADD COLUMN IF NOT EXISTS note_author_name TEXT,
ADD COLUMN IF NOT EXISTS note_updated_at TIMESTAMPTZ;

-- 2. Add Status Columns to hannam_admins & hannam_managers (Fixes Bulk Sync)
ALTER TABLE public.hannam_admins
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.hannam_managers
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- 3. [CRITICAL] Fix RLS Permissions (Fixes 401/403 or Silent Save Failures)
-- Enable RLS
ALTER TABLE public.hannam_reservations ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies if any to avoid conflicts
DROP POLICY IF EXISTS "Enable read access for all users" ON public.hannam_reservations;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.hannam_reservations;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.hannam_reservations;

-- Allow Authenticated Users (Admins/Instructors) to UPDATE reservations (e.g. Save Notes)
CREATE POLICY "Enable update for authenticated users"
ON public.hannam_reservations
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow Read for everyone (or restrict to auth)
CREATE POLICY "Enable read access for all users"
ON public.hannam_reservations
FOR SELECT
USING (true);

-- 4. Grant Permissions to Service Role & Anon (Safe fallback)
GRANT ALL ON TABLE public.hannam_reservations TO service_role;
GRANT ALL ON TABLE public.hannam_reservations TO anon;
GRANT ALL ON TABLE public.hannam_reservations TO authenticated;

-- 5. Fix Manager Link ID Constraint (Just in case)
ALTER TABLE public.hannam_managers
ALTER COLUMN linked_admin_id DROP NOT NULL;
