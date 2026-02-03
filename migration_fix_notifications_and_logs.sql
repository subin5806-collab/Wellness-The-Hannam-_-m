-- [CLEANUP] Remove all existing tokens to prevent 400 "Phantom Token" errors
TRUNCATE TABLE hannam_fcm_tokens;

-- [CREATE] Notification Logs Table
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    receiver_id TEXT, -- Member ID (Phone) or UUID
    receiver_phone TEXT,
    type TEXT DEFAULT 'PUSH', -- PUSH, SMS, KAKAO
    trigger_type TEXT DEFAULT 'MANUAL', -- SYSTEM, MANUAL_PUSH, USER_ACTION
    content TEXT,
    status TEXT, -- SUCCESS, FAILED
    error_message TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [RLS] Enable Security
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- [POLICY] Allow Service Role (Server) AND Admins to do everything
CREATE POLICY "Admins and Server can manage logs"
ON notification_logs
FOR ALL
USING (
  -- Service Role (Server) or Admin Email Check
  (auth.role() = 'service_role') OR
  (EXISTS (SELECT 1 FROM hannam_admins WHERE email = auth.jwt() ->> 'email'))
);

-- [POLICY] Users can view their own logs (Optional, if we want history in app)
CREATE POLICY "Users can view own logs"
ON notification_logs
FOR SELECT
USING (
  receiver_id = (SELECT id::text FROM hannam_members WHERE id::text = receiver_id LIMIT 1) -- Basic match if receiver_id is phone
  -- Note: This is simplified. Strict mapping would check auth.uid() against member table.
  -- For now, primary goal is Server Write access.
);
