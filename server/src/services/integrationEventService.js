/**
 * Integration Event Service - Stage 5
 * 
 * Internal event bus for emitting events to external integrations.
 * Events can be consumed by:
 * - Webhook endpoints (outbound HTTP)
 * - Internal services
 * - Analytics pipelines
 * 
 * Events:
 * - conversation_started: New billable conversation opened
 * - message_sent: Message sent to customer
 * - message_received: Message received from customer
 * - conversation_closed: Conversation window closed
 * - campaign_completed: Campaign finished sending
 * - template_status_changed: Template approval status changed
 * 
 * This is an internal event bus - no UI exposure.
 * External webhooks are configured via Integration model.
 */

const EventEmitter = require('events');
const axios = require('axios');
const crypto = require('crypto');
const Integration = require('../models/Integration');
const { logger } = require('../utils/logger');

// Create singleton event emitter
const eventEmitter = new EventEmitter();
eventEmitter.setMaxListeners(50); // Increase for multiple listeners

// Event types with their payload schemas
const EVENT_TYPES = {
  // Conversation lifecycle
  CONVERSATION_STARTED: 'conversation_started',
  CONVERSATION_CLOSED: 'conversation_closed',
  
  // Message events
  MESSAGE_SENT: 'message_sent',
  MESSAGE_RECEIVED: 'message_received',
  MESSAGE_DELIVERED: 'message_delivered',
  MESSAGE_READ: 'message_read',
  MESSAGE_FAILED: 'message_failed',
  
  // Campaign events
  CAMPAIGN_STARTED: 'campaign_started',
  CAMPAIGN_COMPLETED: 'campaign_completed',
  CAMPAIGN_FAILED: 'campaign_failed',
  
  // Template events
  TEMPLATE_APPROVED: 'template_approved',
  TEMPLATE_REJECTED: 'template_rejected',
  TEMPLATE_PAUSED: 'template_paused',
  
  // Contact events
  CONTACT_CREATED: 'contact_created',
  CONTACT_OPTED_OUT: 'contact_opted_out',
  CONTACT_OPTED_IN: 'contact_opted_in',
  
  // Inbox events
  CONVERSATION_ASSIGNED: 'conversation_assigned',
  SLA_BREACHED: 'sla_breached'
};

// In-memory queue for failed webhooks (to retry)
const retryQueue = [];
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

/**
 * Generate webhook signature for payload verification
 * 
 * @param {String} payload - JSON payload string
 * @param {String} secret - Webhook secret
 * @returns {String} HMAC signature
 */
function generateSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Emit an event internally
 * 
 * @param {String} eventType - Event type from EVENT_TYPES
 * @param {Object} payload - Event payload
 */
function emit(eventType, payload) {
  try {
    const eventData = {
      type: eventType,
      timestamp: new Date().toISOString(),
      ...payload
    };
    
    logger.debug('[IntegrationEvents] Emitting event', {
      type: eventType,
      workspaceId: payload.workspaceId
    });
    
    // Emit to internal listeners
    eventEmitter.emit(eventType, eventData);
    
    // Emit to wildcard listeners
    eventEmitter.emit('*', eventData);
    
    // Process webhooks asynchronously
    processWebhooks(eventType, eventData).catch(err => {
      logger.error('[IntegrationEvents] Webhook processing failed', err);
    });
    
  } catch (error) {
    logger.error('[IntegrationEvents] emit failed:', error);
  }
}

/**
 * Process webhooks for an event
 * Finds all active webhook integrations for the workspace and sends
 * 
 * @param {String} eventType 
 * @param {Object} eventData 
 */
async function processWebhooks(eventType, eventData) {
  try {
    const { workspaceId } = eventData;
    
    if (!workspaceId) {
      return;
    }
    
    // Find active webhook integrations for this workspace
    const integrations = await Integration.find({
      workspace: workspaceId,
      type: 'webhook',
      isActive: true,
      $or: [
        { 'config.events': eventType },
        { 'config.events': '*' },
        { 'config.events': { $exists: false } } // Legacy - receive all
      ]
    }).lean();
    
    if (integrations.length === 0) {
      return;
    }
    
    // Send to each webhook
    const webhookPromises = integrations.map(integration => 
      sendWebhook(integration, eventType, eventData)
    );
    
    await Promise.allSettled(webhookPromises);
    
  } catch (error) {
    logger.error('[IntegrationEvents] processWebhooks failed:', error);
  }
}

/**
 * Send webhook to an integration endpoint
 * 
 * @param {Object} integration - Integration document
 * @param {String} eventType 
 * @param {Object} eventData 
 */
async function sendWebhook(integration, eventType, eventData, attempt = 1) {
  const { config } = integration;
  const url = config.webhookUrl || config.url;
  
  if (!url) {
    logger.warn('[IntegrationEvents] Webhook integration has no URL', {
      integrationId: integration._id
    });
    return;
  }
  
  const payload = {
    event: eventType,
    timestamp: eventData.timestamp,
    data: eventData,
    integration: {
      id: integration._id,
      name: integration.name
    }
  };
  
  const payloadString = JSON.stringify(payload);
  
  // Build headers
  const headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': eventType,
    'X-Webhook-Timestamp': eventData.timestamp,
    'X-Webhook-Attempt': String(attempt)
  };
  
  // Add signature if secret is configured
  if (config.secret) {
    headers['X-Webhook-Signature'] = generateSignature(payloadString, config.secret);
  }
  
  // Add custom headers
  if (config.headers) {
    Object.assign(headers, config.headers);
  }
  
  try {
    const response = await axios.post(url, payload, {
      headers,
      timeout: config.timeout || 10000, // 10 second default
      validateStatus: (status) => status < 500 // Don't throw for 4xx
    });
    
    logger.info('[IntegrationEvents] Webhook sent', {
      integrationId: integration._id,
      eventType,
      status: response.status,
      attempt
    });
    
    // Log delivery
    await logWebhookDelivery(integration._id, eventType, 'success', response.status);
    
  } catch (error) {
    logger.error('[IntegrationEvents] Webhook failed', {
      integrationId: integration._id,
      eventType,
      attempt,
      error: error.message
    });
    
    // Log failure
    await logWebhookDelivery(integration._id, eventType, 'failed', null, error.message);
    
    // Retry if not max attempts
    if (attempt < MAX_RETRY_ATTEMPTS) {
      setTimeout(() => {
        sendWebhook(integration, eventType, eventData, attempt + 1);
      }, RETRY_DELAY_MS * attempt);
    }
  }
}

/**
 * Log webhook delivery attempt
 */
async function logWebhookDelivery(integrationId, eventType, status, httpStatus, error = null) {
  try {
    await Integration.findByIdAndUpdate(integrationId, {
      $push: {
        'stats.webhookDeliveries': {
          event: eventType,
          status,
          httpStatus,
          error,
          timestamp: new Date()
        }
      },
      $inc: {
        'stats.totalWebhooksSent': 1,
        [`stats.webhooks${status === 'success' ? 'Succeeded' : 'Failed'}`]: 1
      }
    });
  } catch (err) {
    // Don't fail on logging error
    logger.error('[IntegrationEvents] logWebhookDelivery failed:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════
// CONVENIENCE EMIT METHODS
// ═══════════════════════════════════════════════════════════════════

/**
 * Emit conversation started event
 */
function emitConversationStarted(data) {
  emit(EVENT_TYPES.CONVERSATION_STARTED, {
    workspaceId: data.workspaceId,
    conversationId: data.conversationId,
    ledgerId: data.ledgerId,
    category: data.category,
    initiatedBy: data.initiatedBy,
    source: data.source,
    contact: {
      id: data.contactId,
      phone: data.phoneNumber
    },
    template: data.templateName ? {
      name: data.templateName,
      category: data.templateCategory
    } : null,
    campaign: data.campaignId ? {
      id: data.campaignId,
      name: data.campaignName
    } : null,
    windowExpiresAt: data.expiresAt
  });
}

/**
 * Emit message sent event
 */
function emitMessageSent(data) {
  emit(EVENT_TYPES.MESSAGE_SENT, {
    workspaceId: data.workspaceId,
    conversationId: data.conversationId,
    messageId: data.messageId,
    whatsappMessageId: data.whatsappMessageId,
    contact: {
      id: data.contactId,
      phone: data.phoneNumber
    },
    messageType: data.messageType,
    isTemplate: data.isTemplate,
    templateName: data.templateName,
    sentBy: data.sentBy, // userId if from inbox
    source: data.source
  });
}

/**
 * Emit message received event
 */
function emitMessageReceived(data) {
  emit(EVENT_TYPES.MESSAGE_RECEIVED, {
    workspaceId: data.workspaceId,
    conversationId: data.conversationId,
    messageId: data.messageId,
    whatsappMessageId: data.whatsappMessageId,
    contact: {
      id: data.contactId,
      phone: data.phoneNumber,
      name: data.contactName
    },
    messageType: data.messageType,
    messageBody: data.messageBody
  });
}

/**
 * Emit conversation closed event
 */
function emitConversationClosed(data) {
  emit(EVENT_TYPES.CONVERSATION_CLOSED, {
    workspaceId: data.workspaceId,
    conversationId: data.conversationId,
    ledgerId: data.ledgerId,
    closedAt: data.closedAt,
    closedBy: data.closedBy, // 'expired' | 'agent' | 'system'
    duration: data.duration, // in seconds
    messageCount: data.messageCount,
    category: data.category
  });
}

/**
 * Emit campaign completed event
 */
function emitCampaignCompleted(data) {
  emit(EVENT_TYPES.CAMPAIGN_COMPLETED, {
    workspaceId: data.workspaceId,
    campaignId: data.campaignId,
    campaignName: data.campaignName,
    status: data.status, // 'completed' | 'failed' | 'partial'
    stats: {
      total: data.totalContacts,
      sent: data.sentCount,
      delivered: data.deliveredCount,
      read: data.readCount,
      failed: data.failedCount
    },
    startedAt: data.startedAt,
    completedAt: data.completedAt,
    duration: data.duration
  });
}

// ═══════════════════════════════════════════════════════════════════
// LISTENER REGISTRATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Register internal event listener
 * 
 * @param {String} eventType - Event type or '*' for all
 * @param {Function} handler - Event handler function
 */
function on(eventType, handler) {
  eventEmitter.on(eventType, handler);
}

/**
 * Register one-time event listener
 */
function once(eventType, handler) {
  eventEmitter.once(eventType, handler);
}

/**
 * Remove event listener
 */
function off(eventType, handler) {
  eventEmitter.off(eventType, handler);
}

/**
 * Get all available event types
 */
function getEventTypes() {
  return EVENT_TYPES;
}

module.exports = {
  // Event types
  EVENT_TYPES,
  
  // Core emit
  emit,
  
  // Convenience emitters
  emitConversationStarted,
  emitMessageSent,
  emitMessageReceived,
  emitConversationClosed,
  emitCampaignCompleted,
  
  // Listener registration
  on,
  once,
  off,
  
  // Utilities
  getEventTypes,
  generateSignature
};
