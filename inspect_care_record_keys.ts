
// Inspect REAL keys of hannam_care_records
import { createClient } from '@supabase/supabase-js';

// Hardcoded env vars from db.ts for standalone execution
const supabaseUrl = 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectKeys() {
    console.log('--- FETCHING ONE CARE RECORD ---');
    const { data, error } = await supabase.from('hannam_care_records').select('*').limit(1);

    if (error) {
        console.error('Error fetching:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No records found.');
        return;
    }

    const record = data[0];
    console.log('Keys found in hannam_care_records:', Object.keys(record).sort());

    // Check for critical fields
    const hasNoteRecommendation = Object.keys(record).includes('note_recommendation');
    const hasRecommendation = Object.keys(record).includes('recommendation');
    const hasRecommendations = Object.keys(record).includes('recommendations');

    console.log(`Has 'note_recommendation'? ${hasNoteRecommendation}`);
    console.log(`Has 'recommendation'? ${hasRecommendation}`);
    console.log(`Has 'recommendations'? ${hasRecommendations}`);
}

inspectKeys();
