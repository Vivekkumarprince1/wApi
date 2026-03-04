/**
 * CONTACT REPOSITORY
 * Data access layer for Contact model operations
 */

const BaseRepository = require('./baseRepository');
const { Contact } = require('../models');

class ContactRepository extends BaseRepository {
  constructor() {
    super(Contact);
  }

  /**
   * Find contact by phone number and workspace
   */
  async findByPhone(phone, workspaceId) {
    return this.findOne({
      phone: phone,
      workspace: workspaceId
    });
  }

  /**
   * Find contacts by workspace with pagination
   */
  async findByWorkspace(workspaceId, options = {}) {
    const conditions = { workspace: workspaceId };
    return this.paginate(conditions, options);
  }

  /**
   * Find contacts by tags
   */
  async findByTags(workspaceId, tags, options = {}) {
    const conditions = {
      workspace: workspaceId,
      tags: { $in: tags }
    };
    return this.paginate(conditions, options);
  }

  /**
   * Search contacts by name or phone
   */
  async search(workspaceId, query, options = {}) {
    const conditions = {
      workspace: workspaceId,
      $or: [
        { name: new RegExp(query, 'i') },
        { phone: new RegExp(query, 'i') },
        { 'metadata.email': new RegExp(query, 'i') }
      ]
    };
    return this.paginate(conditions, options);
  }

  /**
   * Update contact opt-out status
   */
  async updateOptOut(contactId, optOutData) {
    return this.updateById(contactId, {
      optOut: optOutData,
      updatedAt: new Date()
    });
  }

  /**
   * Get contacts for campaign targeting
   */
  async getCampaignContacts(workspaceId, contactIds) {
    return this.find({
      _id: { $in: contactIds },
      workspace: workspaceId,
      'optOut.status': { $ne: true }
    });
  }

  /**
   * Bulk update contacts
   */
  async bulkUpdate(workspaceId, contactIds, updateData) {
    return this.updateMany(
      {
        _id: { $in: contactIds },
        workspace: workspaceId
      },
      {
        ...updateData,
        updatedAt: new Date()
      }
    );
  }

  /**
   * Get contact statistics for workspace
   */
  async getStats(workspaceId) {
    const [total, optedOut, withTags] = await Promise.all([
      this.count({ workspace: workspaceId }),
      this.count({ workspace: workspaceId, 'optOut.status': true }),
      this.count({ workspace: workspaceId, tags: { $exists: true, $ne: [] } })
    ]);

    return {
      total,
      active: total - optedOut,
      optedOut,
      withTags
    };
  }

  /**
   * Update last activity timestamps
   */
  async updateLastActivity(contactId, activityType) {
    const updateField = activityType === 'inbound' ? 'lastInboundAt' : 'lastOutboundAt';
    return this.updateById(contactId, {
      [updateField]: new Date(),
      updatedAt: new Date()
    });
  }
}

module.exports = ContactRepository;