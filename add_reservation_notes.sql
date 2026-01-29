-- Add note columns to hannam_reservations to support Instructor Recording Workflow
ALTER TABLE hannam_reservations 
ADD COLUMN IF NOT EXISTS note_summary TEXT,
ADD COLUMN IF NOT EXISTS note_details TEXT,
ADD COLUMN IF NOT EXISTS note_recommendation TEXT,
ADD COLUMN IF NOT EXISTS note_future_ref TEXT,
ADD COLUMN IF NOT EXISTS note_author_name TEXT,
ADD COLUMN IF NOT EXISTS note_updated_at TIMESTAMP WITH TIME ZONE;

-- Add columns to hannam_care_records for logging and clinical data
ALTER TABLE hannam_care_records
ADD COLUMN IF NOT EXISTS settled_by TEXT,
ADD COLUMN IF NOT EXISTS instructor_name TEXT,
ADD COLUMN IF NOT EXISTS note_author_name TEXT,
ADD COLUMN IF NOT EXISTS note_updated_at TIMESTAMP WITH TIME ZONE;
