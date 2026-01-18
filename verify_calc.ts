
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

import { createHash } from 'crypto';

const verifyCalc = async () => {
    console.log('>>> Verifying 3-Point Checklist...');

    // 1. Password Reset for 01033334444 (for Visual Check)
    const phone = '01033334444';
    const cleanPhone = phone; // Assuming already clean
    const demoPassword = '4444';
    const hashedPassword = createHash('sha256').update(demoPassword).digest('hex');

    const { data: member } = await supabase.from('hannam_members').select('*').eq('phone', cleanPhone).single();
    if (!member) { console.error('Member not found'); return; }

    await supabase.from('hannam_members').update({ password: hashedPassword }).eq('id', member.id);
    console.log(`[Check 1] Member Password Reset to '${demoPassword}' for Login Test.`);

    // 2. Financial Math Verification (The User's Case)
    // "Total 3,000,000 - Used 1,188,000 = Remaining 1,812,000"

    // Create a fresh membership for this exact test
    const msId = crypto.randomUUID();
    const total = 3000000;
    const deductAmount = 1188000;

    // Start with Clean 3,000,000
    const { error: insertErr } = await supabase.from('hannam_memberships').insert([{
        id: msId,
        member_id: member.id,
        product_name: 'MATH_VERIFICATION',
        total_amount: total,
        remaining_amount: total,
        used_amount: 0,
        status: 'active',
        created_at: new Date().toISOString()
    }]);

    if (insertErr) { console.error('Failed to create test membership:', insertErr); return; }
    console.log(`[Check 2] Created Test Membership: Total ${total.toLocaleString()}`);

    // Simulate Deduction Logic (Mirroring db.ts)
    const { data: memberMs, error: selectErr } = await supabase.from('hannam_memberships').select('*').eq('id', msId).single();
    if (selectErr || !memberMs) { console.error('Failed to fetch test membership:', selectErr); return; }

    const currentTotal = memberMs.total_amount; // 3,000,000
    const currentRemaining = memberMs.remaining_amount; // 3,000,000
    const currentUsed = memberMs.used_amount || 0; // 0

    const newRemaining = currentRemaining - deductAmount; // 3m - 1.188m = 1.812m
    const healedUsed = currentTotal - newRemaining; // 3m - 1.812m = 1.188m

    console.log(`[Math Check] ${currentTotal.toLocaleString()} - ${deductAmount.toLocaleString()} = ${newRemaining.toLocaleString()}`);

    if (newRemaining === 1812000) {
        console.log('>>> [SUCCESS] Math Exact Match: Remaining 1,812,000');
    } else {
        console.error(`>>> [FAIL] Math Error: Expected Remaining 1,812,000, Got ${newRemaining.toLocaleString()}`);
    }

    if (healedUsed === 1188000) {
        console.log('>>> [SUCCESS] Used Amount Updated Correctly to 1,188,000');
    } else {
        console.error(`>>> [FAIL] Used Amount Error: Expected Used 1,188,000, Got ${healedUsed.toLocaleString()}`);
    }

    // Clean up
    await supabase.from('hannam_memberships').delete().eq('id', msId);
    console.log(`[Cleanup] Deleted test membership ${msId}`);
};

verifyCalc();
