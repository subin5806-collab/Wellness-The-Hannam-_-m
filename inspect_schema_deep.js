import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

// Create a single supabase client for interacting with your database
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
    console.log("Inspecting Tables...");

    // Method: Insert a dummy row with wrong type to trigger error showing expected type? 
    // Or just use 'select' and check JS type? JS type doesn't distinguish text vs uuid well.
    // Best check: Use a stored proc or system catalog if possible?
    // Since I can't run arbitrary SQL easily, I'll allow an error to tell me?
    // No, let's look at a sample record.

    const { data: records, error: cError } = await supabase.from('hannam_care_records').select('id').limit(1);
    if (records && records[0]) {
        const val = records[0].id;
        console.log(`hannam_care_records.id sample: ${val}`);
        console.log(`Is UUID format? ${/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)}`);
    }

    const { data: admins, error: aError } = await supabase.from('hannam_admins').select('id').limit(1);
    if (admins && admins[0]) {
        const val = admins[0].id;
        console.log(`hannam_admins.id sample: ${val}`);
        console.log(`Is UUID format? ${/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)}`);
    }
}

inspect();
