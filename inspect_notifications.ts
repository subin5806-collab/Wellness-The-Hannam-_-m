
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const inspect = async () => {
    const { data, error } = await supabase.from('hannam_notifications').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Keys:', data && data.length > 0 ? Object.keys(data[0]) : 'No rows found, check schema in code');
        if (data && data.length === 0) {
            // Fallback: try to insert dynamic object to see error key suggestion or just infer from codebase
            console.log('Table empty. Need to check columns via view_file on db.ts or similar.');
        }
    }
}
inspect();
