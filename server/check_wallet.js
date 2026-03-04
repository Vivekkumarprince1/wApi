const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const gupshupService = require('./src/services/bsp/gupshupService');
const { connectRedis } = require('./src/config/redis');
const axios = require('axios');
const bspConfig = require('./src/config/bspConfig');

dotenv.config({ path: path.join(__dirname, '.env') });

async function check() {
    try {
        await connectRedis().catch(() => { });
        const appId = '83145d5d-e470-4893-a52c-7f4a2720f96d';

        console.log('Fetching Wallet Balance...');
        try {
            const balance = await gupshupService.withPartnerAuth(async (headers) => {
                const url = `${bspConfig.partnerBaseUrl}/partner/app/${appId}/wallet/balance`;
                const res = await axios.get(url, { headers });
                return res.data;
            });
            console.log('Wallet Balance:', JSON.stringify(balance, null, 2));
        } catch (e) {
            console.error('Failed to fetch wallet balance:', e.response?.data || e.message);
        }

        console.log('\nRetrying Whitelist with Partner Token...');
        try {
            const res = await gupshupService.withPartnerAuth(async (headers) => {
                const url = `${bspConfig.partnerBaseUrl}/partner/app/${appId}/obotoembed/whitelist`;
                const res = await axios.post(url, {}, { headers });
                return res.data;
            });
            console.log('Whitelist Response (Partner Token):', JSON.stringify(res, null, 2));
        } catch (e) {
            console.error('Whitelist failed even with Partner Token:', e.response?.data || e.message);
        }

    } catch (error) {
        console.error('Global Error:', error.message);
    }
    process.exit(0);
}

check();
