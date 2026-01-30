
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    console.log('Checking hannam_reservations columns...');
    const { data: resData, error: resError } = await supabase
        .from('hannam_reservations')
        .select('*')
        .limit(1);

    if (resError) {
        console.error('Error fetching reservations:', resError);
    } else if (resData && resData.length > 0) {
        console.log('Reservations Columns:', Object.keys(resData[0]));
        if (!Object.keys(resData[0]).includes('note_details')) {
            console.error('CRITICAL: note_details is MISSING from hannam_reservations');
        } else {
            console.log('SUCCESS: note_details exists in hannam_reservations');
        }
    } else {
        console.log('No reservations found to check columns.');
    }

    console.log('\nChecking hannam_care_records columns...');
    const { data: careData, error: careError } = await supabase
        .from('hannam_care_records')
        .select('*')
        .limit(1);

    if (careError) {
        console.error('Error fetching care records:', careError);
    } else if (careData && careData.length > 0) {
        console.log('Care Records Columns:', Object.keys(careData[0]));
        if (!Object.keys(careData[0]).includes('note_details')) {
            console.error('CRITICAL: note_details is MISSING from hannam_care_records');
        } else {
            console.log('SUCCESS: note_details exists in hannam_care_records');
        }
    } else {
        console.log('No care records found to check columns.');
    }
}

checkColumns();
