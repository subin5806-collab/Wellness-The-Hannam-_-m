
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectSchema() {
    console.log(">>> Inspecting hannam_admin_action_logs...");
    // Attempt to insert a dummy to see error structure or select to see keys
    // Since we have 400 bad request on column missing, select * limit 1 should reveal keys if any row exists.
    // If no rows, we rely on error messages or attempting to insert known wrong columns to see what passes.
    // Actually, usually Rpc 'get_columns' or similar is not available.
    // We'll try to select empty.

    const { data: logs, error: lErr } = await supabase.from('hannam_admin_action_logs').select('*').limit(1);
    if (logs && logs.length > 0) {
        console.log("LOGS Columns:", Object.keys(logs[0]));
    } else {
        console.log("LOGS Error/Empty:", lErr);
    }

    console.log("\n>>> Inspecting hannam_notifications...");
    const { data: notis, error: nErr } = await supabase.from('hannam_notifications').select('*').limit(1);
    if (notis && notis.length > 0) {
        console.log("NOTIFICATIONS Columns:", Object.keys(notis[0]));
    } else {
        console.log("NOTIFICATIONS Error/Empty:", nErr);
    }
}

inspectSchema();
