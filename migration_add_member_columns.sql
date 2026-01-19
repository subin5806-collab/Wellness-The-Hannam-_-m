-- Add missing columns to hannam_members table
-- to fix MemberPortal crash (400 Bad Request)

ALTER TABLE hannam_members 
ADD COLUMN IF NOT EXISTS initial_password_set BOOLEAN DEFAULT false;

ALTER TABLE hannam_members 
ADD COLUMN IF NOT EXISTS confirmed_notice_ids TEXT[] DEFAULT '{}';
