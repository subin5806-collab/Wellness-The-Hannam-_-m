
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS Support
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        // [INIT] Lazy Load Credentials to catch missing env vars gracefully
        // Support all common naming conventions (Vite, Next.js, Standard)
        const supabaseUrl = process.env.VITE_SUPABASE_URL
            || process.env.SUPABASE_URL
            || process.env.NEXT_PUBLIC_SUPABASE_URL
            || '';

        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
            || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
            || process.env.SERVICE_ROLE_KEY
            || '';

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('[HardDelete] Missing Server Credentials');
            console.error('Checked URLs: VITE_SUPABASE_URL, SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL');
            console.error('Checked Keys: SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_SERVICE_ROLE_KEY, SERVICE_ROLE_KEY');

            return res.status(500).json({
                error: 'Missing Supabase Credentials',
                details: 'Please define SUPABASE_SERVICE_ROLE_KEY in Vercel Project Settings.'
            });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        if (req.method !== 'POST' && req.method !== 'DELETE') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }

        const { memberId } = req.body || req.query;

        if (!memberId) {
            return res.status(400).json({ error: 'Missing memberId' });
        }

        console.log(`[HardDelete] Starting digital incineration for member: ${memberId}`);

        // 1. Anonymize Admin Logs
        await supabase.from('hannam_admin_action_logs').update({ member_id: null, details: 'Deleted User (Anonymized)' }).eq('member_id', memberId);
        await supabase.from('hannam_admin_action_logs').update({ target_member_id: null, details: 'Target Deleted (Anonymized)' }).eq('target_member_id', memberId);

        // 2. Delete Personal Data (Cascade manually for safety)
        await supabase.from('hannam_fcm_tokens').delete().eq('member_id', memberId);
        await supabase.from('hannam_notifications').delete().eq('member_id', memberId);
        await supabase.from('hannam_admin_private_notes').delete().eq('member_id', memberId);

        // 3. Delete Core Data
        await supabase.from('hannam_care_records').delete().eq('member_id', memberId);
        await supabase.from('hannam_reservations').delete().eq('member_id', memberId);
        await supabase.from('hannam_contracts').delete().eq('member_id', memberId);
        await supabase.from('hannam_memberships').delete().eq('member_id', memberId);

        // 4. Delete Member
        const { error: deleteError } = await supabase.from('hannam_members').delete().eq('id', memberId);

        if (deleteError) throw deleteError;

        console.log(`[HardDelete] Success for ${memberId}`);
        return res.status(200).json({ success: true, message: 'Member permanently deleted' });

    } catch (error: any) {
        console.error('[HardDelete] Fatal Error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
