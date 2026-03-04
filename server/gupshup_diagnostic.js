require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const { Workspace } = require('./src/models');
const { decryptToken } = require('./src/services/bsp/gupshupProvisioningService');

async function runDiagnostics() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const workspaceId = '699c21048e96ba1b49ab6945';
    const workspace = await Workspace.findById(workspaceId);
    const appId = '83145d5d-e470-4893-a52c-7f4a2720f96d';
    const appApiKey = decryptToken(workspace.gupshupIdentity?.appApiKey);

    // Get Partner Token
    const body = new URLSearchParams();
    body.set('email', process.env.GUPSHUP_PARTNER_EMAIL);
    body.set('password', process.env.GUPSHUP_PARTNER_CLIENT_SECRET);
    const loginRes = await axios.post('https://partner.gupshup.io/partner/account/login', body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }
    });
    const partnerToken = loginRes.data?.token;

    const partnerHeaders = { Authorization: partnerToken, token: partnerToken, Accept: 'application/json' };
    const appHeaders = { Authorization: appApiKey, token: appApiKey, Accept: 'application/json' };

    const endpoints = [
        { name: 'Health (App)', url: `/partner/app/${appId}/health`, headers: appHeaders },
        { name: 'Health (Partner)', url: `/partner/app/${appId}/health`, headers: partnerHeaders },
        { name: 'WABA Info (App)', url: `/partner/app/${appId}/waba/info`, headers: appHeaders },
        { name: 'WABA Info (Partner)', url: `/partner/app/${appId}/waba/info`, headers: partnerHeaders },
        { name: 'Ratings (App)', url: `/partner/app/${appId}/ratings`, headers: appHeaders },
        { name: 'Ratings (Partner)', url: `/partner/app/${appId}/ratings`, headers: partnerHeaders },
        { name: 'Subscription (App)', url: `/partner/app/${appId}/subscription`, headers: appHeaders },
        { name: 'Subscription (Partner)', url: `/partner/app/${appId}/subscription`, headers: partnerHeaders }
    ];

    for (const ep of endpoints) {
        console.log(`\n--- Fetching ${ep.name} ---`);
        try {
            const res = await axios.get(`https://partner.gupshup.io${ep.url}`, { headers: ep.headers });
            console.log(`${ep.name} Response:`, JSON.stringify(res.data, null, 2));
        } catch (err) {
            console.error(`${ep.name} Failed:`, err.message);
            if (err.response) console.error('Status:', err.response.status, 'Data:', JSON.stringify(err.response.data));
        }
    }

    await mongoose.disconnect();
}

runDiagnostics();
