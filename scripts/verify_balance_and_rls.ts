
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verify() {
    console.log('>>> 1. [Member Lookup] Searching for member 010-5806-0134...');
    const { data: member, error: mErr } = await supabase
        .from('hannam_members')
        .select('id, name, phone')
        .eq('phone', '01058060134')
        .maybeSingle();

    if (mErr || !member) {
        console.error('Member lookup failed:', mErr);
        return;
    }
    console.log(`Found Member: ${member.name} (${member.id})`);

    console.log('\n>>> 2. [Balance Verification] Checking Active Membership...');
    const { data: membership, error: msErr } = await supabase
        .from('hannam_memberships')
        .select('remaining_amount, used_amount, total_amount')
        .eq('member_id', member.id)
        .eq('status', 'active')
        .maybeSingle();

    if (msErr || !membership) {
        console.error('Membership lookup failed:', msErr);
    } else {
        console.log(`Remaining Balance: ${membership.remaining_amount.toLocaleString()} KRW`);
        console.log(`Used Amount: ${membership.used_amount.toLocaleString()} KRW`);
        console.log(`Target Verification: Is 2,406,000? ${membership.remaining_amount === 2406000 ? 'YES ✅' : 'NO ❌'}`);
    }

    console.log('\n>>> 3. [RLS/Log Verification] Checking latest Admin Log...');
    const { data: logs, error: lErr } = await supabase
        .from('hannam_admin_action_logs')
        .select('action, admin_id, created_at, details')
        .eq('member_id', member.id)
        .order('created_at', { ascending: false })
        .limit(1);

    if (lErr) {
        console.error('Log lookup failed:', lErr);
    } else if (logs && logs.length > 0) {
        const log = logs[0];
        console.log(`Latest Action: ${log.action}`);
        console.log(`Details: ${log.details}`);
        console.log(`Recorded Admin ID: ${log.admin_id ? log.admin_id : 'MISSING ❌'}`);
        console.log(`Status: ${log.admin_id ? 'RLS Compliance OK ✅' : 'RLS Violation Risk ⚠️'}`);
    } else {
        console.log('No logs found for this member.');
    }
}

verify();
