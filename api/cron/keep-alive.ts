import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        // Lightweight Ping: Count active notices (or any small table)
        // "count" is very cheap.
        const { count, error } = await supabase
            .from('hannam_notices')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;

        console.log(`[KeepAlive] Ping Successful. Active Notices: ${count}`);
        return res.status(200).json({ status: 'Alive', timestamp: new Date().toISOString() });
    } catch (error: any) {
        console.error('[KeepAlive] Ping Failed:', error);
        return res.status(500).json({ error: error.message });
    }
}
