
import { createClient } from '@supabase/supabase-js';

// Fallback to hardcoded if env vars missing (as per previous patterns)
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function auditAndHeal() {
    console.log('>>> [START] System-Wide Financial Self-Healing...');

    // 1. Get All Memberships
    const { data: memberships, error: msErr } = await supabase.from('hannam_memberships').select('*');
    if (msErr) throw msErr;

    console.log(`>>> Auditing ${memberships.length} memberships...`);

    let healedCount = 0;
    let errorCount = 0;

    for (const ms of memberships) {
        // 2. Get Usage Sum for each membership
        const { data: records, error: rErr } = await supabase
            .from('hannam_care_records')
            .select('final_price')
            .eq('membership_id', ms.id);

        if (rErr) {
            console.error(`Failed to fetch records for MS ${ms.id}:`, rErr);
            errorCount++;
            continue;
        }

        const usageSum = records?.reduce((sum, r) => sum + (r.final_price || 0), 0) || 0;
        const calculatedRem = ms.total_amount - usageSum;
        const calculatedUsed = usageSum;

        // 3. Compare with Stored Values
        const isRemMismatch = ms.remaining_amount !== calculatedRem;
        const isUsedMismatch = ms.used_amount !== calculatedUsed;

        if (isRemMismatch || isUsedMismatch) {
            console.log(`[MISMATCH] MS ${ms.id} (${ms.product_name})`);
            console.log(`   Stored: Rem ${ms.remaining_amount}, Used ${ms.used_amount}`);
            console.log(`   Calc  : Rem ${calculatedRem}, Used ${calculatedUsed}`);

            // 4. Heal
            const { error: updateErr } = await supabase
                .from('hannam_memberships')
                .update({
                    remaining_amount: calculatedRem,
                    used_amount: calculatedUsed
                })
                .eq('id', ms.id);

            if (updateErr) {
                console.error(`   [FAIL] Update failed: ${updateErr.message}`);
            } else {
                console.log(`   [FIXED] Membership healed.`);
                healedCount++;
            }
        }
    }

    console.log('>>> [COMPLETE]');
    console.log(`Total Audited: ${memberships.length}`);
    console.log(`Healed: ${healedCount}`);
    console.log(`Errors: ${errorCount}`);
}

auditAndHeal();
