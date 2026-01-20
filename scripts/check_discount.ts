
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') }); // Try specific path
// Or try default
if (!process.env.VITE_SUPABASE_URL) {
    dotenv.config({ path: join(__dirname, '../.env.local') });
}
if (!process.env.VITE_SUPABASE_URL) {
    dotenv.config(); // Try default CWD
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDiscountRates() {
    console.log('Checking hannam_memberships default_discount_rate...');

    const { data, error } = await supabase
        .from('hannam_memberships')
        .select('id, default_discount_rate, product_name, status')
        .eq('status', 'active');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Found', data.length, 'active memberships.');
    data.forEach(ms => {
        console.log(`- [${ms.product_name}] Rate: ${ms.default_discount_rate}% (ID: ${ms.id})`);
    });
}

checkDiscountRates();
