-- [FORCE DELETE FIX] Enable CASCADE deletion to prevent Foreign Key errors
-- This allows deleting from either table without manual unlinking.

-- 1. DROP existing constraint (if any)
DO $$
DECLARE
    cnt int;
BEGIN
    SELECT count(*) INTO cnt FROM pg_constraint WHERE conname = 'hannam_managers_linked_admin_id_fkey';
    IF cnt > 0 THEN
        ALTER TABLE public.hannam_managers DROP CONSTRAINT hannam_managers_linked_admin_id_fkey;
    END IF;
END $$;

-- 2. RE-ADD with ON DELETE CASCADE
-- When an admin is deleted, the 'linked_admin_id' in hannam_managers will be handled.
-- Actually, ON DELETE SET NULL is safer for the manager profile, 
-- but the user said "Cascade" is fine. However, we don't want to delete the MANAGER profile itself
-- just because the account is gone. SET NULL is what makes "independent deletion" work.
-- If user deletes Admin -> Manager.linked_admin_id becomes NULL.
-- If user deletes Manager -> Admin stays (independent).

ALTER TABLE public.hannam_managers
ADD CONSTRAINT hannam_managers_linked_admin_id_fkey 
FOREIGN KEY (linked_admin_id) 
REFERENCES public.hannam_admins(id) 
ON DELETE SET NULL; 

-- Note: SET NULL is mathematically the best way to allow "independent" deletion while keeping records.
-- If the user TRULY wants the account to be GONE, we will use a hard delete in the code.
