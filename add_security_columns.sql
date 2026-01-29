-- [SECURITY UPDATE] Secret Note Author Tracking
-- Adding columns to track EXACTLY who wrote the secret note and when.

ALTER TABLE hannam_reservations 
ADD COLUMN IF NOT EXISTS note_details TEXT, -- Ensure secret note column exists
ADD COLUMN IF NOT EXISTS note_author_id UUID, -- ID of the Admin/Instructor who wrote it
ADD COLUMN IF NOT EXISTS note_author_name TEXT, -- Snapshot of the name (e.g. "박태희 강사")
ADD COLUMN IF NOT EXISTS note_updated_at TIMESTAMPTZ; -- Exact time of save

-- Verify:
-- SELECT id, note_details, note_author_name FROM hannam_reservations LIMIT 1;
