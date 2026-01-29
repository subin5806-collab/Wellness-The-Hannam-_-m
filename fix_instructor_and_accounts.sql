-- [1] Ensure hannam_admins has all required columns
ALTER TABLE hannam_admins 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- [2] Ensure hannam_managers has all required columns
ALTER TABLE hannam_managers 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- [3] Fix Foreign Key Constraints for safe deletion
-- If we delete a manager, we don't want Care Records or Reservations to block it.
-- We will SET NULL for historical stability.

-- Reservations
ALTER TABLE hannam_reservations 
DROP CONSTRAINT IF EXISTS hannam_reservations_manager_id_fkey,
ADD CONSTRAINT hannam_reservations_manager_id_fkey 
FOREIGN KEY (manager_id) REFERENCES hannam_managers(id) ON DELETE SET NULL;

-- Care Records
ALTER TABLE hannam_care_records 
DROP CONSTRAINT IF EXISTS hannam_care_records_manager_id_fkey,
ADD CONSTRAINT hannam_care_records_manager_id_fkey 
FOREIGN KEY (manager_id) REFERENCES hannam_managers(id) ON DELETE SET NULL;

-- [4] Implement CASCADE: Delete Manager -> Delete Admin Account
-- Since Managers points to Admins, SQL Cascade won't work that way (parent vs child).
-- We use a Trigger.

CREATE OR REPLACE FUNCTION fn_delete_associated_admin()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.linked_admin_id IS NOT NULL THEN
        DELETE FROM hannam_admins WHERE id = OLD.linked_admin_id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_delete_manager_admin ON hannam_managers;
CREATE TRIGGER tr_delete_manager_admin
AFTER DELETE ON hannam_managers
FOR EACH ROW
EXECUTE FUNCTION fn_delete_associated_admin();

-- [5] Cleanup: Delete Ghost Columns if any (not really needed but ensure sync)
-- Ensure 'is_deleted' exists if code uses it (it does in db.ts managers.getAll)
