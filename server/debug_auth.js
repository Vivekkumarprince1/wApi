const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');

dotenv.config({ path: path.join(__dirname, '.env') });

// Manually get a fresh token and test multiple header formats
async function testRaw() {
    const email = process.env.GUPSHUP_PARTNER_EMAIL;
    const password = process.env.GUPSHUP_PARTNER_CLIENT_SECRET;
    const appId = '83145d5d-e470-4893-a52c-7f4a2720f96d';
    const BASE = 'https://partner.gupshup.io';

    console.log('=== Step A: Fetching fresh partner token ===');
    let rawToken;
    try {
        const body = new URLSearchParams();
        body.set('email', email);
        body.set('password', password);
        const loginRes = await axios.post(`${BASE}/partner/account/login`, body.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }
        });
        rawToken = loginRes.data?.token;
        console.log('Token prefix:', String(rawToken).substring(0, 40) + '...');
    } catch (e) {
        console.error('Login failed:', e.response?.data || e.message);
        process.exit(1);
    }

    const bearerToken = `Bearer ${rawToken}`;

    const headerVariants = [
        { label: 'Authorization: raw (no Bearer)', headers: { Authorization: rawToken, Accept: 'application/json' } },
        { label: 'Authorization: Bearer + raw', headers: { Authorization: bearerToken, Accept: 'application/json' } },
        { label: 'token: raw', headers: { token: rawToken, Accept: 'application/json' } },
        { label: 'Authorization: Bearer + token: raw', headers: { Authorization: bearerToken, token: rawToken, Accept: 'application/json' } },
    ];

    // 1. Test whitelist with all variants
    console.log('\n=== Step B: Testing whitelist ===');
    for (const { label, headers } of headerVariants) {
        try {
            const res = await axios.post(`${BASE}/partner/app/${appId}/obotoembed/whitelist`, {}, { headers });
            console.log(`✅ ${label}:`, JSON.stringify(res.data));
            break;
        } catch (e) {
            console.log(`❌ ${label}:`, e.response?.status, JSON.stringify(e.response?.data));
        }
    }

    // 2. Test verify with all variants
    console.log('\n=== Step C: Testing verify/credit ===');
    for (const { label, headers } of headerVariants) {
        try {
            const res = await axios.get(`${BASE}/partner/app/${appId}/obotoembed/verify`, { headers });
            console.log(`✅ ${label}:`, JSON.stringify(res.data));
            break;
        } catch (e) {
            console.log(`❌ ${label}:`, e.response?.status, JSON.stringify(e.response?.data));
        }
    }

    // 3. Test a known-good partner API (list apps) to confirm token is valid
    console.log('\n=== Step D: Testing known-good partner API (list apps) ===');
    try {
        const res = await axios.get(`${BASE}/partner/app`, {
            headers: { Authorization: bearerToken, token: rawToken, Accept: 'application/json' }
        });
        const apps = res.data?.partnerAppsList || [];
        console.log(`✅ Got ${apps.length} apps`);
    } catch (e) {
        console.error('❌ List apps failed:', e.response?.status, e.response?.data);
    }

    // 4. Test wallet balance with fresh token
    console.log('\n=== Step E: Testing wallet balance ===');
    try {
        const res = await axios.get(`${BASE}/partner/app/${appId}/wallet/balance`, {
            headers: { Authorization: bearerToken, token: rawToken, Accept: 'application/json' }
        });
        console.log('✅ Wallet:', JSON.stringify(res.data));
    } catch (e) {
        console.error('❌ Wallet failed:', e.response?.status, JSON.stringify(e.response?.data));
    }

    process.exit(0);
}

testRaw().catch(err => { console.error(err); process.exit(1); });
