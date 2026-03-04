const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function investigate() {
    const email = process.env.GUPSHUP_PARTNER_EMAIL;
    const password = process.env.GUPSHUP_PARTNER_CLIENT_SECRET;
    const appId = process.env.GUPSHUP_APP_ID;
    const BASE = 'https://partner.gupshup.io';

    // Get fresh token
    const body = new URLSearchParams();
    body.set('email', email);
    body.set('password', password);
    const loginRes = await axios.post(`${BASE}/partner/account/login`, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }
    });
    const rawToken = loginRes.data?.token;
    const headers = { Authorization: rawToken, token: rawToken, Accept: 'application/json' };

    // Get App token
    const appTokenRes = await axios.get(`${BASE}/partner/app/${appId}/token`, { headers });
    const appToken = appTokenRes.data?.token?.token || appTokenRes.data?.token;
    console.log('App token prefix:', String(appToken || '').substring(0, 30));

    const appHeaders = { Authorization: appToken, token: appToken, Accept: 'application/json' };

    // 1. Check WABA info (full detail)
    console.log('\n=== WABA Info ===');
    try {
        const res = await axios.get(`${BASE}/partner/app/${appId}/waba/info`, { headers: appHeaders });
        console.log(JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error('WABA info failed:', e.response?.data || e.message);
    }

    // 2. Check subscriptions
    console.log('\n=== Subscriptions ===');
    try {
        const res = await axios.get(`${BASE}/partner/app/${appId}/subscription`, { headers });
        console.log(JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error('Subscriptions failed:', e.response?.status, e.response?.data || e.message);
    }

    // 3. Check app token details
    console.log('\n=== App Token Details ===');
    console.log('App token:', String(appToken || 'EMPTY').substring(0, 50));

    // 4. Try sending via App token (to ensure we're using the right app)
    console.log('\n=== Send test with full App token ===');
    try {
        const res = await axios.post(`${BASE}/partner/app/${appId}/v3/message`, {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: '917321835093',
            type: 'template',
            template: {
                name: '49ab6945_welcome',
                language: { code: 'en' },
                components: [{ type: 'body', parameters: [{ type: 'text', text: 'TestFromScript' }] }]
            }
        }, { headers: appHeaders });
        console.log('Send result:', JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error('Send failed:', e.response?.status, JSON.stringify(e.response?.data));
    }

    process.exit(0);
}

investigate().catch(e => { console.error(e.message); process.exit(1); });
