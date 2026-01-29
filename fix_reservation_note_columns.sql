-- [NOTE SYSTEM FIX] Add missing note columns to hannam_reservations

ALTER TABLE hannam_reservations 
  ADD COLUMN IF NOT EXISTS note_summary TEXT,
  ADD COLUMN IF NOT EXISTS note_details TEXT,
  ADD COLUMN IF NOT EXISTS note_recommendation TEXT,
  ADD COLUMN IF NOT EXISTS note_future_ref TEXT,
  ADD COLUMN IF NOT EXISTS note_author_name TEXT,
  ADD COLUMN IF NOT EXISTS note_updated_at TIMESTAMPTZ;

-- Ensure these columns are accessible (if RLS is on)
-- Normally reservations are readable by admins/staff. No specific change needed for existing policies.
