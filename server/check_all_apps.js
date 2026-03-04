const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function checkApps() {
    const email = process.env.GUPSHUP_PARTNER_EMAIL;
    const password = process.env.GUPSHUP_PARTNER_CLIENT_SECRET;
    const BASE = 'https://partner.gupshup.io';

    const body = new URLSearchParams();
    body.set('email', email);
    body.set('password', password);
    const loginRes = await axios.post(`${BASE}/partner/account/login`, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }
    });
    const rawToken = loginRes.data?.token;
    const headers = { Authorization: rawToken, token: rawToken, Accept: 'application/json' };

    // Get all apps
    const appsRes = await axios.get(`${BASE}/partner/app`, { headers });
    const apps = appsRes.data?.partnerAppsList || [];

    console.log('\n=== Apps Summary ===');
    console.log(`Total apps: ${apps.length}`);

    // Check live apps 
    const liveApps = apps.filter(a => a.live);
    console.log(`Live apps: ${liveApps.length}`);
    liveApps.forEach(a => console.log(`  - ${a.id} | ${a.name} | phone: ${a.phone}`));

    // For each live app, check WABA canSendMessage status
    console.log('\n=== WABA Sending Status for Live Apps ===');
    for (const app of liveApps) {
        try {
            const appTokenRes = await axios.get(`${BASE}/partner/app/${app.id}/token`, { headers });
            const appToken = appTokenRes.data?.token?.token || appTokenRes.data?.token;
            const appHeaders = { Authorization: appToken, token: appToken, Accept: 'application/json' };

            const wabaRes = await axios.get(`${BASE}/partner/app/${app.id}/waba/info`, { headers: appHeaders });
            const wi = wabaRes.data?.wabaInfo;
            console.log(`  App: ${app.id} | ${wi?.canSendMessage} | displayName: ${wi?.verifiedName} | tier: ${wi?.messagingLimit} | nameStatus: ${wi?.requestedNameStatus}`);
        } catch (e) {
            console.log(`  App: ${app.id} - Error: ${e.response?.data?.message || e.message}`);
        }
    }

    process.exit(0);
}

checkApps().catch(e => { console.error(e.message); process.exit(1); });
