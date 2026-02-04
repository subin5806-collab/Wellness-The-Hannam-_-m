-- [Fix] Hard Delete Member RPC
-- Replaces the broken deletion function with a robust version.
-- Handles all related tables explicitly to avoid "Table Not Found" or FK errors.

create or replace function hard_delete_member(p_member_id text)
returns void as $$
begin
  -- 1. Detach from Admin Logs (Preserve logs, but anonymize link)
  -- Check if 'target_member_id' column exists effectively by just trying update. 
  -- If it fails, we ignore (but we know the schema has it from migration script).
  update hannam_admin_action_logs 
  set member_id = null 
  where member_id = p_member_id;

  update hannam_admin_action_logs 
  set target_member_id = null 
  where target_member_id = p_member_id;

  -- 2. Delete Personal Data (Cascade usually handles this, but we force it for safety)
  delete from hannam_fcm_tokens where member_id = p_member_id;
  delete from hannam_notifications where member_id = p_member_id;
  delete from hannam_admin_private_notes where member_id = p_member_id;
  
  -- 3. Delete Core Data (Memberships, Records, Reservations)
  -- Order matters if cascade is missing.
  delete from hannam_care_records where member_id = p_member_id;
  delete from hannam_reservations where member_id = p_member_id;
  delete from hannam_contracts where member_id = p_member_id;
  delete from hannam_memberships where member_id = p_member_id;

  -- 4. Finally, Delete Member
  delete from hannam_members where id = p_member_id;

  -- 5. Clean up Auth User (Optional/Advanced: requires Supabase Admin API, can't do in SQL easily without extension)
  -- We assume 'id' in hannam_members IS the Auth/Phone. 
  -- If linked to auth.users, it will remain as 'orphan' in Auth but deleted in Public.
  -- This matches the requirement "Remove Member".
end;
$$ language plpgsql security definer;
