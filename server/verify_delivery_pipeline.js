const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });
const bspMessagingService = require('./src/services/bsp/bspMessagingService');
const { Workspace } = require('./src/models');

async function verify() {
    console.log('--- STARTING DELIVERY PIPELINE VERIFICATION ---');

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const workspace = await Workspace.findOne({ gupshupAppId: process.env.GUPSHUP_APP_ID });
        if (!workspace) {
            console.error('Workspace not found for GUPSHUP_APP_ID');
            return;
        }
        console.log(`Found workspace: ${workspace.name} (${workspace._id})`);

        // Verify Send (This will trigger prerequisites: subscriptions + health)
        console.log('\n--- ATTEMPTING TEST SEND (Text) ---');
        console.log('NOTE: This will automatically check health and subscriptions.');

        // We use a known test number if available, else we just log the attempt
        const testNumber = '919016147602'; // From previously identified logs

        try {
            const result = await bspMessagingService.sendTextMessage(
                workspace._id,
                testNumber,
                "Verification: Pipeline Refactor Complete. Webhooks and Health checks active."
            );
            console.log('Send result:', JSON.stringify(result, null, 2));
        } catch (sendErr) {
            console.error('Send failed (as expected if credentials/number invalid, but check the log for prerequisite steps):', sendErr.message);
        }

        console.log('\n--- VERIFICATION LOG SUMMARY ---');
        console.log('Check the console output above for [GupshupService] and [BSPMessagingService] logs.');
        console.log('You should see "Checking subscriptions" and health check warnings if LIMITED.');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

verify();
