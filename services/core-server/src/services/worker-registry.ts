import { initWebhookWorker } from "./messaging/webhook-processor";
import { SnoozeWorker } from "./messaging/snooze-worker";
import { IntegrationSyncWorker } from "./integrations/integration-sync-worker";
import { initImportWorker } from "../workers/importWorker";
import { initBulkMessageWorker } from "../workers/bulkMessageWorker";
import { getStaleFailedJobs } from "./messaging/webhook-queue";
import { logger } from "../utils/logger";

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
  _webhookFailureMonitor?: NodeJS.Timeout;
};

const WEBHOOK_FAILURE_CHECK_MS = Number(process.env.WEBHOOK_FAILURE_CHECK_MS || 60_000);
const WEBHOOK_FAILURE_AGE_MS = Number(process.env.WEBHOOK_FAILURE_AGE_MS || 5 * 60 * 1000);

function startWebhookFailureMonitor() {
  if (globalWorkerReg._webhookFailureMonitor) return;
  globalWorkerReg._webhookFailureMonitor = setInterval(async () => {
    try {
      const stale = await getStaleFailedJobs(WEBHOOK_FAILURE_AGE_MS);
      if (stale.length > 0) {
        logger.error('webhook queue has stale failed jobs', {
          count: stale.length,
          oldestAgeMs: Math.max(...stale.map((j) => j.ageMs || 0)),
          sample: stale.slice(0, 3).map((j) => ({ id: j.id, reason: j.failedReason })),
        });
      }
    } catch (err: any) {
      logger.warn('webhook failure monitor poll error', { error: err?.message });
    }
  }, WEBHOOK_FAILURE_CHECK_MS).unref?.();
}

export function initWorkers() {
  if (globalWorkerReg.__workersInitialized) return;
  globalWorkerReg.__workersInitialized = true;

  if (!globalWorkerReg._importWorker) {
    globalWorkerReg._importWorker = initImportWorker();
    logger.info('Import Worker initialized');
  }

  if (!globalWorkerReg._bulkMessageWorker) {
    globalWorkerReg._bulkMessageWorker = initBulkMessageWorker();
    logger.info('Bulk Message Worker initialized');
  }

  initWebhookWorker();
  logger.info('Webhook Processor initialized');

  if (!globalWorkerReg._snoozeWorker) {
    globalWorkerReg._snoozeWorker = new SnoozeWorker();
    logger.info('Snooze Worker initialized');
  }

  if (!globalWorkerReg._integrationSyncWorker) {
    globalWorkerReg._integrationSyncWorker = new IntegrationSyncWorker();
    logger.info('Integration Sync Worker initialized');
  }

  startWebhookFailureMonitor();
  logger.info('All background workers initialized');
}
