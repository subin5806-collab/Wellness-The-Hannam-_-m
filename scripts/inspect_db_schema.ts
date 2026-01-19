
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTable() {
    console.log('--- Inspecting hannam_members ---');
    // Try to fetch one record to see the structure
    const { data, error } = await supabase.from('hannam_members').select('*').limit(1);

    if (error) {
        console.error('Error fetching hannam_members:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('Table is empty or RLS is blocking read.');
        // Try inserting a dummy to see error? No, too risky.
        return;
    }

    const record = data[0];
    console.log('Checking columns based on first record:');
    Object.keys(record).forEach(key => {
        const value = record[key];
        const type = typeof value;
        // Try to detect UUID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value));
        console.log(`Column: ${key}, Type: ${type}, Value: ${value}, LooksLikeUUID: ${isUUID}`);
    });

    // specifically check 'phone'
    if ('phone' in record) {
        console.log(`Confirmed 'phone' column exists. Value: ${record.phone}`);
    } else {
        console.error("CRITICAL: 'phone' column NOT FOUND in result!");
    }
}

inspectTable();
