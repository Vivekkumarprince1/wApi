const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const gupshupService = require('./src/services/bsp/gupshupService');
const { connectRedis } = require('./src/config/redis');

dotenv.config({ path: path.join(__dirname, '.env') });

async function check() {
    try {
        await connectRedis().catch(() => { });
        const appId = '83145d5d-e470-4893-a52c-7f4a2720f96d';

        console.log('Fetching WABA Info...');
        try {
            const wabaInfo = await gupshupService.getWabaInfo(appId);
            console.log('WABA Info:', JSON.stringify(wabaInfo, null, 2));
        } catch (e) {
            console.error('Failed to fetch WABA info:', e.response?.data || e.message);
        }

        console.log('\nChecking App Health...');
        try {
            const health = await gupshupService.stopApp(appId).catch(async () => {
                // getPartnerApps or something
            });
            // Actually let's just use axios directly for health if not available
            const url = `https://partner.gupshup.io/partner/app/${appId}/health`;
            const token = await gupshupService.resolveAppToken(appId, null);
            const axios = require('axios');
            const res = await axios.get(url, { headers: { Authorization: token } });
            console.log('Health Status:', JSON.stringify(res.data, null, 2));
        } catch (e) {
            console.error('Failed to fetch health:', e.response?.data || e.message);
        }

    } catch (error) {
        console.error('Global Error:', error.message);
    }
    process.exit(0);
}

check();
