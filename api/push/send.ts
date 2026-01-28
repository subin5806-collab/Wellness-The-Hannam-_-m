import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

// [REAL IMPLEMENTATION] Uses firebase-admin SDK for robust Push Notifications
// Requires environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { title, body, tokens, data } = req.body;

    if (!title || !body || !tokens || !Array.isArray(tokens) || tokens.length === 0) {
        return res.status(400).json({ error: 'Missing title, body, or tokens' });
    }

    // Initialize Firebase Admin if not already initialized
    if (!admin.apps.length) {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        // Handle escaped newlines in private key (common issue in Vercel Env)
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (!projectId || !clientEmail || !privateKey) {
            console.error('[Critical] Missing Firebase Admin Credentials');
            return res.status(500).json({
                error: 'Server Configuration Error: Missing Firebase Credentials.',
                solution: 'Please check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in Vercel Env.'
            });
        }

        try {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey
                })
            });
            console.log('[System] Firebase Admin Initialized successfully.');
        } catch (initError: any) {
            console.error('[System] Firebase Admin Init Failed:', initError);
            return res.status(500).json({ error: 'Firebase Admin Init Failed: ' + initError.message });
        }
    }

    try {
        console.log(`[Push] Sending to ${tokens.length} devices...`);

        // Use Multicast for multiple tokens
        // Note: 'tokens' array can contain up to 500 tokens per call.
        const message = {
            // [Top Level Notification] - Required for Android/Web basics
            notification: {
                title: title,
                body: body,
            },
            data: data || {}, // Data payload
            tokens: tokens,   // Target tokens

            // [Android Config]
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    priority: 'high', // Android notification priority
                    channelId: 'default' // Required for Android 8+ (Oreo)
                }
            },

            // [iOS/APNs Config]
            apns: {
                payload: {
                    aps: {
                        alert: {
                            title: title,
                            body: body
                        },
                        sound: 'default',
                        badge: 1,
                        'content-available': 1, // Background update (Silent Push)
                        'mutable-content': 1    // Rich Notifications (Media) - Requested by User
                    }
                },
                headers: {
                    'apns-priority': '10', // High priority (Immediate Delivery)
                }
            },

            // [Web Push Config]
            webpush: {
                headers: {
                    Urgency: 'high'
                },
                notification: {
                    icon: '/pwa-icon.png',
                    click_action: '/',
                    requireInteraction: true
                }
            }
        };

        const response = await admin.messaging().sendEachForMulticast(message as any);

        console.log('[FCM Response] Success:', response.successCount, 'Failure:', response.failureCount);

        if (response.failureCount > 0) {
            const failedTokens: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                    // console.log(`[Push] Token failed: ${ tokens[idx] } - Error: ${ resp.error?.code } `);
                }
            });
            console.warn(`[Push] Partial failure: ${response.failureCount} failed.`);
            // Ideally remove bad tokens here
        }

        return res.status(200).json({
            success: true,
            successCount: response.successCount,
            failureCount: response.failureCount
        });

    } catch (e: any) {
        console.error('[Push Error]', e);
        return res.status(500).json({ error: e.message });
    }
}
