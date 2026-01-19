/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TEMPLATE SENDING CONTROLLER
 * 
 * API endpoints for sending WhatsApp template messages.
 * Implements Interakt-style multi-tenant safe template sending.
 * 
 * Endpoints:
 * - POST /api/v1/messages/template        - Send single template
 * - POST /api/v1/messages/template/bulk   - Send to multiple recipients
 * - GET  /api/v1/messages/templates       - List sendable templates
 * - GET  /api/v1/messages/template/:id    - Get template info for sending
 * - POST /api/v1/messages/template/preview - Preview template with variables
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const templateSendingService = require('../services/templateSendingService');
const Template = require('../models/Template');
const Contact = require('../models/Contact');

// ═══════════════════════════════════════════════════════════════════════════════
// SEND TEMPLATE MESSAGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send a template message to a single recipient
 * 
 * POST /api/v1/messages/template
 * 
 * Body:
 * {
 *   "templateId": "60f1234567890abcdef12345",   // OR templateName
 *   "templateName": "order_update",              // If templateId not provided
 *   "to": "919876543210",                        // Recipient phone
 *   "variables": {
 *     "header": ["John Doe"],                    // Header variables (if any)
 *     "body": ["John", "Order #12345"],          // Body variables
 *     "buttons": ["PROMO2024"]                   // Button variables (if any)
 *   },
 *   "contactId": "60f1234567890abcdef12346"     // Optional contact link
 * }
 */
async function sendTemplateMessage(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const {
      templateId,
      templateName,
      to,
      variables,
      contactId,
      campaignId
    } = req.body;

    // Validate required fields
    if (!templateId && !templateName) {
      return res.status(400).json({
        success: false,
        error: 'Either templateId or templateName is required'
      });
    }

    if (!to) {
      return res.status(400).json({
        success: false,
        error: 'Recipient phone number (to) is required'
      });
    }

    // Send template
    const result = await templateSendingService.sendTemplate({
      workspaceId,
      templateId,
      templateName,
      to,
      variables: variables || {},
      contactId,
      meta: { campaignId }
    });

    res.json({
      success: true,
      message: 'Template message sent successfully',
      data: result
    });

  } catch (error) {
    console.error('[Template Send Error]', error.code, error.message);
    
    // Map error codes to HTTP status codes
    const statusMap = {
      TEMPLATE_NOT_FOUND: 404,
      TEMPLATE_NOT_APPROVED: 400,
      TEMPLATE_OWNERSHIP_MISMATCH: 403,
      VARIABLE_COUNT_MISMATCH: 400,
      WORKSPACE_NOT_CONFIGURED: 400,
      PHONE_NOT_CONFIGURED: 400,
      META_API_ERROR: 502,
      INVALID_RECIPIENT: 400
    };

    const status = statusMap[error.code] || 500;
    
    res.status(status).json({
      success: false,
      error: error.message,
      code: error.code,
      details: error.metaError || null
    });
  }
}

/**
 * Send template to multiple recipients
 * 
 * POST /api/v1/messages/template/bulk
 * 
 * Body:
 * {
 *   "templateId": "60f1234567890abcdef12345",
 *   "recipients": [
 *     { "to": "919876543210", "variables": { "body": ["John", "#123"] }, "contactId": "..." },
 *     { "to": "919876543211", "variables": { "body": ["Jane", "#124"] } }
 *   ],
 *   "campaignId": "optional-campaign-id"
 * }
 */
async function sendTemplateBulk(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const {
      templateId,
      templateName,
      recipients,
      campaignId
    } = req.body;

    // Validate required fields
    if (!templateId && !templateName) {
      return res.status(400).json({
        success: false,
        error: 'Either templateId or templateName is required'
      });
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Recipients array is required and must not be empty'
      });
    }

    // Limit bulk size
    const MAX_BULK_SIZE = 1000;
    if (recipients.length > MAX_BULK_SIZE) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${MAX_BULK_SIZE} recipients per request`
      });
    }

    // Send bulk
    const result = await templateSendingService.sendTemplateBulk({
      workspaceId,
      templateId,
      templateName,
      recipients,
      meta: { campaignId, bulkSend: true }
    });

    res.json({
      success: result.success,
      message: `Sent ${result.sent}/${result.total} messages`,
      data: {
        total: result.total,
        sent: result.sent,
        failed: result.failed,
        results: result.results
      }
    });

  } catch (error) {
    console.error('[Template Bulk Send Error]', error.code, error.message);
    
    res.status(error.code === 'TEMPLATE_NOT_FOUND' ? 404 : 500).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE LISTING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * List templates available for sending (approved only)
 * 
 * GET /api/v1/messages/templates
 * 
 * Query params:
 * - category: MARKETING, UTILITY, AUTHENTICATION
 * - search: Search term
 * - page: Page number
 * - limit: Items per page
 */
async function listSendableTemplates(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { category, search, page = 1, limit = 50 } = req.query;

    const result = await templateSendingService.listSendableTemplates(workspaceId, {
      category,
      search,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('[List Sendable Templates Error]', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get template info for sending (variables required, preview)
 * 
 * GET /api/v1/messages/template/:id
 */
async function getTemplateForSending(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { id } = req.params;

    const info = await templateSendingService.getTemplateInfo(workspaceId, id);

    if (!info) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.json({
      success: true,
      template: info
    });

  } catch (error) {
    console.error('[Get Template Info Error]', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREVIEW & VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Preview template with variables (without sending)
 * 
 * POST /api/v1/messages/template/preview
 * 
 * Body:
 * {
 *   "templateId": "60f1234567890abcdef12345",
 *   "variables": {
 *     "body": ["John", "Order #12345"]
 *   }
 * }
 */
async function previewTemplate(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { templateId, templateName, variables } = req.body;

    // Get template
    let template;
    if (templateId) {
      template = await Template.findOne({ _id: templateId, workspace: workspaceId });
    } else if (templateName) {
      template = await Template.findOne({ name: templateName.toLowerCase(), workspace: workspaceId });
    }

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Validate variables
    const validation = templateSendingService.validateVariables(template, variables || {});

    // Build preview text with variables replaced
    let previewHeader = template.header?.text || '';
    let previewBody = template.body?.text || '';

    // Replace header variables
    if (variables?.header) {
      variables.header.forEach((value, index) => {
        previewHeader = previewHeader.replace(`{{${index + 1}}}`, value);
      });
    }

    // Replace body variables
    if (variables?.body) {
      variables.body.forEach((value, index) => {
        previewBody = previewBody.replace(`{{${index + 1}}}`, value);
      });
    }

    // Build payload preview
    const { payload } = templateSendingService.buildTemplatePayload(
      template,
      '919999999999', // Dummy number for preview
      variables || {}
    );

    res.json({
      success: true,
      template: {
        id: template._id,
        name: template.name,
        category: template.category,
        language: template.language,
        status: template.status,
        canSend: template.status === 'APPROVED'
      },
      validation,
      preview: {
        header: template.header?.enabled ? {
          format: template.header.format,
          text: previewHeader,
          mediaUrl: template.header.mediaUrl
        } : null,
        body: previewBody,
        footer: template.footer?.enabled ? template.footer.text : null,
        buttons: template.buttons?.enabled ? template.buttons.items.map(btn => ({
          type: btn.type,
          text: btn.text,
          url: btn.url,
          phoneNumber: btn.phoneNumber
        })) : []
      },
      metaPayload: payload
    });

  } catch (error) {
    console.error('[Preview Template Error]', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Send template to a contact by contact ID
 * 
 * POST /api/v1/messages/template/contact/:contactId
 * 
 * Body:
 * {
 *   "templateId": "60f1234567890abcdef12345",
 *   "variables": { "body": ["John", "#123"] }
 * }
 */
async function sendTemplateToContact(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { contactId } = req.params;
    const { templateId, templateName, variables } = req.body;

    // Get contact
    const contact = await Contact.findOne({
      _id: contactId,
      workspace: workspaceId
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }

    if (!contact.phone) {
      return res.status(400).json({
        success: false,
        error: 'Contact does not have a phone number'
      });
    }

    // Send template
    const result = await templateSendingService.sendTemplate({
      workspaceId,
      templateId,
      templateName,
      to: contact.phone,
      variables: variables || {},
      contactId: contact._id
    });

    res.json({
      success: true,
      message: 'Template message sent to contact',
      data: {
        ...result,
        contact: {
          id: contact._id,
          name: contact.name,
          phone: contact.phone
        }
      }
    });

  } catch (error) {
    console.error('[Template Send to Contact Error]', error.code, error.message);
    
    const statusMap = {
      TEMPLATE_NOT_FOUND: 404,
      TEMPLATE_NOT_APPROVED: 400,
      VARIABLE_COUNT_MISMATCH: 400,
      META_API_ERROR: 502
    };

    res.status(statusMap[error.code] || 500).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSATION ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get template send statistics
 * 
 * GET /api/v1/messages/template/stats
 */
async function getTemplateStats(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { startDate, endDate, templateId } = req.query;

    const Message = require('../models/Message');
    
    const matchQuery = {
      workspace: workspaceId,
      type: 'template',
      direction: 'outbound'
    };

    if (templateId) {
      matchQuery['meta.templateId'] = templateId;
    }

    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    const stats = await Message.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            templateName: '$meta.templateName',
            category: '$meta.templateCategory',
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: {
            templateName: '$_id.templateName',
            category: '$_id.category'
          },
          total: { $sum: '$count' },
          statuses: {
            $push: {
              status: '$_id.status',
              count: '$count'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          templateName: '$_id.templateName',
          category: '$_id.category',
          total: 1,
          sent: {
            $reduce: {
              input: '$statuses',
              initialValue: 0,
              in: {
                $cond: [
                  { $eq: ['$$this.status', 'sent'] },
                  { $add: ['$$value', '$$this.count'] },
                  '$$value'
                ]
              }
            }
          },
          delivered: {
            $reduce: {
              input: '$statuses',
              initialValue: 0,
              in: {
                $cond: [
                  { $eq: ['$$this.status', 'delivered'] },
                  { $add: ['$$value', '$$this.count'] },
                  '$$value'
                ]
              }
            }
          },
          read: {
            $reduce: {
              input: '$statuses',
              initialValue: 0,
              in: {
                $cond: [
                  { $eq: ['$$this.status', 'read'] },
                  { $add: ['$$value', '$$this.count'] },
                  '$$value'
                ]
              }
            }
          },
          failed: {
            $reduce: {
              input: '$statuses',
              initialValue: 0,
              in: {
                $cond: [
                  { $eq: ['$$this.status', 'failed'] },
                  { $add: ['$$value', '$$this.count'] },
                  '$$value'
                ]
              }
            }
          }
        }
      },
      { $sort: { total: -1 } }
    ]);

    // Category summary
    const categorySummary = await Message.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$meta.templateCategory',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      stats: {
        templates: stats,
        byCategory: categorySummary.reduce((acc, item) => {
          acc[item._id || 'unknown'] = item.count;
          return acc;
        }, {}),
        total: stats.reduce((sum, s) => sum + s.total, 0)
      }
    });

  } catch (error) {
    console.error('[Template Stats Error]', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  sendTemplateMessage,
  sendTemplateBulk,
  listSendableTemplates,
  getTemplateForSending,
  previewTemplate,
  sendTemplateToContact,
  getTemplateStats
};
