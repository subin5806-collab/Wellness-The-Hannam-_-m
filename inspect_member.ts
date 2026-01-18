
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const check = async () => {
    const phone = '01033334444';
    console.log(`Checking member with phone: ${phone}`);

    // Check by Phone column
    const { data: byPhone, error: err1 } = await supabase
        .from('hannam_members')
        .select('*')
        .eq('phone', phone);

    if (err1) console.error('Error by phone:', err1);
    else {
        console.log('Found by Phone column:', byPhone.length);
        byPhone.forEach(m => console.log('Member:', { id: m.id, phone: m.phone, name: m.name }));
    }

    // Check by ID column matches phone
    const { data: byId, error: err2 } = await supabase
        .from('hannam_members')
        .select('*')
        .eq('id', phone);

    if (err2) {
        // Expecting error if ID column is UUID type
        console.log('Error searching ID="01033334444":', err2.message, err2.code);
    } else {
        console.log('Found by ID="01033334444":', byId.length);
        if (byId.length > 0) console.log('CONFIRMED: ID is stored as phone number.');
    }
};

check();
