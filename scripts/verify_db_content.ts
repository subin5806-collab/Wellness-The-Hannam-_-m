
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env vars
// Hardcoded for verification based on db.ts fallbacks
const supabaseUrl = 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNotes() {
    console.log('Checking hannam_admin_private_notes...');

    // 1. Check if we can read ANY notes (RLS might block this if we are anon)
    const { data, error } = await supabase
        .from('hannam_admin_private_notes')
        .select('*');

    if (error) {
        console.error('Error fetching notes (likely RLS blocking anon access):', error);
    } else {
        console.log(`Found ${data.length} notes:`);
        console.log(JSON.stringify(data, null, 2));
    }

    // 2. Try to insert a note as anon to see failure (Verification of RLS Blocking)
    console.log('\n--- Attempting Test Insert (Anon) ---');
    const testId = '00000000-0000-0000-0000-000000000000'; // Dummy ID, likely will fail FK if not careful, but RLS should hit first
    const { error: insertError } = await supabase
        .from('hannam_admin_private_notes')
        .insert({
            care_record_id: 'db20562e-3356-4277-859a-18c7b80a6c0c', // Use a real ID if possible, or random UUID to test RLS
            member_id: 'any',
            admin_email: 'script_test@test.com',
            content: 'Script Test'
        });

    if (insertError) {
        console.log('Insert failed as expected (if RLS active):', insertError.message, insertError.details, insertError.code);
    } else {
        console.log('Insert SUCCESS (RLS might be too open!)');
    }
}

checkNotes();
