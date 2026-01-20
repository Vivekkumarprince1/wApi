/**
 * Webhook Queue Service
 * Async processing of Meta webhooks via BullMQ
 * Ensures fast response to Meta + reliable processing
 * 
 * TASK C: Webhook Idempotency
 * - Store processed webhook IDs (message_id, status_id)
 * - Ignore duplicates safely
 * - Runs inside async worker, not request thread
 */

let Queue, Worker;

try {
  ({ Queue, Worker } = require('bullmq'));
} catch (err) {
  console.warn('[WebhookQueue] BullMQ not installed. Install with: npm install bullmq');
}

let webhookQueue = null;
let webhookWorker = null;
let redisClient = null; // For idempotency checks

// =============================================================================
// TASK C: IDEMPOTENCY TRACKING
// =============================================================================

// TTL for processed webhook IDs (24 hours)
const IDEMPOTENCY_TTL = 24 * 60 * 60;

/**
 * Generate idempotency key from webhook payload
 * Extracts message_id or status_id for deduplication
 * @param {Object} payload - Webhook payload
 * @returns {string|null} - Idempotency key or null
 */
function extractIdempotencyKey(payload) {
  try {
    const entry = payload?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    
    if (!value) return null;
    
    // Extract message_id for incoming messages
    if (value.messages && value.messages.length > 0) {
      const messageId = value.messages[0].id;
      if (messageId) return `msg:${messageId}`;
    }
    
    // Extract status_id for message status updates
    if (value.statuses && value.statuses.length > 0) {
      const status = value.statuses[0];
      const statusKey = `${status.id}:${status.status}`;
      if (status.id) return `status:${statusKey}`;
    }
    
    // For other webhook types, use a hash of the payload
    const crypto = require('crypto');
    const payloadHash = crypto.createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .substring(0, 16);
    return `hash:${payloadHash}`;
    
  } catch (err) {
    console.warn('[WebhookQueue] Could not extract idempotency key:', err.message);
    return null;
  }
}

/**
 * Check if webhook has already been processed
 * @param {string} idempotencyKey - Unique webhook identifier
 * @returns {Promise<boolean>} - True if already processed
 */
async function isWebhookProcessed(idempotencyKey) {
  if (!redisClient || !idempotencyKey) return false;
  
  try {
    const exists = await redisClient.exists(`webhook:processed:${idempotencyKey}`);
    return exists === 1;
  } catch (err) {
    console.warn('[WebhookQueue] Idempotency check failed:', err.message);
    return false; // Allow processing on error
  }
}

/**
 * Mark webhook as processed
 * @param {string} idempotencyKey - Unique webhook identifier
 */
async function markWebhookProcessed(idempotencyKey) {
  if (!redisClient || !idempotencyKey) return;
  
  try {
    await redisClient.set(
      `webhook:processed:${idempotencyKey}`,
      Date.now().toString(),
      'EX',
      IDEMPOTENCY_TTL
    );
  } catch (err) {
    console.warn('[WebhookQueue] Failed to mark webhook processed:', err.message);
  }
}

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
    
    // Store redis client for idempotency checks (Task C)
    redisClient = redisConnection;
    
    console.log('[WebhookQueue] ✅ Queue initialized with idempotency support');
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
 * TASK C: Includes idempotency checks inside worker
 */
function startWebhookWorker(redisConnection) {
  if (!Queue || !Worker) {
    console.error('[WebhookQueue] BullMQ not available - cannot start worker');
    return null;
  }

  // Store redis client for idempotency if not already set
  if (!redisClient) {
    redisClient = redisConnection;
  }

  try {
    webhookWorker = new Worker('webhooks', async (job) => {
      const { processWhatsAppWebhook } = require('../controllers/metaWebhookController');

      console.log(`[WebhookQueue] ⚙️  Processing job ${job.id} (attempt ${job.attemptsMade + 1}/5)`);

      // TASK C: Idempotency check - skip if already processed
      const idempotencyKey = extractIdempotencyKey(job.data.payload);
      if (idempotencyKey) {
        const alreadyProcessed = await isWebhookProcessed(idempotencyKey);
        if (alreadyProcessed) {
          console.log(`[WebhookQueue] ⏭️  Skipping duplicate webhook ${idempotencyKey}`);
          return { skipped: true, reason: 'duplicate', idempotencyKey };
        }
      }

      try {
        await processWhatsAppWebhook(job.data.payload, job.data.signature);
        
        // TASK C: Mark as processed after successful processing
        if (idempotencyKey) {
          await markWebhookProcessed(idempotencyKey);
        }
        
        console.log(`[WebhookQueue] ✅ Job ${job.id} completed`);
        return { success: true, idempotencyKey };
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
  stopWebhookWorker,
  // TASK C: Idempotency helpers (for external use if needed)
  extractIdempotencyKey,
  isWebhookProcessed,
  markWebhookProcessed
};
