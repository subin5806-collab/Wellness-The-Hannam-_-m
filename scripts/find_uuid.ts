
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findUUID() {
    const targetPhone = '01058060134';
    console.log(`Searching for UUID of phone: ${targetPhone}`);

    // 1. Try direct phone query
    const { data, error } = await supabase.from('hannam_members').select('id, name, phone').eq('phone', targetPhone);

    if (data && data.length > 0) {
        console.log('FOUND MATCH via Direct Query:');
        console.log(JSON.stringify(data[0], null, 2));
        return;
    }

    if (error) {
        console.error('Direct Query Error:', error.message);
    }

    // 2. Try Fetch All & Filter (Fallback)
    console.log('Attempting Fetch All & Filter...');
    const { data: all, error: allErr } = await supabase.from('hannam_members').select('id, name, phone').limit(1000);

    if (allErr) {
        console.error('Fetch All Error:', allErr.message);
        return;
    }

    const found = all.find(m => m.phone === targetPhone || m.phone.replace(/[^0-9]/g, '') === targetPhone);

    if (found) {
        console.log('FOUND MATCH via Fallback:');
        console.log(JSON.stringify(found, null, 2));
    } else {
        console.log('Member NOT FOUND even in full list.');
    }
}

findUUID();
