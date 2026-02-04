import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';

// [INIT] Supabase Admin Client for Logging & Badge Count
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
// [SECURITY] Use Service Role Key for Admin Privileges (Log Writes)
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // [SECURITY] Strict Server-Side Key Usage
    // db.ts (Client) uses ANON_KEY. Here (Server) we use SERVICE_ROLE or PRIVATE_KEY.
    // Ensure we do NOT import 'db' from client side if it carries env vars incorrectly.
    // construct dedicated server admin client if needed, or just use `supabase-js` with env vars.

    const { title, body, tokens, data, targets } = req.body;

    // Normalizing targets
    let finalTargets: { token: string, memberId?: string, name?: string }[] = [];

    if (targets && Array.isArray(targets)) {
        finalTargets = targets;
    } else if (tokens && Array.isArray(tokens)) {
        finalTargets = tokens.map(t => ({ token: t, memberId: 'UNKNOWN', name: 'Unknown' }));
    }

    if (!title || !body || finalTargets.length === 0) {
        return res.status(400).json({ error: 'Missing title, body, or targets' });
    }

    // Initialize Firebase Admin
    if (!admin.apps.length) {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (!projectId || !clientEmail || !privateKey) {
            console.error('[Push Init] Missing Credentials');
            return res.status(500).json({ error: 'Server Config Error: Missing Firebase Credentials' });
        }

        try {
            admin.initializeApp({
                credential: admin.credential.cert({ projectId, clientEmail, privateKey })
            });
        } catch (e: any) {
            return res.status(500).json({ error: 'Firebase Init Failed: ' + e.message });
        }
    }

    // [ASYNC PATTERN] Fire Pushes & Prepare Logs
    try {
        console.log(`[Push] Processing ${finalTargets.length} targets...`);

        const CHUNK_SIZE = 500;
        const chunks = [];
        for (let i = 0; i < finalTargets.length; i += CHUNK_SIZE) {
            chunks.push(finalTargets.slice(i, i + CHUNK_SIZE));
        }

        let totalSuccess = 0;
        let totalFailure = 0;
        const logsToInsert: any[] = [];

        // 1. Execute Push Sending (Critical Path)
        // We await this to ensure we can report status
        const pushPromises = chunks.map(async (chunk) => {
            const messages = chunk.map(target => ({
                token: target.token,
                notification: { title, body },
                data: data || {},
                android: { priority: 'high' as const, notification: { channelId: 'default' } },
                apns: { payload: { aps: { alert: { title, body }, sound: 'default', badge: 1, 'content-available': 1 } } }
            }));

            try {
                const responses = await admin.messaging().sendEach(messages as any);
                totalSuccess += responses.successCount;
                totalFailure += responses.failureCount;

                // Prepare logs (Memory operation, fast)
                responses.responses.forEach((resp, idx) => {
                    const target = chunk[idx];
                    logsToInsert.push({
                        receiver_id: target.memberId === 'UNKNOWN' ? null : target.memberId,
                        type: 'PUSH',
                        trigger_type: 'MANUAL_PUSH', // [USER REQ] Explicit marking
                        content: `[${title}] ${body}`,
                        status: resp.success ? 'SUCCESS' : 'FAILED',
                        error_message: resp.success ? null : (resp.error?.code || 'Unknown Error'),
                        sent_at: new Date().toISOString()
                    });
                });
            } catch (err) {
                console.error('[Batch Push Error]', err);
                // Even on error, we try to log failure for the whole chunk if possible?
                // For now, skip logging for completely crashed chunks to save time.
            }
        });

        await Promise.all(pushPromises);

        // 2. Logging (Secondary Path) - "Fire and Forget" style?
        // In Vercel Node.js, we MUST await before return, otherwise process freezes.
        // BUT we have already calculated the result for the user.
        // We will fire the DB insert PROMISE but NOT await it for the response? 
        // NO, Vercel kills outstanding promises. We MUST await.
        // OPTIMIZATION: We used `logsToInsert` array to batch insert ONCE at the end, instead of per chunk.

        if (logsToInsert.length > 0) {
            // Non-blocking catch
            try {
                await supabase.from('notification_logs').insert(logsToInsert);
            } catch (err) {
                console.error('[Log Async Error]', err);
            }
        }

        console.log(`[Push] Completed. Success: ${totalSuccess}, Failure: ${totalFailure}`);
        return res.status(200).json({ success: true, successCount: totalSuccess, failureCount: totalFailure });

    } catch (e: any) {
        console.error('[Push Fatal Error]', e);
        return res.status(500).json({ error: e.message });
    }
}
