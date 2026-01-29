-- [System Recovery - FIXED] 안전한 ID 자동 생성 및 컬럼 추가
-- 1. 강사 ID 자동 생성 (기존 기본키 규칙 유지하며 설정)
ALTER TABLE public.hannam_managers 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 2. 예약 노트 컬럼 추가 (중복 방지 처리)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hannam_reservations' AND column_name='details') THEN
        ALTER TABLE public.hannam_reservations ADD COLUMN details TEXT;
    END IF;
END $$;

ALTER TABLE public.hannam_reservations 
ADD COLUMN IF NOT EXISTS note_details TEXT,
ADD COLUMN IF NOT EXISTS note_summary TEXT,
ADD COLUMN IF NOT EXISTS note_recommendation TEXT,
ADD COLUMN IF NOT EXISTS note_future_ref TEXT,
ADD COLUMN IF NOT EXISTS note_author_name TEXT,
ADD COLUMN IF NOT EXISTS note_updated_at TIMESTAMPTZ;
