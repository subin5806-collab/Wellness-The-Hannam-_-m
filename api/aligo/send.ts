import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ALIGO_CONFIG = {
  key: process.env.ALIGO_APIKEY || 'wt1mir1bfax86lt0s8vu9bn47whjywb5',
  user_id: process.env.ALIGO_USERID || 'modoofit',
  senderkey: process.env.ALIGO_SENDERKEY || 'd40940367cfd584c22f0da0e7803be4d3e3785a4',
  sender: process.env.ALIGO_SENDER || '01000000000'
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { type, receiver, message, template_code, subject, failover, fsubject, fmessage } = req.body;

  if (!receiver || !message) {
    return res.status(400).json({ error: 'Missing receiver or message' });
  }

  const endpoint = 'https://kakaoapi.aligo.in/akv10/alimtalk/send/';

  const formData = new URLSearchParams();
  formData.append('apikey', ALIGO_CONFIG.key);
  formData.append('userid', ALIGO_CONFIG.user_id);
  formData.append('senderkey', ALIGO_CONFIG.senderkey);
  formData.append('sender', req.body.sender || ALIGO_CONFIG.sender);
  formData.append('receiver_1', receiver);
  formData.append('subject_1', subject || '알림톡');
  formData.append('message_1', message);
  if (template_code) formData.append('tpl_code', template_code);

  // Failover Settings (SMS Fallback)
  if (failover === 'Y' || req.body.useFailover) {
    formData.append('failover', 'Y');
    formData.append('fsubject_1', fsubject || subject || '알림');
    formData.append('fmessage_1', fmessage || message);
  }

  // formData.append('testmode_yn', 'Y'); // Uncomment for testing

  try {
    const aligoRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData
    });

    const result = await aligoRes.json();

    // DB Logging (Unconditional)
    await supabase.from('hannam_admin_action_logs').insert({
      admin_email: 'system@aligo-api',
      action_type: 'ALIMTALK_SEND',
      target_id: receiver,
      details: JSON.stringify({
        success: result.code === 0,
        code: result.code,
        message: result.message,
        template: template_code,
        isFailover: failover === 'Y'
      }),
      ip_address: req.headers['x-forwarded-for'] || '0.0.0.0'
    });

    return res.status(200).json(result);
  } catch (error: any) {
    // Log Failure
    await supabase.from('hannam_admin_action_logs').insert({
      admin_email: 'system@aligo-api',
      action_type: 'ALIMTALK_ERROR',
      target_id: receiver,
      details: JSON.stringify({ error: error.message }),
      ip_address: req.headers['x-forwarded-for'] || '0.0.0.0'
    });
    return res.status(500).json({ error: error.message });
  }
}
