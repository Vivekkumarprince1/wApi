/**
 * CONTACT SERVICE
 * Business logic for contact management operations
 */

const { contactRepository } = require('../../repositories');
const { createError, ERROR_CODES } = require('../../utils/errorFormatter');
const { transformContact } = require('../../utils/transformers');
const logger = require('../../utils/logger');

class ContactService {
  /**
   * Create a new contact
   */
  async createContact(workspaceId, contactData) {
    try {
      logger.info('Creating contact', { workspaceId, phone: contactData.phone });

      // Check if contact already exists
      const existingContact = await contactRepository.findByPhone(contactData.phone, workspaceId);
      if (existingContact) {
        throw createError(
          ERROR_CODES.ALREADY_EXISTS,
          'Contact with this phone number already exists',
          { phone: contactData.phone }
        );
      }

      // Normalize contact data
      const normalizedData = this.normalizeContactPayload(contactData);

      // Create contact
      const contact = await contactRepository.create({
        workspace: workspaceId,
        ...normalizedData
      });

      logger.info('Contact created successfully', { contactId: contact._id, workspaceId });
      return transformContact(contact);
    } catch (error) {
      logger.error('Failed to create contact', { error: error.message, workspaceId });
      throw error;
    }
  }

  /**
   * Get contact by ID
   */
  async getContact(workspaceId, contactId) {
    try {
      const contact = await contactRepository.findById(contactId);

      if (!contact || contact.workspace.toString() !== workspaceId) {
        throw createError(ERROR_CODES.NOT_FOUND, 'Contact not found');
      }

      return transformContact(contact);
    } catch (error) {
      logger.error('Failed to get contact', { error: error.message, contactId, workspaceId });
      throw error;
    }
  }

  /**
   * List contacts with pagination and filtering
   */
  async listContacts(workspaceId, options = {}) {
    try {
      const { page = 1, limit = 20, search, tags } = options;

      let conditions = { workspace: workspaceId };

      // Apply search filter
      if (search) {
        // This will be handled by the repository's search method
        return await contactRepository.search(workspaceId, search, { page, limit });
      }

      // Apply tags filter
      if (tags && tags.length > 0) {
        return await contactRepository.findByTags(workspaceId, tags, { page, limit });
      }

      // Get paginated results
      const result = await contactRepository.paginate(conditions, {
        page,
        limit,
        sort: { createdAt: -1 }
      });

      return {
        data: result.documents.map(contact => transformContact(contact)),
        pagination: result.pagination
      };
    } catch (error) {
      logger.error('Failed to list contacts', { error: error.message, workspaceId, options });
      throw error;
    }
  }

  /**
   * Update contact
   */
  async updateContact(workspaceId, contactId, updateData) {
    try {
      logger.info('Updating contact', { contactId, workspaceId });

      // Verify contact exists and belongs to workspace
      const contact = await contactRepository.findById(contactId);
      if (!contact || contact.workspace.toString() !== workspaceId) {
        throw createError(ERROR_CODES.NOT_FOUND, 'Contact not found');
      }

      // Normalize update data
      const normalizedData = this.normalizeContactPayload(updateData);

      // Update contact
      const updatedContact = await contactRepository.updateById(contactId, {
        ...normalizedData,
        updatedAt: new Date()
      });

      logger.info('Contact updated successfully', { contactId, workspaceId });
      return transformContact(updatedContact);
    } catch (error) {
      logger.error('Failed to update contact', { error: error.message, contactId, workspaceId });
      throw error;
    }
  }

  /**
   * Delete contact
   */
  async deleteContact(workspaceId, contactId) {
    try {
      logger.info('Deleting contact', { contactId, workspaceId });

      // Verify contact exists and belongs to workspace
      const contact = await contactRepository.findById(contactId);
      if (!contact || contact.workspace.toString() !== workspaceId) {
        throw createError(ERROR_CODES.NOT_FOUND, 'Contact not found');
      }

      await contactRepository.deleteById(contactId);

      logger.info('Contact deleted successfully', { contactId, workspaceId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete contact', { error: error.message, contactId, workspaceId });
      throw error;
    }
  }

  /**
   * Bulk import contacts
   */
  async bulkImportContacts(workspaceId, contactsData) {
    try {
      logger.info('Bulk importing contacts', { workspaceId, count: contactsData.length });

      const results = {
        successful: [],
        failed: []
      };

      for (const contactData of contactsData) {
        try {
          const contact = await this.createContact(workspaceId, contactData);
          results.successful.push(contact);
        } catch (error) {
          results.failed.push({
            data: contactData,
            error: error.message
          });
        }
      }

      logger.info('Bulk import completed', {
        workspaceId,
        successful: results.successful.length,
        failed: results.failed.length
      });

      return results;
    } catch (error) {
      logger.error('Failed to bulk import contacts', { error: error.message, workspaceId });
      throw error;
    }
  }

  /**
   * Update contact opt-out status
   */
  async updateOptOut(workspaceId, contactId, optOutData) {
    try {
      logger.info('Updating contact opt-out status', { contactId, workspaceId, optOutData });

      // Verify contact exists and belongs to workspace
      const contact = await contactRepository.findById(contactId);
      if (!contact || contact.workspace.toString() !== workspaceId) {
        throw createError(ERROR_CODES.NOT_FOUND, 'Contact not found');
      }

      await contactRepository.updateOptOut(contactId, optOutData);

      logger.info('Contact opt-out status updated', { contactId, workspaceId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to update opt-out status', { error: error.message, contactId, workspaceId });
      throw error;
    }
  }

  /**
   * Get contact statistics
   */
  async getContactStats(workspaceId) {
    try {
      return await contactRepository.getStats(workspaceId);
    } catch (error) {
      logger.error('Failed to get contact stats', { error: error.message, workspaceId });
      throw error;
    }
  }

  /**
   * Update contact activity timestamps
   */
  async updateActivity(contactId, activityType) {
    try {
      await contactRepository.updateLastActivity(contactId, activityType);
    } catch (error) {
      logger.error('Failed to update contact activity', { error: error.message, contactId, activityType });
      throw error;
    }
  }

  /**
   * Normalize contact payload data
   */
  normalizeContactPayload(payload = {}) {
    const firstName = payload.firstName ?? payload.first_name;
    const lastName = payload.lastName ?? payload.last_name;
    const email = payload.email;

    const metadata = {
      ...(payload.metadata || {})
    };

    if (typeof firstName === 'string') metadata.firstName = firstName;
    if (typeof lastName === 'string') metadata.lastName = lastName;
    if (typeof email === 'string') metadata.email = email;

    const normalized = {
      phone: payload.phone || payload.phone_number,
      name: payload.name,
      tags: Array.isArray(payload.tags) ? payload.tags : undefined,
      metadata
    };

    if (!normalized.name && (metadata.firstName || metadata.lastName)) {
      normalized.name = `${metadata.firstName || ''} ${metadata.lastName || ''}`.trim();
    }

    return normalized;
  }
}

module.exports = new ContactService();