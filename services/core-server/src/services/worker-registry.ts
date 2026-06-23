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
const CORE_WORKER_PROFILE = process.env.CORE_WORKER_PROFILE || (process.env.NODE_ENV === 'production' ? 'webhooks' : 'all');

function workerEnabled(name: 'import' | 'bulk' | 'webhook' | 'snooze' | 'integration') {
  if (CORE_WORKER_PROFILE === 'none') return false;
  if (CORE_WORKER_PROFILE === 'all') return true;
  if (CORE_WORKER_PROFILE === 'webhooks') return name === 'webhook';
  return CORE_WORKER_PROFILE.split(',').map((part) => part.trim()).includes(name);
}

function startWebhookFailureMonitor() {
  if (!workerEnabled('webhook')) return;
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

  logger.info('Core worker profile selected', { profile: CORE_WORKER_PROFILE });

  if (workerEnabled('import') && !globalWorkerReg._importWorker) {
    globalWorkerReg._importWorker = initImportWorker();
    logger.info('Import Worker initialized');
  }

  if (workerEnabled('bulk') && !globalWorkerReg._bulkMessageWorker) {
    globalWorkerReg._bulkMessageWorker = initBulkMessageWorker();
    logger.info('Bulk Message Worker initialized');
  }

  if (workerEnabled('webhook')) {
    initWebhookWorker();
    logger.info('Webhook Processor initialized');
  }

  if (workerEnabled('snooze') && !globalWorkerReg._snoozeWorker) {
    globalWorkerReg._snoozeWorker = new SnoozeWorker();
    logger.info('Snooze Worker initialized');
  }

  if (workerEnabled('integration') && !globalWorkerReg._integrationSyncWorker) {
    globalWorkerReg._integrationSyncWorker = new IntegrationSyncWorker();
    logger.info('Integration Sync Worker initialized');
  }

  startWebhookFailureMonitor();
  logger.info('All background workers initialized');
}
