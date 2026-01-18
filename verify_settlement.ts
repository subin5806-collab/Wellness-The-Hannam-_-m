
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const verify = async () => {
    console.log('>>> Verifying Settlement Fix (Direct RPC Call)...');
    const phone = '01033334444';

    // 1. Get Member
    const { data: member } = await supabase.from('hannam_members').select('*').eq('phone', phone).single();
    if (!member) {
        console.error('Member not found!');
        return;
    }
    console.log('Member Found:', member.id, member.name);

    // Check ID Format (Naive UUID check)
    if (member.id.length !== 36) {
        console.error('ERROR: ID does not look like UUID (len!=36):', member.id);
        // return; // Keep going to see if RPC fails
    } else {
        console.log('ID format looks correct (UUID).');
    }

    // 2. Get Membership
    let { data: memberships } = await supabase.from('hannam_memberships').select('*').eq('member_id', member.id);
    if (!memberships || memberships.length === 0) {
        console.log('Creating Test Membership...');
        // Insert dummy membership
        const newMs = {
            member_id: member.id,
            product_name: 'VERIFY_TEST',
            total_amount: 100000,
            remaining_amount: 100000,
            status: 'active',
            created_at: new Date().toISOString()
        };
        const { data: msData, error: msErr } = await supabase.from('hannam_memberships').insert([newMs]).select();
        if (msErr) { console.error('Failed to create ms:', msErr); return; }
        memberships = msData;
    }
    const ms = memberships[0];
    console.log('Using Membership:', ms.id);

    // 3. Get Program
    const { data: programs } = await supabase.from('hannam_programs').select('*');
    const prog = programs?.[0];
    if (!prog) { console.error('No programs'); return; }

    // 4. Simulate Client-Side Logic (Matching db.ts fix)
    console.log('Simulating Client-Side Settlement (Balance Check -> Deduct -> Insert)...');

    // 4.1 Check Balance
    const { data: memberMs, error: msError } = await supabase
        .from('hannam_memberships')
        .select('remaining_amount, used_amount')
        .eq('id', ms.id)
        .single();

    if (msError || !memberMs) { console.error('Membership fetch failed'); return; }
    if (memberMs.remaining_amount < 100) { console.error('Insufficient funds'); return; }

    const newBalance = memberMs.remaining_amount - 100;

    // 4.2 Deduct
    const { error: updateError } = await supabase
        .from('hannam_memberships')
        .update({
            remaining_amount: newBalance,
            used_amount: (memberMs.used_amount || 0) + 100
        })
        .eq('id', ms.id);

    if (updateError) { console.error('Deduction failed:', updateError); return; }

    // 4.3 Insert Record
    const { data: records, error: insertError } = await supabase.from('hannam_care_records').insert([{
        id: crypto.randomUUID(),
        member_id: member.id,
        membership_id: ms.id,
        program_id: prog.id,
        original_price: 100,
        discount_rate: 0,
        final_price: 100,
        balance_after: newBalance,
        note_summary: 'Verification Logic Test',
        note_details: 'Client side logic works',
        signature_status: 'pending',
        date: new Date().toISOString().split('T')[0]
    }]).select();

    if (insertError) {
        console.error('>>> LOGIC FAILED (Insert):', insertError);
    } else {
        console.log('>>> SUCCESS! Record Created:', records[0].id);
        console.log('Balance Updated to:', newBalance);
    }
};

verify();
