
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { db } from './db'; // We might not need db, just raw insert

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function probe() {
    const memberId = '01058060134'; // subin

    console.log(">>> Probing 1: Insert without type...");
    const { error: e1 } = await supabase.from('hannam_notifications').insert([{
        member_id: memberId,
        title: 'Probe Test 1',
        content: 'No type',
        is_read: false
    }]);

    if (!e1) {
        console.log("SUCCESS: 'type' column is NOT required.");
        return;
    }
    console.log("Failed 1:", e1.message);

    if (e1.message.includes('notification_type')) {
        console.log("HINT FOUND: notification_type seems missing.");
    }

    console.log(">>> Probing 2: Insert with 'notification_type'...");
    const { error: e2 } = await supabase.from('hannam_notifications').insert([{
        member_id: memberId,
        title: 'Probe Test 2',
        content: 'With notification_type',
        notification_type: 'TEST',
        is_read: false
    }]);

    if (!e2) {
        console.log("SUCCESS: The column is 'notification_type'.");
        return;
    }
    console.log("Failed 2:", e2.message);

    console.log(">>> Probing 3: Insert with 'category'...");
    const { error: e3 } = await supabase.from('hannam_notifications').insert([{
        member_id: memberId,
        title: 'Probe Test 3',
        content: 'With category',
        category: 'TEST',
        is_read: false
    }]);

    if (!e3) {
        console.log("SUCCESS: The column is 'category'.");
        return;
    }
    console.log("Failed 3:", e3.message);
}

probe();
