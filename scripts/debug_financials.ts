
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectFinancials() {
    const targetId = '01058060134';
    console.log(`[Financial Debug] Target: ${targetId}`);

    // 1. Memberships
    const { data: memberships } = await supabase.from('hannam_memberships').select('*').eq('member_id', targetId);
    console.log('--- Memberships ---');
    memberships?.forEach(m => {
        console.log(`ID: ${m.id}, Total: ${m.total_amount}, Used(DB): ${m.used_amount}, Remaining(DB): ${m.remaining_amount}, Status: ${m.status}`);
    });

    // 2. All Records (including pending)
    const { data: records } = await supabase.from('hannam_care_records').select('*').eq('member_id', targetId);
    console.log('--- Care Records ---');
    let sum = 0;
    records?.forEach(r => {
        console.log(`ID: ${r.id}, Price: ${r.final_price}, Status: ${r.signature_status}, MemID: ${r.membership_id}`);
        if (r.signature_status === 'completed') sum += r.final_price;
    });
    console.log(`Sum of Signed Records: ${sum}`);
}

inspectFinancials();
