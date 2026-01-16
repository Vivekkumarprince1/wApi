/**
 * Webhook Queue Service
 * Async processing of Meta webhooks via BullMQ
 * Ensures fast response to Meta + reliable processing
 */

let Queue, Worker;

try {
  ({ Queue, Worker } = require('bullmq'));
} catch (err) {
  console.warn('[WebhookQueue] BullMQ not installed. Install with: npm install bullmq');
}

let webhookQueue = null;
let webhookWorker = null;

/**
 * Initialize webhook queue
 * Must be called after Redis is ready
 */
async function initializeWebhookQueue(redisConnection) {
  if (!Queue || !Worker) {
    console.error('[WebhookQueue] BullMQ not available - webhooks will be processed synchronously');
    return null;
  }

  try {
    webhookQueue = new Queue('webhooks', { connection: redisConnection });
    console.log('[WebhookQueue] ✅ Queue initialized');
    return webhookQueue;
  } catch (err) {
    console.error('[WebhookQueue] Failed to initialize:', err.message);
    return null;
  }
}

/**
 * Enqueue webhook for async processing
 */
async function enqueueWebhook(payload, signature, priority = 'normal') {
  if (!webhookQueue) {
    console.warn('[WebhookQueue] Queue not initialized - processing synchronously');
    return null;
  }

  try {
    const priorityMap = {
      high: 1,      // Messages
      normal: 5,    // Status updates
      low: 10       // Other events
    };

    const job = await webhookQueue.add('process', {
      payload,
      signature,
      receivedAt: new Date().toISOString()
    }, {
      priority: priorityMap[priority] || 5,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: {
        age: 24 * 3600 // Remove after 24 hours
      },
      removeOnFail: {
        age: 7 * 24 * 3600 // Keep failures for 7 days
      }
    });

    console.log(`[WebhookQueue] 📨 Queued job ${job.id} (priority: ${priority})`);
    return job;
  } catch (err) {
    console.error('[WebhookQueue] Enqueue failed:', err.message);
    return null;
  }
}

/**
 * Start webhook worker
 * Processes queued webhooks with concurrency control
 */
function startWebhookWorker(redisConnection) {
  if (!Queue || !Worker) {
    console.error('[WebhookQueue] BullMQ not available - cannot start worker');
    return null;
  }

  try {
    webhookWorker = new Worker('webhooks', async (job) => {
      const { processWhatsAppWebhook } = require('../controllers/metaWebhookController');

      console.log(`[WebhookQueue] ⚙️  Processing job ${job.id} (attempt ${job.attemptsMade + 1}/5)`);

      try {
        await processWhatsAppWebhook(job.data.payload, job.data.signature);
        console.log(`[WebhookQueue] ✅ Job ${job.id} completed`);
      } catch (err) {
        console.error(`[WebhookQueue] ❌ Job ${job.id} failed:`, err.message);
        throw err; // Will trigger retry
      }
    }, {
      connection: redisConnection,
      concurrency: 10, // Process max 10 webhooks in parallel
      limiter: {
        max: 100,
        duration: 1000 // Max 100 jobs/sec
      }
    });

    // Event handlers
    webhookWorker.on('completed', (job) => {
      console.log(`[WebhookQueue] ✅ Job ${job.id} succeeded`);
    });

    webhookWorker.on('failed', (job, err) => {
      console.error(`[WebhookQueue] ❌ Job ${job.id} failed after ${job.attemptsMade} attempts:`, err.message);

      // Could send alert here if max retries reached
      if (job.attemptsMade >= 5) {
        console.error(`[WebhookQueue] 🚨 Job ${job.id} moved to dead letter queue`);
      }
    });

    webhookWorker.on('stalled', (job) => {
      console.warn(`[WebhookQueue] ⚠️  Job ${job.id} stalled (will retry)`);
    });

    console.log('[WebhookQueue] 🚀 Worker started');
    return webhookWorker;
  } catch (err) {
    console.error('[WebhookQueue] Failed to start worker:', err.message);
    return null;
  }
}

/**
 * Get queue stats
 */
async function getQueueStats() {
  if (!webhookQueue) return null;

  try {
    const counts = await webhookQueue.getJobCounts();
    return {
      active: counts.active,
      completed: counts.completed,
      failed: counts.failed,
      delayed: counts.delayed,
      waiting: counts.waiting
    };
  } catch (err) {
    console.error('[WebhookQueue] Stats fetch failed:', err.message);
    return null;
  }
}

/**
 * Stop worker gracefully
 */
async function stopWebhookWorker() {
  if (webhookWorker) {
    await webhookWorker.close();
    console.log('[WebhookQueue] 🛑 Worker stopped');
  }
}

module.exports = {
  initializeWebhookQueue,
  enqueueWebhook,
  startWebhookWorker,
  getQueueStats,
  stopWebhookWorker
};
