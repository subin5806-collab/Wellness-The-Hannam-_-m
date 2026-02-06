import type { VercelRequest, VercelResponse } from '@vercel/node';

// Config priority: Env Vars (Server)
// The client will pass DB-stored config if available, but for bootstrapping auth we rely on base config
const ALIGO_CONFIG = {
    key: process.env.ALIGO_APIKEY || process.env.VITE_ALIGO_APIKEY || 'wt1mir1bfax86lt0s8vu9bn47whjywb5',
    user_id: process.env.ALIGO_USERID || process.env.VITE_ALIGO_USERID || 'modoofit',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { action, ...params } = req.body;
    // action: 'auth' | 'category' | 'add' | 'list'

    let endpoint = '';
    const formData = new URLSearchParams();

    // Base Credentials
    formData.append('apikey', ALIGO_CONFIG.key);
    formData.append('userid', ALIGO_CONFIG.user_id);

    switch (action) {
        case 'auth': // 1. Request Auth Number
            endpoint = 'https://kakaoapi.aligo.in/akv10/profile/auth/';
            // params: plusid, phonenumber
            formData.append('plusid', params.plusid);
            formData.append('phonenumber', params.phonenumber);
            break;

        case 'category': // 2. Get Category Code
            endpoint = 'https://kakaoapi.aligo.in/akv10/category/';
            // no extra params needed
            break;

        case 'add': // 3. Verify & Add Profile -> Returns senderKey
            endpoint = 'https://kakaoapi.aligo.in/akv10/profile/add/';
            // params: plusid, authnum, phonenumber, categorycode
            formData.append('plusid', params.plusid);
            formData.append('authnum', params.authnum);
            formData.append('phonenumber', params.phonenumber);
            formData.append('categorycode', params.categorycode);
            break;

        case 'list': // 4. List Profiles
            endpoint = 'https://kakaoapi.aligo.in/akv10/profile/list/';
            // optional: plusid, senderkey
            if (params.plusid) formData.append('plusid', params.plusid);
            if (params.senderkey) formData.append('senderkey', params.senderkey);
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
