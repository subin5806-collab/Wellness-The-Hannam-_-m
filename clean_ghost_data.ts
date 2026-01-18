
import { createClient } from '@supabase/supabase-js';


// Use db.ts credentials logic
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanGhostData() {
    console.log('>>> [START] Cleaning Ghost Data (Orphaned Records)...');

    // 1. Get all ACTIVE Member IDs
    // (Filter out is_deleted=true. Reservations linked to deleted members should be removed)
    const { data: members, error: mErr } = await supabase.from('hannam_members')
        .select('id')
        .eq('is_deleted', false); // Only consider active members as valid parents

    if (mErr) throw mErr;
    const memberIds = new Set(members.map(m => m.id));
    console.log(`>>> Found ${memberIds.size} ACTIVE members.`);

    // 2. Check Reservations
    const { data: reservations } = await supabase.from('hannam_reservations').select('id, member_id');
    const ghostReservations = (reservations || []).filter(r => !memberIds.has(r.member_id));
    console.log(`>>> Found ${ghostReservations.length} ghost reservations.`);

    for (const r of ghostReservations) {
        await supabase.from('hannam_reservations').delete().eq('id', r.id);
        console.log(`    - Deleted Reservation ${r.id}`);
    }

    // 3. Check Care Records
    const { data: records } = await supabase.from('hannam_care_records').select('id, member_id');
    const ghostRecords = (records || []).filter(r => !memberIds.has(r.member_id));
    console.log(`>>> Found ${ghostRecords.length} ghost care records.`);

    for (const r of ghostRecords) {
        await supabase.from('hannam_care_records').delete().eq('id', r.id);
        console.log(`    - Deleted Care Record ${r.id}`);
    }

    // 4. Check Notifications
    const { data: notis } = await supabase.from('hannam_notifications').select('id, member_id');
    const ghostNotis = (notis || []).filter(n => !memberIds.has(n.member_id));
    console.log(`>>> Found ${ghostNotis.length} ghost notifications.`);

    for (const n of ghostNotis) {
        await supabase.from('hannam_notifications').delete().eq('id', n.id);
        console.log(`    - Deleted Notification ${n.id}`);
    }

    console.log('>>> [COMPLETE] Ghost Data Cleanup Finished.');
}

cleanGhostData();
