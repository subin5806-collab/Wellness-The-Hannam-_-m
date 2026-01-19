
import { createClient } from '@supabase/supabase-js';

// Hardcoded from db.ts
const supabaseUrl = 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectColumns() {
    console.log('>>> INSPECTING hannam_notifications KEYS via Insert...\n');

    const minimalData = {
        id: `TEST-${Date.now()}`,
        member_id: '01058060134',
        title: 'Probe',
        content: 'Probe',
        is_read: false
    };

    console.log('Inserting MINIMAL record (no type/category)...');
    const { data, error } = await supabase.from('hannam_notifications').insert([minimalData]).select();

    if (error) {
        console.log(`Minimal Insert Failed: ${error.message}`);
    } else {
        console.log('Minimal Insert SUCCESS!');
        if (data && data.length > 0) {
            console.log('Returned Keys (Columns):');
            console.log(Object.keys(data[0]).join(', '));

            // Cleanup
            await supabase.from('hannam_notifications').delete().eq('id', minimalData.id);
        }
    }
}

inspectColumns();
