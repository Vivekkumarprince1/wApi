const Queue = require('bull');
const { logger } = require('../utils/logger');
const AuditLog = require('../models/AuditLog');

/**
 * MESSAGE RETRY QUEUE SERVICE
 * 
 * Risk: If message send fails, customer sees failure immediately. No retry means lost messages.
 * Interakt Approach:
 * 1. When message send fails, enqueue to retry queue
 * 2. Retry with exponential backoff: 1m, 5m, 15m, 1h
 * 3. Track retry count + last error
 * 4. After max retries, move to dead letter queue
 * 5. Operator can manually retry or investigate
 * 
 * Implementation:
 * - Queue: BullMQ (same as webhookQueue)
 * - Workers: 5 concurrent retry processors
 * - Backoff: exponential (1m, 5m, 15m, 1h)
 * - Max retries: 4
 */

let messageRetryQueue = null;
let messageRetryWorker = null;

/**
 * Initialize message retry queue
 * Called from server.js after Redis connection
 */
function initializeMessageRetryQueue(redisConnection) {
  if (messageRetryQueue) {
    logger.warn('[MessageRetryQueue] Already initialized');
    return messageRetryQueue;
  }

  const queueName = `message-retry:${process.env.NODE_ENV || 'dev'}`;

  messageRetryQueue = new Queue(queueName, {
    redis: redisConnection,
    settings: {
      // Max workers processing simultaneously
      maxStalledCount: 2,
      lockDuration: 30000, // 30 seconds
      lockRenewTime: 15000, // 15 seconds
    },
  });

  messageRetryQueue.on('error', (err) => {
    logger.error('[MessageRetryQueue] Queue error:', err);
  });

  logger.info(`[MessageRetryQueue] ✅ Queue initialized: ${queueName}`);
  return messageRetryQueue;
}

/**
 * Start worker to process retry jobs
 */
function startMessageRetryWorker(redisConnection) {
  if (messageRetryWorker) {
    logger.warn('[MessageRetryQueue] Worker already started');
    return messageRetryWorker;
  }

  const queueName = `message-retry:${process.env.NODE_ENV || 'dev'}`;

  messageRetryQueue = new Queue(queueName, {
    redis: redisConnection,
    settings: {
      maxStalledCount: 2,
      lockDuration: 30000,
      lockRenewTime: 15000,
    },
  });

  // Process jobs with 5 concurrent workers
  messageRetryQueue.process(5, async (job) => {
    return processMessageRetry(job);
  });

  messageRetryQueue.on('completed', (job) => {
    logger.info(`[MessageRetryQueue] Job completed:`, {
      jobId: job.id,
      messageId: job.data.messageId,
    });
  });

  messageRetryQueue.on('failed', (job, err) => {
    logger.error(`[MessageRetryQueue] Job failed:`, {
      jobId: job.id,
      messageId: job.data.messageId,
      error: err.message,
      attempts: job.attemptsMade,
    });
  });

  messageRetryWorker = messageRetryQueue;
  logger.info(`[MessageRetryQueue] ✅ Worker started with 5 concurrent processors`);

  return messageRetryWorker;
}

/**
 * Enqueue failed message for retry
 * Called by metaWebhookController when message send fails
 * 
 * Retry delays: 1m, 5m, 15m, 1h (exponential backoff)
 */
async function enqueueRetry(messageData, lastError, retryCount = 0) {
  if (!messageRetryQueue) {
    logger.warn('[MessageRetryQueue] Queue not initialized, skipping retry');
    return null;
  }

  const maxRetries = 4;

  // Calculate exponential backoff delay (in ms)
  const delayMs = calculateBackoffDelay(retryCount);

  try {
    const job = await messageRetryQueue.add(
      {
        messageId: messageData._id || messageData.id,
        workspaceId: messageData.workspaceId,
        recipientPhone: messageData.recipientPhone,
        messageBody: messageData.messageBody,
        templateId: messageData.templateId,
        mediaUrl: messageData.mediaUrl,
        lastError,
        retryCount,
        maxRetries,
        originalTimestamp: messageData.timestamp,
      },
      {
        attempts: 1, // We control retries manually with delayed re-enqueue
        delay: delayMs,
        backoff: {
          type: 'exponential',
          delay: delayMs,
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    logger.info(`[MessageRetryQueue] Message enqueued for retry:`, {
      messageId: messageData._id || messageData.id,
      retryCount,
      delaySeconds: delayMs / 1000,
      jobId: job.id,
    });

    // Audit log
    await AuditLog.create({
      workspaceId: messageData.workspaceId,
      entityType: 'message',
      entityId: messageData._id || messageData.id,
      action: 'retry_enqueued',
      details: {
        retryCount,
        delaySeconds: delayMs / 1000,
        lastError,
        jobId: job.id,
      },
      status: 'warning',
    });

    return job;
  } catch (error) {
    logger.error('[MessageRetryQueue] Failed to enqueue retry:', {
      messageId: messageData._id || messageData.id,
      error: error.message,
    });
    throw error;
  }
}

/**
 * INTERNAL: Process individual retry job
 * Called by worker
 */
async function processMessageRetry(job) {
  const data = job.data;
  const { messageId, workspaceId, recipientPhone, maxRetries } = data;

  logger.info(`[MessageRetryQueue] Processing retry job:`, {
    messageId,
    attempt: data.retryCount + 1,
    maxRetries,
  });

  try {
    // Get metaAutomationService to send message
    const metaAutomationService = require('./metaAutomationService');
    const Workspace = require('../models/Workspace');

    // Get workspace and token
    const workspace = await Workspace.findById(workspaceId).select('esbFlow phoneNumbers');
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const secretsManager = require('./secretsManager');
    const accessToken = await secretsManager.retrieveToken(
      workspaceId.toString()
    );

    if (!accessToken) {
      throw new Error('Access token not found');
    }

    // Retry sending message
    const phoneNumberId = workspace.phoneNumbers[0]?.phone_number_id;
    let result;

    if (data.templateId) {
      // Template-based message
      result = await metaAutomationService.sendTemplateMessage(
        accessToken,
        phoneNumberId,
        recipientPhone,
        data.templateId
      );
    } else {
      // Text message
      result = await metaAutomationService.sendTextMessage(
        accessToken,
        phoneNumberId,
        recipientPhone,
        data.messageBody
      );
    }

    // Mark message as sent
    const Message = require('../models/Message');
    await Message.findByIdAndUpdate(messageId, {
      $set: {
        status: 'sent',
        sentAt: new Date(),
        metaMessageId: result.messages[0].id,
      },
    });

    // Audit log
    await AuditLog.create({
      workspaceId,
      entityType: 'message',
      entityId: messageId,
      action: 'retry_success',
      details: {
        retryCount: data.retryCount,
        metaMessageId: result.messages[0].id,
      },
      status: 'success',
    });

    logger.info(`[MessageRetryQueue] Message sent successfully on retry:`, {
      messageId,
      retryCount: data.retryCount,
      metaMessageId: result.messages[0].id,
    });

    return { success: true, retryCount: data.retryCount };
  } catch (error) {
    logger.warn(`[MessageRetryQueue] Retry attempt failed:`, {
      messageId,
      retryCount: data.retryCount,
      error: error.message,
    });

    // If max retries reached, move to dead letter queue
    if (data.retryCount >= maxRetries - 1) {
      await AuditLog.create({
        workspaceId: data.workspaceId,
        entityType: 'message',
        entityId: messageId,
        action: 'retry_exhausted',
        details: {
          finalError: error.message,
          totalAttempts: data.retryCount + 1,
        },
        status: 'critical',
      });

      logger.error(`[MessageRetryQueue] Max retries exhausted, moving to dead letter:`, {
        messageId,
        totalAttempts: data.retryCount + 1,
      });

      // TODO: Move to dead letter queue for manual investigation
      return {
        success: false,
        deadLetter: true,
        error: error.message,
      };
    }

    // Re-enqueue for next retry attempt
    const nextRetryCount = data.retryCount + 1;
    const delayMs = calculateBackoffDelay(nextRetryCount);

    await messageRetryQueue.add(
      {
        ...data,
        lastError: error.message,
        retryCount: nextRetryCount,
      },
      {
        delay: delayMs,
      }
    );

    logger.info(`[MessageRetryQueue] Message re-enqueued for next attempt:`, {
      messageId,
      nextAttempt: nextRetryCount + 1,
      delaySeconds: delayMs / 1000,
    });

    throw error; // Mark job as failed, but it will be retried
  }
}

/**
 * INTERNAL: Calculate exponential backoff delay
 * Attempts: 1m, 5m, 15m, 1h
 */
function calculateBackoffDelay(retryCount) {
  const delays = [
    60 * 1000,        // 1 minute
    5 * 60 * 1000,    // 5 minutes
    15 * 60 * 1000,   // 15 minutes
    60 * 60 * 1000,   // 1 hour
  ];

  return delays[Math.min(retryCount, delays.length - 1)];
}

/**
 * Get queue stats for monitoring
 */
async function getQueueStats() {
  if (!messageRetryQueue) {
    return { error: 'Queue not initialized' };
  }

  const [waiting, active, delayed, failed, completed] = await Promise.all([
    messageRetryQueue.getWaitingCount(),
    messageRetryQueue.getActiveCount(),
    messageRetryQueue.getDelayedCount(),
    messageRetryQueue.getFailedCount(),
    messageRetryQueue.getCompletedCount(),
  ]);

  return {
    waiting,
    active,
    delayed,
    failed,
    completed,
    total: waiting + active + delayed + failed + completed,
  };
}

module.exports = {
  initializeMessageRetryQueue,
  startMessageRetryWorker,
  enqueueRetry,
  getQueueStats,
};
