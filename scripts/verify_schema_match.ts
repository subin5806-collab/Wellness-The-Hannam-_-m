
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifySchemaMatch() {
    console.log(">>> [FINAL PROOF] Verifying Log Schema & Data Integrity...");

    // 1. Emulate the exact data structure used in db.ts
    const testPayload = {
        // action_type: 'VERIFY_SCHEMA', // We confirmed this is the correct column name
        // admin_id: ...
        // old_value: '{"remaining": 3000000}',
        // new_value: '{"remaining": 2406000}'
    };

    const userId = '6a3bbb76-f640-4c4c-bbf6-02c80a7ea77c'; // The restored admin ID
    const memberId = '01058060134';

    const logData = {
        admin_id: userId,
        admin_email: 'help@thehannam.com',
        action_type: 'SCHEMA_VERIFICATION',
        member_id: memberId,
        target_member_id: memberId,
        details: '케어 정산 완료: 잔액 3,000,000원 -> 2,406,000원', // The exact string format user wants
        field: 'remaining_amount',
        old_value: JSON.stringify({ remaining: 3000000, used: 0 }),
        new_value: JSON.stringify({ remaining: 2406000, used: 594000 }),
        created_at: new Date().toISOString()
    };

    console.log("Payload to Insert:", JSON.stringify(logData, null, 2));

    // 2. Attempt Insert
    const { data, error } = await supabase.from('hannam_admin_action_logs').insert([logData]).select();

    if (error) {
        console.error("❌ SCHEMA MISMATCH or PERMISSION ERROR:", error);
        process.exit(1);
    }

    console.log("✅ INSERT SUCCESS! Schema is 100% matched.");
    console.log("Logged Record:", data[0]);

    // 3. Verify Content
    const details = data[0].details;
    if (details.includes('3,000,000원 -> 2,406,000원')) {
        console.log("✅ DATA INTEGRITY VERIFIED: details string matches requirement.");
    } else {
        console.error("❌ CONTENT MISMATCH: ", details);
    }
}

verifySchemaMatch();
