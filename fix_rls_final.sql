-- [RLS 긴급 수정: 관리자 권한 완전 개방]
-- Supabase Dashboard SQL Editor에서 실행해주세요.

-- 1. hannam_admin_action_logs (로그 테이블)
ALTER TABLE hannam_admin_action_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON hannam_admin_action_logs;
DROP POLICY IF EXISTS "Admins can view all logs" ON hannam_admin_action_logs;
DROP POLICY IF EXISTS "Admins can insert logs" ON hannam_admin_action_logs;

CREATE POLICY "Admins can insert logs"
ON hannam_admin_action_logs FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view logs"
ON hannam_admin_action_logs FOR SELECT
TO authenticated
USING (true);

-- 2. hannam_memberships (잔액 테이블)
ALTER TABLE hannam_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage memberships" ON hannam_memberships;

CREATE POLICY "Admins can manage memberships"
ON hannam_memberships FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. hannam_care_records (케어 기록 테이블)
ALTER TABLE hannam_care_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage care records" ON hannam_care_records;

CREATE POLICY "Admins can manage care records"
ON hannam_care_records FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. hannam_notifications (알림 테이블)
ALTER TABLE hannam_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can send notifications" ON hannam_notifications;

CREATE POLICY "Admins can send notifications"
ON hannam_notifications FOR insert
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view notifications"
ON hannam_notifications FOR select
TO authenticated
USING (true);
