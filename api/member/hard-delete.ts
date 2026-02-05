
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS Support
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST' && req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { memberId } = req.body || req.query;

    if (!memberId) {
        return res.status(400).json({ error: 'Missing memberId' });
    }

    try {
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

        // 5. Attempt Auth User Deletion (Optional - requires Service Role)
        // We can try to delete from auth.users if the ID matches a UUID
        // But since memberId is now Phone, we might need to lookup the UUID first if they are linked.
        // For now, removing from 'hannam_members' is the main "Member" deletion.

        console.log(`[HardDelete] Success for ${memberId}`);
        return res.status(200).json({ success: true, message: 'Member permanently deleted' });

    } catch (error: any) {
        console.error('[HardDelete] Failed:', error);
        return res.status(500).json({ error: error.message });
    }
}
