import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch'; // Vercel environment usually has fetch global or node-fetch

// [REAL IMPLEMENTATION] Uses Legacy HTTP Protocol
// Requires FCM_SERVER_KEY in environment variables.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { title, body, tokens, data } = req.body;

    if (!title || !body || !tokens || !Array.isArray(tokens) || tokens.length === 0) {
        return res.status(400).json({ error: 'Missing title, body, or tokens' });
    }

    const SERVER_KEY = process.env.FCM_SERVER_KEY;
    if (!SERVER_KEY) {
        console.error('[Critical] FCM_SERVER_KEY is missing in environment variables.');
        return res.status(500).json({
            error: 'Server Configuration Error: FCM_SERVER_KEY missing.',
            solution: 'Please add FCM_SERVER_KEY to Vercel/System Env.'
        });
    }

    try {
        console.log(`[Push] Sending to ${tokens.length} devices...`);

        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `key=${SERVER_KEY}`
            },
            body: JSON.stringify({
                registration_ids: tokens,
                notification: {
                    title: title,
                    body: body,
                    icon: '/pwa-icon.png',
                    click_action: '/'
                },
                data: data || {}
            })
        });

        const result: any = await response.json();
        console.log('[FCM Response]', JSON.stringify(result));

        if (result.failure > 0) {
            console.warn(`[Push] Partial failure: ${result.failure} failed out of ${tokens.length}`);
            // We could parse results to see which tokens failed (e.g., NotRegistered) and remove them from DB.
        }

        return res.status(200).json({ success: true, fcmResult: result });

    } catch (e: any) {
        console.error('[Push Error]', e);
        return res.status(500).json({ error: e.message });
    }
}
