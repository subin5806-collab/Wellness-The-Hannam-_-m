
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'node:buffer';

// [DEPLOYMENT TRIGGER] Remove Notes Deletion (2026-02-05 22:06)
console.log('[System] Hard Delete Service initialized. Waiting for requests...');

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

        // [DEBUG] Identify Key Source & Value
        let keySource = 'NONE';
        let supabaseServiceKey = '';

        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
            keySource = 'SUPABASE_SERVICE_ROLE_KEY';
            supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        } else if (process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
            keySource = 'VITE_SUPABASE_SERVICE_ROLE_KEY';
            supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
        } else if (process.env.SERVICE_ROLE_KEY) {
            keySource = 'SERVICE_ROLE_KEY';
            supabaseServiceKey = process.env.SERVICE_ROLE_KEY;
        }

        supabaseServiceKey = supabaseServiceKey.trim();

        // [DEBUG] Capture Metadata for Diagnostics
        const debugInfo = {
            keySource,
            keyLength: supabaseServiceKey.length,
            keyRole: 'UNKNOWN'
        };

        // [CRITICAL LOGGING]
        console.log(`[HardDelete] Key Source: ${keySource}`);
        console.log(`[HardDelete] Key Length: ${supabaseServiceKey.length}`);

        // [JWT DIAGNOSTICS] Decode "role" claim
        try {
            if (supabaseServiceKey.includes('.')) {
                const payloadPart = supabaseServiceKey.split('.')[1];
                const decodedPayload = JSON.parse(Buffer.from(payloadPart, 'base64').toString('utf-8'));

                debugInfo.keyRole = decodedPayload.role; // Capture Role
                console.log(`[HardDelete] Key Role (Decoded): ${decodedPayload.role}`);

                if (decodedPayload.role !== 'service_role') {
                    console.error(`[CRITICAL] WRONG KEY TYPE DETECTED! Role is '${decodedPayload.role}', expected 'service_role'.`);
                }
            } else {
                console.error('[HardDelete] Key is NOT a valid JWT format (no dots).');
            }
        } catch (e) {
            console.error('[HardDelete] Failed to decode JWT:', e);
            debugInfo.keyRole = 'ERROR_DECODING';
        }

        if (supabaseServiceKey.length > 0 && supabaseServiceKey.length < 250) {
            console.error(`[CRITICAL] Key length (${supabaseServiceKey.length}) suggests ANON KEY! Expected > 300.`);
        }

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('[HardDelete] Missing Server Credentials');

            // [DEBUG] List available keys with value metadata (security safe)
            const availableEnvKeys = Object.keys(process.env)
                .filter(k => k.includes('SUPABASE') || k.includes('VITE'))
                .map(k => ({
                    key: k,
                    length: process.env[k]?.length || 0,
                    preview: process.env[k] ? `${process.env[k]?.substring(0, 3)}...` : 'EMPTY'
                }));

            console.error('Available Environment Keys:', availableEnvKeys);

            return res.status(500).json({
                error: 'Missing Supabase Credentials',
                details: 'Please define SUPABASE_SERVICE_ROLE_KEY in Vercel.',
                debug_env_metadata: availableEnvKeys
            });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        if (req.method !== 'POST' && req.method !== 'DELETE') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }

        const { memberId } = req.body || req.query;

        if (!memberId) {
            return res.status(400).json({
                error: 'Missing memberId',
                debug_diagnostics: debugInfo // [PROBE] Return diagnostics to confirm environment
            });
        }

        console.log(`[HardDelete] Starting digital incineration for member: ${memberId}`);

        // [DEBUG] Prepare Metadata for verification (User Request: "Check length")
        const keyMetadata = {
            key: 'SUPABASE_SERVICE_ROLE_KEY',
            length: supabaseServiceKey?.length || 0,
            preview: supabaseServiceKey ? `${supabaseServiceKey.substring(0, 5)}...` : 'EMPTY'
        };

        // 0. Delete Auth User (First, to prevent login)
        // [FIX] 'memberId' is now PHONE NUMBER, but deleteUser() needs UUID.
        // We must find the UUID first using the phone number.
        console.log(`[HardDelete] Searching for Auth User UUID for phone: ${memberId}`);

        const { data: userList, error: listError } = await supabase.auth.admin.listUsers();

        if (listError) {
            console.error('[HardDelete] Failed to list users for UUID lookup:', listError);
            // Proceed to DB delete even if auth lookup fails? No, better report.
            throw new Error(`Auth User Lookup Failed: ${listError.message}`);
        }

        // Find user by Phone Metadata or Phone field (Supabase stores normalized phone)
        // Our phone format: 01012345678. Supabase might hold +821012345678 or similar.
        // Or if we used email: 01012345678@...
        const targetUser = userList.users.find(u => {
            const phoneMatch = u.phone === memberId || u.user_metadata?.phone === memberId || u.user_metadata?.full_phone === memberId;
            const emailMatch = u.email?.startsWith(memberId); // e.g. 01012345678@instructor...
            return phoneMatch || emailMatch;
        });

        if (targetUser) {
            console.log(`[HardDelete] Found UUID: ${targetUser.id} for member ${memberId}`);

            const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(targetUser.id);

            if (deleteAuthError) {
                console.error('[HardDelete] Auth Deletion Failed:', deleteAuthError);
                return res.status(500).json({
                    error: 'Auth User Deletion Failed',
                    details: deleteAuthError.message,
                    debug_metadata: keyMetadata
                });
            }
            console.log(`[HardDelete] Auth User ${targetUser.id} deleted.`);
        } else {
            console.warn(`[HardDelete] No Auth User found for ${memberId}. Skipping Auth Deletion.`);
        }

        // Helper to safely delete and report error
        const safeDelete = async (table: string, column: string = 'member_id') => {
            const { error } = await supabase.from(table).delete().eq(column, memberId);
            if (error) {
                console.error(`[HardDelete] Failed to delete from ${table}:`, error);
                throw new Error(`Deletion Error (${table}): ${error.message} (${error.code})`);
            }
        };

        // 1. Anonymize Admin Logs (Update, not delete)
        const { error: logError } = await supabase.from('hannam_admin_action_logs').update({ member_id: null, details: 'Deleted User (Anonymized)' }).eq('member_id', memberId);
        if (logError) throw new Error(`Log Anonymization Error: ${logError.message}`);

        await supabase.from('hannam_admin_action_logs').update({ target_member_id: null, details: 'Target Deleted (Anonymized)' }).eq('target_member_id', memberId);

        // 2. Delete Personal Data
        await safeDelete('hannam_fcm_tokens');
        await safeDelete('hannam_notifications');
        // [FIX] 'hannam_admin_private_notes' has NO member_id column. 
        // It is linked to care_record_id and will cascade delete automatically.
        // removing explicit delete to avoid 42703 error.

        // 3. Delete Core Data (Aggressive Cascade)
        // Try deleting everything related, suppressing 404s/errors for non-existent tables if needed?
        // Actually safeDelete throws. I should make it suppress "relation does not exist" error?
        // But for now, let's just list ALL known tables from experience or standard schema.

        await safeDelete('hannam_care_records');
        await safeDelete('hannam_reservations');
        await safeDelete('hannam_contracts');
        await safeDelete('hannam_memberships');

        // [Aggressive] Try deleting legacy/potential tables just in case
        // If they don't exist, it might throw "relation 'xxx' does not exist". 
        // We should wrap safeDelete to ignore that specific error.

        const safeDeleteIgnoreMissing = async (table: string) => {
            const { error } = await supabase.from(table).delete().eq('member_id', memberId);
            if (error) {
                // Ignore if table doesn't exist (code 42P01) or column missing (42703)
                if (error.code === '42P01' || error.code === '42703') {
                    console.warn(`[HardDelete] Skipped missing table/column: ${table}`);
                } else {
                    console.error(`[HardDelete] Failed to delete from ${table}:`, error);
                    // Don't throw, just log for these optional ones
                }
            }
        };

        await safeDeleteIgnoreMissing('hannam_payments');
        await safeDeleteIgnoreMissing('hannam_payment_history');
        await safeDeleteIgnoreMissing('hannam_point_history');
        await safeDeleteIgnoreMissing('hannam_signatures');
        await safeDeleteIgnoreMissing('hannam_transactions');
        await safeDeleteIgnoreMissing('hannam_sales');
        await safeDeleteIgnoreMissing('hannam_files');


        // 4. Delete Member (Result Check)
        const { error: deleteError } = await supabase.from('hannam_members').delete().eq('id', memberId);

        if (deleteError) {
            console.error('[HardDelete] Member Deletion Failed:', deleteError);
            throw new Error(`Member Deletion Failed: ${deleteError.message} (${deleteError.code})`);
        }

        console.log(`[HardDelete] Success for ${memberId}`);
        return res.status(200).json({ success: true, message: 'Member permanently deleted' });

    } catch (error: any) {
        console.error('[HardDelete] Fatal Error:', error);
        return res.status(500).json({
            error: error.message || 'Internal Server Error',
            stack: error.stack // Optional: for debugging
        });
    }
}
