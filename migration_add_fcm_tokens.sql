-- 1. Create FCM Token Storage Table
CREATE TABLE IF NOT EXISTS hannam_fcm_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    member_id TEXT REFERENCES hannam_members(id) ON DELETE CASCADE, -- References Phone Number
    token TEXT NOT NULL,
    device_type TEXT DEFAULT 'web',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(member_id, token) -- Prevent duplicate tokens for same user
);

-- 2. Enable RLS
ALTER TABLE hannam_fcm_tokens ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Allow anyone to insert (since we identify by phone number in local storage)
-- But ideally, we should check if the user OWNS the phone number via Auth.
-- For now, consistent with current simplified Auth:
DROP POLICY IF EXISTS "Public can insert own token" ON hannam_fcm_tokens;
CREATE POLICY "Public can insert own token" ON hannam_fcm_tokens FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read own tokens" ON hannam_fcm_tokens;
CREATE POLICY "Users can read own tokens" ON hannam_fcm_tokens FOR SELECT USING (member_id = current_setting('request.jwt.claim.sub', true) OR true);
-- Note: 'true' is broad, but consistent with current 'phone ID' system where auth.uid() might not match member_id (text).

DROP POLICY IF EXISTS "Users can delete own tokens" ON hannam_fcm_tokens;
CREATE POLICY "Users can delete own tokens" ON hannam_fcm_tokens FOR DELETE USING (true); -- Simplified for removal on logout

-- 4. Notification Triggers (Optional: Trigger 'Payment Complete' push automatically via Database?)
-- We will handle sending via API logic (Edge Function) for better control.
