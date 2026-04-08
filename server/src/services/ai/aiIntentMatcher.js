const { AutomationRule, AiIntentMatchLog } = require('../../models');
const aiService = require('./generativeAiService');
const logger = require('../../utils/logger');

/**
 * AI Intent Matcher Service
 * 
 * Implements the "Smart Selector" layer by comparing customer messages 
 * against a list of active automation rules using semantic AI.
 */

/**
 * Match a message against active rules for a workspace
 */
async function matchIntent(workspaceId, messageBody, conversationId, contactId) {
  try {
    // 1. Fetch all enabled message-based rules for this workspace
    // We include auto_replies and workflows with message triggers
    const activeRules = await AutomationRule.find({
      workspace: workspaceId,
      enabled: true,
      deletedAt: null,
      $or: [
        { 'trigger.event': { $in: ['message_received', 'customer.message.received'] } },
        { legacyTrigger: 'message_received' }
      ]
    }).select('name description trigger.filters.keywords actions flowConfig').lean();

    if (activeRules.length < 3) {
      logger.debug(`[AIIntentMatcher] Skipping AI match: Only ${activeRules.length} rules active (min 3)`);
      return null;
    }

    // 2. Prepare categories for LLM
    const categories = activeRules.map(rule => ({
      id: rule._id.toString(),
      name: rule.name,
      description: rule.description || '',
      keywords: rule.trigger?.filters?.keywords || []
    }));

    // 3. Prompt LLM to find the best match
    const result = await aiService.classifyIntent(messageBody, categories);

    if (result && result.matchFound && result.categoryId && result.confidence >= 0.7) {
      const matchedRuleId = result.categoryId;
      const matchedRule = activeRules.find(r => r._id.toString() === matchedRuleId);

      if (matchedRule) {
        logger.info(`[AIIntentMatcher] ✅ Smart Match found: "${messageBody}" -> [${matchedRule.name}] (Confidence: ${result.confidence})`);
        
        // 4. Log the match for reporting
        await AiIntentMatchLog.create({
          workspace: workspaceId,
          queryText: messageBody,
          matchedRule: matchedRuleId,
          confidence: result.confidence,
          conversation: conversationId,
          contact: contactId,
          aiMetadata: {
            model: 'gemini-1.5-flash',
            intentDetected: matchedRule.name,
            reasoning: result.reasoning
          }
        });

        return matchedRule;
      }
    }

    logger.debug(`[AIIntentMatcher] ❌ No strong semantic match for: "${messageBody}"`);
    return null;

  } catch (error) {
    logger.error('[AIIntentMatcher] Matching failed:', error);
    return null;
  }
}

module.exports = {
  matchIntent
};
