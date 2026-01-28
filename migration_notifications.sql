-- [NOTIFICATION SYSTEM UPGRADE]
-- 1. hannam_notifications (Private Alerts)
-- Add user_id for strict security
ALTER TABLE hannam_notifications 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE hannam_notifications ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Users can view own notifications" ON hannam_notifications;
DROP POLICY IF EXISTS "Admins can manage notifications" ON hannam_notifications;

-- Create Policies
-- Users: View/Update (Read status) own
CREATE POLICY "Users can view own notifications"
ON hannam_notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR member_id = (auth.jwt() ->> 'phone_number')); -- Fallback for phone-based if needed, but user_id is better

CREATE POLICY "Users can update own notifications"
ON hannam_notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Admins: Message/View All
CREATE POLICY "Admins can manage notifications"
ON hannam_notifications FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM hannam_admins WHERE email = auth.jwt() ->> 'email')
);

-- 2. hannam_notices (Public Notices)
-- Ensure table exists (Ref ONLY)
CREATE TABLE IF NOT EXISTS hannam_notices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    category TEXT DEFAULT 'NOTICE',
    is_popup BOOLEAN DEFAULT false,
    is_alert_on BOOLEAN DEFAULT false,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for Notices (Public Read)
ALTER TABLE hannam_notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can view notices" ON hannam_notices;
CREATE POLICY "Everyone can view notices" ON hannam_notices FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage notices" ON hannam_notices;
CREATE POLICY "Admins can manage notices" ON hannam_notices FOR ALL USING (
  EXISTS (SELECT 1 FROM hannam_admins WHERE email = auth.jwt() ->> 'email')
);
