/**
 * CONTACT CONTROLLER
 * HTTP request handlers for contact endpoints
 */

const contactService = require('../../services/messaging/contactService');
const { asyncHandler } = require('../../utils/errorFormatter');
const { contactValidations, handleValidationErrors } = require('../../utils/validation');
const { transformPaginationResult } = require('../../utils/transformers');

/**
 * Create a new contact
 */
const createContact = asyncHandler(async (req, res) => {
  const workspaceId = req.user.workspace;
  const contact = await contactService.createContact(workspaceId, req.body);

  res.status(201).json({
    success: true,
    data: contact
  });
});

/**
 * Get contact by ID
 */
const getContact = asyncHandler(async (req, res) => {
  const workspaceId = req.user.workspace;
  const { contactId } = req.params;

  const contact = await contactService.getContact(workspaceId, contactId);

  res.json({
    success: true,
    data: contact
  });
});

/**
 * List contacts with pagination and filtering
 */
const listContacts = asyncHandler(async (req, res) => {
  const workspaceId = req.user.workspace;
  const options = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20,
    search: req.query.search,
    tags: req.query.tags ? req.query.tags.split(',') : undefined
  };

  const result = await contactService.listContacts(workspaceId, options);

  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination
  });
});

/**
 * Update contact
 */
const updateContact = asyncHandler(async (req, res) => {
  const workspaceId = req.user.workspace;
  const { contactId } = req.params;

  const contact = await contactService.updateContact(workspaceId, contactId, req.body);

  res.json({
    success: true,
    data: contact
  });
});

/**
 * Delete contact
 */
const deleteContact = asyncHandler(async (req, res) => {
  const workspaceId = req.user.workspace;
  const { contactId } = req.params;

  await contactService.deleteContact(workspaceId, contactId);

  res.json({
    success: true,
    message: 'Contact deleted successfully'
  });
});

/**
 * Bulk import contacts
 */
const bulkImportContacts = asyncHandler(async (req, res) => {
  const workspaceId = req.user.workspace;
  const { contacts } = req.body;

  if (!Array.isArray(contacts)) {
    return res.status(400).json({
      success: false,
      message: 'Contacts must be an array'
    });
  }

  const results = await contactService.bulkImportContacts(workspaceId, contacts);

  res.json({
    success: true,
    data: results
  });
});

/**
 * Update contact opt-out status
 */
const updateOptOut = asyncHandler(async (req, res) => {
  const workspaceId = req.user.workspace;
  const { contactId } = req.params;
  const { status, reason } = req.body;

  const optOutData = {
    status: Boolean(status),
    optedOutAt: status ? new Date() : null,
    optedOutVia: reason || 'manual'
  };

  if (!status) {
    optOutData.optedBackInAt = new Date();
  }

  await contactService.updateOptOut(workspaceId, contactId, optOutData);

  res.json({
    success: true,
    message: `Contact ${status ? 'opted out' : 'opted back in'} successfully`
  });
});

/**
 * Get contact statistics
 */
const getContactStats = asyncHandler(async (req, res) => {
  const workspaceId = req.user.workspace;

  const stats = await contactService.getContactStats(workspaceId);

  res.json({
    success: true,
    data: stats
  });
});

module.exports = {
  createContact,
  getContact,
  listContacts,
  updateContact,
  deleteContact,
  bulkImportContacts,
  updateOptOut,
  getContactStats
};