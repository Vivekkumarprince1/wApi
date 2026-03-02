require('dotenv').config();
const gupshupService = require('./src/services/gupshupService');

async function dumpApp() {
    const appId = '284b5e81-749d-48f6-9e4a-94c2da9cbcca';

    try {
        const apps = await gupshupService.getPartnerApps();
        const appList = apps?.partnerAppsList || apps?.data || [];
        const app = appList.find(a => a.id === appId);

        console.log('FULL APP DETAIL:', JSON.stringify(app, null, 2));

    } catch (error) {
        console.error('❌ Error checking app:', error.message);
    }
}

dumpApp().then(() => process.exit(0));
