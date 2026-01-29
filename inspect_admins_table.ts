
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const inspectAdmins = async () => {
    console.log('>>> Inspecting hannam_admins table...');
    const { data, error } = await supabase.from('hannam_admins').select('*').limit(1);

    if (error) {
        console.error('Error selecting from hannam_admins:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns found:', Object.keys(data[0]));
    } else {
        console.log('Table is empty. Need to infer columns from types or assumed schema.');
        // Insert dummy to probe
        const testId = `TEST-${Date.now()}`;
        const { error: insertError } = await supabase.from('hannam_admins').insert([{
            email: `probe-${testId}@test.com`,
            password: 'test',
            name: 'Probe',
            role: 'STAFF',
            phone: '01000000000'
        }]).select();

        if (insertError) {
            console.log('Insert Probe Failed:', insertError);
        } else {
            console.log('Insert Probe Success. Columns likely match types.ts');
            await supabase.from('hannam_admins').delete().eq('email', `probe-${testId}@test.com`);
        }
    }
};

inspectAdmins();
