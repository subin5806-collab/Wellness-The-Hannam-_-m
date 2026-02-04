import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// [INIT] Supabase Admin Client (Service Role Required for Storage Write)
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Basic Auth for Cron (verify signature if needed) or Admin Check
    // For now, we assume Vercel Cron or Admin Trigger

    try {
        console.log('[Backup] Starting manual/daily backup...');

        // 1. Fetch ALL Data with pagination handling (simplified for now, assuming fits in memory)
        // For production scale, we would stream or chunk, but for <1000 records, this is fine.
        const [members, memberships, records, reservations, notices, notifications] = await Promise.all([
            supabase.from('hannam_members').select('*'),
            supabase.from('hannam_memberships').select('*'),
            supabase.from('hannam_care_records').select('*'),
            supabase.from('hannam_reservations').select('*'),
            supabase.from('hannam_notices').select('*'),
            supabase.from('hannam_notifications').select('*')
        ]);

        if (members.error) throw members.error;

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

        // 2. Prepare File
        const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
        const fileName = `backup_${dateStr}_${timeStr}.json`;
        const fileContent = JSON.stringify(backupData, null, 2);

        // 3. Upload to 'backups' Bucket (Private)
        const { data, error } = await supabase.storage
            .from('backups')
            .upload(fileName, fileContent, {
                contentType: 'application/json',
                upsert: false
            });

        if (error) {
            console.error('[Backup] Upload Failed:', error);
            throw error;
        }

        console.log(`[Backup] Success: ${fileName}`);
        return res.status(200).json({ success: true, fileName, path: data?.path });

    } catch (e: any) {
        console.error('[Backup] Failed:', e);
        return res.status(500).json({ error: e.message });
    }
}
