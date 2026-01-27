import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client (Server-side)
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Must use Service Key for Cron to bypass RLS or act as admin
// fallback to anon key if service key missing (but Cron usually needs admin rights)
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // [Security] Verify Vercel Cron Signature (Optional but recommended)
    // const authHeader = req.headers['authorization'];
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).end('Unauthorized');

    console.log('[Cron] Starting Daily Visit Reminder Check...');

    try {
        // 1. Load Settings
        const { data: setting } = await supabase
            .from('hannam_system_settings')
            .select('value')
            .eq('key', 'NOTIFICATION_CONFIG')
            .single();

        const config = setting?.value || {};
        const reminderConfig = config.visitReminder || { enabled: false };

        if (!reminderConfig.enabled) {
            console.log('[Cron] Visit Reminder is disabled.');
            return res.status(200).json({ status: 'Skipped (Disabled)' });
        }

        // 2. Calculate Target Date (e.g., Tomorrow)
        // Assuming '1_DAY_BEFORE' logic
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + 1);
        const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

        console.log(`[Cron] Target Date: ${targetDateStr}`);

        // 3. Find Reservations
        const { data: reservations } = await supabase
            .from('hannam_reservations')
            .select(`
           id,
           date,
           time,
           member_id,
           program_id,
           programs:hannam_programs(name)
        `)
            .eq('date', targetDateStr)
            .eq('status', 'confirmed'); // Only confirmed

        if (!reservations || reservations.length === 0) {
            console.log('[Cron] No reservations found for target date.');
            return res.status(200).json({ status: 'No Reservations' });
        }

        console.log(`[Cron] Found ${reservations.length} reservations.`);

        // 4. Send Pushes
        const results = [];
        for (const resv of reservations) {
            // Get Token
            const { data: tokenData } = await supabase
                .from('hannam_fcm_tokens')
                .select('token')
                .eq('member_id', resv.member_id);

            const tokens = tokenData?.map(t => t.token) || [];
            if (tokens.length > 0) {
                // Mock Push Call (In production, replace with actual FCM Admin logic or fetch call to push endpoint)
                // Here we just log for now, or call our own API if we can (but calling localhost from vercel is tricky).
                // Better to use a helper function or direct Firebase Admin SDK here.

                console.log(`[Push] Sending to Member ${resv.member_id} (Tokens: ${tokens.length})`);
                results.push({ memberId: resv.member_id, status: 'Sent' });
            } else {
                console.log(`[Push] Member ${resv.member_id} has no tokens.`);
                results.push({ memberId: resv.member_id, status: 'No Token' });
            }
        }

        return res.status(200).json({
            success: true,
            targetDate: targetDateStr,
            processed: results.length,
            details: results
        });

    } catch (error: any) {
        console.error('[Cron] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
