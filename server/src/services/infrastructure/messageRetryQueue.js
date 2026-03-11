const Queue = require('bull');
const logger = require('../../utils/logger');
const { AuditLog, Message } = require('../../models');
const bspMessagingService = require('../bsp/bspMessagingService');

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
 * Called by gupshupWebhookController when message send fails
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
      workspace: messageData.workspaceId,
      action: 'message.retry_enqueued',
      resource: {
        type: 'message',
        id: messageData._id || messageData.id
      },
      details: {
        retryCount,
        delaySeconds: delayMs / 1000,
        lastError,
        jobId: job.id,
        status: 'warning',
      }
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

function buildTemplateRetryComponents(message) {
  if (Array.isArray(message?.meta?.components) && message.meta.components.length > 0) {
    return message.meta.components;
  }

  const variables = message?.template?.variables || message?.meta?.variables || {};
  const components = [];

  if (Array.isArray(variables.header) && variables.header.length > 0) {
    components.push({
      type: 'header',
      parameters: variables.header.map((value) => ({ type: 'text', text: value }))
    });
  }

  if (Array.isArray(variables.body) && variables.body.length > 0) {
    components.push({
      type: 'body',
      parameters: variables.body.map((value) => ({ type: 'text', text: value }))
    });
  }

  if (Array.isArray(variables.buttons) && variables.buttons.length > 0) {
    variables.buttons.forEach((value, index) => {
      components.push({
        type: 'button',
        sub_type: 'quick_reply',
        index: String(index),
        parameters: [{ type: 'payload', payload: value }]
      });
    });
  }

  return components;
}

function buildRetryRequestFromMessage(message, fallbackData = {}) {
  if (!message) {
    throw new Error('MESSAGE_REQUIRED_FOR_RETRY');
  }

  const workspaceId = String(message.workspace || fallbackData.workspaceId || '');
  const recipientPhone = message.recipientPhone || fallbackData.recipientPhone;

  if (!workspaceId) throw new Error('WORKSPACE_REQUIRED_FOR_RETRY');
  if (!recipientPhone) throw new Error('RECIPIENT_REQUIRED_FOR_RETRY');

  const options = {
    contactId: message.contact || undefined,
    conversationId: message.conversation || undefined,
    sentBy: message.sentBy || undefined,
    skipMessageLog: true
  };

  if (message.type === 'template') {
    const templateName =
      message.template?.metaTemplateName ||
      message.meta?.metaTemplateName ||
      message.template?.name ||
      message.meta?.templateName;

    if (!templateName) {
      throw new Error('TEMPLATE_NAME_MISSING_FOR_RETRY');
    }

    return {
      method: 'sendTemplateMessage',
      args: [
        workspaceId,
        recipientPhone,
        templateName,
        message.template?.language || message.meta?.language || 'en',
        buildTemplateRetryComponents(message),
        options
      ]
    };
  }

  if (['image', 'video', 'document', 'audio'].includes(message.type)) {
    const mediaUrl = message.media?.url || message.meta?.media?.url || fallbackData.mediaUrl;
    if (!mediaUrl) {
      throw new Error('MEDIA_URL_MISSING_FOR_RETRY');
    }

    const caption = message.media?.caption || message.meta?.media?.caption || message.body || '';

    return {
      method: 'sendMediaMessage',
      args: [
        workspaceId,
        recipientPhone,
        message.type,
        { url: mediaUrl, link: mediaUrl },
        caption.startsWith('[') ? '' : caption,
        options
      ]
    };
  }

  return {
    method: 'sendTextMessage',
    args: [workspaceId, recipientPhone, message.body || fallbackData.messageBody || '', options]
  };
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
    const message = await Message.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    if (['sent', 'delivered', 'read'].includes(message.status) && message.whatsappMessageId) {
      logger.info('[MessageRetryQueue] Skipping retry for already-sent message', {
        messageId,
        status: message.status,
        whatsappMessageId: message.whatsappMessageId
      });
      return { success: true, skipped: true, reason: 'already_sent' };
    }

    const retryRequest = buildRetryRequestFromMessage(message, data);
    const result = await bspMessagingService[retryRequest.method](...retryRequest.args);

    message.status = 'queued';
    message.sentAt = new Date();
    message.failedAt = null;
    message.failureReason = null;
    message.whatsappMessageId = result.messageId;
    message.meta = {
      ...(message.meta || {}),
      whatsappId: result.messageId,
      retryCount: data.retryCount + 1,
      retryLastAttemptAt: new Date(),
      retryLastError: null
    };
    message.markModified('meta');
    await message.save();

    // Audit log
    await AuditLog.create({
      workspace: workspaceId,
      action: 'message.retry_success',
      resource: {
        type: 'message',
        id: messageId
      },
      details: {
        retryCount: data.retryCount,
        whatsappMessageId: result.messageId,
        status: 'success',
      }
    });

    logger.info(`[MessageRetryQueue] Message sent successfully on retry:`, {
      messageId,
      retryCount: data.retryCount,
      whatsappMessageId: result.messageId,
    });

    return { success: true, retryCount: data.retryCount };
  } catch (error) {
    await Message.findByIdAndUpdate(messageId, {
      $set: {
        status: 'failed',
        failureReason: error.message,
        failedAt: new Date(),
        'meta.retryLastAttemptAt': new Date(),
        'meta.retryLastError': error.message
      }
    }).catch((updateErr) => {
      logger.warn('[MessageRetryQueue] Failed to update message retry error state:', updateErr.message);
    });

    logger.warn(`[MessageRetryQueue] Retry attempt failed:`, {
      messageId,
      retryCount: data.retryCount,
      error: error.message,
    });

    // If max retries reached, move to dead letter queue
    if (data.retryCount >= maxRetries - 1) {
      await AuditLog.create({
        workspace: data.workspaceId,
        action: 'message.retry_exhausted',
        resource: {
          type: 'message',
          id: messageId
        },
        details: {
          finalError: error.message,
          totalAttempts: data.retryCount + 1,
          status: 'critical',
        }
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
  buildRetryRequestFromMessage,
  calculateBackoffDelay,
};
