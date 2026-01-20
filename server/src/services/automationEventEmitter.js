/**
 * Automation Event Emitter - Stage 6 Automation Engine
 * 
 * Central event registry that emits events for automation triggers.
 * All automation-relevant events flow through this emitter.
 */

const EventEmitter = require('events');
const { logger } = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════
// EVENT TYPES
// ═══════════════════════════════════════════════════════════════════════════

const AUTOMATION_EVENTS = {
  // Conversation events
  CONVERSATION_CREATED: 'conversation.created',
  CONVERSATION_CLOSED: 'conversation.closed',
  CONVERSATION_REOPENED: 'conversation.reopened',
  CONVERSATION_ASSIGNED: 'conversation.assigned',
  CONVERSATION_UNASSIGNED: 'conversation.unassigned',
  
  // Message events
  CUSTOMER_MESSAGE_RECEIVED: 'customer.message.received',
  FIRST_AGENT_REPLY: 'first.agent.reply',
  
  // SLA events
  SLA_BREACHED: 'sla.breached',
  
  // Contact events
  CONTACT_CREATED: 'contact.created',
  CONTACT_UPDATED: 'contact.updated',
  CONTACT_TAG_ADDED: 'contact.tag.added',
  
  // Deal events
  DEAL_STAGE_CHANGED: 'deal.stage.changed',
  
  // Campaign events
  CAMPAIGN_MESSAGE_DELIVERED: 'campaign.message.delivered',
  CAMPAIGN_MESSAGE_READ: 'campaign.message.read',
  CAMPAIGN_MESSAGE_REPLIED: 'campaign.message.replied',
  
  // Legacy events (for backwards compatibility)
  MESSAGE_RECEIVED: 'message_received',
  STATUS_UPDATED: 'status_updated',
  CAMPAIGN_COMPLETED: 'campaign_completed',
  KEYWORD: 'keyword',
  TAG_ADDED: 'tag_added',
  AD_LEAD: 'ad_lead'
};

// ═══════════════════════════════════════════════════════════════════════════
// EVENT EMITTER CLASS
// ═══════════════════════════════════════════════════════════════════════════

class AutomationEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Allow many listeners for automation rules
    this._enabled = true;
    this._workspaceOverrides = new Map(); // Per-workspace enable/disable
    this._eventCounts = new Map(); // Track event counts for monitoring
    this._lastEvents = []; // Keep last N events for debugging
    this._maxLastEvents = 100;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // ENABLE/DISABLE
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Global kill switch
   */
  disable() {
    this._enabled = false;
    logger.warn('[AutomationEvents] Global automation disabled');
  }
  
  enable() {
    this._enabled = true;
    logger.info('[AutomationEvents] Global automation enabled');
  }
  
  isEnabled() {
    return this._enabled;
  }
  
  /**
   * Per-workspace enable/disable
   */
  disableWorkspace(workspaceId) {
    this._workspaceOverrides.set(workspaceId.toString(), false);
    logger.info(`[AutomationEvents] Automation disabled for workspace ${workspaceId}`);
  }
  
  enableWorkspace(workspaceId) {
    this._workspaceOverrides.delete(workspaceId.toString());
    logger.info(`[AutomationEvents] Automation enabled for workspace ${workspaceId}`);
  }
  
  isWorkspaceEnabled(workspaceId) {
    if (!this._enabled) return false;
    const override = this._workspaceOverrides.get(workspaceId.toString());
    return override !== false;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // EVENT EMISSION
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Emit an automation event with standard payload
   */
  emitAutomationEvent(eventType, payload) {
    // Validate payload
    if (!payload.workspaceId) {
      logger.error(`[AutomationEvents] Missing workspaceId for event ${eventType}`);
      return false;
    }
    
    // Check global and workspace enablement
    if (!this.isWorkspaceEnabled(payload.workspaceId)) {
      logger.debug(`[AutomationEvents] Event ${eventType} skipped - automation disabled`);
      return false;
    }
    
    // Build standard event payload
    const event = {
      type: eventType,
      workspaceId: payload.workspaceId,
      conversationId: payload.conversationId || null,
      contactId: payload.contactId || null,
      messageId: payload.messageId || null,
      timestamp: new Date(),
      metadata: payload.metadata || {}
    };
    
    // Track event
    this._trackEvent(event);
    
    // Emit
    logger.debug(`[AutomationEvents] Emitting ${eventType}`, { 
      workspaceId: event.workspaceId,
      conversationId: event.conversationId 
    });
    
    this.emit(eventType, event);
    this.emit('automation.event', event); // Also emit generic event for global listeners
    
    return true;
  }
  
  /**
   * Track event for monitoring
   */
  _trackEvent(event) {
    // Increment count
    const key = `${event.workspaceId}:${event.type}`;
    this._eventCounts.set(key, (this._eventCounts.get(key) || 0) + 1);
    
    // Keep last events
    this._lastEvents.unshift({
      ...event,
      _tracked: new Date()
    });
    if (this._lastEvents.length > this._maxLastEvents) {
      this._lastEvents.pop();
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // CONVENIENCE METHODS FOR COMMON EVENTS
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Emit when a new conversation is created
   */
  conversationCreated(payload) {
    return this.emitAutomationEvent(AUTOMATION_EVENTS.CONVERSATION_CREATED, payload);
  }
  
  /**
   * Emit when customer sends a message
   */
  customerMessageReceived(payload) {
    // Also emit legacy event
    this.emitAutomationEvent(AUTOMATION_EVENTS.MESSAGE_RECEIVED, payload);
    return this.emitAutomationEvent(AUTOMATION_EVENTS.CUSTOMER_MESSAGE_RECEIVED, payload);
  }
  
  /**
   * Emit when agent sends first reply
   */
  firstAgentReply(payload) {
    return this.emitAutomationEvent(AUTOMATION_EVENTS.FIRST_AGENT_REPLY, payload);
  }
  
  /**
   * Emit when conversation is closed
   */
  conversationClosed(payload) {
    return this.emitAutomationEvent(AUTOMATION_EVENTS.CONVERSATION_CLOSED, payload);
  }
  
  /**
   * Emit when conversation is reopened
   */
  conversationReopened(payload) {
    return this.emitAutomationEvent(AUTOMATION_EVENTS.CONVERSATION_REOPENED, payload);
  }
  
  /**
   * Emit when SLA is breached
   */
  slaBreached(payload) {
    return this.emitAutomationEvent(AUTOMATION_EVENTS.SLA_BREACHED, payload);
  }
  
  /**
   * Emit when contact is created
   */
  contactCreated(payload) {
    return this.emitAutomationEvent(AUTOMATION_EVENTS.CONTACT_CREATED, payload);
  }
  
  /**
   * Emit when contact is updated
   */
  contactUpdated(payload) {
    return this.emitAutomationEvent(AUTOMATION_EVENTS.CONTACT_UPDATED, payload);
  }
  
  /**
   * Emit when tag is added to contact
   */
  contactTagAdded(payload) {
    // Also emit legacy event
    this.emitAutomationEvent(AUTOMATION_EVENTS.TAG_ADDED, payload);
    return this.emitAutomationEvent(AUTOMATION_EVENTS.CONTACT_TAG_ADDED, payload);
  }
  
  /**
   * Emit when conversation is assigned
   */
  conversationAssigned(payload) {
    return this.emitAutomationEvent(AUTOMATION_EVENTS.CONVERSATION_ASSIGNED, payload);
  }
  
  /**
   * Emit when conversation is unassigned
   */
  conversationUnassigned(payload) {
    return this.emitAutomationEvent(AUTOMATION_EVENTS.CONVERSATION_UNASSIGNED, payload);
  }
  
  /**
   * Emit when deal stage changes
   */
  dealStageChanged(payload) {
    return this.emitAutomationEvent(AUTOMATION_EVENTS.DEAL_STAGE_CHANGED, payload);
  }
  
  /**
   * Emit when campaign message is delivered
   */
  campaignMessageDelivered(payload) {
    return this.emitAutomationEvent(AUTOMATION_EVENTS.CAMPAIGN_MESSAGE_DELIVERED, payload);
  }
  
  /**
   * Emit when campaign message is read
   */
  campaignMessageRead(payload) {
    return this.emitAutomationEvent(AUTOMATION_EVENTS.CAMPAIGN_MESSAGE_READ, payload);
  }
  
  /**
   * Emit when customer replies to campaign
   */
  campaignMessageReplied(payload) {
    // Also emit legacy campaign completed for reply-based triggers
    this.emitAutomationEvent(AUTOMATION_EVENTS.CAMPAIGN_COMPLETED, payload);
    return this.emitAutomationEvent(AUTOMATION_EVENTS.CAMPAIGN_MESSAGE_REPLIED, payload);
  }
  
  /**
   * Emit ad lead event
   */
  adLeadReceived(payload) {
    return this.emitAutomationEvent(AUTOMATION_EVENTS.AD_LEAD, payload);
  }
  
  /**
   * Emit keyword match event
   */
  keywordMatched(payload) {
    return this.emitAutomationEvent(AUTOMATION_EVENTS.KEYWORD, payload);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // MONITORING
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Get event statistics
   */
  getStats() {
    return {
      enabled: this._enabled,
      workspaceOverrides: Object.fromEntries(this._workspaceOverrides),
      eventCounts: Object.fromEntries(this._eventCounts),
      listenerCounts: this.eventNames().map(name => ({
        event: name,
        listeners: this.listenerCount(name)
      })),
      lastEventsCount: this._lastEvents.length
    };
  }
  
  /**
   * Get last N events (for debugging)
   */
  getLastEvents(limit = 20) {
    return this._lastEvents.slice(0, limit);
  }
  
  /**
   * Get event count for workspace
   */
  getWorkspaceEventCount(workspaceId, eventType = null) {
    let total = 0;
    for (const [key, count] of this._eventCounts) {
      if (key.startsWith(workspaceId.toString())) {
        if (!eventType || key.endsWith(`:${eventType}`)) {
          total += count;
        }
      }
    }
    return total;
  }
  
  /**
   * Reset stats (for testing)
   */
  resetStats() {
    this._eventCounts.clear();
    this._lastEvents = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

const automationEvents = new AutomationEventEmitter();

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  automationEvents,
  AUTOMATION_EVENTS,
  AutomationEventEmitter
};
