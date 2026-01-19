/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BSP TEMPLATE CONTROLLER (INTERAKT-STYLE)
 * 
 * Full-featured template management with:
 * - Structured component-based templates
 * - BSP parent WABA submission
 * - Validation middleware integration
 * - Approval history tracking
 * - Template duplication
 * - Webhook status sync
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const Template = require('../models/Template');
const Workspace = require('../models/Workspace');
const bspMessagingService = require('../services/bspMessagingService');
const bspConfig = require('../config/bspConfig');
const { validateTemplate, buildMetaPayload, LIMITS } = require('../middlewares/templateValidation');

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE TEMPLATE (DRAFT)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new template in DRAFT status
 * Uses structured components (header, body, footer, buttons)
 */
async function createTemplate(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { 
      name, 
      language = 'en', 
      category = 'MARKETING',
      header,
      body,
      footer,
      buttons 
    } = req.body;
    
    // Check for duplicate name in workspace
    const existing = await Template.findOne({ 
      workspace: workspaceId, 
      name: name.toLowerCase() 
    });
    
    if (existing) {
      return res.status(400).json({ 
        success: false,
        message: 'Template with this name already exists in your workspace',
        code: 'DUPLICATE_NAME'
      });
    }
    
    // Create template with structured components
    const template = await Template.create({
      workspace: workspaceId,
      name: name.toLowerCase(),
      language,
      category: Template.getValidMetaCategory(category),
      header: header || { enabled: false, format: 'NONE' },
      body: {
        text: body?.text || '',
        examples: body?.examples || []
      },
      footer: footer || { enabled: false, text: '' },
      buttons: buttons || { enabled: false, items: [] },
      status: 'DRAFT',
      createdBy: req.user._id,
      source: 'LOCAL'
    });
    
    // Track workspace usage
    await Workspace.findByIdAndUpdate(workspaceId, {
      $inc: { 'usage.templates': 1 }
    });
    
    // Include any warnings from validation
    const response = { 
      success: true,
      template,
      message: 'Template created as draft'
    };
    
    if (req.templateWarnings?.length > 0) {
      response.warnings = req.templateWarnings;
    }
    
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIST TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * List all templates for workspace with filtering
 */
async function listTemplates(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { 
      status, 
      category, 
      search, 
      language,
      page = 1, 
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Build query
    const query = { workspace: workspaceId };
    
    if (status) {
      const statuses = status.toUpperCase().split(',');
      query.status = { $in: statuses };
    }
    
    if (category) {
      const categories = category.toUpperCase().split(',');
      query.category = { $in: categories };
    }
    
    if (language) {
      query.language = language;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'body.text': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    
    // Execute query with pagination
    const [templates, totalCount] = await Promise.all([
      Template.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'name email')
        .lean(),
      Template.countDocuments(query)
    ]);
    
    // Calculate status counts
    const statusCounts = await Template.aggregate([
      { $match: { workspace: workspaceId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    const counts = {
      all: totalCount,
      draft: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      paused: 0,
      disabled: 0
    };
    
    statusCounts.forEach(({ _id, count }) => {
      counts[_id.toLowerCase()] = count;
    });
    
    res.json({
      success: true,
      templates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        hasMore: skip + templates.length < totalCount
      },
      counts
    });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET SINGLE TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get template details with full history
 */
async function getTemplate(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    
    const template = await Template.findOne({ 
      _id: req.params.id, 
      workspace: workspaceId 
    })
      .populate('createdBy', 'name email')
      .lean();
    
    if (!template) {
      return res.status(404).json({ 
        success: false,
        message: 'Template not found' 
      });
    }
    
    // Add computed properties
    template.canEdit = ['DRAFT', 'REJECTED'].includes(template.status);
    template.canSubmit = ['DRAFT', 'REJECTED'].includes(template.status);
    template.canSend = template.status === 'APPROVED';
    template.variableCount = (template.body?.text?.match(/\{\{(\d+)\}\}/g) || []).length;
    
    res.json({ success: true, template });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Update template (only if in editable status)
 */
async function updateTemplate(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { 
      name, 
      language, 
      category, 
      header, 
      body, 
      footer, 
      buttons 
    } = req.body;
    
    const template = await Template.findOne({ 
      _id: req.params.id, 
      workspace: workspaceId 
    });
    
    if (!template) {
      return res.status(404).json({ 
        success: false,
        message: 'Template not found' 
      });
    }
    
    // Check if editable
    if (!template.canEdit()) {
      return res.status(400).json({
        success: false,
        message: `Cannot edit template with status: ${template.status}. Only DRAFT and REJECTED templates can be edited.`,
        code: 'TEMPLATE_NOT_EDITABLE'
      });
    }
    
    // Check for duplicate name if name is being changed
    if (name && name.toLowerCase() !== template.name) {
      const existing = await Template.findOne({
        workspace: workspaceId,
        name: name.toLowerCase(),
        _id: { $ne: template._id }
      });
      
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Template with this name already exists',
          code: 'DUPLICATE_NAME'
        });
      }
      
      template.name = name.toLowerCase();
    }
    
    // Update fields
    if (language !== undefined) template.language = language;
    if (category !== undefined) template.category = Template.getValidMetaCategory(category);
    if (header !== undefined) template.header = header;
    if (body !== undefined) template.body = body;
    if (footer !== undefined) template.footer = footer;
    if (buttons !== undefined) template.buttons = buttons;
    
    // Reset to draft if was rejected
    if (template.status === 'REJECTED') {
      template.status = 'DRAFT';
    }
    
    await template.save();
    
    // Validate and return warnings
    const validation = validateTemplate(template.toObject());
    
    res.json({ 
      success: true,
      template,
      message: 'Template updated',
      warnings: validation.warnings
    });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Delete template (also deletes from Meta if approved)
 */
async function deleteTemplate(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    
    const template = await Template.findOne({ 
      _id: req.params.id, 
      workspace: workspaceId 
    });
    
    if (!template) {
      return res.status(404).json({ 
        success: false,
        message: 'Template not found' 
      });
    }
    
    // If approved on Meta, delete from Meta first
    if (template.metaTemplateId && ['APPROVED', 'PAUSED', 'DISABLED'].includes(template.status)) {
      const workspace = await Workspace.findById(workspaceId);
      
      if (workspace.bspManaged && bspConfig.isEnabled()) {
        try {
          await bspMessagingService.deleteTemplate(template.metaTemplateName);
          console.log(`[BSP] Deleted template from Meta: ${template.metaTemplateName}`);
        } catch (metaError) {
          // Log but continue with local deletion
          console.error('[BSP] Failed to delete from Meta:', metaError.message);
        }
      }
    }
    
    await Template.deleteOne({ _id: req.params.id });
    
    // Update workspace usage
    await Workspace.findByIdAndUpdate(workspaceId, {
      $inc: { 'usage.templates': -1 }
    });
    
    res.json({ 
      success: true, 
      message: 'Template deleted successfully' 
    });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBMIT TEMPLATE TO META (BSP)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Submit template to Meta for approval via BSP parent WABA
 */
async function submitTemplate(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    
    const template = await Template.findOne({ 
      _id: req.params.id, 
      workspace: workspaceId 
    });
    
    if (!template) {
      return res.status(404).json({ 
        success: false,
        message: 'Template not found' 
      });
    }
    
    // Check if can submit
    if (!template.canSubmit()) {
      return res.status(400).json({
        success: false,
        message: `Cannot submit template with status: ${template.status}`,
        code: 'TEMPLATE_NOT_SUBMITTABLE'
      });
    }
    
    // Validate template before submission
    const validation = validateTemplate(template.toObject());
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Template validation failed',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }
    
    // Get workspace and verify BSP setup
    const workspace = await Workspace.findById(workspaceId);
    
    if (!workspace.bspManaged) {
      return res.status(400).json({
        success: false,
        message: 'Workspace is not configured for WhatsApp. Please complete onboarding.',
        code: 'BSP_NOT_CONFIGURED',
        requiresOnboarding: true
      });
    }
    
    if (!bspConfig.isEnabled()) {
      return res.status(503).json({
        success: false,
        message: 'WhatsApp service is not configured. Please contact support.',
        code: 'BSP_SERVICE_UNAVAILABLE'
      });
    }
    
    try {
      // Build namespaced name
      const workspaceIdSuffix = workspaceId.toString().slice(-8);
      const namespacedName = `${workspaceIdSuffix}_${template.name}`;
      
      // Build Meta API payload using template method
      const metaComponents = template.buildMetaComponents();
      
      // Submit to BSP
      const result = await bspMessagingService.submitTemplate(
        workspaceId,
        {
          name: template.name,
          language: template.language,
          category: template.category,
          components: metaComponents
        }
      );
      
      // Update template with submission details
      template.status = 'PENDING';
      template.metaTemplateId = result.templateId;
      template.metaTemplateName = result.namespacedName || namespacedName;
      template.submittedAt = new Date();
      template.submittedVia = 'BSP';
      
      // Add to approval history
      template.approvalHistory.push({
        status: 'PENDING',
        timestamp: new Date(),
        source: 'BSP_SUBMISSION'
      });
      
      await template.save();
      
      // Track workspace usage
      await Workspace.findByIdAndUpdate(workspaceId, {
        $inc: { 'usage.templatesSubmitted': 1 }
      });
      
      res.json({
        success: true,
        message: 'Template submitted for Meta approval',
        template,
        metaTemplateName: template.metaTemplateName,
        warnings: validation.warnings
      });
      
    } catch (metaError) {
      // Handle specific BSP errors
      const errorResponse = handleBspError(metaError);
      return res.status(errorResponse.statusCode).json(errorResponse);
    }
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC TEMPLATES FROM META
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sync template status from Meta (fetch all workspace templates)
 */
async function syncTemplates(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const workspace = await Workspace.findById(workspaceId);
    
    if (!workspace.bspManaged) {
      return res.status(400).json({
        success: false,
        message: 'Workspace is not configured for WhatsApp',
        code: 'BSP_NOT_CONFIGURED'
      });
    }
    
    if (!bspConfig.isEnabled()) {
      return res.status(503).json({
        success: false,
        message: 'WhatsApp service is not configured',
        code: 'BSP_SERVICE_UNAVAILABLE'
      });
    }
    
    // Fetch all templates from Meta
    const result = await bspMessagingService.fetchTemplates({ limit: 250 });
    
    const workspaceIdSuffix = workspaceId.toString().slice(-8);
    
    let syncStats = {
      synced: 0,
      new: 0,
      updated: 0,
      skipped: 0
    };
    
    for (const metaTemplate of result.templates) {
      // Only process templates belonging to this workspace
      if (!metaTemplate.name.startsWith(`${workspaceIdSuffix}_`)) {
        // Check for legacy templates
        const legacyTemplate = await Template.findOne({
          workspace: workspaceId,
          name: metaTemplate.name,
          language: metaTemplate.language
        });
        
        if (!legacyTemplate) {
          syncStats.skipped++;
          continue;
        }
      }
      
      // Extract original name
      const originalName = metaTemplate.name.startsWith(`${workspaceIdSuffix}_`)
        ? metaTemplate.name.replace(`${workspaceIdSuffix}_`, '')
        : metaTemplate.name;
      
      // Find or create local template
      let localTemplate = await Template.findOne({
        workspace: workspaceId,
        $or: [
          { name: originalName, language: metaTemplate.language },
          { metaTemplateName: metaTemplate.name, language: metaTemplate.language }
        ]
      });
      
      const isNew = !localTemplate;
      
      if (!localTemplate) {
        localTemplate = new Template({
          workspace: workspaceId,
          name: originalName,
          language: metaTemplate.language,
          createdBy: req.user._id,
          source: 'META'
        });
        syncStats.new++;
      } else {
        syncStats.updated++;
      }
      
      // Parse components to structured format
      const parsedComponents = parseMetaComponents(metaTemplate.components);
      
      // Update from Meta data
      const previousStatus = localTemplate.status;
      localTemplate.status = metaTemplate.status;
      localTemplate.metaTemplateId = metaTemplate.id;
      localTemplate.metaTemplateName = metaTemplate.name;
      localTemplate.category = metaTemplate.category;
      localTemplate.header = parsedComponents.header;
      localTemplate.body = parsedComponents.body;
      localTemplate.footer = parsedComponents.footer;
      localTemplate.buttons = parsedComponents.buttons;
      localTemplate.qualityScore = metaTemplate.quality_score?.score || 'UNKNOWN';
      localTemplate.rejectionReason = metaTemplate.rejected_reason || null;
      localTemplate.lastSyncedAt = new Date();
      localTemplate.submittedVia = 'BSP';
      
      // Add to approval history if status changed
      if (previousStatus !== metaTemplate.status) {
        localTemplate.approvalHistory.push({
          status: metaTemplate.status,
          timestamp: new Date(),
          source: 'META_SYNC',
          reason: metaTemplate.rejected_reason
        });
        
        if (metaTemplate.status === 'APPROVED' && !localTemplate.approvedAt) {
          localTemplate.approvedAt = new Date();
        }
      }
      
      await localTemplate.save();
      syncStats.synced++;
    }
    
    res.json({
      success: true,
      message: `Synced ${syncStats.synced} templates`,
      stats: syncStats,
      totalFromMeta: result.templates.length
    });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUPLICATE TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a copy of an existing template
 */
async function duplicateTemplate(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { newName } = req.body;
    
    const originalTemplate = await Template.findOne({
      _id: req.params.id,
      workspace: workspaceId
    });
    
    if (!originalTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    // Generate new name if not provided
    const duplicateName = newName?.toLowerCase() || 
      `${originalTemplate.name}_copy_${Date.now().toString(36)}`;
    
    // Check for duplicate name
    const existing = await Template.findOne({
      workspace: workspaceId,
      name: duplicateName
    });
    
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Template with this name already exists',
        code: 'DUPLICATE_NAME'
      });
    }
    
    // Use template's duplicate method
    const newTemplate = await originalTemplate.duplicate(duplicateName, req.user._id);
    
    res.status(201).json({
      success: true,
      message: 'Template duplicated successfully',
      template: newTemplate
    });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATE TEMPLATE (PREVIEW)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate template without saving
 */
async function validateTemplatePreview(req, res, next) {
  try {
    const templateData = req.body;
    
    const validation = validateTemplate(templateData);
    
    res.json({
      success: true,
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      limits: LIMITS
    });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET TEMPLATE CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get template categories with counts
 */
async function getTemplateCategories(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    
    const categories = await Template.aggregate([
      { $match: { workspace: workspaceId } },
      { 
        $group: { 
          _id: '$category', 
          count: { $sum: 1 },
          approved: { 
            $sum: { $cond: [{ $eq: ['$status', 'APPROVED'] }, 1, 0] } 
          }
        } 
      },
      { $project: { _id: 0, category: '$_id', count: 1, approved: 1 } },
      { $sort: { count: -1 } }
    ]);
    
    res.json({ 
      success: true,
      categories,
      validCategories: ['MARKETING', 'UTILITY', 'AUTHENTICATION']
    });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE STATUS WEBHOOK HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle template status update webhook from Meta
 * Called by the webhook handler when message_template_status_update event received
 */
async function handleTemplateStatusWebhook(webhookData) {
  try {
    const { 
      message_template_id,
      message_template_name,
      message_template_language,
      event,
      reason 
    } = webhookData;
    
    // Find template by Meta ID or namespaced name
    const template = await Template.findOne({
      $or: [
        { metaTemplateId: message_template_id },
        { metaTemplateName: message_template_name }
      ]
    });
    
    if (!template) {
      console.log(`[Webhook] Template not found for status update: ${message_template_name}`);
      return { handled: false, reason: 'Template not found' };
    }
    
    // Map Meta event to status
    const statusMap = {
      'APPROVED': 'APPROVED',
      'REJECTED': 'REJECTED',
      'PENDING': 'PENDING',
      'PENDING_DELETION': 'PENDING',
      'DELETED': 'DELETED',
      'DISABLED': 'DISABLED',
      'REINSTATED': 'APPROVED',
      'FLAGGED': 'DISABLED',
      'PAUSED': 'PAUSED'
    };
    
    const newStatus = statusMap[event] || event;
    const previousStatus = template.status;
    
    // Update template
    template.status = newStatus;
    template.lastWebhookUpdate = new Date();
    
    if (reason) {
      template.rejectionReason = reason;
    }
    
    // Add to approval history
    template.approvalHistory.push({
      status: newStatus,
      timestamp: new Date(),
      reason: reason,
      source: 'WEBHOOK'
    });
    
    // Update specific timestamps
    if (newStatus === 'APPROVED' && !template.approvedAt) {
      template.approvedAt = new Date();
    }
    
    await template.save();
    
    console.log(`[Webhook] Template ${template.name} status: ${previousStatus} → ${newStatus}`);
    
    return { 
      handled: true, 
      templateId: template._id,
      previousStatus,
      newStatus
    };
  } catch (err) {
    console.error('[Webhook] Error handling template status:', err);
    return { handled: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse Meta API components to structured format
 */
function parseMetaComponents(components) {
  const result = {
    header: { enabled: false, format: 'NONE' },
    body: { text: '', examples: [] },
    footer: { enabled: false, text: '' },
    buttons: { enabled: false, items: [] }
  };
  
  if (!components) return result;
  
  for (const component of components) {
    switch (component.type) {
      case 'HEADER':
        result.header = {
          enabled: true,
          format: component.format || 'TEXT',
          text: component.text || '',
          example: component.example?.header_text?.[0] || '',
          mediaUrl: component.example?.header_handle?.[0] || ''
        };
        break;
        
      case 'BODY':
        result.body = {
          text: component.text || '',
          examples: component.example?.body_text?.[0] || []
        };
        break;
        
      case 'FOOTER':
        result.footer = {
          enabled: true,
          text: component.text || ''
        };
        break;
        
      case 'BUTTONS':
        result.buttons = {
          enabled: true,
          items: (component.buttons || []).map(btn => ({
            type: btn.type,
            text: btn.text,
            url: btn.url,
            phoneNumber: btn.phone_number,
            example: btn.example?.[0] || ''
          }))
        };
        break;
    }
  }
  
  return result;
}

/**
 * Handle BSP specific errors
 */
function handleBspError(error) {
  const message = error.message || '';
  
  if (message.includes('BSP_TOKEN_EXPIRED') || message.includes('token')) {
    return {
      statusCode: 503,
      success: false,
      message: 'WhatsApp service token expired. Please contact support.',
      code: 'BSP_TOKEN_EXPIRED'
    };
  }
  
  if (message.includes('TEMPLATE_LIMIT') || message.includes('rate limit')) {
    return {
      statusCode: 429,
      success: false,
      message: 'Daily template submission limit reached. Please try again tomorrow.',
      code: 'BSP_TEMPLATE_LIMIT'
    };
  }
  
  if (message.includes('does not exist') || message.includes('missing permissions')) {
    return {
      statusCode: 503,
      success: false,
      message: 'WhatsApp Business Account is not properly configured.',
      code: 'BSP_WABA_ACCESS_ERROR',
      details: 'Verify WABA ID, system user assignment, and token permissions.'
    };
  }
  
  if (message.includes('duplicate') || message.includes('already exists')) {
    return {
      statusCode: 400,
      success: false,
      message: 'A template with this name already exists on Meta.',
      code: 'TEMPLATE_EXISTS'
    };
  }
  
  // Generic error
  return {
    statusCode: 500,
    success: false,
    message: 'Failed to submit template to WhatsApp',
    code: 'BSP_ERROR',
    details: message
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // CRUD operations
  createTemplate,
  listTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  
  // BSP operations
  submitTemplate,
  syncTemplates,
  
  // Additional features
  duplicateTemplate,
  validateTemplatePreview,
  getTemplateCategories,
  
  // Webhook handler
  handleTemplateStatusWebhook
};
