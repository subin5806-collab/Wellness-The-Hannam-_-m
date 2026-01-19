
import { createClient } from '@supabase/supabase-js';

// Hardcoded based on db.ts
const supabaseUrl = 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function getMember() {
    const { data, error } = await supabase
        .from('hannam_members')
        .select('id, name, phone')
        .limit(1)
        .single();

    if (error) {
        console.error('Error fetching member:', error);
    } else {
        console.log('Valid Member Found:');
        console.log(JSON.stringify(data, null, 2));
    }
}

getMember();
