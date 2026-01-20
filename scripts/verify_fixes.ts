
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const debug = async () => {
    console.log("=== DEBUG START ===");

    // 1. Check View
    console.log("1. Checking 'hannam_membership_real_balances' view...");
    const { data: viewData, error: viewError } = await supabase.from('hannam_membership_real_balances').select('*').limit(5);
    if (viewError) {
        console.error("❌ View Error:", viewError);
        console.error("   Hint: Does the view exist? Has migration been run?");
    } else {
        console.log("✅ View Data (First 5):", viewData);
    }

    // 2. Check Discount Rates
    console.log("\n2. Checking Membership Discount Rates...");
    const { data: msData } = await supabase.from('hannam_memberships').select('id, product_name, default_discount_rate').eq('status', 'active').limit(5);
    console.log("✅ Membership Data:", msData);

    // 3. Check Recommendation Notes
    console.log("\n3. Checking Recommendation Notes...");
    const { data: careData } = await supabase.from('hannam_care_records').select('id, note_recommendation').not('note_recommendation', 'is', null).limit(5);
    console.log("✅ Care Record Recommendation Notes:", careData);

    console.log("=== DEBUG END ===");
};

debug();
