
import { createClient } from '@supabase/supabase-js';

// Fallback to hardcoded if env vars missing (Dev environment specific)
// Fallback to hardcoded if env vars missing (Dev environment specific)
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectNotices() {
    console.log('>>> Inspecting hannam_notices schema...');

    // Try to insert a dummy record with all fields to see which one fails
    const testId = crypto.randomUUID();
    const { error } = await supabase.from('hannam_notices').insert({
        id: testId,
        title: 'Schema Test',
        content: 'Testing columns',
        category: 'TEST',
        is_popup: false,
        is_alert_on: false,
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
        image_url: 'http://test.com/image.jpg'
    });

    if (error) {
        console.error('>>> [FAIL] Insert failed. Likely missing column:', error.message);
        if (error.message.includes('column')) {
            console.log('>>> DETECTED MISSING COLUMN. RECOMMENDING FIX.');
        }
    } else {
        console.log('>>> [SUCCESS] All columns exist. Insert successful.');
        await supabase.from('hannam_notices').delete().eq('id', testId);
    }
}

inspectNotices();
