-- [Fix] Final Corrected Schema for Admin Private Notes
-- hannam_care_records.id is UUID
-- hannam_members.id is TEXT (matches user provided schema)
-- RLS Policy: Removed 'is_active' check as the column does not exist.

DROP TABLE IF EXISTS hannam_admin_private_notes;

CREATE TABLE hannam_admin_private_notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  care_record_id UUID REFERENCES hannam_care_records(id) ON DELETE CASCADE,
  member_id TEXT REFERENCES hannam_members(id) ON DELETE CASCADE,
  admin_email TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(care_record_id)
);

ALTER TABLE hannam_admin_private_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Admin Access Only (Email Match Only)
CREATE POLICY "Admins can view/edit" ON hannam_admin_private_notes 
USING (EXISTS (SELECT 1 FROM hannam_admins WHERE email = auth.email()));
