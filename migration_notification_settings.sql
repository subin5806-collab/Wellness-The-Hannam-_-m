-- Create a table for system-wide settings if not exists
CREATE TABLE IF NOT EXISTS hannam_system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by TEXT -- Admin email
);

-- Insert default Notification Config
INSERT INTO hannam_system_settings (key, value)
VALUES (
    'NOTIFICATION_CONFIG',
    '{
        "visitReminder": { "enabled": true, "time": "09:00", "timing": "1_DAY_BEFORE" },
        "etiquette": { "enabled": true, "start": "22:00", "end": "08:00" }
    }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE hannam_system_settings ENABLE ROW LEVEL SECURITY;

-- Allow read to authenticated users (admin/members might need read depending on logic, but mostly admin)
-- Actually, strict security: Only Admins can read/write settings.
CREATE POLICY "Admins can manage settings" ON hannam_system_settings
    FOR ALL
    USING (auth.jwt() ->> 'email' LIKE '%@wellness.hannam') -- Simplified check or use existing admin logic
    WITH CHECK (auth.jwt() ->> 'email' LIKE '%@wellness.hannam');
