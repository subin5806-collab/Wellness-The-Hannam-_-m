
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function restoreAdmin() {
    const email = 'help@thehannam.com';
    const password = 'lucete800134';

    console.log(`>>> Attempting to register Admin: ${email}`);

    // 1. Try to Sign Up (This acts as check-or-create)
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        console.error(`SignUp Failed: ${error.message}`);
        if (error.message.includes('already registered')) {
            console.log(">>> Account ALREADY EXISTS. The password might be different.");
            console.log(">>> Please check if 'lucete800134' is the correct password.");
        }
    } else if (data.user) {
        console.log(">>> SUCCESS: Admin Account Created/Restored!");
        console.log(`User ID: ${data.user.id}`);
        console.log("Please try logging in now.");
    } else {
        // Sometimes signUp returns null user if confirmation is required
        console.log(">>> SignUp initiated. Please check email for confirmation links if applicable.");
    }
}

restoreAdmin();
