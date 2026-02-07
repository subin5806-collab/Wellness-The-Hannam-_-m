
// Scripts to manually test Aligo API (Server-side simulation)
// Run with: node scripts/test_aligo_manual.js

const ALIGO_CONFIG = {
    key: process.env.ALIGO_APIKEY || 'wt1mir1bfax86lt0s8vu9bn47whjywb5',
    user_id: process.env.ALIGO_USERID || 'modoofit',
    senderkey: process.env.ALIGO_SENDERKEY || 'd40940367cfd584c22f0da0e7803be4d3e3785a4',
    sender: process.env.ALIGO_SENDER || '01000000000'
};

/*
    Testing Strategy:
    We use a dummy receiver number.
    If the IP is BLOCKED, Aligo API will likely return a 403 or connection timeout/error immediately.
    If the IP is ALLOWED, Aligo API will process the request. 
    Even if the number is invalid, we will get a JSON response from Aligo (e.g., code: -***).
    Getting ANY valid JSON response from Aligo means the IP blocking issue is RESOLVED.
*/

async function testAligo() {
    console.log("=== Aligo Manual Check ===");
    console.log("Config:", { ...ALIGO_CONFIG, key: '***' }); // Hide key in logs

    const endpoint = 'https://kakaoapi.aligo.in/akv10/alimtalk/send/';
    const formData = new URLSearchParams();
    formData.append('apikey', ALIGO_CONFIG.key);
    formData.append('userid', ALIGO_CONFIG.user_id);
    formData.append('senderkey', ALIGO_CONFIG.senderkey);
    formData.append('sender', ALIGO_CONFIG.sender);
    formData.append('receiver_1', '01012345678'); // Dummy number
    formData.append('subject_1', 'Test');
    formData.append('message_1', 'Test Message for IP Verification');
    formData.append('testmode_yn', 'Y'); // Use test mode if possible to avoid charging/spam

    try {
        console.log(`Sending to ${endpoint}...`);
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });

        console.log(`HTTP Status: ${res.status}`);

        if (res.status === 403) {
            console.error("❌ 403 Forbidden - IP is likely still BLOCKED.");
        } else if (res.ok) {
            const data = await res.json();
            console.log("Response Body:", data);
            if (data.code !== undefined) {
                console.log("✅ Connection Successful! (Aligo responded)");
                if (data.code === 0) {
                    console.log("   Legacy: Success code 0 received (Unexpected for dummy number but good)");
                } else {
                    console.log(`   Note: Received Aligo error code ${data.code} (${data.message}), which is EXPECTED for dummy data.`);
                    console.log("   Crucially, this means the server IP is NOT blocked.");
                }
            }
        } else {
            const text = await res.text();
            console.error(`❌ HTTP Error: ${res.status} ${res.statusText}`);
            console.error("Body:", text);
        }

    } catch (e) {
        console.error("❌ Connection Failed:", e);
    }
}

testAligo();
