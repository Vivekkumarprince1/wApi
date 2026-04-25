import { CampaignWorker } from "./marketing/campaign-worker";
import { initWebhookWorker } from "./messaging/webhook-processor";
import { SnoozeWorker } from "./messaging/snooze-worker";
import { AnswerBotCrawlWorker } from "./automation/answerbot-crawl-worker";
import { IntegrationSyncWorker } from "./integrations/integration-sync-worker";
import { BillingWorker } from "./billing/billing-worker";
import { BillingQueueService } from "./billing/billing-queue";

/**
 * Worker Registry
 * 
 * Central entry point to initialize all background BullMQ workers.
 * Required for the custom Next.js server to process background tasks.
 */

const globalWorkerReg = global as unknown as {
  __workersInitialized?: boolean;
  _campaignWorker?: any;
  _snoozeWorker?: any;
  _answerBotCrawlWorker?: any;
  _integrationSyncWorker?: any;
  _billingWorker?: any;
};

export function initWorkers() {
  if (globalWorkerReg.__workersInitialized) return;
  globalWorkerReg.__workersInitialized = true;
  
  console.log('[WorkerRegistry] ⚙️ Initializing background workers...');

  // 1. Campaign Engine
  if (!globalWorkerReg._campaignWorker) {
    globalWorkerReg._campaignWorker = new CampaignWorker();
    
    // Initialize maintenance cycle
    const { CampaignQueueService } = require("./marketing/campaign-queue");
    CampaignQueueService.startMaintenance().catch((err: any) => {
      console.error('[WorkerRegistry] Failed to start campaign maintenance:', err);
    });
  }
  
  // 2. Webhook Processor (Singleton pattern)
  const webhookWorker = initWebhookWorker();
  console.log(`[WorkerRegistry] 🚀 Webhook worker started: ${webhookWorker.name}`);

  // 3. Snooze Monitor
  if (!globalWorkerReg._snoozeWorker) globalWorkerReg._snoozeWorker = new SnoozeWorker();

  // 5. Integration Sync Worker
  if (!globalWorkerReg._integrationSyncWorker) globalWorkerReg._integrationSyncWorker = new IntegrationSyncWorker();

  // 6. Billing & Autopay Worker
  if (!globalWorkerReg._billingWorker) {
    globalWorkerReg._billingWorker = new BillingWorker();
    
    // Start the daily renewal check cycle
    BillingQueueService.startRenewalCycle().catch((err: any) => {
      console.error('[WorkerRegistry] Failed to start billing renewal cycle:', err);
    });
  }

  console.log('[WorkerRegistry] ✅ All workers initialized.');
}
