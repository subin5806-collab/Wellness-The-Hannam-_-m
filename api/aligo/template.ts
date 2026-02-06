
import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALIGO_CONFIG = {
    key: process.env.ALIGO_APIKEY || process.env.VITE_ALIGO_APIKEY || 'wt1mir1bfax86lt0s8vu9bn47whjywb5',
    user_id: process.env.ALIGO_USERID || process.env.VITE_ALIGO_USERID || 'modoofit',
    senderkey: process.env.ALIGO_SENDERKEY || process.env.VITE_ALIGO_SENDERKEY || 'd40940367cfd584c22f0da0e7803be4d3e3785a4',
    sender: process.env.ALIGO_SENDER || process.env.VITE_ALIGO_SENDER || '01000000000'
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { action, ...params } = req.body;
    // action: 'list', 'add', 'delete'

    let endpoint = '';
    const formData = new URLSearchParams();
    formData.append('apikey', ALIGO_CONFIG.key);
    formData.append('userid', ALIGO_CONFIG.user_id);
    formData.append('senderkey', ALIGO_CONFIG.senderkey);

    switch (action) {
        case 'list':
            endpoint = 'https://kakaoapi.aligo.in/akv10/template/list/';
            break;
        case 'add':
            endpoint = 'https://kakaoapi.aligo.in/akv10/template/add/';
            formData.append('tpl_name', params.tpl_name);
            formData.append('tpl_content', params.tpl_content);
            // Optional buttons etc.
            break;
        case 'request': // Request Inspection
            endpoint = 'https://kakaoapi.aligo.in/akv10/template/request/';
            formData.append('tpl_code', params.tpl_code);
            break;
        case 'delete':
            endpoint = 'https://kakaoapi.aligo.in/akv10/template/del/';
            formData.append('tpl_code', params.tpl_code);
            break;
        default:
            return res.status(400).json({ error: 'Invalid Action' });
    }

    try {
        const apiRes = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        const result = await apiRes.json();
        return res.status(200).json(result);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}
