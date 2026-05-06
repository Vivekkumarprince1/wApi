import { initWebhookWorker } from "./messaging/webhook-processor";
import { SnoozeWorker } from "./messaging/snooze-worker";
import { IntegrationSyncWorker } from "./integrations/integration-sync-worker";
import { initImportWorker } from "../workers/importWorker";
import { initBulkMessageWorker } from "../workers/bulkMessageWorker";

/**
 * Worker Registry
 * 
 * Central entry point to initialize all background BullMQ workers.
 */

const globalWorkerReg = global as unknown as {
  __workersInitialized?: boolean;
  _importWorker?: any;
  _bulkMessageWorker?: any;
  _snoozeWorker?: any;
  _integrationSyncWorker?: any;
};

export function initWorkers() {
  if (globalWorkerReg.__workersInitialized) return;
  globalWorkerReg.__workersInitialized = true;

  // 1. Import Engine
  if (!globalWorkerReg._importWorker) {
    globalWorkerReg._importWorker = initImportWorker();
    console.log("[WorkerRegistry] Import Worker initialized.");
  }

  // 2. Bulk Messaging
  if (!globalWorkerReg._bulkMessageWorker) {
    globalWorkerReg._bulkMessageWorker = initBulkMessageWorker();
    console.log("[WorkerRegistry] Bulk Message Worker initialized.");
  }

  // 3. Webhook Processor
  initWebhookWorker();
  console.log("[WorkerRegistry] Webhook Processor initialized.");

  // 4. Snooze Monitor
  if (!globalWorkerReg._snoozeWorker) {
    globalWorkerReg._snoozeWorker = new SnoozeWorker();
    console.log("[WorkerRegistry] Snooze Worker initialized.");
  }

  // 5. Integration Sync Worker
  if (!globalWorkerReg._integrationSyncWorker) {
    globalWorkerReg._integrationSyncWorker = new IntegrationSyncWorker();
    console.log("[WorkerRegistry] Integration Sync Worker initialized.");
  }

  console.log("[WorkerRegistry] All background workers initialized.");
}
