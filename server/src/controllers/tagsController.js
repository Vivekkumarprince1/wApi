/**
 * Tags Controller - Stage 5 CRM
 * 
 * API endpoints for tag management:
 * - CRUD operations for tags
 * - Add/remove tags from contacts and conversations
 * - Filter by tags
 * - Tag analytics
 */

const tagService = require('../services/tagService');
const { logger } = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════
// TAG CRUD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/tags
 * Get all tags for workspace
 */
exports.getTags = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { search, scope, sortBy, limit } = req.query;
    
    const tags = await tagService.getTags(workspaceId, {
      search,
      scope,
      sortBy,
      limit: parseInt(limit) || 100
    });
    
    res.json({
      success: true,
      data: tags
    });
    
  } catch (error) {
    logger.error('[Tags] getTags failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tags',
      code: 'TAGS_ERROR'
    });
  }
};

/**
 * POST /api/v1/tags
 * Create a new tag
 */
exports.createTag = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const userId = req.user._id;
    const { name, color, description, scope } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Tag name is required',
        code: 'MISSING_NAME'
      });
    }
    
    const tag = await tagService.createTag(workspaceId, {
      name,
      color,
      description,
      scope
    }, userId);
    
    res.status(201).json({
      success: true,
      data: tag
    });
    
  } catch (error) {
    logger.error('[Tags] createTag failed:', error);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: error.message,
        code: 'TAG_EXISTS'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create tag',
      code: 'TAGS_ERROR'
    });
  }
};

/**
 * PUT /api/v1/tags/:tagId
 * Update a tag
 */
exports.updateTag = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { tagId } = req.params;
    const updates = req.body;
    
    const tag = await tagService.updateTag(workspaceId, tagId, updates);
    
    res.json({
      success: true,
      data: tag
    });
    
  } catch (error) {
    logger.error('[Tags] updateTag failed:', error);
    
    if (error.message === 'Tag not found') {
      return res.status(404).json({
        success: false,
        error: error.message,
        code: 'TAG_NOT_FOUND'
      });
    }
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: error.message,
        code: 'TAG_EXISTS'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update tag',
      code: 'TAGS_ERROR'
    });
  }
};

/**
 * DELETE /api/v1/tags/:tagId
 * Delete a tag
 */
exports.deleteTag = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { tagId } = req.params;
    
    await tagService.deleteTag(workspaceId, tagId);
    
    res.json({
      success: true,
      message: 'Tag deleted successfully'
    });
    
  } catch (error) {
    logger.error('[Tags] deleteTag failed:', error);
    
    if (error.message === 'Tag not found') {
      return res.status(404).json({
        success: false,
        error: error.message,
        code: 'TAG_NOT_FOUND'
      });
    }
    
    if (error.message.includes('system tags')) {
      return res.status(403).json({
        success: false,
        error: error.message,
        code: 'SYSTEM_TAG'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to delete tag',
      code: 'TAGS_ERROR'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CONTACT TAGGING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/contacts/:contactId/tags
 * Add tags to a contact
 */
exports.addTagsToContact = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const userId = req.user._id;
    const { contactId } = req.params;
    const { tags } = req.body;
    
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tags array is required',
        code: 'MISSING_TAGS'
      });
    }
    
    const contact = await tagService.addTagsToContact(
      workspaceId,
      contactId,
      tags,
      userId
    );
    
    res.json({
      success: true,
      data: contact
    });
    
  } catch (error) {
    logger.error('[Tags] addTagsToContact failed:', error);
    
    if (error.message === 'Contact not found') {
      return res.status(404).json({
        success: false,
        error: error.message,
        code: 'CONTACT_NOT_FOUND'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to add tags',
      code: 'TAGS_ERROR'
    });
  }
};

/**
 * DELETE /api/v1/contacts/:contactId/tags
 * Remove tags from a contact
 */
exports.removeTagsFromContact = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { contactId } = req.params;
    const { tags } = req.body;
    
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tags array is required',
        code: 'MISSING_TAGS'
      });
    }
    
    const contact = await tagService.removeTagsFromContact(
      workspaceId,
      contactId,
      tags
    );
    
    res.json({
      success: true,
      data: contact
    });
    
  } catch (error) {
    logger.error('[Tags] removeTagsFromContact failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove tags',
      code: 'TAGS_ERROR'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSATION TAGGING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/conversations/:conversationId/tags
 * Add tags to a conversation
 */
exports.addTagsToConversation = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const userId = req.user._id;
    const { conversationId } = req.params;
    const { tags } = req.body;
    
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tags array is required',
        code: 'MISSING_TAGS'
      });
    }
    
    const conversation = await tagService.addTagsToConversation(
      workspaceId,
      conversationId,
      tags,
      userId
    );
    
    res.json({
      success: true,
      data: conversation
    });
    
  } catch (error) {
    logger.error('[Tags] addTagsToConversation failed:', error);
    
    if (error.message === 'Conversation not found') {
      return res.status(404).json({
        success: false,
        error: error.message,
        code: 'CONVERSATION_NOT_FOUND'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to add tags',
      code: 'TAGS_ERROR'
    });
  }
};

/**
 * DELETE /api/v1/conversations/:conversationId/tags
 * Remove tags from a conversation
 */
exports.removeTagsFromConversation = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { conversationId } = req.params;
    const { tags } = req.body;
    
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tags array is required',
        code: 'MISSING_TAGS'
      });
    }
    
    const conversation = await tagService.removeTagsFromConversation(
      workspaceId,
      conversationId,
      tags
    );
    
    res.json({
      success: true,
      data: conversation
    });
    
  } catch (error) {
    logger.error('[Tags] removeTagsFromConversation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove tags',
      code: 'TAGS_ERROR'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// BULK OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/tags/bulk/contacts
 * Bulk add tags to multiple contacts
 */
exports.bulkAddTagsToContacts = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const userId = req.user._id;
    const { contactIds, tags } = req.body;
    
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Contact IDs array is required',
        code: 'MISSING_CONTACTS'
      });
    }
    
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tags array is required',
        code: 'MISSING_TAGS'
      });
    }
    
    const result = await tagService.bulkAddTagsToContacts(
      workspaceId,
      contactIds,
      tags,
      userId
    );
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('[Tags] bulkAddTagsToContacts failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk add tags',
      code: 'TAGS_ERROR'
    });
  }
};

/**
 * DELETE /api/v1/tags/bulk/contacts
 * Bulk remove tags from multiple contacts
 */
exports.bulkRemoveTagsFromContacts = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { contactIds, tags } = req.body;
    
    const result = await tagService.bulkRemoveTagsFromContacts(
      workspaceId,
      contactIds,
      tags
    );
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('[Tags] bulkRemoveTagsFromContacts failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk remove tags',
      code: 'TAGS_ERROR'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// FILTERING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/tags/filter/contacts
 * Get contacts by tags
 */
exports.getContactsByTags = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { tags, matchAll, page, limit } = req.query;
    
    if (!tags) {
      return res.status(400).json({
        success: false,
        error: 'Tags parameter is required',
        code: 'MISSING_TAGS'
      });
    }
    
    const tagArray = tags.split(',').map(t => t.trim());
    
    const result = await tagService.getContactsByTags(
      workspaceId,
      tagArray,
      {
        matchAll: matchAll === 'true',
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50
      }
    );
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('[Tags] getContactsByTags failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get contacts by tags',
      code: 'TAGS_ERROR'
    });
  }
};

/**
 * GET /api/v1/tags/filter/conversations
 * Get conversations by tags
 */
exports.getConversationsByTags = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { tags, matchAll, status, page, limit } = req.query;
    
    if (!tags) {
      return res.status(400).json({
        success: false,
        error: 'Tags parameter is required',
        code: 'MISSING_TAGS'
      });
    }
    
    const tagArray = tags.split(',').map(t => t.trim());
    
    const result = await tagService.getConversationsByTags(
      workspaceId,
      tagArray,
      {
        matchAll: matchAll === 'true',
        status,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50
      }
    );
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('[Tags] getConversationsByTags failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversations by tags',
      code: 'TAGS_ERROR'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/tags/analytics
 * Get tag usage analytics
 */
exports.getTagAnalytics = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    
    const analytics = await tagService.getTagAnalytics(workspaceId);
    
    res.json({
      success: true,
      data: analytics
    });
    
  } catch (error) {
    logger.error('[Tags] getTagAnalytics failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tag analytics',
      code: 'TAGS_ERROR'
    });
  }
};
