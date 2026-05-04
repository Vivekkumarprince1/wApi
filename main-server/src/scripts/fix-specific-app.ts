import mongoose from 'mongoose';
import { Workspace } from '../models';
import { GupshupPartnerService } from '../services/bsp/gupshup-partner-service';
import { config } from '../config';

async function fixSpecificApp(appId: string) {
    try {
        console.log(`[Fix] Starting repair for app: ${appId}`);
        if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI not found");
        await mongoose.connect(process.env.MONGODB_URI);

        console.log(`[Fix] Reparing app ${appId} with autonomous factory...`);

        // 2. Resolve webhook URL
        const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || config.baseUrl || '').replace(/\/$/, '');
        const webhookUrl = `${base}/api/webhooks/whatsapp`;
        
        console.log(`[Fix] Target Webhook: ${webhookUrl}`);

        // 3. Set subscription
        const events = ['message', 'message-status', 'user-event', 'message-event'];
        console.log(`[Fix] Setting subscription with events: ${events.join(', ')}`);
        
        const result = await GupshupPartnerService.setSubscription({
            appId,
            url: webhookUrl,
            events
        });

        console.log('[Fix] Result:', JSON.stringify(result, null, 2));
        console.log('[Fix] ✅ Repair completed successfully.');
        
        process.exit(0);
    } catch (err: any) {
        console.error('[Fix] ❌ Error:', err.message);
        process.exit(1);
    }
}

const TARGET_APP_ID = '04b436f7-8ef3-4c9e-8239-b9ca18833731';
fixSpecificApp(TARGET_APP_ID);
