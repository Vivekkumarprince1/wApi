const { automationEvents, AUTOMATION_EVENTS } = require('../automation/automationEventEmitter');
const { Deal, Pipeline, Contact, Workspace } = require('../../models');
const logger = require('../../utils/logger');

/**
 * CRM Automation Service
 * 
 * Bridges the gap between Messaging (Inbox) and CRM (Sales Pipeline).
 * Listens for inbox events and automatically creates/updates deals.
 */
class CRMAutomationService {
  constructor() {
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    
    // Listen for label changes in the inbox
    automationEvents.on(AUTOMATION_EVENTS.CONVERSATION_LABEL_CHANGED, this.handleLabelChanged.bind(this));
    
    // Optional: Listen for specific tag additions
    automationEvents.on(AUTOMATION_EVENTS.CONTACT_TAG_ADDED, this.handleTagAdded.bind(this));

    this.initialized = true;
    logger.info('[CRMAutomation] Service initialized');
  }

  /**
   * Automatically create a deal when a lead label is set
   */
  async handleLabelChanged(event) {
    try {
      const { workspaceId, contactId, metadata } = event;
      const { label } = metadata;

      // Define "Lead Capture" labels - In a real app, these would be user-configurable rules
      const leadLabels = ['Lead', 'Qualified', 'Interested', 'Sales', 'Hot Lead'];
      
      if (!leadLabels.includes(label)) return;

      logger.info(`[CRMAutomation] Potential lead detected: Label "${label}" for contact ${contactId} in ${workspaceId}`);

      // 1. Check if contact already has an active deal
      const existingDeal = await Deal.findOne({
        workspace: workspaceId,
        contact: contactId,
        status: 'active'
      });

      if (existingDeal) {
        logger.debug(`[CRMAutomation] Contact ${contactId} already has an active deal. Skipping auto-creation.`);
        return;
      }

      // 2. Resolve default pipeline for the workspace
      let pipeline = await Pipeline.findOne({ workspace: workspaceId, isDefault: true });
      if (!pipeline) {
        pipeline = await Pipeline.findOne({ workspace: workspaceId });
      }

      if (!pipeline || !pipeline.stages.length) {
        logger.warn(`[CRMAutomation] No valid pipeline found for workspace ${workspaceId}. Cannot auto-create deal.`);
        return;
      }

      // 3. Resolve the contact
      const contact = await Contact.findById(contactId);
      if (!contact) return;

      // 4. Create the deal
      const firstStage = pipeline.stages.sort((a, b) => a.position - b.position)[0];
      
      const deal = await Deal.create({
        workspace: workspaceId,
        contact: contactId,
        pipeline: pipeline._id,
        title: `Auto: ${contact.name || contact.phone} (${label})`,
        value: 0,
        currency: 'USD',
        stage: firstStage.id,
        probability: 10,
        priority: label === 'Hot Lead' ? 'high' : 'medium',
        description: `Automatically created from Inbox label change: "${label}"`
      });

      // Record history
      deal.stageHistory.push({
        stage: firstStage.id,
        timestamp: new Date()
      });
      await deal.save();

      // Update contact
      contact.activeDealId = deal._id;
      contact.activePipelineId = pipeline._id;
      await contact.save();

      logger.info(`[CRMAutomation] Successfully created auto-deal ${deal._id} for contact ${contact.phone}`);

      // Emit deal creation socket event for real-time frontend updates
      const { getIO } = require('../../utils/socket');
      const io = getIO();
      if (io) {
        await deal.populate(['contact', 'pipeline']);
        io.to(`workspace:${workspaceId}`).emit('deal:created', { deal });
      }

    } catch (err) {
      logger.error('[CRMAutomation] Error in handleLabelChanged:', err);
    }
  }

  /**
   * Handle tag added events
   */
  async handleTagAdded(event) {
    // Similar logic for specific tags like 'potential-customer'
  }
}

module.exports = new CRMAutomationService();
