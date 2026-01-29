-- [SCHEMA FIX] Add is_active and Fix Foreign Keys for Safe Management

-- 1. Add is_active column to hannam_admins (Default to TRUE)
ALTER TABLE public.hannam_admins 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 2. Modify Foreign Key in hannam_managers to allow safe deletion of admins
-- First, find the constraint name if it exists (usually it's hannam_managers_linked_admin_id_fkey)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.hannam_managers'::regclass
      AND confrelid = 'public.hannam_admins'::regclass;

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.hannam_managers DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- 3. Re-add Foreign Key with ON DELETE SET NULL
ALTER TABLE public.hannam_managers
ADD CONSTRAINT hannam_managers_linked_admin_id_fkey 
FOREIGN KEY (linked_admin_id) 
REFERENCES public.hannam_admins(id) 
ON DELETE SET NULL;

-- 4. Ensure all existing managers have correct linkage if missing
UPDATE public.hannam_managers m
SET linked_admin_id = a.id
FROM public.hannam_admins a
WHERE (m.name = a.name OR replace(m.phone, '-', '') = a.phone)
  AND (m.linked_admin_id IS NULL OR m.linked_admin_id = '');

-- 5. Audit Check
SELECT a.id, a.name, a.is_active, m.id as manager_id, m.name as manager_name
FROM public.hannam_admins a
LEFT JOIN public.hannam_managers m ON m.linked_admin_id = a.id;
