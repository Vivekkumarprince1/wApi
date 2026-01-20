/**
 * Tag Service - Stage 5 CRM
 * 
 * Manages tags for contacts and conversations.
 * Supports:
 * - Tag CRUD operations
 * - Bulk tag operations
 * - Tag-based filtering
 * - Usage analytics
 */

const mongoose = require('mongoose');
const Tag = require('../models/Tag');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const { logger } = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════
// TAG CRUD OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new tag
 */
async function createTag(workspaceId, tagData, userId = null) {
  try {
    const { name, color, description, scope } = tagData;
    
    // Check for duplicate
    const existing = await Tag.findOne({
      workspace: workspaceId,
      normalizedName: name.toLowerCase().trim()
    });
    
    if (existing) {
      throw new Error('Tag with this name already exists');
    }
    
    const tag = await Tag.create({
      workspace: workspaceId,
      name: name.trim(),
      color: color || '#6B7280',
      description,
      scope: scope || 'all',
      createdBy: userId
    });
    
    logger.info(`[Tags] Created tag "${name}" for workspace ${workspaceId}`);
    return tag;
    
  } catch (error) {
    logger.error('[Tags] Failed to create tag:', error);
    throw error;
  }
}

/**
 * Update a tag
 */
async function updateTag(workspaceId, tagId, updates, userId = null) {
  try {
    const allowedUpdates = ['name', 'color', 'description', 'scope'];
    const updateData = {};
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    });
    
    // If name is being changed, update normalizedName
    if (updateData.name) {
      updateData.normalizedName = updateData.name.toLowerCase().trim();
      
      // Check for duplicate name
      const existing = await Tag.findOne({
        workspace: workspaceId,
        normalizedName: updateData.normalizedName,
        _id: { $ne: tagId }
      });
      
      if (existing) {
        throw new Error('Tag with this name already exists');
      }
    }
    
    const tag = await Tag.findOneAndUpdate(
      { _id: tagId, workspace: workspaceId },
      updateData,
      { new: true }
    );
    
    if (!tag) {
      throw new Error('Tag not found');
    }
    
    logger.info(`[Tags] Updated tag ${tagId}`);
    return tag;
    
  } catch (error) {
    logger.error('[Tags] Failed to update tag:', error);
    throw error;
  }
}

/**
 * Delete a tag
 */
async function deleteTag(workspaceId, tagId) {
  try {
    const tag = await Tag.findOne({ _id: tagId, workspace: workspaceId });
    
    if (!tag) {
      throw new Error('Tag not found');
    }
    
    if (tag.isSystem) {
      throw new Error('Cannot delete system tags');
    }
    
    // Remove tag from all contacts
    await Contact.updateMany(
      { workspace: workspaceId, tags: tag.name },
      { $pull: { tags: tag.name } }
    );
    
    // Remove tag from all conversations
    await Conversation.updateMany(
      { workspace: workspaceId, tags: tag.name },
      { $pull: { tags: tag.name } }
    );
    
    await Tag.deleteOne({ _id: tagId });
    
    logger.info(`[Tags] Deleted tag ${tagId} and removed from all items`);
    return { success: true, removedFrom: { contacts: true, conversations: true } };
    
  } catch (error) {
    logger.error('[Tags] Failed to delete tag:', error);
    throw error;
  }
}

/**
 * Get all tags for a workspace
 */
async function getTags(workspaceId, options = {}) {
  const { search, scope, sortBy = 'name', limit = 100 } = options;
  
  try {
    const query = { workspace: workspaceId };
    
    if (search) {
      query.normalizedName = { $regex: search.toLowerCase(), $options: 'i' };
    }
    
    if (scope && scope !== 'all') {
      query.scope = { $in: ['all', scope] };
    }
    
    const sortOptions = {
      name: { name: 1 },
      usage: { 'usageCount.total': -1 },
      recent: { createdAt: -1 }
    };
    
    const tags = await Tag.find(query)
      .sort(sortOptions[sortBy] || sortOptions.name)
      .limit(limit)
      .lean();
    
    return tags;
    
  } catch (error) {
    logger.error('[Tags] Failed to get tags:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAG ASSIGNMENT OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Add tags to a contact
 */
async function addTagsToContact(workspaceId, contactId, tagNames, userId = null) {
  try {
    // Normalize tag names
    const normalizedTags = tagNames.map(t => t.trim());
    
    // Find or create tags
    for (const tagName of normalizedTags) {
      await Tag.findOrCreate(workspaceId, tagName, userId);
    }
    
    // Add to contact
    const contact = await Contact.findOneAndUpdate(
      { _id: contactId, workspace: workspaceId },
      { $addToSet: { tags: { $each: normalizedTags } } },
      { new: true }
    );
    
    if (!contact) {
      throw new Error('Contact not found');
    }
    
    // Update usage counters
    for (const tagName of normalizedTags) {
      await Tag.incrementUsage(workspaceId, tagName, 'contacts');
    }
    
    logger.info(`[Tags] Added ${normalizedTags.length} tags to contact ${contactId}`);
    return contact;
    
  } catch (error) {
    logger.error('[Tags] Failed to add tags to contact:', error);
    throw error;
  }
}

/**
 * Remove tags from a contact
 */
async function removeTagsFromContact(workspaceId, contactId, tagNames) {
  try {
    const normalizedTags = tagNames.map(t => t.trim());
    
    const contact = await Contact.findOneAndUpdate(
      { _id: contactId, workspace: workspaceId },
      { $pull: { tags: { $in: normalizedTags } } },
      { new: true }
    );
    
    if (!contact) {
      throw new Error('Contact not found');
    }
    
    // Update usage counters
    for (const tagName of normalizedTags) {
      await Tag.decrementUsage(workspaceId, tagName, 'contacts');
    }
    
    logger.info(`[Tags] Removed ${normalizedTags.length} tags from contact ${contactId}`);
    return contact;
    
  } catch (error) {
    logger.error('[Tags] Failed to remove tags from contact:', error);
    throw error;
  }
}

/**
 * Add tags to a conversation
 */
async function addTagsToConversation(workspaceId, conversationId, tagNames, userId = null) {
  try {
    const normalizedTags = tagNames.map(t => t.trim());
    
    // Find or create tags
    for (const tagName of normalizedTags) {
      await Tag.findOrCreate(workspaceId, tagName, userId);
    }
    
    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, workspace: workspaceId },
      { $addToSet: { tags: { $each: normalizedTags } } },
      { new: true }
    );
    
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    
    // Update usage counters
    for (const tagName of normalizedTags) {
      await Tag.incrementUsage(workspaceId, tagName, 'conversations');
    }
    
    logger.info(`[Tags] Added ${normalizedTags.length} tags to conversation ${conversationId}`);
    return conversation;
    
  } catch (error) {
    logger.error('[Tags] Failed to add tags to conversation:', error);
    throw error;
  }
}

/**
 * Remove tags from a conversation
 */
async function removeTagsFromConversation(workspaceId, conversationId, tagNames) {
  try {
    const normalizedTags = tagNames.map(t => t.trim());
    
    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, workspace: workspaceId },
      { $pull: { tags: { $in: normalizedTags } } },
      { new: true }
    );
    
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    
    // Update usage counters
    for (const tagName of normalizedTags) {
      await Tag.decrementUsage(workspaceId, tagName, 'conversations');
    }
    
    logger.info(`[Tags] Removed ${normalizedTags.length} tags from conversation ${conversationId}`);
    return conversation;
    
  } catch (error) {
    logger.error('[Tags] Failed to remove tags from conversation:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BULK OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Bulk add tags to multiple contacts
 */
async function bulkAddTagsToContacts(workspaceId, contactIds, tagNames, userId = null) {
  try {
    const normalizedTags = tagNames.map(t => t.trim());
    
    // Find or create tags
    for (const tagName of normalizedTags) {
      await Tag.findOrCreate(workspaceId, tagName, userId);
    }
    
    const result = await Contact.updateMany(
      { _id: { $in: contactIds }, workspace: workspaceId },
      { $addToSet: { tags: { $each: normalizedTags } } }
    );
    
    // Update usage counters (approximate - may count duplicates)
    for (const tagName of normalizedTags) {
      await Tag.findOneAndUpdate(
        { workspace: workspaceId, normalizedName: tagName.toLowerCase() },
        { $inc: { 'usageCount.contacts': result.modifiedCount, 'usageCount.total': result.modifiedCount } }
      );
    }
    
    logger.info(`[Tags] Bulk added tags to ${result.modifiedCount} contacts`);
    return { success: true, modifiedCount: result.modifiedCount };
    
  } catch (error) {
    logger.error('[Tags] Failed to bulk add tags:', error);
    throw error;
  }
}

/**
 * Bulk remove tags from multiple contacts
 */
async function bulkRemoveTagsFromContacts(workspaceId, contactIds, tagNames) {
  try {
    const normalizedTags = tagNames.map(t => t.trim());
    
    const result = await Contact.updateMany(
      { _id: { $in: contactIds }, workspace: workspaceId },
      { $pull: { tags: { $in: normalizedTags } } }
    );
    
    logger.info(`[Tags] Bulk removed tags from ${result.modifiedCount} contacts`);
    return { success: true, modifiedCount: result.modifiedCount };
    
  } catch (error) {
    logger.error('[Tags] Failed to bulk remove tags:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FILTERING & SEARCH
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get contacts by tags
 */
async function getContactsByTags(workspaceId, tagNames, options = {}) {
  const { matchAll = false, page = 1, limit = 50 } = options;
  
  try {
    const query = { workspace: workspaceId };
    
    if (matchAll) {
      // Must have ALL specified tags
      query.tags = { $all: tagNames };
    } else {
      // Must have ANY of the specified tags
      query.tags = { $in: tagNames };
    }
    
    const skip = (page - 1) * limit;
    
    const [contacts, total] = await Promise.all([
      Contact.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Contact.countDocuments(query)
    ]);
    
    return {
      contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
    
  } catch (error) {
    logger.error('[Tags] Failed to get contacts by tags:', error);
    throw error;
  }
}

/**
 * Get conversations by tags
 */
async function getConversationsByTags(workspaceId, tagNames, options = {}) {
  const { matchAll = false, page = 1, limit = 50, status = null } = options;
  
  try {
    const query = { workspace: workspaceId };
    
    if (matchAll) {
      query.tags = { $all: tagNames };
    } else {
      query.tags = { $in: tagNames };
    }
    
    if (status) {
      query.status = status;
    }
    
    const skip = (page - 1) * limit;
    
    const [conversations, total] = await Promise.all([
      Conversation.find(query)
        .populate('contact', 'name phone')
        .populate('assignedTo', 'name email')
        .sort({ lastActivityAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Conversation.countDocuments(query)
    ]);
    
    return {
      conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
    
  } catch (error) {
    logger.error('[Tags] Failed to get conversations by tags:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAG ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get tag usage analytics
 */
async function getTagAnalytics(workspaceId) {
  try {
    const tags = await Tag.find({ workspace: workspaceId })
      .sort({ 'usageCount.total': -1 })
      .limit(50)
      .lean();
    
    const totalContacts = await Contact.countDocuments({ 
      workspace: workspaceId,
      tags: { $exists: true, $ne: [] }
    });
    
    const totalConversations = await Conversation.countDocuments({
      workspace: workspaceId,
      tags: { $exists: true, $ne: [] }
    });
    
    return {
      tags: tags.map(t => ({
        id: t._id,
        name: t.name,
        color: t.color,
        contacts: t.usageCount.contacts,
        conversations: t.usageCount.conversations,
        total: t.usageCount.total
      })),
      summary: {
        totalTags: tags.length,
        contactsWithTags: totalContacts,
        conversationsWithTags: totalConversations
      }
    };
    
  } catch (error) {
    logger.error('[Tags] Failed to get tag analytics:', error);
    throw error;
  }
}

module.exports = {
  // CRUD
  createTag,
  updateTag,
  deleteTag,
  getTags,
  
  // Contact tagging
  addTagsToContact,
  removeTagsFromContact,
  
  // Conversation tagging
  addTagsToConversation,
  removeTagsFromConversation,
  
  // Bulk operations
  bulkAddTagsToContacts,
  bulkRemoveTagsFromContacts,
  
  // Filtering
  getContactsByTags,
  getConversationsByTags,
  
  // Analytics
  getTagAnalytics
};
