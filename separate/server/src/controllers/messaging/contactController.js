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
  const { id: contactId } = req.params;

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

/**
 * Export contacts to CSV
 */
const exportContacts = asyncHandler(async (req, res) => {
  const workspaceId = req.user.workspace;
  const { Parser } = require('json2csv'); // Requires json2csv package
  
  const options = { limit: 10000 }; // Maximum export limit
  const result = await contactService.listContacts(workspaceId, options);
  
  if (!result.data || result.data.length === 0) {
    return res.status(404).json({ success: false, message: 'No contacts found to export' });
  }

  try {
    const fields = ['name', 'phone', 'leadStatus', 'createdAt', 'tags', 'assignedAgentId'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(result.data);

    res.header('Content-Type', 'text/csv');
    res.attachment(`contacts_export_${new Date().toISOString()}.csv`);
    return res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to generate CSV' });
  }
});

module.exports = {
  createContact,
  getContact,
  listContacts,
  updateContact,
  deleteContact,
  bulkImportContacts,
  exportContacts,
  updateOptOut,
  getContactStats
};