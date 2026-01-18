-- [1] Create 'hannam' Storage Bucket (Public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('hannam', 'hannam', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- [2] Storage Policies for 'hannam' (Allow All for Anon/Public)
-- Policy: Public Read
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'hannam' );

-- Policy: Anon Upload/Update/Delete
CREATE POLICY "Anon Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'hannam' );

CREATE POLICY "Anon Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'hannam' );

CREATE POLICY "Anon Delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'hannam' );


-- [3] RLS Policies for 'hannam_notices' (Allow All for Anon/Public)
ALTER TABLE hannam_notices ENABLE ROW LEVEL SECURITY;

-- Allow SELECT for everyone
CREATE POLICY "Public Select Notices"
ON hannam_notices FOR SELECT
USING (true);

-- Allow INSERT/UPDATE/DELETE for everyone (Anon)
CREATE POLICY "Public Write Notices"
ON hannam_notices FOR ALL
USING (true)
WITH CHECK (true);

-- [Optional] Verify
SELECT * FROM storage.buckets WHERE id = 'hannam';
