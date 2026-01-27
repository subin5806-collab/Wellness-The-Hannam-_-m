
import { db } from '../db';

export const AligoService = {
    // 1. Send Direct Message (Manual)
    getTemplates: async () => {
        try {
            const response = await fetch('/api/aligo/template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'list' })
            });
            if (!response.ok) throw new Error(response.statusText);
            const data = await response.json();
            return data.list || [];
        } catch (e) {
            console.warn("[DevMode] API Fallback: Returning mock templates", e);
            return [
                { code: 'TP_REMIND_01', name: '방문 리마인드 (기본)', content: '[웰니스더한남] 예약 알림\n\n#{이름}님, 내일(#{날짜}) #{시간} 예약을 안내드립니다.\n프로그램: #{프로그램}', status: 'R' },
                { code: 'TP_PAY_01', name: '결제 완료 안내', content: '[웰니스더한남] 결제 완료\n\n#{이름}님, #{상품명} 결제가 완료되었습니다.\n금액: #{결제금액}원', status: 'A' }, // A: Inspection
                { code: 'TP_EVENT_01', name: '이벤트 안내', content: '(광고) 웰니스더한남 봄맞이 이벤트...', status: 'R' }
            ];
        }
    },

    addTemplate: async (name: string, content: string) => {
        const response = await fetch('/api/aligo/template', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'add', tpl_name: name, tpl_content: content })
        });
        return await response.json();
    },

    deleteTemplate: async (code: string) => {
        const response = await fetch('/api/aligo/template', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', tpl_code: code })
        });
        return await response.json();
    },

    sendDirect: async (receiver: string, message: string, templateCode?: string) => {
        // Call our Serverless Function
        const response = await fetch('/api/aligo/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'alimtalk',
                receiver,
                message,
                template_code: templateCode
            })
        });
        return await response.json();
    },

    // 2. Manage Configuration (Smart Cron Settings)
    getConfig: async () => {
        // Fetch from hannam_notices (ID: ALIMTALK_CONFIG)
        // We reuse the pattern from db.system.getSecurityConfig
        // But we need to implement it here or in db.ts.
        // For consistency, let's look at db.ts or just query Supabase directly?
        // Let's use db.ts to be clean. But db.ts might not have this specific getter yet.
        // We will assume db.ts/notices is accessible or we add a helper.
        // Actually, let's implement the DB fetch here for isolation or consistency.
        // Wait, 'db' object is robust.
        const data = await db.notices.getById('ALIMTALK_CONFIG');
        if (data?.content) {
            try { return JSON.parse(data.content); } catch (e) { return null; }
        }
        return {
            isActive: false,
            sendTime: '15:00',
            senderPhone: '',
            reminderTemplateCode: '',
            reminderBody: '[웰니스더한남] 예약 알림\n\n#{이름}님, 내일(#{날짜}) #{시간} 예약을 안내드립니다.\n프로그램: #{프로그램}'
        };
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
            console.error("Failed to save config", e);
            return { success: false, message: (e as any).message };
        }
    },


};
