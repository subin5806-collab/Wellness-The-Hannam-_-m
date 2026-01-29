-- [1] Upgrade Admin Table for Instructor Login
ALTER TABLE hannam_admins 
ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'STAFF' CHECK (role IN ('SUPER', 'STAFF', 'INSTRUCTOR'));

-- [2] Upgrade Manager Table for Soft Delete & Link
ALTER TABLE hannam_managers 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- [RESET] Ensure linked_admin_id is TEXT (Drop if exists as UUID from previous run)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hannam_managers' AND column_name = 'linked_admin_id') THEN
        ALTER TABLE hannam_managers DROP COLUMN linked_admin_id;
    END IF;
END $$;

ALTER TABLE hannam_managers 
ADD COLUMN linked_admin_id TEXT REFERENCES hannam_admins(id);

-- [RESET] Drop table to ensure schema is fresh with TEXT admin_id
DROP TABLE IF EXISTS hannam_admin_private_notes CASCADE;

-- [3] Fix Admin Private Notes RLS (Secure Stamping)
CREATE TABLE hannam_admin_private_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    care_record_id UUID REFERENCES hannam_care_records(id) ON DELETE CASCADE,
    admin_id TEXT REFERENCES hannam_admins(id), -- The writer (Text to match Admin ID)
    admin_email TEXT, -- Legacy/Display
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Private Notes
ALTER TABLE hannam_admin_private_notes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_current_admin_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM hannam_admins WHERE id = auth.uid()::text;
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy: Super Admin sees all
CREATE POLICY "Super Admin View All Notes" ON hannam_admin_private_notes
FOR ALL
USING (
  (SELECT role FROM hannam_admins WHERE id = auth.uid()::text) = 'SUPER'
);

-- Policy: Instructor sees ONLY own notes
CREATE POLICY "Instructor View Own Notes" ON hannam_admin_private_notes
FOR ALL
USING (
  admin_id = auth.uid()::text
);

-- [4] History Access Logic (Complex)
-- Instructor can view Care Records of a member IF they have a reservation with that member TODAY.

-- Helper to find "My Manager ID"
CREATE OR REPLACE FUNCTION get_my_manager_id()
RETURNS TEXT AS $$
DECLARE
  v_mgr_id TEXT;
BEGIN
  SELECT id INTO v_mgr_id FROM hannam_managers WHERE linked_admin_id = auth.uid()::text;
  RETURN v_mgr_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS: Care Records
ALTER TABLE hannam_care_records ENABLE ROW LEVEL SECURITY;

-- Note: Existing policies might conflict. We'll drop relevant ones if known, or just add permissive ones for now carefully.
-- For Instructors:
CREATE POLICY "Instructor View Assigned Member History" ON hannam_care_records
FOR SELECT
USING (
  -- 1. I am a Super Admin
  ((SELECT role FROM hannam_admins WHERE id = auth.uid()::text) = 'SUPER')
  OR
  -- 2. I am the manager on THIS record
  (manager_id = get_my_manager_id())
  OR
  -- 3. I have a reservation with this member TODAY
  EXISTS (
    SELECT 1 FROM hannam_reservations r
    WHERE r.member_id = hannam_care_records.member_id
    AND r.manager_id = get_my_manager_id()
    AND r.date = to_char(now() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')::date
  )
);

-- Allow Insert for Instructors (for their own sessions)
CREATE POLICY "Instructor Insert Records" ON hannam_care_records
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL -- Basic check, detailed validation in DB logic or API
);
