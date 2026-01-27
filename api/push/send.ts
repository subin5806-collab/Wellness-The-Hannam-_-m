import type { VercelRequest, VercelResponse } from '@vercel/node';

// [NOTE] This is a mock implementation because we lack the Firebase Service Account Key.
// In production, this would use 'firebase-admin' to send actual FCM messages.
// For now, it logs the request and returns success to simulate the "Test" experience.

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { title, body, tokens, data } = req.body;

    if (!title || !body || !tokens || !Array.isArray(tokens) || tokens.length === 0) {
        return res.status(400).json({ error: 'Missing title, body, or tokens' });
    }

    console.log('------------------------------------------------');
    console.log('[Push Mock] Sending to', tokens.length, 'devices');
    console.log('[Title]', title);
    console.log('[Body]', body);
    if (data) console.log('[Data]', data);
    console.log('------------------------------------------------');

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Success Response
    return res.status(200).json({
        success: true,
        message: `Processed ${tokens.length} messages (Mock)`,
        results: tokens.map(() => ({ status: 'ok', id: 'mock-msg-' + Date.now() }))
    });
}
