-- [Fix Notification RLS]
-- Add policy to allow members to view notifications based on Phone Number (member_id)
-- This is required because Admin Console inserts notifications using Phone Number (member_id) but leaves user_id NULL.
-- The previous strict policy (auth.uid() = user_id) hid these notifications.

ALTER TABLE hannam_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON hannam_notifications;

CREATE POLICY "Users can view own notifications"
ON hannam_notifications FOR SELECT
TO authenticated
USING (
  -- 1. Match by UUID (Strict)
  auth.uid() = user_id 
  OR 
  -- 2. Match by Phone Number (Loose / Migrated)
  -- We assume member_id stores the phone number (e.g., '01012345678')
  -- We extract the phone number from the JWT.
  -- Note: ensure your JWT actually contains 'phone_number' or 'phone'. 
  -- Supabase defaults: 'phone' in user_metadata, or 'phone' claim check.
  -- Safest is checking 'phone' property in metadata, or matching the JWT phone claim.
  member_id = (auth.jwt() ->> 'phone_number')
  OR
  member_id = (auth.jwt() -> 'user_metadata' ->> 'phone')
  OR
  member_id = (auth.jwt() -> 'user_metadata' ->> 'phone_number')
);

DROP POLICY IF EXISTS "Users can update own notifications" ON hannam_notifications;

CREATE POLICY "Users can update own notifications"
ON hannam_notifications FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id 
  OR 
  member_id = (auth.jwt() ->> 'phone_number')
  OR
  member_id = (auth.jwt() -> 'user_metadata' ->> 'phone')
)
WITH CHECK (
  auth.uid() = user_id 
  OR 
  member_id = (auth.jwt() ->> 'phone_number')
  OR
  member_id = (auth.jwt() -> 'user_metadata' ->> 'phone')
);

-- Ensure hannam_notices is viewable by everyone
DROP POLICY IF EXISTS "Everyone can view notices" ON hannam_notices;
CREATE POLICY "Everyone can view notices" ON hannam_notices FOR SELECT USING (true);
