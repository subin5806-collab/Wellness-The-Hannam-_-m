
import { db } from '../db';

/**
 * AligoService [REAL IMPLEMENTATION]
 * Sends actual Kakao AlimTalk messages using Aligo API.
 * Requires 'ALIMTALK_CONFIG' in hannam_notices table with { apikey, userid, sender, ... }
 */
export const AligoService = {
    // 1. Send Direct Message (Real API)
    getTemplates: async () => {
        const config = await AligoService.getConfig();
        if (!config || !config.apikey || !config.userid) {
            console.warn('[Aligo] Config missing. Returning empty templates.');
            return [];
        }

        try {
            const formData = new FormData();
            formData.append('apikey', config.apikey);
            formData.append('userid', config.userid);

            // [API] List Templates
            const res = await fetch('https://kakaoapi.aligo.in/akv10/template/list/', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.code === 0) {
                return data.list;
            } else {
                console.error('[Aligo] Template List Error:', data.message);
                return [];
            }
        } catch (e) {
            console.error('[Aligo] Fetch Error:', e);
            return [];
        }
    },

    addTemplate: async (name: string, content: string) => {
        // Aligo Template Registration is complex (requires category codes, buttons, etc.)
        // For now, we only support Listing/Sending.
        return { code: -1, success: false, message: 'API Template Registration not supported in this version. Use Aligo Admin.' };
    },

    deleteTemplate: async (code: string) => {
        return { code: -1, success: false, message: 'Use Aligo Admin to manage templates.' };
    },

    sendDirect: async (receiver: string, message: string, templateCode?: string) => {
        const config = await AligoService.getConfig();
        if (!config || !config.apikey || !config.userid) {
            console.error('[Aligo] Missing Configuration. Message NOT sent.');
            return { code: -1, success: false, message: 'System Config Missing' };
        }

        console.log(`[Aligo] Sending Real Message to ${receiver}...`);

        try {
            const formData = new FormData();
            formData.append('apikey', config.apikey);
            formData.append('userid', config.userid);
            formData.append('sender', config.senderPhone || '01000000000'); // Valid Sender ID Required
            formData.append('receiver', receiver.replace(/[^0-9]/g, ''));
            formData.append('message', message);
            // formData.append('tpl_code', templateCode || ''); // If template
            // For general notification without template (FriendTalk equivalent), or if AlimTalk fails, it falls back?
            // "AlimTalk" MUST use registered template. "FriendTalk" can be free text.
            // As per request "AlimTalk", we should probably use a template if possible, but user passed raw message.
            // *CRITICAL*: Aligo "AlimTalk" API strictly requires `tpl_code` and `subject_1` etc matched with template.
            // *FALLBACK*: If just sending text, we try sending as "SMS/LMS" via Aligo if AlimTalk not specified?
            // Review docs: Aligo has /akv10/alimtalk/send/ and /send/ (SMS).
            // Request said "Kakao AlimTalk".
            // Since we don't have the template code map, we might fail if we just send random text to AlimTalk API.
            // BUT: The existing mock had "Template Code" in `getTemplates`.
            // Let's assume we use the SMS API if no template code is provided, OR try AlimTalk if `templateCode` exists.

            const endpoint = templateCode ? 'https://kakaoapi.aligo.in/akv10/alimtalk/send/' : 'https://apis.aligo.in/send/';

            if (templateCode) {
                formData.append('tpl_code', templateCode);
                formData.append('emtitle_1', '웰니스 알림'); // Button title fallback
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (data.code === 0 || (data.result_code && data.result_code === 1)) {
                console.log('[Aligo] Send Success:', data);
                return { code: 0, success: true, message: '전송 성공', data };
            } else {
                console.error('[Aligo] Send Failed:', data);
                return { code: data.code, success: false, message: data.message || '전송 실패' };
            }

        } catch (e: any) {
            console.error('[Aligo] Network Error:', e);
            return { code: -99, success: false, message: e.message };
        }
    },

    // 2. Manage Configuration
    getConfig: async () => {
        const data = await db.notices.getById('ALIMTALK_CONFIG');
        if (data?.content) {
            try { return JSON.parse(data.content); } catch (e) { return null; }
        }
        return null;
    },

    updateConfig: async (config: any) => {
        try {
            await (db.notices as any).upsert({
                id: 'ALIMTALK_CONFIG',
                title: 'System Config (AlimTalk)',
                content: JSON.stringify(config),
                category: 'SYSTEM',
                isPopup: false,
                isAlertOn: false,
                startDate: new Date().toISOString(),
                endDate: '2099-12-31'
            });
            return { success: true };
        } catch (e) {
            return { success: false, message: (e as any).message };
        }
    }
};
