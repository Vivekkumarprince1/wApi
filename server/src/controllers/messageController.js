const Message = require('../models/Message');
const Contact = require('../models/Contact');
const Template = require('../models/Template');
const Workspace = require('../models/Workspace');
const whatsappService = require('../services/whatsappService');
const metaService = require('../services/metaService');

// Send a message (queues it for sending)
async function sendMessage(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { contactId, body } = req.body;
    const contact = await Contact.findOne({ _id: contactId, workspace });
    if (!contact) return res.status(404).json({ message: 'Contact not found' });
    const message = await Message.create({ workspace, contact: contact._id, direction: 'outbound', body, status: 'queued' });
    // enqueue send job (service handles retry and queue)
    whatsappService.enqueueSend(message._id);
    res.status(202).json({ message: 'Queued', id: message._id });
  } catch (err) { next(err); }
}

// Webhook endpoint to receive messages or status updates from WhatsApp Cloud
async function webhookHandler(req, res, next) {
  try {
    // WhatsApp sends a specific envelope. We parse minimal fields for demo.
    const data = req.body;
    // Example: parse inbound message and create Message record
    // NOTE: Real WhatsApp webhook format needs robust parsing per docs.
    if (data.entry) {
      // iterate entries
      for (const entry of data.entry) {
        // push to processing pipeline; simplified here
        // TODO: implement proper parsing based on WhatsApp payload
      }
    }
    res.sendStatus(200);
  } catch (err) { next(err); }
}

module.exports = { sendMessage, webhookHandler };

// Send a WhatsApp template message immediately
async function sendTemplateMessage(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { contactId, templateId, variables = [], language = 'en' } = req.body;

    if (!contactId || !templateId) {
      return res.status(400).json({ message: 'contactId and templateId are required' });
    }

    const contact = await Contact.findOne({ _id: contactId, workspace: workspaceId });
    if (!contact) return res.status(404).json({ message: 'Contact not found' });

    const template = await Template.findOne({ _id: templateId, workspace: workspaceId });
    if (!template) return res.status(404).json({ message: 'Template not found' });

    if (template.status !== 'APPROVED') {
      return res.status(400).json({ message: 'Template must be approved before sending' });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    const accessToken = workspace.whatsappAccessToken;
    const phoneNumberId = workspace.whatsappPhoneNumberId;
    if (!accessToken || !phoneNumberId) {
      return res.status(400).json({ message: 'WABA credentials not configured' });
    }

    // Build components array for Meta API
    const components = buildTemplateComponents(template, variables);

    // Create a queued message record for tracking
    const message = await Message.create({
      workspace: workspaceId,
      contact: contact._id,
      direction: 'outbound',
      type: 'template',
      body: renderTemplatePreview(template, variables),
      status: 'sending',
      meta: {
        templateId: template._id,
        templateName: template.name,
        variables,
        language
      }
    });

    try {
      // Send via Meta Cloud API
      const result = await metaService.sendTemplateMessage(
        accessToken,
        phoneNumberId,
        contact.phone,
        template.name,
        language,
        components
      );

      // Update message status
      message.status = 'sent';
      message.meta.whatsappId = result.messageId;
      message.meta.whatsappResponses = [result];
      message.sentAt = new Date();
      await message.save();

      // Increment workspace usage
      workspace.usage.messages = (workspace.usage.messages || 0) + 1;
      await workspace.save();

      return res.status(200).json({ 
        success: true, 
        message: 'Template message sent successfully',
        id: message._id, 
        whatsappId: result.messageId 
      });
    } catch (err) {
      message.status = 'failed';
      message.meta.errors = [err.message];
      await message.save();
      
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to send template message',
        error: err.message 
      });
    }
  } catch (err) {
    next(err);
  }
}

// Send bulk template messages to multiple contacts
async function sendBulkTemplateMessage(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { contactIds, templateId, language = 'en', variablesMap = {} } = req.body;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ message: 'contactIds array is required' });
    }

    if (!templateId) {
      return res.status(400).json({ message: 'templateId is required' });
    }

    const template = await Template.findOne({ _id: templateId, workspace: workspaceId });
    if (!template) return res.status(404).json({ message: 'Template not found' });

    if (template.status !== 'APPROVED') {
      return res.status(400).json({ message: 'Template must be approved before sending' });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    const accessToken = workspace.whatsappAccessToken;
    const phoneNumberId = workspace.whatsappPhoneNumberId;
    if (!accessToken || !phoneNumberId) {
      return res.status(400).json({ message: 'WABA credentials not configured' });
    }

    // Fetch all contacts
    const contacts = await Contact.find({ 
      _id: { $in: contactIds }, 
      workspace: workspaceId 
    });

    if (contacts.length === 0) {
      return res.status(404).json({ message: 'No valid contacts found' });
    }

    const results = {
      total: contacts.length,
      sent: 0,
      failed: 0,
      details: []
    };

    // Send to each contact
    for (const contact of contacts) {
      try {
        // Get variables for this contact (or use default)
        const variables = variablesMap[contact._id.toString()] || variablesMap.default || [];
        
        // Build components
        const components = buildTemplateComponents(template, variables);

        // Create message record
        const message = await Message.create({
          workspace: workspaceId,
          contact: contact._id,
          direction: 'outbound',
          type: 'template',
          body: renderTemplatePreview(template, variables),
          status: 'sending',
          meta: {
            templateId: template._id,
            templateName: template.name,
            variables,
            language,
            bulk: true
          }
        });

        // Send via Meta API
        const result = await metaService.sendTemplateMessage(
          accessToken,
          phoneNumberId,
          contact.phone,
          template.name,
          language,
          components
        );

        // Update message status
        message.status = 'sent';
        message.meta.whatsappId = result.messageId;
        message.sentAt = new Date();
        await message.save();

        results.sent++;
        results.details.push({
          contactId: contact._id,
          phone: contact.phone,
          status: 'sent',
          messageId: message._id,
          whatsappId: result.messageId
        });

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        results.failed++;
        results.details.push({
          contactId: contact._id,
          phone: contact.phone,
          status: 'failed',
          error: error.message
        });
      }
    }

    // Update workspace usage
    workspace.usage.messages = (workspace.usage.messages || 0) + results.sent;
    await workspace.save();

    return res.status(200).json({
      success: true,
      message: `Bulk send completed: ${results.sent} sent, ${results.failed} failed`,
      results
    });

  } catch (err) {
    next(err);
  }
}

// Helper function to build template components for Meta API
function buildTemplateComponents(template, variables) {
  const components = [];

  // Find HEADER component
  const headerComponent = template.components?.find(c => c.type === 'HEADER');
  if (headerComponent && variables.header) {
    components.push({
      type: 'header',
      parameters: Array.isArray(variables.header) 
        ? variables.header.map(v => ({ type: 'text', text: v }))
        : [{ type: 'text', text: variables.header }]
    });
  }

  // Find BODY component
  const bodyComponent = template.components?.find(c => c.type === 'BODY');
  if (bodyComponent && variables.body && variables.body.length > 0) {
    components.push({
      type: 'body',
      parameters: variables.body.map(v => ({ type: 'text', text: v }))
    });
  }

  // Find BUTTON components
  const buttonComponents = template.components?.filter(c => c.type === 'BUTTONS');
  if (buttonComponents && variables.buttons && variables.buttons.length > 0) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: 0,
      parameters: variables.buttons.map(v => ({ type: 'text', text: v }))
    });
  }

  return components;
}

// Helper function to render template preview with variables
function renderTemplatePreview(template, variables) {
  let preview = '';

  // Add header
  const headerComponent = template.components?.find(c => c.type === 'HEADER');
  if (headerComponent) {
    let headerText = headerComponent.text || '';
    if (variables.header) {
      const headerVars = Array.isArray(variables.header) ? variables.header : [variables.header];
      headerVars.forEach((v, i) => {
        headerText = headerText.replace(`{{${i + 1}}}`, v);
      });
    }
    preview += `${headerText}\n\n`;
  }

  // Add body
  const bodyComponent = template.components?.find(c => c.type === 'BODY');
  if (bodyComponent) {
    let bodyText = bodyComponent.text || '';
    if (variables.body && Array.isArray(variables.body)) {
      variables.body.forEach((v, i) => {
        bodyText = bodyText.replace(`{{${i + 1}}}`, v);
      });
    }
    preview += bodyText;
  }

  // Add footer
  const footerComponent = template.components?.find(c => c.type === 'FOOTER');
  if (footerComponent) {
    preview += `\n\n${footerComponent.text}`;
  }

  return preview || 'Template message';
}

module.exports.sendTemplateMessage = sendTemplateMessage;
module.exports.sendBulkTemplateMessage = sendBulkTemplateMessage;
