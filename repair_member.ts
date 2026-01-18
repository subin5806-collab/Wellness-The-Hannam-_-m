
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const BAD_ID = '01033334444';

const repair = async () => {
    console.log('>>> Starting Repair for ID:', BAD_ID);

    // 1. Fetch Bad Member
    const { data: badMember, error: fetchError } = await supabase.from('hannam_members').select('*').eq('id', BAD_ID).single();
    if (fetchError || !badMember) {
        console.error('Failed to fetch bad member:', fetchError);
        return;
    }
    console.log('Found Bad Member:', badMember.name);

    // 1.5 Rename Old Member Unique Fields (Email/Phone) to free up constraints
    const tempEmail = `del_${Date.now()}_${badMember.email}`;
    const tempPhone = `del_${Date.now()}`.slice(0, 15); // Phone constraint might be length limited? likely not strictly.
    // actually, let's just use a random invalid phone if possible.

    console.log('Renaming Old Member Unique Fields...');
    const { error: renameError } = await supabase.from('hannam_members').update({
        email: tempEmail,
        phone: tempPhone
    }).eq('id', BAD_ID);

    if (renameError) {
        console.error('Failed to rename old member:', renameError);
        return;
    }

    // 2. Create NEW Member with VALID UUID
    const newId = crypto.randomUUID();
    const newMember = { ...badMember, id: newId };

    // Ensure we don't accidentally use the TEMP values if we copied object reference? 
    // No, we copied `badMember` BEFORE renaming. `badMember` holds original values. Good.

    delete newMember.created_at; // Letting DB handle or keeping original? Let's keep original if possible, but 'default' usually handles it.
    // If we want to preserve history, we should keep created_at.

    // Note: 'hannam_members' likely has specific columns. We should just insert the object we got, swapping ID.
    // Ensure we don't insert unknown columns if select('*') returns joined data (it shouldn't).

    console.log('Creating New Member with ID:', newId);
    const { error: insertError } = await supabase.from('hannam_members').insert([newMember]);
    if (insertError) {
        console.error('Failed to insert new member:', insertError);
        // ROLLBACK: Try to revert old member name?
        console.log('Attempting Revert of Old Member...');
        await supabase.from('hannam_members').update({ email: badMember.email, phone: badMember.phone }).eq('id', BAD_ID);
        return;
    }
    console.log('New Member Inserted.');

    // 3. Update Foreign Keys (Memberships, Reservations, CareRecords)
    // Table: hannam_memberships
    {
        const { error } = await supabase.from('hannam_memberships').update({ member_id: newId }).eq('member_id', BAD_ID);
        if (error) console.error('Failed to migrate memberships:', error);
        else console.log('Migrated memberships.');
    }

    // Table: hannam_reservations
    {
        const { error } = await supabase.from('hannam_reservations').update({ member_id: newId }).eq('member_id', BAD_ID);
        if (error) console.error('Failed to migrate reservations:', error);
        else console.log('Migrated reservations.');
    }

    // Table: hannam_care_records
    {
        const { error } = await supabase.from('hannam_care_records').update({ member_id: newId }).eq('member_id', BAD_ID);
        if (error) console.error('Failed to migrate care records:', error);
        else console.log('Migrated care records.');
    }

    // Table: hannam_admin_action_logs (audit logs)
    {
        const { error } = await supabase.from('hannam_admin_action_logs').update({ member_id: newId, target_member_id: newId }).eq('member_id', BAD_ID);
        if (error) console.warn('Failed to migrate audit logs (member_id):', error);

        const { error: error2 } = await supabase.from('hannam_admin_action_logs').update({ target_member_id: newId }).eq('target_member_id', BAD_ID);
        if (error2) console.warn('Failed to migrate audit logs (target_member_id):', error2);
        else console.log('Migrated audit logs.');
    }

    // 4. Delete Old Member
    console.log('Deleting Old Member...');
    const { error: deleteError } = await supabase.from('hannam_members').delete().eq('id', BAD_ID);
    if (deleteError) {
        console.error('Failed to delete old member:', deleteError);
        console.log('Recommended Manual Action: Delete member with ID explicitly.', BAD_ID);
    } else {
        console.log('Repair Complete! Old member deleted.');
    }
};

repair();
