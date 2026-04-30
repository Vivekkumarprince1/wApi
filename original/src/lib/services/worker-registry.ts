// import { CampaignWorker } from "./marketing/campaign-worker";
import { initWebhookWorker } from "./messaging/webhook-processor";
import { SnoozeWorker } from "./messaging/snooze-worker";
import { AnswerBotCrawlWorker } from "./automation/answerbot-crawl-worker";
import { IntegrationSyncWorker } from "./integrations/integration-sync-worker";
// import { BillingWorker } from "./billing/billing-worker";
// import { BillingQueueService } from "./billing/billing-queue";


/**
 * Worker Registry
 * 
 * Central entry point to initialize all background BullMQ workers.
 * Required for the custom Next.js server to process background tasks.
 * 
 * NOTE: Campaign CRUD/API and EXECUTION (BullMQ worker) are handled by campaign-service.
 *       The monolith provides low-level primitives via the Worker Bridge.
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

  // 1. Campaign Engine (MOVED TO CAMPAIGN-SERVICE MICROSERVICE)
  /*
  if (!globalWorkerReg._campaignWorker) {
    globalWorkerReg._campaignWorker = new CampaignWorker();
    
    const { CampaignQueueService } = require("./marketing/campaign-queue");
    CampaignQueueService.startMaintenance().catch((err: any) => {
      console.error('[WorkerRegistry] Failed to start campaign maintenance:', err);
    });
  }
  */
  
  // 2. Webhook Processor
  const webhookWorker = initWebhookWorker();

  // 3. Snooze Monitor
  if (!globalWorkerReg._snoozeWorker) globalWorkerReg._snoozeWorker = new SnoozeWorker();

  // 4. Integration Sync Worker
  if (!globalWorkerReg._integrationSyncWorker) globalWorkerReg._integrationSyncWorker = new IntegrationSyncWorker();

  // 5. Billing & Autopay Worker (MOVED TO BILLING-SERVICE MICROSERVICE)
  /*
  if (!globalWorkerReg._billingWorker) {
    globalWorkerReg._billingWorker = new BillingWorker();
    
    BillingQueueService.startRenewalCycle().catch((err: any) => {
      console.error('[WorkerRegistry] Failed to start billing renewal cycle:', err);
    });
  }
  */

}
