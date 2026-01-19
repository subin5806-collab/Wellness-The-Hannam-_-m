import { createClient } from '@supabase/supabase-js';

// Hardcoded from db.ts
const supabaseUrl = 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log('>>> [VERIFICATION] Starting Wellness Care Note Logic Check...\n');

    // 1. Find Member (User: 문수빈)
    console.log('1. Searching for Member "문수빈"...');

    // Try finding by generic search if exact match fails, or exact match first.
    const { data: members, error: mErr } = await supabase
        .from('hannam_members')
        .select('*')
        .ilike('name', '%문수빈%');

    if (mErr || !members || members.length === 0) {
        console.error('   [FAIL] Member "문수빈" not found. Listing latest 3 members to help debug:');
        const { data: recent } = await supabase.from('hannam_members').select('name, id').limit(3);
        console.log(recent);
        return;
    }

    // Use the first match
    const member = members[0];
    console.log(`   [PASS] Found Member: ${member.name} (ID/Phone: ${member.id})`);

    // 2. Balance Check
    console.log('\n2. Checking Membership Balance...');
    const { data: memberships } = await supabase
        .from('hannam_memberships')
        .select('*')
        .eq('member_id', member.id)
        .eq('status', 'active');

    let balanceMatch = false;

    if (!memberships || memberships.length === 0) {
        console.log('   [WARN] No active membership found.');
    } else {
        memberships.forEach(ms => {
            console.log(`   - Membership ID: ${ms.id}`);
            console.log(`     Product: ${ms.product_name}`);
            console.log(`     Total: ${ms.total_amount.toLocaleString()} | Used: ${ms.used_amount.toLocaleString()}`);
            console.log(`     Remaining: ${ms.remaining_amount.toLocaleString()}`);

            if (ms.remaining_amount === 2406000) {
                console.log('     [MATCH] Exact balance 2,406,000 found!');
                balanceMatch = true;
            }
        });
    }

    // 3. Signature Check (Latest Care Record)
    console.log('\n3. Checking Valid Signature in DB...');
    const { data: records } = await supabase
        .from('hannam_care_records')
        .select('id, date, signature_data, signature_status, final_price')
        .eq('member_id', member.id)
        .order('date', { ascending: false })
        .limit(1);

    if (records && records.length > 0) {
        const record = records[0];
        console.log(`   [INFO] Latest Rec: ${record.date} (Price: ${record.final_price?.toLocaleString()})`);

        if (record.signature_data && record.signature_data.startsWith('data:image')) {
            console.log('   [PASS] Signature saved as valid Base64 Image.');
            console.log(`          DB Value Prefix: ${record.signature_data.substring(0, 30)}...`);
        } else if (record.signature_data) {
            console.log('   [WARN] Signature data exists but header check (data:image) needs manual verification.');
            console.log(`          Value: ${record.signature_data.substring(0, 50)}...`);
        } else {
            console.log('   [FAIL] No signature data found for latest record.');
        }
    } else {
        console.log('   [WARN] No care records found.');
    }

    // 4. Notification Check
    console.log('\n4. Checking Notifications...');
    const { data: notis } = await supabase
        .from('hannam_notifications')
        .select('*')
        .eq('member_id', member.id)
        .order('created_at', { ascending: false })
        .limit(5);

    if (notis && notis.length > 0) {
        console.log(`   [INFO] Found ${notis.length} recent notifications.`);
        notis.forEach(n => {
            console.log(`   - [${n.is_read ? 'READ' : 'UNREAD'}] ${n.title}: ${n.content}`);
        });

        const unreadCount = notis.filter(n => !n.is_read).length;
        if (unreadCount > 0) {
            console.log(`   [PASS] User has ${unreadCount} unread notifications -> Red Dot ACTIVE.`);
        } else {
            console.log('   [INFO] All notifications read -> Red Dot INACTIVE.');
        }
    } else {
        console.log('   [WARN] No notifications found.');
    }
}

verify();
