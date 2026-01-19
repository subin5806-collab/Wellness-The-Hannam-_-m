-- [MIGRATION] Standardize Member ID to Phone Number (TEXT) & Fix RLS
-- Created: 2026-01-19
-- Goal: Replace UUID-based IDs with Phone Numbers across the entire system.
--       AND ensure RLS policies allow access (Anonymous Client Architecture).

BEGIN;

-- 1. [BACKUP] Create Backup Tables (Snapshot)
CREATE TABLE IF NOT EXISTS backup_hannam_members_20260119 AS SELECT * FROM hannam_members;
CREATE TABLE IF NOT EXISTS backup_hannam_memberships_20260119 AS SELECT * FROM hannam_memberships;
CREATE TABLE IF NOT EXISTS backup_hannam_care_records_20260119 AS SELECT * FROM hannam_care_records;
CREATE TABLE IF NOT EXISTS backup_hannam_reservations_20260119 AS SELECT * FROM hannam_reservations;
CREATE TABLE IF NOT EXISTS backup_hannam_contracts_20260119 AS SELECT * FROM hannam_contracts;
CREATE TABLE IF NOT EXISTS backup_hannam_notifications_20260119 AS SELECT * FROM hannam_notifications;
CREATE TABLE IF NOT EXISTS backup_hannam_admin_notes_20260119 AS SELECT * FROM hannam_admin_private_notes;
CREATE TABLE IF NOT EXISTS backup_hannam_action_logs_20260119 AS SELECT * FROM hannam_admin_action_logs;

-- 2. [DROP CONSTRAINTS] Remove Foreign Keys to allow ID changes
ALTER TABLE hannam_memberships DROP CONSTRAINT IF EXISTS hannam_memberships_member_id_fkey;
ALTER TABLE hannam_care_records DROP CONSTRAINT IF EXISTS hannam_care_records_member_id_fkey;
ALTER TABLE hannam_reservations DROP CONSTRAINT IF EXISTS hannam_reservations_member_id_fkey;
ALTER TABLE hannam_contracts DROP CONSTRAINT IF EXISTS hannam_contracts_member_id_fkey;
ALTER TABLE hannam_notifications DROP CONSTRAINT IF EXISTS hannam_notifications_member_id_fkey;
ALTER TABLE hannam_admin_private_notes DROP CONSTRAINT IF EXISTS hannam_admin_private_notes_member_id_fkey;
ALTER TABLE hannam_admin_action_logs DROP CONSTRAINT IF EXISTS hannam_admin_action_logs_member_id_fkey;

-- 3. [MIGRATE CHILDREN] Update Child Tables to use Phone Number
ALTER TABLE hannam_memberships ALTER COLUMN member_id TYPE TEXT;
ALTER TABLE hannam_care_records ALTER COLUMN member_id TYPE TEXT;
ALTER TABLE hannam_reservations ALTER COLUMN member_id TYPE TEXT;
ALTER TABLE hannam_contracts ALTER COLUMN member_id TYPE TEXT;
ALTER TABLE hannam_notifications ALTER COLUMN member_id TYPE TEXT;
ALTER TABLE hannam_admin_private_notes ALTER COLUMN member_id TYPE TEXT;
ALTER TABLE hannam_admin_action_logs ALTER COLUMN member_id TYPE TEXT;
ALTER TABLE hannam_admin_action_logs ALTER COLUMN target_member_id TYPE TEXT;

UPDATE hannam_memberships c SET member_id = m.phone FROM hannam_members m WHERE c.member_id = m.id::text;
UPDATE hannam_care_records c SET member_id = m.phone FROM hannam_members m WHERE c.member_id = m.id::text;
UPDATE hannam_reservations c SET member_id = m.phone FROM hannam_members m WHERE c.member_id = m.id::text;
UPDATE hannam_contracts c SET member_id = m.phone FROM hannam_members m WHERE c.member_id = m.id::text;
UPDATE hannam_notifications c SET member_id = m.phone FROM hannam_members m WHERE c.member_id = m.id::text;
UPDATE hannam_admin_private_notes c SET member_id = m.phone FROM hannam_members m WHERE c.member_id = m.id::text;
UPDATE hannam_admin_action_logs c SET member_id = m.phone FROM hannam_members m WHERE c.member_id = m.id::text;
UPDATE hannam_admin_action_logs c SET target_member_id = m.phone FROM hannam_members m WHERE c.target_member_id = m.id::text;

-- 4. [MIGRATE PARENT] Update hannam_members ID
ALTER TABLE hannam_members ALTER COLUMN id TYPE TEXT;
UPDATE hannam_members SET id = phone;

-- 5. [RESTORE CONSTRAINTS] Re-apply Foreign Keys
ALTER TABLE hannam_memberships ADD CONSTRAINT hannam_memberships_member_id_fkey FOREIGN KEY (member_id) REFERENCES hannam_members(id) ON DELETE CASCADE;
ALTER TABLE hannam_care_records ADD CONSTRAINT hannam_care_records_member_id_fkey FOREIGN KEY (member_id) REFERENCES hannam_members(id) ON DELETE CASCADE;
ALTER TABLE hannam_reservations ADD CONSTRAINT hannam_reservations_member_id_fkey FOREIGN KEY (member_id) REFERENCES hannam_members(id) ON DELETE CASCADE;
ALTER TABLE hannam_contracts ADD CONSTRAINT hannam_contracts_member_id_fkey FOREIGN KEY (member_id) REFERENCES hannam_members(id) ON DELETE CASCADE;
ALTER TABLE hannam_notifications ADD CONSTRAINT hannam_notifications_member_id_fkey FOREIGN KEY (member_id) REFERENCES hannam_members(id) ON DELETE CASCADE;
ALTER TABLE hannam_admin_private_notes ADD CONSTRAINT hannam_admin_private_notes_member_id_fkey FOREIGN KEY (member_id) REFERENCES hannam_members(id) ON DELETE CASCADE;

-- 6. [RLS PERMISSIVE] Ensure all tables are accessible (Anon Client Support)
-- Enable RLS just in case it was disabled, but set policy to TRUE
ALTER TABLE hannam_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE hannam_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE hannam_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hannam_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hannam_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE hannam_care_records ENABLE ROW LEVEL SECURITY;

-- Drop existing potential restrictive policies
DROP POLICY IF EXISTS "Public Access" ON hannam_members;
DROP POLICY IF EXISTS "Public Access" ON hannam_memberships;
DROP POLICY IF EXISTS "Public Access" ON hannam_reservations;
DROP POLICY IF EXISTS "Public Access" ON hannam_contracts;
DROP POLICY IF EXISTS "Public Access" ON hannam_notifications;
DROP POLICY IF EXISTS "Public Access" ON hannam_care_records;

-- Create Permissive Policies
CREATE POLICY "Public Access" ON hannam_members FOR ALL USING (true);
CREATE POLICY "Public Access" ON hannam_memberships FOR ALL USING (true);
CREATE POLICY "Public Access" ON hannam_reservations FOR ALL USING (true);
CREATE POLICY "Public Access" ON hannam_contracts FOR ALL USING (true);
CREATE POLICY "Public Access" ON hannam_notifications FOR ALL USING (true);
CREATE POLICY "Public Access" ON hannam_care_records FOR ALL USING (true);

COMMIT;
