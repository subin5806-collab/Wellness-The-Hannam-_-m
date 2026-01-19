
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
// Also try loading from .env.local if not found
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

// Note: Using Anon Key for read-only verification is sufficient for this check.
const supabase = createClient(supabaseUrl, supabaseKey);

const MEMBER_ID = '0101111111';

async function analyze() {
    console.log(`Analyzing financial data for member: ${MEMBER_ID}`);

    // 1. Get Memberships
    const { data: memberships, error: msError } = await supabase
        .from('hannam_memberships')
        .select('*')
        .eq('member_id', MEMBER_ID);

    if (msError) {
        console.error('Error fetching memberships:', msError);
        return;
    }

    // 2. Get Care Records
    const { data: records, error: rError } = await supabase
        .from('hannam_care_records')
        .select('*')
        .eq('member_id', MEMBER_ID)
        .order('date', { ascending: true }); // chronological

    if (rError) {
        console.error('Error fetching records:', rError);
        return;
    }

    console.log(`Found ${memberships.length} memberships, ${records.length} care records.`);

    // 3. Logic Check
    // Formula: Total Payment - Actual Usage = Residual

    // Aggregates
    let grandTotalPayment = 0;
    let grandUsageSum = 0;
    let grandDBRemaining = 0;

    memberships.forEach(ms => {
        console.log(`\n[Membership ${ms.id}]`);
        console.log(`  Product: ${ms.product_name}`);
        console.log(`  Total Amount: ${ms.total_amount}`);
        console.log(`  DB Stored Remaining: ${ms.remaining_amount}`);
        console.log(`  DB Stored Used: ${ms.used_amount}`);

        grandTotalPayment += ms.total_amount;
        grandDBRemaining += ms.remaining_amount;
    });

    // Check usage linked to specific membership if possible, or global sum if single pool
    // The schema separates memberships, but 'care_records' has 'membership_id'.

    // Group records by membership
    const usageByMs: Record<string, number> = {};
    let globalUsageVerify = 0;

    records.forEach(r => {
        const msId = r.membership_id;
        const amount = r.final_price || 0;
        usageByMs[msId] = (usageByMs[msId] || 0) + amount;
        globalUsageVerify += amount;
    });

    console.log('\n[Usage Verification]');
    let allValid = true;

    memberships.forEach(ms => {
        const calculatedUsage = usageByMs[ms.id] || 0;
        const expectedRemaining = ms.total_amount - calculatedUsage;
        const diff = expectedRemaining - ms.remaining_amount;

        console.log(`  Membership ${ms.id.slice(0, 8)}...`);
        console.log(`    Total: ${ms.total_amount}`);
        console.log(`    Sum(Records): ${calculatedUsage}`);
        console.log(`    Expected Remaining (Total-Sum): ${expectedRemaining}`);
        console.log(`    Stored Remaining: ${ms.remaining_amount}`);
        console.log(`    Diff: ${diff}`);

        if (diff !== 0) {
            console.error(`    [MISMATCH] Logic error detected! ${diff} KRW`);
            allValid = false;
        } else {
            console.log(`    [OK] Matched.`);
        }
    });

    if (allValid) {
        console.log('\nSUCCESS: All balances match the Single Logic formula.');
    } else {
        console.error('\nFAILURE: Balances do not match the Single Logic formula.');
    }
}

analyze();
