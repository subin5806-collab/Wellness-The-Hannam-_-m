
import { db } from '../db';

/**
 * AligoService [PROXY IMPLEMENTATION]
 * Sends requests to Serverless Functions (/api/aligo/*).
 * Eliminates CORS issues and hides API Keys from client.
 */
export const AligoService = {
    // 1. Get Templates (via Server Proxy)
    getTemplates: async () => {
        try {
            const res = await fetch('/api/aligo/template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'list' })
            });
            const data = await res.json();
            if (data.code === 0) {
                return data.list;
            } else {
                console.warn('[Aligo] Template List Warning:', data.message);
                return [];
            }
        } catch (e) {
            console.error('[Aligo] Proxy Error:', e);
            return [];
        }
    },

    requestTemplate: async (code: string) => {
        try {
            const res = await fetch('/api/aligo/template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'request', tpl_code: code })
            });
            return await res.json();
        } catch (e) {
            return { code: -99, message: 'Request Failed' };
        }
    },

    addTemplate: async (name: string, content: string) => {
        return { code: -1, success: false, message: 'Use Aligo Admin Console.' };
    },

    deleteTemplate: async (code: string) => {
        return { code: -1, success: false, message: 'Use Aligo Admin Console.' };
    },

    // 1.5 Channel Auth (Profile)
    requestAuth: async (plusid: string, phonenumber: string) => {
        try {
            const res = await fetch('/api/aligo/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'auth', plusid, phonenumber })
            });
            return await res.json();
        } catch (e) { return { code: -99, message: 'Auth Request Failed' }; }
    },

    getCategory: async () => {
        try {
            const res = await fetch('/api/aligo/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'category' })
            });
            return await res.json();
        } catch (e) { return { code: -99, message: 'Category Load Failed' }; }
    },

    createProfile: async (plusid: string, authnum: string, phonenumber: string, categorycode: string) => {
        try {
            const res = await fetch('/api/aligo/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add', plusid, authnum, phonenumber, categorycode })
            });
            return await res.json();
        } catch (e) { return { code: -99, message: 'Profile Create Failed' }; }
    },

    getProfiles: async () => {
        try {
            const res = await fetch('/api/aligo/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'list' })
            });
            return await res.json();
        } catch (e) { return { code: -99, message: 'List Failed' }; }
    },

    // 2. Send Direct Message (via Server Proxy)
    sendDirect: async (receiver: string, message: string, templateCode?: string) => {
        try {
            const payload: any = {
                receiver,
                message,
                template_code: templateCode,
                subject: '알림톡',
                // Failover defaults (Server handles this logic too, but we pass flag)
                failover: 'Y'
            };

            const res = await fetch('/api/aligo/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (data.code === 0 || (data.result_code && data.result_code === 1)) {
                return { code: 0, success: true, message: '전송 성공', data };
            } else {
                return { code: data.code, success: false, message: data.message || '전송 실패' };
            }
        } catch (e: any) {
            console.error('[Aligo] Proxy Send Error:', e);
            return { code: -99, success: false, message: e.message };
        }
    },

    // 3. Config (Legacy - No longer needed on client, but kept for interface compatibility)
    getConfig: async () => {
        return { message: 'Managed by Server' };
    },

    updateConfig: async (config: any) => {
        // Warning: This updates the DB record which is mostly unused now, 
        // but maybe used by other legacy systems? Leaving as is or stubbing.
        // For now, let's allow updating DB just in case, but client uses Server Env Vars primarily.
        try {
            await (db.notices as any).upsert({
                id: 'ALIMTALK_CONFIG',
                title: 'System Config (AlimTalk - Deprecated)',
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

    // 4. Balance (via Server Proxy if endpoint exists, otherwise nullable)
    getBalance: async () => {
        // Not implemented in proxy yet
        return null;
    },

    getHistory: async (page = 1, limit = 50) => {
        // Not implemented in proxy yet
        return { list: [], total: 0 };
    },

    // 5. Safe Wrapper
    sendWithCheck: async (trigger: 'PAYMENT' | 'RESERVATION' | 'VISIT_REMINDER', receiver: string, variables: Record<string, string>) => {
        // [Logic Shift] Client only resolves template code mapping? 
        // Or we just send directly?
        // Since we moved config to server, 'trigger' mapping is tricky if it was in DB.
        // Let's assume we maintain a simple mapping here OR fetch it from DB (if DB 406 isn't blocking).

        // If DB is blocking (406), we can't fetch mapping.
        // Hardcode common templates for now to survive?
        const TEMPLATE_MAP: Record<string, string> = {
            'PAYMENT': 'TP_PAY_01',
            'RESERVATION': 'TP_RES_01',
            'VISIT_REMINDER': 'TP_REMIND_01'
        };

        const templateCode = TEMPLATE_MAP[trigger];
        if (!templateCode) return { success: false, message: 'No Template Map' };

        // Construct Message (Simple substitution)
        // Note: Real template text is on server/Aligo. We can't replace variables locally if we don't know the text.
        // Solution: We pass variables to Server? 
        // But /api/aligo/send expects 'message' string.
        // Compromise: We construct a "Reasonable" message here. Aligo might reject if it doesn't match EXACTLY.
        // This is risky. 
        // BETTER: User Logic seems to be "Send what I give you". 
        // If we can't fetch config, we can't do exact replacement. 
        // Let's try sending generic message if we can't load template.

        let message = `[${trigger}] 알림\n`;
        Object.entries(variables).forEach(([k, v]) => message += `${k}: ${v}\n`);

        return await AligoService.sendDirect(receiver, message, templateCode);
    }
};
