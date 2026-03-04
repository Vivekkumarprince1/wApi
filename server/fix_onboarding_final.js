const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const gupshupService = require('./src/services/bsp/gupshupService');
const { connectRedis } = require('./src/config/redis');
const axios = require('axios');
const bspConfig = require('./src/config/bspConfig');

dotenv.config({ path: path.join(__dirname, '.env') });

async function fix() {
    try {
        await connectRedis().catch(() => { });
        const appId = '83145d5d-e470-4893-a52c-7f4a2720f96d';
        const wabaId = '743706951952362';

        console.log('\n--- Finalizing Onboarding (Enhanced) ---');

        console.log('Step 1: Whitelisting WABA ID...');

        // Attempt 1: Standard (No body)
        try {
            console.log('   Attempt 1: No body...');
            const res = await gupshupService.whitelistWaba(appId);
            console.log('   Success!', JSON.stringify(res, null, 2));
        } catch (e1) {
            console.warn('   Attempt 1 failed:', e1.response?.data || e1.message);

            // Attempt 2: With WABA ID in body
            try {
                console.log('   Attempt 2: With WABA ID in body...');
                const res = await gupshupService.withPartnerAuth(async (headers) => {
                    const url = `${bspConfig.partnerBaseUrl}/partner/app/${appId}/obotoembed/whitelist`;
                    const res = await axios.post(url, { wabaId }, { headers });
                    return res.data;
                });
                console.log('   Success (with WABA ID)!', JSON.stringify(res, null, 2));
            } catch (e2) {
                console.error('   Attempt 2 failed:', e2.response?.data || e2.message);
            }
        }

        console.log('\nStep 2: Verifying and Attaching Credit Line...');
        try {
            const res = await gupshupService.verifyAndAttachCreditLine(appId);
            console.log('   Success!', JSON.stringify(res, null, 2));
        } catch (e) {
            console.error('   ❌ Step 2 failed:', e.response?.data || e.message);
        }

    } catch (error) {
        console.error('Global Error:', error.message);
    }
    process.exit(0);
}

fix();
