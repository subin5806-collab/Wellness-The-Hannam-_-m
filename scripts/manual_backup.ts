
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // Load env if possible, or we hardcode for this one-off script if needed

async function runBackup() {
    console.log('[Manual Backup] Initializing...');

    // Use Service Role Key from Env (User said "Service Role Key" is required)
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
    const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseKey) {
        console.error('MISSING VITE_SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        console.log('[Manual Backup] Fetching Data...');
        const [members, memberships, records, reservations, notices, notifications] = await Promise.all([
            supabase.from('hannam_members').select('*'),
            supabase.from('hannam_memberships').select('*'),
            supabase.from('hannam_care_records').select('*'),
            supabase.from('hannam_reservations').select('*'),
            supabase.from('hannam_notices').select('*'),
            supabase.from('hannam_notifications').select('*')
        ]);

        if (members.error) throw new Error('Member Fetch Error: ' + members.error.message);

        const backupData = {
            timestamp: new Date().toISOString(),
            stats: {
                members: members.data?.length,
                records: records.data?.length
            },
            data: {
                members: members.data,
                memberships: memberships.data,
                care_records: records.data,
                reservations: reservations.data,
                notices: notices.data,
                notifications: notifications.data
            }
        };

        const dateStr = new Date().toISOString().split('T')[0];
        const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
        const fileName = `backup_${dateStr}_${timeStr}_MANUAL.json`; // Tagged MANUAL
        const fileContent = JSON.stringify(backupData, null, 2);

        console.log(`[Manual Backup] Uploading ${fileName} (${fileContent.length} bytes)...`);

        const { data, error } = await supabase.storage
            .from('backups')
            .upload(fileName, fileContent, {
                contentType: 'application/json',
                upsert: false
            });

        if (error) {
            console.error('[Manual Backup] Upload Failed:', error);
            throw error;
        }

        console.log(`[Manual Backup] Success! Path: ${data?.path}`);

    } catch (e: any) {
        console.error('[Manual Backup] CRITICAL FAILURE:', e.message);
    }
}

runBackup();
