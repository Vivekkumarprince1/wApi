import { Workspace } from '@/models';
import { GupshupPartnerService } from './gupshup-partner-service';
import { config } from '@/config';

/**
 * Webhook Sync Service
 * 
 * Responsibilities:
 * 1. Synchronize all active Gupshup app subscriptions with the current platform webhook URL.
 * 2. Implements "Read-before-Write" to avoid redundant API calls.
 * 3. Implements rate limiting (throttle) to avoid 429 Too Many Requests errors.
 */

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const WebhookSyncService = {
  /**
   * Safe Sync All Workspaces
   * Iterates through all workspaces with a Gupshup App and updates their webhook.
   */
  async syncAll(options: { url?: string, modes?: string[], strategy?: 'update' | 'add' | 'replace' } = {}) {
    const targetUrl = options.url || config.whatsappWebhookUrl;
    const strategy = options.strategy || 'update';
    
    if (!targetUrl || !targetUrl.startsWith('https://')) {
      throw new Error('Invalid Webhook URL. HTTPS required.');
    }

    console.log(`[WebhookSync] Starting global sync. Target URL: ${targetUrl}`);

    // Fetch workspaces that have a Gupshup App ID
    const workspaces = await Workspace.find({ 
      gupshupAppId: { $exists: true, $ne: null } 
    }).select('name gupshupAppId');

    const stats = {
      total: workspaces.length,
      synced: 0,
      skipped: 0,
      failed: 0
    };

    for (const ws of workspaces) {
      const appId = ws.gupshupAppId!;
      
      try {
        // 1. Read: Check current subscriptions to avoid redundant writes
        let currentSubs: any[];
        try {
          currentSubs = await GupshupPartnerService.listSubscriptions(appId);
        } catch (listError: any) {
          const status = listError?.response?.status;
          console.error(`[WebhookSync] Failed to list subscriptions for ${ws.name} (${appId}). Status: ${status}`);
          stats.failed++;
          continue;
        }

        const requiredEvents = (options.modes && options.modes.length > 0)
          ? options.modes.map(e => e.toUpperCase())
          : ['MESSAGE', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'ENQUEUED', 'TEMPLATE', 'ACCOUNT', 'BILLING', 'PAYMENTS', 'FLOWS_MESSAGE'];

        const matchingSub = Array.isArray(currentSubs) && currentSubs.find((s: any) => s.url === targetUrl);
        const hasAllEvents = matchingSub && requiredEvents.every(ev => (matchingSub.modes || matchingSub.events || []).includes(ev));

        // Skip check only for 'update' strategy. 'add' and 'replace' always execute.
        if (strategy === 'update' && hasAllEvents) {
          console.log(`[WebhookSync] Skip: ${ws.name} (${appId}) is already fully synced.`);
          stats.skipped++;
          continue;
        }

        // 2. Write: Update subscription
        console.log(`[WebhookSync] Processing: ${ws.name} (${appId}) -> ${targetUrl} [Strategy: ${strategy}]`);
        await GupshupPartnerService.setSubscription({
          appId,
          url: targetUrl,
          events: requiredEvents,
          strategy: strategy as any
        });

        stats.synced++;
        console.log(`[WebhookSync] ✓ Successfully synced ${ws.name} (${appId})`);

        // 3. Throttle: Avoid 429 Too Many Requests (Gupshup limit is usually quite generous but safe is better)
        await sleep(1000); 

      } catch (error: any) {
        const status = error?.response?.status;
        const errorMsg = error?.response?.data?.message || error?.message;
        console.error(`[WebhookSync] Failed for ${ws.name} (${appId}). Status: ${status}, Error: ${errorMsg}`);
        stats.failed++;
        
        // If we hit a rate limit, sleep longer
        if (status === 429) {
          console.warn('[WebhookSync] Rate limit hit. Cooling down for 10 seconds...');
          await sleep(10000);
        }
      }
    }

    console.log(`[WebhookSync] Completed. Stats:`, stats);
    return stats;
  }
};
