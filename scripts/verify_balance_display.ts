
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyBalanceSync() {
    const memberId = '01058060134';

    // 1. Fetch DB Source of Truth (Membership)
    const { data: membership } = await supabase.from('hannam_memberships').select('*').eq('member_id', memberId).single();

    // 2. Fetch Latest Care Record (Source of History Display)
    const { data: records } = await supabase.from('hannam_care_records').select('*').eq('member_id', memberId).order('created_at', { ascending: false }).limit(1);
    const latestRecord = records ? records[0] : null;

    console.log(">>> [BALANCE SYNC CHECK]");
    console.log(`[DB Membership] Remaining: ${membership.remaining_amount.toLocaleString()} KRW`);

    if (latestRecord) {
        console.log(`[Latest Record] Balance After: ${latestRecord.balance_after.toLocaleString()} KRW`);

        if (membership.remaining_amount === latestRecord.balance_after) {
            console.log("✅ SYNC MATCH: Dashboard (Membership) and Care Note (Latest Record) match exactly.");
        } else {
            console.error("❌ SYNC MISMATCH: Dashboard and Care Note differ!");
            console.log("Note: If you just fixed the logic, try creating a NEW record to verify the future state. Old records are immutable snapshots.");
        }
    } else {
        console.log("[Latest Record] None found.");
    }
}

verifyBalanceSync();
