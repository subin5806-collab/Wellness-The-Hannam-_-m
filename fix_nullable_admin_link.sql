-- [1] Make linked_admin_id nullable in hannam_managers
ALTER TABLE hannam_managers ALTER COLUMN linked_admin_id DROP NOT NULL;

-- [2] Drop existing strict foreign key constraint if it exists
ALTER TABLE hannam_managers DROP CONSTRAINT IF EXISTS hannam_managers_linked_admin_id_fkey;

-- [3] Re-add foreign key constraint with ON DELETE SET NULL
-- This allows linked_admin_id to be NULL during registration.
ALTER TABLE hannam_managers 
ADD CONSTRAINT hannam_managers_linked_admin_id_fkey 
FOREIGN KEY (linked_admin_id) REFERENCES hannam_admins(id) 
ON DELETE SET NULL;
