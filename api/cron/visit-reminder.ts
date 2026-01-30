
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { AligoService } from '../../services/aligo';

// Initialize Supabase Client (Service Role needed for Cron to act as Admin)
// We need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// These should be in Vercel Environment Variables.
// BUT for this code to "just work" in the user's environment if they haven't set them yet,
// we might have issues.
// We'll assume they are present or fallback to PUBLIC ones (which might fail RLS if not careful).
// However, Cron jobs usually run on server, so they have access to server envs.
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
// NOTE: Anon key might not have permission to read everything/send messages depending on RLS.
// We strongly recommend SERVICE_ROLE_KEY.

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Check authorization (Vercel Cron Header) to prevent external abuse
    // const cronHeader = req.headers['x-vercel-cron']; // Available in Prod

    try {
        // 1. Fetch Dynamic Config from DB (hannam_notices -> ALIMTALK_CONFIG)
        const { data: configData } = await supabase
            .from('hannam_notices')
            .select('content')
            .eq('id', 'ALIMTALK_CONFIG')
            .single();

        if (!configData || !configData.content) {
            return res.status(200).json({ status: 'No Config Found' });
        }

        const config = JSON.parse(configData.content);
        // Config Structure: { isActive: boolean, sendTime: string (e.g. "15:00"), templateCode: string }

        if (!config.isActive) {
            return res.status(200).json({ status: 'Skipped: Feature Inactive' });
        }

        // 2. Check Time Match
        const now = new Date();
        // Convert to KST (UTC+9)
        const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
        const currentHour = kstTime.getUTCHours(); // This might be tricky.
        // Let's rely on string comparison of the hour.
        // actually `kstTime` is a shifted Date object. getUTCHours() would be UTC.
        // getHours() would be local system time (Vercel is UTC).
        // Let's use Intl or simple offset math.

        // Simpler: config.sendTime is "15:00". We want to see if NOW (KST) is within the 15:00 hour (15:00 ~ 15:59).
        // Vercel Cron runs somewhat precisely.
        const formatter = new Intl.DateTimeFormat('ko-KR', {
            timeZone: 'Asia/Seoul',
            hour: 'numeric',
            hour12: false
        });
        const kstHourStr = formatter.format(now);
        // kstHourStr might be "15" or "03" depending on locale options. 
        // Let's parse config.sendTime's hour.
        const targetHour = parseInt(config.sendTime.split(':')[0], 10);
        const currentKstHour = parseInt(kstHourStr, 10);

        if (currentKstHour !== targetHour) {
            return res.status(200).json({
                status: 'Skipped: Time Mismatch',
                currentKst: currentKstHour,
                target: targetHour
            });
        }

        // 3. Logic: Find Target Date based on 'daysBefore' (Default: 1 => Tomorrow)
        const daysOffset = (config.daysBefore !== undefined) ? parseInt(config.daysBefore) : 1;

        const kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
        kstNow.setDate(kstNow.getDate() + daysOffset);
        const targetDate = kstNow.toISOString().split('T')[0];

        // Fetch Reservations
        // We need member info too.
        const { data: reservations } = await supabase
            .from('hannam_reservations')
            .select(`
        *,
        member:hannam_members(name, phone),
        program:hannam_programs(name)
      `)
            .eq('date', targetDate)
            .eq('status', 'RESERVED');

        if (!reservations || reservations.length === 0) {
            return res.status(200).json({ status: 'No Reservations for Tomorrow', targetDate });
        }

        // 4. Send Messages (Batch)
        const results = [];

        // We need to call our own 'send' API or use the logic directly.
        // Since we are in the same Vercel project, we can import the logic if refactored, 
        // or just fetch the internal API URL. Fetching localhost in Vercel is tricky.
        // Better to replicate sending logic or import a helper.
        // I will use direct fetch to Aligo here to avoid self-call issues (timeout/networking).

        const ALIGO_CONFIG = {
            key: 'wt1mir1bfax86lt0s8vu9bn47whjywb5',
            user_id: 'modoofit',
            senderkey: 'd40940367cfd584c22f0da0e7803be4d3e3785a4',
            sender: config.senderPhone || '01000000000' // Must be in config
        };

        const endpoint = 'https://kakaoapi.aligo.in/akv10/alimtalk/send/';

        for (const res of reservations) {
            if (!res.member?.phone) continue;

            const formData = new URLSearchParams();
            formData.append('apikey', ALIGO_CONFIG.key);
            formData.append('userid', ALIGO_CONFIG.user_id);
            formData.append('senderkey', ALIGO_CONFIG.senderkey);
            formData.append('sender', ALIGO_CONFIG.sender);
            formData.append('receiver_1', res.member.phone);
            formData.append('subject_1', '방문 알림');
            formData.append('tpl_code', config.reminderTemplateCode);

            // Template Variables Replacement
            // Assuming Template content has #{v1} for Member Name, #{v2} for Time... 
            // This is user-specific. For MVP, we might send a fixed message or use "em_1", "em_2" etc.
            // Aligo uses specific variable mapping.
            // We will try to map standard ones:
            // message_1 = Plain text message.
            // We need to construct the message body matching the template.
            // For now, we assume the user configured the 'message pattern' in the UI or we just send standard info.
            // Actually, AlimTalk requires EXACT match with template.
            // We will assume the config stores the "Template Body Pattern" and we replace variables.
            let messageBody = config.reminderBody || `[웰니스더한남] 예약 알림\n\n#{이름}님, 내일(#{날짜}) #{시간} 예약을 안내드립니다.\n프로그램: #{프로그램}`;

            messageBody = messageBody.replace('#{이름}', res.member.name)
                .replace('#{날짜}', res.date)
                .replace('#{시간}', res.time)
                .replace('#{프로그램}', res.program?.name || '케어');

            // [CONTROL CENTER INTEGRATION]
            // We use sendWithCheck to respect the "VISIT_REMINDER" switch in the Control Center.
            // If the switch is OFF (default), it will skip silently.

            const notiRes = await AligoService.sendWithCheck('VISIT_REMINDER', res.member.phone, {
                '이름': res.member.name,
                '날짜': res.date,
                '시간': res.time,
                '프로그램': res.program?.name || '케어'
            });

            results.push({ id: res.id, success: notiRes.success, result: notiRes });
        }

        return res.status(200).json({
            status: 'Batch Complete',
            processed: results.length,
            targetDate
        });

    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}
