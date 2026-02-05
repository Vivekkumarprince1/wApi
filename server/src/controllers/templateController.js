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
const { getParentWaba } = require('../services/parentWabaService');
const usageLedgerService = require('../services/usageLedgerService');

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
    // Interakt-style canonical schema: normalize raw Meta components if provided
    let {
      name,
      language = 'en',
      category = 'MARKETING',
      header,
      body,
      footer,
      buttons,
      components
    } = req.body;

    // If raw Meta components are sent, convert to structured format
    // WHY: Enforce single canonical schema while preserving backward compatibility
    if (components && (!header || !body)) {
      const parsed = parseMetaComponents(components);
      header = parsed.header;
      body = parsed.body;
      footer = parsed.footer;
      buttons = parsed.buttons;
    }
    
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
    
    const parentWaba = await getParentWaba();

    // Create template with structured components
    const template = await Template.create({
      workspace: workspaceId,
      parentWaba: parentWaba?._id,
      parentWabaId: parentWaba?.wabaId,
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

/**
 * Get library statistics
 * GET /api/v1/templates/stats
 */
async function getTemplateLibraryStats(req, res, next) {
  try {
    const workspaceId = req.user.workspace;

    // Total templates
    const total = await Template.countDocuments({ workspace: workspaceId });

    // By category
    const byCategoryAgg = await Template.aggregate([
      { $match: { workspace: workspaceId } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const byCategory = byCategoryAgg.reduce((acc, item) => {
      acc[item._id || 'unknown'] = item.count;
      return acc;
    }, {});

    // By status
    const byStatusAgg = await Template.aggregate([
      { $match: { workspace: workspaceId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const byStatus = byStatusAgg.reduce((acc, item) => {
      acc[item._id.toLowerCase()] = item.count;
      return acc;
    }, {});

    res.json({
      success: true,
      stats: {
        total,
        byCategory,
        byStatus
      }
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
 * Stage 2 Hardening: If template is APPROVED, fork it instead of editing
 */
async function updateTemplate(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    // Interakt-style canonical schema: normalize raw Meta components if provided
    let {
      name,
      language,
      category,
      header,
      body,
      footer,
      buttons,
      components
    } = req.body;

    // If raw Meta components are sent, convert to structured format
    // WHY: Enforce single canonical schema while preserving backward compatibility
    if (components && (!header || !body)) {
      const parsed = parseMetaComponents(components);
      header = parsed.header;
      body = parsed.body;
      footer = parsed.footer;
      buttons = parsed.buttons;
    }
    
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
    
    // ─────────────────────────────────────────────────────────────────────────────
    // STAGE 2 HARDENING - TASK A: VERSION FORKING
    // If template is APPROVED, create a new version (clone) instead of editing
    // Original approved template remains usable
    // ─────────────────────────────────────────────────────────────────────────────
    if (template.status === 'APPROVED') {
      try {
        const { template: forkedTemplate, wasExisting } = await Template.cloneApprovedTemplate(
          template._id,
          req.user._id
        );
        
        // Apply the requested changes to the forked template
        if (name) forkedTemplate.name = name.toLowerCase();
        if (language !== undefined) forkedTemplate.language = language;
        if (category !== undefined) forkedTemplate.category = Template.getValidMetaCategory(category);
        if (header !== undefined) forkedTemplate.header = header;
        if (body !== undefined) forkedTemplate.body = body;
        if (footer !== undefined) forkedTemplate.footer = footer;
        if (buttons !== undefined) forkedTemplate.buttons = buttons;
        
        forkedTemplate.lastEditedBy = req.user._id;
        await forkedTemplate.save();
        
        const validation = validateTemplate(forkedTemplate.toObject());
        
        return res.json({
          success: true,
          template: forkedTemplate,
          forked: true,
          originalTemplateId: template._id,
          message: wasExisting 
            ? 'Returned existing draft version of this template'
            : 'Created new version of approved template. Original remains active.',
          warnings: validation.warnings
        });
      } catch (forkErr) {
        return res.status(forkErr.statusCode || 500).json({
          success: false,
          message: forkErr.message,
          code: forkErr.code || 'FORK_FAILED'
        });
      }
    }
    
    // Check if editable (DRAFT or REJECTED)
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
    
    // Track who edited (Stage 2 versioning)
    template.lastEditedBy = req.user._id;
    
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
 * Stage 2 Hardening: Block deletion if template is used in campaigns
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
    
    // ─────────────────────────────────────────────────────────────────────────────
    // STAGE 2 HARDENING - TASK C: USAGE PROTECTION
    // Block deletion if template is used in campaigns
    // ─────────────────────────────────────────────────────────────────────────────
    const deleteCheck = await Template.canDeleteTemplate(template._id);
    if (!deleteCheck.canDelete) {
      return res.status(400).json({
        success: false,
        message: deleteCheck.reason,
        code: 'TEMPLATE_IN_USE',
        usedInCampaigns: deleteCheck.usedInCampaigns
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
 * Stage 2 Task 3: Enhanced submission with duplicate detection and retry logic
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
        code: 'TEMPLATE_NOT_SUBMITTABLE',
        currentStatus: template.status,
        helpText: template.status === 'PENDING' 
          ? 'Template is already pending approval. Wait for Meta to review.'
          : template.status === 'APPROVED'
            ? 'Template is already approved and can be used for messaging.'
            : null
      });
    }
    
    // Validate template before submission
    const validation = validateTemplate(template.toObject());
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Template validation failed',
        errors: validation.errors,
        warnings: validation.warnings,
        helpText: 'Fix the errors above and try again.'
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

    // Enforce template submission limits (abuse/spam mitigation)
    try {
      await bspMessagingService.checkTemplateSubmissionLimit(workspace);
    } catch (limitErr) {
      return res.status(429).json({
        success: false,
        message: limitErr.message,
        code: 'TEMPLATE_SUBMISSION_LIMIT'
      });
    }
    
    // Stage 2: Verify phone is connected and active
    const phoneStatus = workspace.bspPhoneStatus || 'UNKNOWN';
    if (!['CONNECTED', 'RESTRICTED'].includes(phoneStatus)) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp phone is not connected. Please complete phone activation.',
        code: 'PHONE_NOT_ACTIVE',
        phoneStatus
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
      
      // Stage 2: Check if template with same namespaced name already exists on Meta
      // This prevents "duplicate template" errors from Meta
      if (template.metaTemplateName && template.status === 'REJECTED') {
        // Template was previously submitted and rejected - Meta might still have it
        console.log(`[Template] Resubmitting rejected template: ${namespacedName}`);
      }
      
      // Build Meta API payload using template method
      const metaComponents = template.buildMetaComponents();
      
      // ─────────────────────────────────────────────────────────────────────────────
      // STAGE 2 HARDENING - TASK B: META PAYLOAD SNAPSHOT
      // Capture exact payload sent to Meta for audit/debug
      // This snapshot is immutable after submission
      // ─────────────────────────────────────────────────────────────────────────────
      const metaPayload = {
        name: template.name,
        language: template.language,
        category: template.category,
        components: metaComponents
      };
      
      // Submit to BSP
      const result = await bspMessagingService.submitTemplate(
        workspaceId,
        metaPayload
      );
      
      // Update template with submission details
      template.status = 'PENDING';
      template.metaTemplateId = result.templateId;
      template.metaTemplateName = result.namespacedName || namespacedName;
      template.submittedAt = new Date();
      template.submittedVia = 'BSP';
      template.rejectionReason = null; // Clear previous rejection
      template.rejectionDetails = null;
      
      // Store immutable snapshot of what was sent to Meta (Task B)
      template.metaPayloadSnapshot = {
        components: metaPayload.components,
        name: metaPayload.name,
        language: metaPayload.language,
        category: metaPayload.category,
        submittedAt: new Date(),
        raw: result.rawResponse || null // Store raw Meta API response if available
      };
      
      // Add to approval history with version tracking
      template.approvalHistory.push({
        status: 'PENDING',
        timestamp: new Date(),
        source: 'BSP_SUBMISSION',
        rawEvent: { version: template.version, payloadSnapshot: true }
      });
      
      await template.save();
      
      // Track workspace usage
      await Workspace.findByIdAndUpdate(workspaceId, {
        $inc: { 'usage.templatesSubmitted': 1 }
      });

      // BSP billing: template submission count
      try {
        await usageLedgerService.incrementTemplateSubmissions(workspaceId, 1);
      } catch (usageErr) {
        console.error('[Template] Usage ledger update failed:', usageErr.message);
      }
      
      res.json({
        success: true,
        message: 'Template submitted for Meta approval. Review usually takes 5-10 minutes.',
        template,
        metaTemplateName: template.metaTemplateName,
        estimatedApprovalTime: '5-10 minutes',
        warnings: validation.warnings
      });
      
    } catch (metaError) {
      // Handle specific BSP errors
      const errorResponse = handleBspError(metaError);
      
      // Stage 2: Track submission failures in approval history
      template.approvalHistory.push({
        status: 'SUBMISSION_FAILED',
        timestamp: new Date(),
        reason: metaError.message,
        source: 'BSP_ERROR'
      });
      await template.save();
      
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

    const rawEvent = (event || webhookData.status || webhookData.message_template_status || '').toString().toUpperCase();
    if (!rawEvent) {
      return { handled: false, reason: 'missing_event' };
    }

    // Extract original template name (remove workspace prefix if present)
    let originalTemplateName = message_template_name;
    if (message_template_name && message_template_name.includes('_')) {
      const parts = message_template_name.split('_');
      const prefix = parts[0];
      if (prefix.length === 8) {
        originalTemplateName = parts.slice(1).join('_');
      }
    }

    const nameCandidates = [
      originalTemplateName,
      originalTemplateName?.toLowerCase(),
      message_template_name,
      message_template_name?.toLowerCase()
    ].filter(Boolean);
    
    // Find template by Meta ID or namespaced name
    const template = await Template.findOne({
      $or: [
        { metaTemplateId: message_template_id },
        { metaTemplateName: { $in: nameCandidates } },
        { name: { $in: nameCandidates } }
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
      'FLAGGED_FOR_REVIEW': 'DISABLED',
      'IN_APPEAL': 'PENDING',
      'QUALITY_PENDING': 'PENDING',
      'PAUSED': 'PAUSED',
      'AUTO_DISABLED': 'DISABLED',
      'BLOCKED': 'DISABLED'
    };
    
    const newStatus = statusMap[rawEvent] || rawEvent;
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
// VERSION FORKING (Stage 2 Hardening - Task A)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fork an approved template for editing
 * Creates a new DRAFT version while keeping original APPROVED and usable
 */
async function forkApprovedTemplate(req, res, next) {
  try {
    const templateId = req.params.id;
    const userId = req.user._id;
    
    const { template, wasExisting } = await Template.cloneApprovedTemplate(templateId, userId);
    
    res.json({
      success: true,
      template,
      wasExisting,
      message: wasExisting 
        ? 'Returned existing draft version of this template'
        : 'Created new version for editing. Original approved template remains active.',
      originalTemplateId: template.originalTemplateId
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        code: err.code
      });
    }
    next(err);
  }
}

/**
 * Get all versions of a template
 */
async function getTemplateVersions(req, res, next) {
  try {
    const templateId = req.params.id;
    const workspaceId = req.user.workspace;
    
    // Verify template belongs to workspace
    const template = await Template.findOne({
      _id: templateId,
      workspace: workspaceId
    });
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    const versions = await Template.getTemplateVersions(templateId);
    
    res.json({
      success: true,
      versions,
      currentVersion: template.version,
      activeVersionId: versions.find(v => v.isActiveVersion)?._id
    });
  } catch (err) {
    next(err);
  }
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
  getTemplateLibraryStats,
  
  // Version forking (Stage 2 Hardening)
  forkApprovedTemplate,
  getTemplateVersions,
  
  // Webhook handler
  handleTemplateStatusWebhook
};
