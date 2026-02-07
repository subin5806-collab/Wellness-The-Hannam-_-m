import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const proxyUrl = process.env.FIXIE_URL || process.env.QUOTAGUARD_URL;
        let agent: any = undefined;
        let proxyStatus = 'Direct Connection (Dynamic IP)';

        if (proxyUrl) {
            const { HttpsProxyAgent } = await import('https-proxy-agent');
            agent = new HttpsProxyAgent(proxyUrl);
            proxyStatus = 'Proxy Connection (Static IP candidate)';
        }

        const ipRes = await fetch('https://api.ipify.org?format=json', {
            agent
        } as any);

        const data = await ipRes.json();

        return res.status(200).json({
            ip: data.ip,
            connection_type: proxyStatus,
            message: 'This is the outbound IP used for external API calls.',
            note: 'If using Fixie, this should be one of your static IPs.'
        });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}
