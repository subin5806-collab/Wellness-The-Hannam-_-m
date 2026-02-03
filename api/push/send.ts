import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';

// [INIT] Supabase Admin Client for Logging & Badge Count
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ghhknsewwevbgojozdzc.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGtuc2V3d2V2Ymdvam96ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODg1NTUsImV4cCI6MjA4MzE2NDU1NX0.AYHMQSU6d9c7avX8CeOoNekFbJoibVxWno9PkIOuSnc';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // [PAYLOAD UPDATE] Accepts 'targets' array for detailed handling
    // tokens: deprecated (backward compatibility)
    const { title, body, tokens, data, targets } = req.body;

    // Normalizing targets
    let finalTargets: { token: string, memberId?: string, name?: string }[] = [];

    if (targets && Array.isArray(targets)) {
        finalTargets = targets;
    } else if (tokens && Array.isArray(tokens)) {
        // Backward compatibility for old calls
        finalTargets = tokens.map(t => ({ token: t, memberId: 'UNKNOWN', name: 'Unknown' }));
    }

    if (!title || !body || finalTargets.length === 0) {
        return res.status(400).json({ error: 'Missing title, body, or targets' });
    }

    // Initialize Firebase Admin
    if (!admin.apps.length) {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        // [FIX] Auto-repair newline characters in Private Key to prevent 500 Errors
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

    try {
        console.log(`[Push] Processing ${finalTargets.length} targets...`);

        // [BATCH PROCESSING] 500 Chunking
        const CHUNK_SIZE = 500;
        const chunks = [];
        for (let i = 0; i < finalTargets.length; i += CHUNK_SIZE) {
            chunks.push(finalTargets.slice(i, i + CHUNK_SIZE));
        }

        let totalSuccess = 0;
        let totalFailure = 0;

        // Process Chunks
        for (const chunk of chunks) {
            // [BADGE LOGIC] Calculate Badge for each user in chunk?
            // Optimization: For bulk sends, fetching 500 counts is slow.
            // If targets < 10 (Individual Mode), we calculate accurate badge.
            // Otherwise, we send badge: 1 (or handle differently).

            const messages = await Promise.all(chunk.map(async (target) => {
                let badgeCount = 1;

                // Accurate Badge Count for Individual Sends
                if (finalTargets.length <= 10 && target.memberId && target.memberId !== 'UNKNOWN') {
                    const { count } = await supabase
                        .from('hannam_notifications')
                        .select('*', { count: 'exact', head: true })
                        .eq('member_id', target.memberId)
                        .eq('is_read', false);
                    badgeCount = (count || 0) + 1; // Existing + This new one
                }

                return {
                    token: target.token,
                    notification: { title, body },
                    data: data || {},
                    android: {
                        priority: 'high' as const,
                        notification: { channelId: 'default', notificationCount: badgeCount }
                    },
                    apns: {
                        payload: {
                            aps: {
                                alert: { title, body },
                                sound: 'default',
                                badge: badgeCount, // [FIX] Accurate Badge
                                'content-available': 1
                            }
                        }
                    }
                };
            }));

            // Send Each (to allow individual badge counts)
            // Note: sendAll() is deprecated/legacy? admin.messaging().sendEach() is recommended.
            const responses = await admin.messaging().sendEach(messages as any);

            totalSuccess += responses.successCount;
            totalFailure += responses.failureCount;

            // [LOGGING] Record to Notification Logs (Independent Try-Catch)
            try {
                const logsToInsert = responses.responses.map((resp, idx) => {
                    const target = chunk[idx];
                    return {
                        receiver_id: target.memberId === 'UNKNOWN' ? null : target.memberId,
                        receiver_phone: null,
                        type: 'PUSH',
                        trigger_type: 'MANUAL_PUSH',
                        content: `[${title}] ${body}`,
                        status: resp.success ? 'SUCCESS' : 'FAILED',
                        error_message: resp.success ? null : (resp.error?.code || 'Unknown Error'),
                        sent_at: new Date().toISOString()
                    };
                });

                if (logsToInsert.length > 0) {
                    const { error: logError } = await supabase.from('notification_logs').insert(logsToInsert);
                    if (logError) console.error('[Push Log Error] Insert failed:', logError);
                }
            } catch (logErr) {
                console.error('[Push Log Error] Unexpected logging failure:', logErr);
                // [CRITICAL] Do NOT fail the main response just because logging failed.
            }
        }

        console.log(`[Push] Completed. Success: ${totalSuccess}, Failure: ${totalFailure}`);
        return res.status(200).json({ success: true, successCount: totalSuccess, failureCount: totalFailure });

    } catch (e: any) {
        console.error('[Push Error]', e);
        return res.status(500).json({ error: e.message });
    }
}
