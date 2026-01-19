
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyLogic() {
    console.log(">>> [LOGIC VERIFICATION] Simulating Complete Care Session...");

    // 1. Setup Mock Data
    const memberId = '01058060134'; // 문수빈
    const deductionAmount = 594000; // Expected deduction

    // 2. Fetch Current State
    console.log(`fetching membership for ${memberId}...`);
    const { data: memberMs } = await supabase
        .from('hannam_memberships')
        .select('*')
        .eq('member_id', memberId)
        .single();

    if (!memberMs) {
        console.error("No membership found!");
        return;
    }

    console.log(`Current Total: ${memberMs.total_amount.toLocaleString()}`);
    console.log(`Current Used: ${memberMs.used_amount.toLocaleString()}`);
    console.log(`Current Remaining: ${memberMs.remaining_amount.toLocaleString()}`);

    // 3. Simulate Logic from db.ts
    const { data: history } = await supabase
        .from('hannam_care_records')
        .select('final_price')
        .eq('membership_id', memberMs.id);

    const usageSum = history?.reduce((sum, h) => sum + ((h as any).final_price || 0), 0) || 0;
    const realRemaining = memberMs.total_amount - usageSum;

    console.log(`\n[Re-Calculation] Usage Sum: ${usageSum.toLocaleString()}`);
    console.log(`[Re-Calculation] Real Remaining: ${realRemaining.toLocaleString()}`);

    const predictedRemaining = realRemaining - deductionAmount;
    const predictedUsed = usageSum + deductionAmount;

    console.log(`\n>>> [PREDICTION] If we deduct ${deductionAmount.toLocaleString()}:`);
    console.log(`New Remaining should be: ${predictedRemaining.toLocaleString()}`);
    console.log(`New Used should be: ${predictedUsed.toLocaleString()}`);

    console.log(`Integrity Check: ${memberMs.total_amount} === ${predictedRemaining} + ${predictedUsed}`);
    const isValid = memberMs.total_amount === (predictedRemaining + predictedUsed);
    console.log(`Logic Valid? ${isValid ? 'YES ✅' : 'NO ❌'}`);
}

verifyLogic();
