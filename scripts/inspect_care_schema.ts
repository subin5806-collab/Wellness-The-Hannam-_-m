
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectCareTable() {
    console.log('--- Inspecting hannam_care_records ---');
    // Try to fetch one record to see the structure
    const { data, error } = await supabase.from('hannam_care_records').select('*').limit(1);

    if (error) {
        console.error('Error fetching hannam_care_records:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('Table is empty. Cannot deduce types from values.');
        // We can try to insert a dummy record with a text member_id and see if it fails?
        // "id" is uuid usually.
        return;
    }

    const record = data[0];
    console.log('Checking columns based on first record:');
    Object.keys(record).forEach(key => {
        const value = record[key];
        const type = typeof value;
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value));
        console.log(`Column: ${key}, Type: ${type}, Value: ${value}, LooksLikeUUID: ${isUUID}`);
    });
}

inspectCareTable();
