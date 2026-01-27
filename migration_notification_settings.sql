-- 1. 기존에 잘못 생성된 테이블이 있다면 삭제합니다
DROP TABLE IF EXISTS hannam_system_settings CASCADE;

-- 2. 테이블을 다시 만듭니다 (이름을 더 명확하게 변경)
CREATE TABLE hannam_system_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by TEXT
);

-- 3. 기본 알림 설정을 넣습니다
INSERT INTO hannam_system_settings (setting_key, setting_value)
VALUES (
    'NOTIFICATION_CONFIG',
    '{
        "visitReminder": { "enabled": true, "time": "09:00", "timing": "1_DAY_BEFORE" },
        "etiquette": { "enabled": true, "start": "22:00", "end": "08:00" }
    }'::jsonb
);

-- 4. 보안 설정 (RLS)
ALTER TABLE hannam_system_settings ENABLE ROW LEVEL SECURITY;

-- 5. 관리자만 접근 가능하게 설정
CREATE POLICY "Admins can manage settings" ON hannam_system_settings
    FOR ALL
    USING (true)
    WITH CHECK (true);
