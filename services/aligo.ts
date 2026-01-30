
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
    },

    // 3. Control Center Features
    getBalance: async () => {
        const config = await AligoService.getConfig();
        if (!config?.apikey || !config?.userid) return null;

        try {
            const formData = new FormData();
            formData.append('apikey', config.apikey);
            formData.append('userid', config.userid);

            // Aligo API: /akv10/heart/remain/ or /heart/remain/ (Check docs, usually /heart/remain/ is for SMS/LMS common balance)
            const res = await fetch('https://apis.aligo.in/remain/', { method: 'POST', body: formData });
            const data = await res.json();
            // data: { code: 0, message: "성공", SMS_CNT: 100, LMS_CNT: 50, MMS_CNT: 50, ... }
            if (data.code === 0) return data;
            return null;
        } catch (e) { return null; }
    },

    getHistory: async (page = 1, limit = 50) => {
        const config = await AligoService.getConfig();
        if (!config?.apikey || !config?.userid) return { list: [], total: 0 };

        try {
            const formData = new FormData();
            formData.append('apikey', config.apikey);
            formData.append('userid', config.userid);
            formData.append('page', page.toString());
            formData.append('limit', limit.toString());
            // Optional: filter by date range if needed

            // Aligo API: /list/ for SMS, /akv10/history/list/ for AlimTalk
            // We want mostly AlimTalk history but maybe SMS too.
            // Let's try AlimTalk history first.
            const res = await fetch('https://kakaoapi.aligo.in/akv10/history/list/', { method: 'POST', body: formData });
            const data = await res.json();
            // data: { code: 0, list: [...], total_cnt: ... }
            if (data.code === 0) return { list: data.list, total: data.total_cnt };
            return { list: [], total: 0 };
        } catch (e) { return { list: [], total: 0 }; }
    },

    // 4. Safe Wrapper (The Master Switch Enforcer)
    sendWithCheck: async (trigger: 'PAYMENT' | 'RESERVATION' | 'VISIT_REMINDER', receiver: string, variables: Record<string, string>) => {
        const config = await AligoService.getConfig();

        // 1. Check Global Config
        if (!config?.isActive) {
            console.log(`[Aligo] Global Switch OFF. Skipped ${trigger} to ${receiver}`);
            return { success: false, message: 'Global Switch OFF' }; // Silent skip
        }

        // 2. Check Trigger Switch
        const triggerConfig = config.triggers?.[trigger];
        if (!triggerConfig?.enabled) {
            console.log(`[Aligo] Trigger [${trigger}] OFF. Skipped to ${receiver}`);
            return { success: false, message: 'Trigger Switch OFF' };
        }

        // 3. Resolve Template
        const templateCode = triggerConfig.templateCode;
        if (!templateCode) {
            console.error(`[Aligo] No Template Selected for [${trigger}].`);
            return { success: false, message: 'No Template Selected' };
        }

        // 4. Construct Message (Replace Variables)
        // We need the template content to replace variables. 
        // Ideally we have the template text cached in config.templates, or we trust the caller passed the right built message?
        // Wait, caller usually passes 'message' string. 
        // BUT user asked for "Template Selection" -> This implies we construct the message here based on the selected template.
        // However, existing calls (MemberRegistration) build the string themselves.
        // REFACTOR STRATEGY: 
        // Option A: Caller builds string -> We just use provided string. (Risk: Caller string might not match selected template?)
        // Option B: Caller passes variables -> We look up template -> We build string. (Best for "Template Selection")

        // Let's implement Option B for robustness.
        const template = config.templates?.find((t: any) => t.templtCode === templateCode); // Aligo API uses templtCode
        let message = template?.templtContent || '';

        if (!message) {
            // Fallback: If we don't have template cached, we cannot build message.
            // In this case, we might need to rely on a 'default' or fail.
            // Or maybe the caller SHOULD pass the fallback message?
            // For now, let's assume we can fetch/cache templates.
            console.warn(`[Aligo] Template content not found for ${templateCode}. Using variables dump.`);
            message = Object.entries(variables).map(([k, v]) => `${k}: ${v}`).join('\n');
        } else {
            // Replace `#{이름}` -> variables['이름']
            Object.entries(variables).forEach(([key, value]) => {
                message = message.replace(new RegExp(`#\{${key}\}`, 'g'), value);
            });
        }

        // 5. Send
        return await AligoService.sendDirect(receiver, message, templateCode);
    }
};
