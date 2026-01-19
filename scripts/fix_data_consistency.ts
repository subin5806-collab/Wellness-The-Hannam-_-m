
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function patchData() {
    console.log('--- Patching Data Consistency ---');

    // Target Record found in debug: 94724bc1-ea85-4c23-8fc0-4b58bb536935
    const recordId = '94724bc1-ea85-4c23-8fc0-4b58bb536935';

    // 1. Update Record to 'completed' so it counts in Balance Engine
    // 2. Correct balance_after to 2,406,000 (3M - 594k) to match Membership
    const { data, error } = await supabase.from('hannam_care_records')
        .update({
            signature_status: 'completed',
            balance_after: 2406000,
            // Optional: Add a system note about auto-fix
            internal_staff_note: 'System Correction: Status synced with Membership usage.'
        })
        .eq('id', recordId)
        .select();

    if (error) {
        console.error('Patch Failed:', error.message);
    } else {
        console.log('Patch Success:', data[0]);
    }
}

patchData();
