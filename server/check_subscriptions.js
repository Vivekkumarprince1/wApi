const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config({ path: __dirname + '/.env' });
const gupshupService = require('./src/services/bsp/gupshupService');
const { Workspace } = require('./src/models');
const { decryptToken } = require('./src/services/bsp/gupshupProvisioningService');

async function checkSubscriptions() {
    console.log('--- GUPSHUP SUBSCRIPTION DIAGNOSTIC ---');

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const appId = process.env.GUPSHUP_APP_ID;

        console.log('Logging in to Gupshup Partner API...');
        const body = new URLSearchParams();
        body.set('email', process.env.GUPSHUP_PARTNER_EMAIL);
        body.set('password', process.env.GUPSHUP_PARTNER_CLIENT_SECRET);

        const loginRes = await axios.post('https://partner.gupshup.io/partner/account/login', body.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }
        });

        const token = loginRes.data?.token;
        if (!token) throw new Error('Failed to get partner token during login');
        console.log('Login successful.');

        await runCheck(appId, token);

    } catch (error) {
        console.error('Diagnostic failed:', error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

async function runCheck(appId, token) {
    console.log(`Checking subscriptions for App ID: ${appId}`);

    const tokenClean = token.replace(/^Bearer\s+/i, '').trim();
    const headerVariants = [
        { 'Authorization': `Bearer ${tokenClean}`, 'token': tokenClean, 'Accept': 'application/json' },
        { 'Authorization': tokenClean, 'token': tokenClean, 'Accept': 'application/json' }
    ];

    let lastError = null;
    for (const headers of headerVariants) {
        try {
            const url = `https://partner.gupshup.io/partner/app/${appId}/subscription`;
            const res = await axios.get(url, { headers, timeout: 15000 });

            console.log('\n✅ ACTIVE SUBSCRIPTIONS FOUND:');
            const subs = res.data.subscriptions || [];
            if (subs.length === 0) {
                console.log('No active subscriptions.');
                return;
            }

            subs.forEach(s => {
                console.log(`- Mode: ${s.mode.padEnd(8)} | Name: ${s.name.padEnd(20)} | URL: ${s.callbackUrl}`);
            });

            const modes = subs.map(s => s.mode);
            const hasSentEvents = modes.includes('MESSAGE');
            console.log('\n--- Status Verification ---');
            console.log(`[Sent Messages]  Status: ${hasSentEvents ? '✅ SUBSCRIBED' : '❌ NOT SUBSCRIBED'}`);
            console.log(`[Failed Events]  Status: ${modes.includes('FAILED') ? '✅ SUBSCRIBED' : '❌ NOT SUBSCRIBED'}`);
            console.log(`[Billing Events] Status: ${modes.includes('BILLING') ? '✅ SUBSCRIBED' : '❌ NOT SUBSCRIBED'}`);

            if (hasSentEvents) {
                console.log('\nNote: "MESSAGE" mode receives all delivery statuses (sent, delivered, read) in Gupshup V3.');
            }
            return;
        } catch (err) {
            lastError = err;
        }
    }

    console.error('Failed to list subscriptions after trying multiple header formats.');
    console.error('Final Error:', lastError.message);
    if (lastError.response?.data) console.error('Data:', lastError.response.data);
}

checkSubscriptions();
