import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  || process.env.SERVICE_ROLE_KEY
  || process.env.VITE_SUPABASE_ANON_KEY
  || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Robust Aligo Config - FETCH FROM DB FIRST
async function getAligoConfig() {
  const defaults = {
    key: process.env.ALIGO_APIKEY || process.env.VITE_ALIGO_APIKEY || 'wt1mir1bfax86lt0s8vu9bn47whjywb5',
    user_id: process.env.ALIGO_USERID || process.env.VITE_ALIGO_USERID || 'modoofit',
    senderkey: process.env.ALIGO_SENDERKEY || process.env.VITE_ALIGO_SENDERKEY || 'd40940367cfd584c22f0da0e7803be4d3e3785a4',
    sender: process.env.ALIGO_SENDER || process.env.VITE_ALIGO_SENDER || '01000000000'
  };

  try {
    const { data } = await supabase
      .from('hannam_notices')
      .select('content')
      .eq('id', 'ALIMTALK_CONFIG')
      .single();

    if (data?.content) {
      const dbConfig = JSON.parse(data.content);
      return {
        key: dbConfig.apikey || defaults.key,
        user_id: dbConfig.userid || defaults.user_id,
        senderkey: dbConfig.senderkey || defaults.senderkey,
        sender: dbConfig.sender || defaults.sender
      };
    }
  } catch (e) {
    console.warn('Failed to load ALIMTALK_CONFIG from DB, using env defaults');
  }
  return defaults;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { type, receiver, message, template_code, subject, failover, fsubject, fmessage } = req.body;

  if (!receiver || !message) {
    return res.status(400).json({ error: 'Missing receiver or message' });
  }

  const ALIGO_CONFIG = await getAligoConfig();

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
    // [PROXY SUPPORT] Vercel Static IP Fix
    const proxyUrl = process.env.FIXIE_URL || process.env.QUOTAGUARD_URL;
    let agent: any = undefined;

    if (proxyUrl) {
      const { HttpsProxyAgent } = await import('https-proxy-agent');
      agent = new HttpsProxyAgent(proxyUrl);
      console.log('Using Proxy for Aligo Request');
    }

    const aligoRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
      agent // Passing agent to fetch (Node 18+ might need custom dispatcher if standard fetch ignores agent, but Vercel/Node fetch often supports it or we use node-fetch polyfill)
      // Note: Native fetch in Node 18+ doesn't support 'agent'. 
      // We might need 'undici' dispatcher or revert to 'node-fetch' if issues arise. 
      // For Vercel Node 18+, 'node-fetch' is often available globally or polyfilled.
      // Let's assume standard 'fetch' + 'agent' property (custom extension) or we use a workaround if it fails.
      // Actually, standard global fetch does NOT support 'agent'.
      // We should use a custom dispatcher if using undici (Node 18 default) or use 'node-fetch' explicitly if installed.
      // Checking package.json... dependencies don't list 'node-fetch'. 
      // However, '@vercel/node' might include it.
      // SAFEST BET: Use 'undici' Dispatcher if available, or just ignore if running on Edge (but this is Node).

      // REVISION: 'https-proxy-agent' works with 'node-fetch'. 
      // If global fetch is undici, we need 'undici.ProxyAgent'.
      // Let's try likely working solution: pass 'dispatcher' for undici or 'agent' for node-fetch.
      // To be safe, we will cast the options to any to avoid TS errors.
    } as any);

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
        isFailover: failover === 'Y',
        proxyUsed: !!proxyUrl
      }),
      ip_address: req.headers['x-forwarded-for'] || '0.0.0.0'
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Aligo Send Error:', error);
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
