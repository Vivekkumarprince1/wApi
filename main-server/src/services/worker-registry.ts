import { initWebhookWorker } from "./messaging/webhook-processor";
import { SnoozeWorker } from "./messaging/snooze-worker";
import { IntegrationSyncWorker } from "./integrations/integration-sync-worker";
import { initImportWorker } from "../workers/importWorker";

/**
 * Worker Registry
 * 
 * Central entry point to initialize all background BullMQ workers.
 */

const globalWorkerReg = global as unknown as {
  __workersInitialized?: boolean;
  _importWorker?: any;
  _snoozeWorker?: any;
  _integrationSyncWorker?: any;
};

export function initWorkers() {
  if (globalWorkerReg.__workersInitialized) return;
  globalWorkerReg.__workersInitialized = true;

  // 1. Import Engine
  if (!globalWorkerReg._importWorker) globalWorkerReg._importWorker = initImportWorker();

  // 2. Webhook Processor
  initWebhookWorker();

  // 3. Snooze Monitor
  if (!globalWorkerReg._snoozeWorker) globalWorkerReg._snoozeWorker = new SnoozeWorker();

  // 4. Integration Sync Worker
  if (!globalWorkerReg._integrationSyncWorker) globalWorkerReg._integrationSyncWorker = new IntegrationSyncWorker();

  console.log("[WorkerRegistry] All background workers initialized.");
}
