import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

// Create a single supabase client for interacting with your database
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
    console.log("Inspecting hannam_admins ID type...");
    // Select ID only
    const { data: admins, error: adminError } = await supabase.from('hannam_admins').select('id').limit(1);
    if (adminError) console.error("Admin Error:", adminError);
    else {
        console.log("Admin Sample:", admins[0]);
        if (admins[0]) {
            console.log("Admin ID Type:", typeof admins[0].id);
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(admins[0].id);
            console.log("Is UUID format?", isUUID);
            if (!isUUID) console.log("ID Value:", admins[0].id);
        }
    }
}

inspect();
