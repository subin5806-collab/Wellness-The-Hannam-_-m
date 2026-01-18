-- [CRITICAL] Run this script in Supabase SQL Editor to enable new features

-- 1. Add 'admin_memo' column for Secret Memo feature
ALTER TABLE hannam_members 
ADD COLUMN IF NOT EXISTS admin_memo TEXT;

-- 2. Ensure Data Integrity with ON DELETE CASCADE (Fixes Ghost Data issue)
ALTER TABLE hannam_reservations DROP CONSTRAINT IF EXISTS hannam_reservations_member_id_fkey;
ALTER TABLE hannam_care_records DROP CONSTRAINT IF EXISTS hannam_care_records_member_id_fkey;
ALTER TABLE hannam_notifications DROP CONSTRAINT IF EXISTS hannam_notifications_member_id_fkey;
ALTER TABLE hannam_memberships DROP CONSTRAINT IF EXISTS hannam_memberships_member_id_fkey;

ALTER TABLE hannam_reservations
ADD CONSTRAINT hannam_reservations_member_id_fkey
FOREIGN KEY (member_id) REFERENCES hannam_members(id)
ON DELETE CASCADE;

ALTER TABLE hannam_care_records
ADD CONSTRAINT hannam_care_records_member_id_fkey
FOREIGN KEY (member_id) REFERENCES hannam_members(id)
ON DELETE CASCADE;

ALTER TABLE hannam_notifications
ADD CONSTRAINT hannam_notifications_member_id_fkey
FOREIGN KEY (member_id) REFERENCES hannam_members(id)
ON DELETE CASCADE;

ALTER TABLE hannam_memberships
ADD CONSTRAINT hannam_memberships_member_id_fkey
FOREIGN KEY (member_id) REFERENCES hannam_members(id)
ON DELETE CASCADE;
