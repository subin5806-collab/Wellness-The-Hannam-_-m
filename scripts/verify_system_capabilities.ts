
import { createClient } from '@supabase/supabase-js';

// Hardcoded from db.ts
const supabaseUrl = 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

const supabase = createClient(supabaseUrl, supabaseKey);

// Dummy Base64 Image (1x1 Pixel Transparent PNG)
const DUMMY_SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

async function runCapabilityTest() {
    console.log('>>> [CAPABILITY TEST] Verifying Signature & Notification Storage Logic...\n');

    // 1. Setup: Find a member to attach dummy data to
    const { data: members } = await supabase.from('hannam_members').select('id, name').limit(1);
    if (!members || members.length === 0) {
        console.error('[FAIL] No members found to test with.');
        return;
    }
    const testMember = members[0];
    console.log(`[SETUP] Using Member: ${testMember.name} (${testMember.id})`);

    // 2. Insert Dummy Care Record (Direct SQL to bypass balance deduction)
    const dummyId = crypto.randomUUID();
    console.log(`[STEP 1] Inserting Dummy Care Record (ID: ${dummyId})...`);

    const { error: insertErr } = await supabase.from('hannam_care_records').insert([{
        id: dummyId,
        member_id: testMember.id,
        membership_id: 'TEST_MEMBERSHIP_ID', // Won't link to real one
        program_id: 'TEST_PROG',
        original_price: 0,
        discount_rate: 0,
        final_price: 0,
        note_summary: 'TEST_VERIFICATION',
        note_details: 'System Capability Check',
        date: new Date().toISOString().split('T')[0],
        signature_status: 'pending'
    }]);

    if (insertErr) {
        // If FK constraint fails (membership_id), we might need to fetch a real membership id BUT not update it.
        // Or just ignore if schema allows null? Schema usually enforces FK.
        // Let's try to find a real membership ID but NOT change its balance.
        console.warn('[WARN] Insert failed (likely FK). Retrying with existing membership ID (Safe Mode - No deduction)...');

        const { data: realMs } = await supabase.from('hannam_memberships').select('id').eq('member_id', testMember.id).limit(1);
        if (!realMs || realMs.length === 0) {
            console.error('[FAIL] No real membership found to satisfy FK.');
            return;
        }

        const retryErr = await supabase.from('hannam_care_records').insert([{
            id: dummyId,
            member_id: testMember.id,
            membership_id: realMs[0].id,
            program_id: 'PROG-1737130000000', // Try a likely ID or fetch one
            original_price: 0,
            discount_rate: 0,
            final_price: 0,
            note_summary: 'TEST_VERIFICATION',
            note_details: 'System Capability Check',
            date: new Date().toISOString().split('T')[0],
            signature_status: 'pending'
        }]);

        // If program fails, we need a real program.
        // Assuming simple insert for now. If this fails, I'll update plan.
    }

    // 3. Test Signature Update
    console.log('[STEP 2] Simulating Signature Save...');
    const { data: updated, error: updateErr } = await supabase
        .from('hannam_care_records')
        .update({
            signature_data: DUMMY_SIG,
            signature_status: 'completed',
            signed_at: new Date().toISOString()
        })
        .eq('id', dummyId)
        .select();

    if (updateErr) {
        console.error(`[FAIL] Signature Update Failed: ${updateErr.message}`);
    } else {
        const savedData = updated[0].signature_data;
        if (savedData === DUMMY_SIG) {
            console.log('[PASS] Signature Saved Successfully!');
            console.log(`       Data: ${savedData.substring(0, 50)}...`);
        } else {
            console.error('[FAIL] Saved data does not match input.');
        }
    }

    // 4. Test Notification Trigger
    console.log('\n[STEP 3] Simulating Notification...');
    const notiId = `TEST-NOTI-${Date.now()}`;
    const { error: notiErr } = await supabase.from('hannam_notifications').insert([{
        id: notiId,
        member_id: testMember.id,
        // type column does not exist in DB schema
        title: 'Verification Test',
        content: 'This is a test notification for the red dot logic.',
        is_read: false,
        created_at: new Date().toISOString()
    }]);

    if (notiErr) {
        console.error(`[FAIL] Notification Insert Failed: ${notiErr.message}`);
    } else {
        console.log('[PASS] Notification Inserted.');
        // Verify Red Dot Capability
        const { count } = await supabase.from('hannam_notifications')
            .select('*', { count: 'exact', head: true })
            .eq('member_id', testMember.id)
            .eq('is_read', false);

        console.log(`[INFO] Current Unread Count: ${count}`);
        if (count && count > 0) console.log('[PASS] Red Dot Logic: Unread count > 0 confirmed.');
    }

    // 5. Cleanup
    console.log('\n[CLEANUP] Removing test data...');
    await supabase.from('hannam_care_records').delete().eq('id', dummyId);
    await supabase.from('hannam_notifications').delete().eq('id', notiId);
    console.log('[DONE] Test Complete.');
}

runCapabilityTest();
