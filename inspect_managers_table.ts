
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const inspectManagers = async () => {
    console.log('>>> Inspecting hannam_managers table...');
    // Try to select one row to see columns
    const { data, error } = await supabase.from('hannam_managers').select('*').limit(1);

    if (error) {
        console.error('Error selecting from hannam_managers:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns found:', Object.keys(data[0]));
        if ('memo' in data[0]) {
            console.log('✅ "memo" column EXISTS.');
        } else {
            console.log('❌ "memo" column MISSING. Found:', Object.keys(data[0]));
        }
    } else {
        console.log('Table is empty. Attempting to insert a dummy row to probe schema...');
        // Try inserting with admin_memo (Existing Column)
        const testId = `TEST-${Date.now()}`;
        const { error: insertError } = await supabase.from('hannam_managers').insert([{
            id: testId,
            name: 'PersistenceProbe',
            phone: '01000000000',
            admin_memo: 'Persistence Test Success',
            is_deleted: false,
            created_at: new Date().toISOString()
        }]);

        if (insertError) {
            console.error('Insert failed:', insertError);
        } else {
            console.log('✅ Insert with "admin_memo" SUCCEEDED. Persistence verified.');
            // Cleanup
            await supabase.from('hannam_managers').delete().eq('id', testId);
        }
    }
};

inspectManagers();
