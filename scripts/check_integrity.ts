
import { createClient } from '@supabase/supabase-js';

// [CONFIG] Use Anon Key to simulate Client Side Access
const supabaseUrl = 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyIntegrity() {
    console.log('================================================');
    console.log('[SYSTEM VERIFICATION] Standardized ID Check');
    console.log('================================================');

    const targetId = '01058060134'; // Moon Subin's Phone Number (Now the ID)
    console.log(`Target Member ID (Phone): ${targetId}`);

    // 1. Fetch Member (Critical: Must return data using Phone as ID)
    console.log('\n[1] Member Profile Lookup...');
    const { data: member, error: mErr } = await supabase.from('hannam_members').select('*').eq('id', targetId).single();

    if (mErr || !member) {
        console.error('❌ FAILED: Member not found by Phone ID.', mErr?.message);
        console.log('TIP: Did you run the migration_fix_member_ids_v2.sql script?');
        return;
    }
    console.log(`✅ SUCCESS: Found ${member.name}`);
    console.log(`   - ID: ${member.id}`);
    console.log(`   - Phone: ${member.phone}`);
    if (member.id !== member.phone) console.warn('   ⚠️ WARNING: ID does not match Phone exactly (Check whitespace?)');

    // 2. Fetch Care Records (Data Consistency)
    console.log('\n[2] Care History & Foreign Keys...');
    const { data: records, error: rErr } = await supabase.from('hannam_care_records').select('*').eq('member_id', targetId).order('date', { ascending: false });

    if (rErr) {
        console.error('❌ FAILED: Care Records fetch error.', rErr.message);
        return;
    }
    console.log(`✅ SUCCESS: Found ${records.length} care records linked to ${targetId}`);

    if (records.length === 0) {
        console.warn('   ⚠️ No records found. Cannot verify deeper links.');
    } else {
        const latestInfo = records[0];
        console.log(`   - Latest Record: ${latestInfo.date} / -${latestInfo.final_price}`);
    }

    // 3. Verify Private Note Link (Data Link)
    console.log('\n[3] Admin Private Note Link...');
    if (records.length > 0) {
        const record = records[0];
        const { data: note, error: nErr } = await supabase.from('hannam_admin_private_notes').select('*').eq('care_record_id', record.id).maybeSingle();

        if (nErr) console.error('   ❌ Note Fetch Error:', nErr.message);

        if (note) {
            console.log(`✅ SUCCESS: Linked Private Note found.`);
            console.log(`   - Note ID: ${note.id}`);
            console.log(`   - Member ID in Note: ${note.member_id} (Should be ${targetId})`);
            if (note.member_id !== targetId) console.error('   ❌ MISMATCH: Note member_id is wrong!');
        } else {
            console.log(`   ℹ️ No note for latest record. Skipping link check.`);
        }
    }

    // 4. Verify Balance Calculation (Financial Logic)
    console.log('\n[4] Financial Balance Integrity...');

    // Fetch Memberships
    const { data: memberships } = await supabase.from('hannam_memberships').select('*').eq('member_id', targetId);
    const { data: allRecords } = await supabase.from('hannam_care_records').select('*').eq('member_id', targetId);

    if (!memberships || memberships.length === 0) {
        console.warn('   ⚠️ No memberships found.');
    } else {
        const totalInvested = memberships.reduce((sum, m) => sum + (m.total_amount || 0), 0);

        // Calculate usage based on signed/completed records
        const signedRecords = allRecords?.filter(r => r.signature_status === 'completed') || [];
        const totalUsed = signedRecords.reduce((sum, r) => sum + (r.final_price || 0), 0);

        const calculatedRemaining = totalInvested - totalUsed;

        console.log(`   - Total Invested: ${totalInvested.toLocaleString()}`);
        console.log(`   - Total Used (Signed): ${totalUsed.toLocaleString()}`);
        console.log(`   - Calculated Remaining: ${calculatedRemaining.toLocaleString()}`);

        // Compare with Record Snapshot (if available)
        if (records.length > 0) {
            const snapshot = records[0].balance_after;
            console.log(`   - DB Snapshot (Latest): ${snapshot.toLocaleString()}`);

            if (Math.abs(calculatedRemaining - snapshot) < 100) {
                console.log(`✅ SUCCESS: Dynamic Calculation matches DB Snapshot.`);
            } else {
                console.warn(`   ⚠️ WARNING: Balance Mismatch! Check for unsigned records or manual adjustments.`);
            }
        }
    }

    console.log('\n================================================');
    console.log('[VERIFICATION COMPLETE]');
}

verifyIntegrity();
