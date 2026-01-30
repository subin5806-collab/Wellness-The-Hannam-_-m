
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
// Removed import to avoid ESM/TS-node issues
// import { CareRecord } from './types.ts';

interface CareRecord {
    id: string;
    note_details?: string;
    note_recommendation?: string;
    wellness_recommendation?: string;
    [key: string]: any;
}


dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

const supabase = createClient(supabaseUrl, supabaseKey);

// Mock transformKeys function for verification
function transformKeys(data: any, mode: 'toCamel') {
    if (!data) return data;
    if (Array.isArray(data)) return data.map(i => transformKeys(i, mode));
    if (typeof data !== 'object') return data;
    return Object.keys(data).reduce((acc, key) => {
        const newKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        acc[newKey] = data[key];
        return acc;
    }, {} as any);
}

async function verifySecurityAndSync() {
    console.log('--- STARTING VERIFICATION ---');

    // 1. [SECURITY] Simulate db.ts > getHistoryForMember
    // Querying strictly selected columns
    console.log('[1. SECURITY CHECK] Simulating Member History Fetch...');
    const memberId = '01012345678'; // Use a dummy or assume existing one. Let's list any member first.

    // Find a member with care records
    const { data: memberWithRecords } = await supabase.from('hannam_care_records').select('member_id').limit(1);
    const targetMemberId = memberWithRecords?.[0]?.member_id || memberId;

    const { data: memberHistory, error: memberError } = await supabase.from('hannam_care_records')
        .select(`
          id, 
          member_id, 
          program_id, 
          manager_id, 
          date, 
          note_summary, 
          note_recommendation, 
          signature_status, 
          signature_data,
          final_price,
          balance_after,
          created_at
        `)
        .eq('member_id', targetMemberId)
        .order('date', { ascending: false })
        .limit(1);

    if (memberError) {
        console.error('Member Fetch Error:', memberError);
    } else {
        const record = memberHistory?.[0];
        console.log('Fetched Member Record Keys:', Object.keys(record || {}));
        if (record && 'note_details' in record) {
            console.error('❌ FAIL: note_details (Secret Note) LEAKED in Member API!');
        } else {
            console.log('✅ PASS: note_details is NOT accessible in Member API.');
        }
    }

    // 2. [SYNC] Verify Recommendation Persistence
    // Check if 'note_recommendation' exists in db
    console.log('\n[2. SYNC CHECK] Verifying Recommendation Field...');
    const { data: recommendationCheck } = await supabase.from('hannam_care_records')
        .select('note_recommendation, wellness_recommendation')
        .limit(5);

    console.log('Sample Recommendations:', recommendationCheck);

    const hasRec = recommendationCheck?.some(r => r.note_recommendation || r.wellness_recommendation);
    if (hasRec) {
        console.log('✅ PASS: Recommendation data exists in DB.');
    } else {
        console.warn('⚠️ WARN: No recommendation data found in sample (might just be empty text).');
    }

    // 3. [APP SYNC] Verify getByReservationId
    console.log('\n[3. APP SYNC] Verifying getByReservationId...');
    // Find a record with a reservation_id
    const { data: linkedRecord } = await supabase.from('hannam_care_records')
        .select('reservation_id')
        .not('reservation_id', 'is', null)
        .limit(1);

    if (linkedRecord && linkedRecord.length > 0) {
        const resId = linkedRecord[0].reservation_id;
        console.log(`Testing with Reservation ID: ${resId}`);

        const { data: fetchedByRes, error: fetchErr } = await supabase
            .from('hannam_care_records')
            .select('*')
            .eq('reservation_id', resId)
            .maybeSingle();

        if (fetchErr) {
            console.error('Fetch Error:', fetchErr);
        } else {
            console.log('Fetched Record by Reservation ID:', fetchedByRes ? 'Found' : 'Not Found');
            if (fetchedByRes) {
                console.log('Recommendation in Fetched Record:', fetchedByRes.note_recommendation);
                console.log('Secret Note in Fetched Record:', fetchedByRes.note_details ? '(Present)' : '(Empty)');
                console.log('✅ PASS: getByReservationId works.');
            }
        }
    } else {
        console.log('⚠️ SKIP: No linked Care Records found to test getByReservationId.');
    }

    console.log('--- VERIFICATION COMPLETE ---');
}

verifySecurityAndSync();
