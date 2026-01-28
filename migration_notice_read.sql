-- [SYNC & READ STATUS FIX]
-- Add column to track which notices a user has read
ALTER TABLE hannam_members
ADD COLUMN IF NOT EXISTS confirmed_notice_ids TEXT[] DEFAULT '{}';

-- Ensure RLS allows users to update their own confirmed_notice_ids
DROP POLICY IF EXISTS "Users can update own read status" ON hannam_members;
CREATE POLICY "Users can update own read status"
ON hannam_members FOR UPDATE
TO authenticated
USING (auth.uid()::text = id OR id = (auth.jwt() ->> 'phone_number')) -- Phone number text ID match
WITH CHECK (auth.uid()::text = id OR id = (auth.jwt() ->> 'phone_number'));
