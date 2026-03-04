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

const { Template } = require('../../models');
const { Workspace } = require('../../models');
const bspMessagingService = require('../../services/bsp/bspMessagingService');
const bspConfig = require('../../config/bspConfig');
const { validateTemplate, buildMetaPayload, LIMITS } = require('../../middlewares/infrastructure/templateValidation');
const usageLedgerService = require('../../services/billing/usageLedgerService');

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
    } else {
      query.status = { $ne: 'DELETED' };
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
      { $match: { workspace: workspaceId, status: { $ne: 'DELETED' } } },
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
      components,
      expectedVersion,
      expectedStatus
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

    const normalizedExpectedStatus = expectedStatus ? String(expectedStatus).toUpperCase() : null;
    const hasExpectedVersion = expectedVersion !== undefined && expectedVersion !== null && expectedVersion !== '';
    const parsedExpectedVersion = hasExpectedVersion ? Number(expectedVersion) : null;

    if (normalizedExpectedStatus && template.status !== normalizedExpectedStatus) {
      return res.status(409).json({
        success: false,
        message: `Template status changed from ${normalizedExpectedStatus} to ${template.status}. Reload and try again.`,
        code: 'STATUS_CHANGED_DURING_EDIT',
        currentStatus: template.status,
        templateId: template._id
      });
    }

    if (hasExpectedVersion && (!Number.isFinite(parsedExpectedVersion) || template.version !== parsedExpectedVersion)) {
      return res.status(409).json({
        success: false,
        message: 'Template was modified by another user. Reload latest version before saving.',
        code: 'TEMPLATE_VERSION_CONFLICT',
        currentVersion: template.version,
        templateId: template._id
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
          req.user._id,
          { alwaysNew: true }
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
        forkedTemplate.editHistory.push({
          action: 'APPROVED_FORK_CREATED',
          actor: req.user._id,
          sourceTemplateId: template._id,
          details: {
            sourceStatus: template.status,
            sourceVersion: template.version,
            newVersion: forkedTemplate.version
          }
        });
        await forkedTemplate.save();

        let submissionResult;
        try {
          submissionResult = await submitTemplateForApproval(forkedTemplate, workspaceId);
        } catch (submitErr) {
          forkedTemplate.editHistory.push({
            action: 'APPROVED_FORK_SUBMISSION_FAILED',
            actor: req.user._id,
            sourceTemplateId: template._id,
            details: {
              errorCode: submitErr.code,
              errorMessage: submitErr.message
            }
          });

          await forkedTemplate.save();

          submitErr.forkedTemplateId = forkedTemplate._id;
          throw submitErr;
        }

        forkedTemplate.editHistory.push({
          action: 'APPROVED_FORK_SUBMITTED',
          actor: req.user._id,
          sourceTemplateId: template._id,
          details: {
            submittedStatus: submissionResult.template.status,
            metaTemplateName: submissionResult.metaTemplateName,
            submittedAt: submissionResult.template.submittedAt
          }
        });
        await forkedTemplate.save();

        const validation = validateTemplate(submissionResult.template.toObject());

        return res.json({
          success: true,
          template: submissionResult.template,
          forked: true,
          originalTemplateId: template._id,
          workflow: 'APPROVED_FORK_AND_SUBMIT',
          notification: 'Approved template was copied to a new version and auto-submitted for review.',
          message: wasExisting
            ? 'Created and submitted a new version for this approved template.'
            : 'Created and submitted a new version for this approved template.',
          warnings: validation.warnings
        });
      } catch (forkErr) {
        if (forkErr?.forkedTemplateId) {
          return res.status(forkErr.statusCode || 500).json({
            success: false,
            message: forkErr.message,
            code: forkErr.code || 'FORK_SUBMIT_FAILED',
            forkedTemplateId: forkErr.forkedTemplateId,
            workflow: 'APPROVED_FORK_AND_SUBMIT_FAILED',
            notification: 'New template version was created, but auto-submission failed. Review and retry submission.'
          });
        }

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

    const previousStatus = template.status;

    // Reset to draft if was rejected
    if (template.status === 'REJECTED') {
      template.status = 'DRAFT';
    }

    template.editHistory.push({
      action: 'DIRECT_EDIT',
      actor: req.user._id,
      sourceTemplateId: template._id,
      details: {
        previousStatus,
        currentStatus: template.status,
        version: template.version
      }
    });

    await template.save();

    // Validate and return warnings
    const validation = validateTemplate(template.toObject());

    res.json({
      success: true,
      template,
      workflow: 'DIRECT_EDIT',
      notification: 'Draft/rejected template updated directly without creating a new version.',
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
          await bspMessagingService.deleteTemplate(template.metaTemplateName, workspaceId, template.metaTemplateId);
          console.log(`[BSP] Deleted template from Meta: ${template.metaTemplateName}`);
        } catch (metaError) {
          // Log but continue with local deletion
          console.error('[BSP] Failed to delete from Meta:', metaError.message);
        }
      }
    }

    // Instead of deleting it completely, we change its status to DELETED
    // This physically removes it from the usable cache but stops the `syncTemplates` webhook
    // from re-downloading it as a "New" template if Meta is slow to sync the deletion state.
    template.status = 'DELETED';
    template.name = `${template.name}_DELETED_${Date.now()}`; // Fix name collision issue to allow reuse
    await template.save();

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

async function submitTemplateForApproval(template, workspaceId) {
  // Validate template before submission
  const validation = validateTemplate(template.toObject());

  if (!validation.valid) {
    const error = new Error('Template validation failed');
    error.statusCode = 400;
    error.code = 'TEMPLATE_VALIDATION_FAILED';
    error.errors = validation.errors;
    error.warnings = validation.warnings;
    throw error;
  }

  const workspace = await Workspace.findById(workspaceId);

  if (!workspace?.bspManaged) {
    const error = new Error('Workspace is not configured for WhatsApp. Please complete onboarding.');
    error.statusCode = 400;
    error.code = 'BSP_NOT_CONFIGURED';
    throw error;
  }

  try {
    await bspMessagingService.checkTemplateSubmissionLimit(workspace);
  } catch (limitErr) {
    limitErr.statusCode = 429;
    limitErr.code = 'TEMPLATE_SUBMISSION_LIMIT';
    throw limitErr;
  }

  const phoneStatus = workspace.bspPhoneStatus || 'UNKNOWN';
  if (!['CONNECTED', 'RESTRICTED'].includes(phoneStatus)) {
    const error = new Error('WhatsApp phone is not connected. Please complete phone activation.');
    error.statusCode = 400;
    error.code = 'PHONE_NOT_ACTIVE';
    error.phoneStatus = phoneStatus;
    throw error;
  }

  if (!bspConfig.isEnabled()) {
    const error = new Error('WhatsApp service is not configured. Please contact support.');
    error.statusCode = 503;
    error.code = 'BSP_SERVICE_UNAVAILABLE';
    throw error;
  }

  const resolvedAppId =
    workspace?.gupshupIdentity?.partnerAppId ||
    workspace?.gupshupAppId;

  if (!resolvedAppId) {
    const error = new Error('Gupshup app ID is missing for this workspace. Complete BSP onboarding or configure GUPSHUP_APP_ID.');
    error.statusCode = 400;
    error.code = 'GUPSHUP_APP_ID_MISSING';
    error.details = {
      hasPartnerAppId: Boolean(workspace?.gupshupIdentity?.partnerAppId),
      hasWorkspaceAppId: Boolean(workspace?.gupshupAppId),
      hasEnvAppId: Boolean(process.env.GUPSHUP_APP_ID)
    };
    throw error;
  }

  try {
    const workspaceIdSuffix = workspaceId.toString().slice(-8);
    const namespacedName = `${workspaceIdSuffix}_${template.name}`;
    const metaComponents = template.buildMetaComponents();

    const metaPayload = {
      name: template.name,
      language: template.language,
      category: template.category,
      components: metaComponents,
      metaTemplateId: template.metaTemplateId
    };

    const result = await bspMessagingService.submitTemplate(workspaceId, metaPayload);

    template.status = 'PENDING';
    template.metaTemplateId = result.templateId;
    template.metaTemplateName = result.namespacedName || namespacedName;
    template.submittedAt = new Date();
    template.submittedVia = 'BSP';
    template.rejectionReason = null;
    template.rejectionDetails = null;
    template.metaPayloadSnapshot = {
      components: metaPayload.components,
      name: metaPayload.name,
      language: metaPayload.language,
      category: metaPayload.category,
      submittedAt: new Date(),
      raw: result.rawResponse || null
    };

    template.approvalHistory.push({
      status: 'PENDING',
      timestamp: new Date(),
      rawEvent: { version: template.version, payloadSnapshot: true }
    });

    await template.save();

    await Workspace.findByIdAndUpdate(workspaceId, {
      $inc: { 'usage.templatesSubmitted': 1 }
    });

    try {
      await usageLedgerService.incrementTemplateSubmissions(workspaceId, 1);
    } catch (usageErr) {
      console.error('[Template] Usage ledger update failed:', usageErr.message);
    }

    return {
      template,
      warnings: validation.warnings,
      metaTemplateName: template.metaTemplateName
    };
  } catch (metaError) {
    const mapped = handleBspError(metaError);
    const error = new Error(mapped.message);
    error.statusCode = mapped.statusCode;
    error.code = mapped.code;
    error.details = mapped.details;
    throw error;
  }
}

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

    try {
      const submission = await submitTemplateForApproval(template, workspaceId);

      return res.json({
        success: true,
        message: 'Template submitted for Meta approval. Review usually takes 5-10 minutes.',
        template: submission.template,
        metaTemplateName: submission.metaTemplateName,
        estimatedApprovalTime: '5-10 minutes',
        warnings: submission.warnings
      });
    } catch (submitError) {
      console.error('[Template Submit] Submission failed:', {
        code: submitError.code,
        statusCode: submitError.statusCode,
        message: submitError.message,
        details: submitError.details,
        errors: submitError.errors
      });

      return res.status(submitError.statusCode || 500).json({
        success: false,
        message: submitError.message || 'Failed to submit template to WhatsApp',
        code: submitError.code || 'BSP_ERROR',
        details: submitError.details,
        errors: submitError.errors,
        warnings: submitError.warnings
      });
    }
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC TEMPLATES FROM GUPSHUP / META
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse Gupshup-format template into local structured fields.
 * Gupshup returns: elementName, data, containerMeta, languageCode, category,
 * status, quality, reason, externalId, id, templateType, etc.
 */
function parseGupshupTemplate(gTemplate) {
  const result = {
    header: { enabled: false, format: 'NONE' },
    body: { text: '', examples: [] },
    footer: { enabled: false, text: '' },
    buttons: { enabled: false, items: [] }
  };

  // Parse containerMeta for structured data (header, footer, buttons, etc.)
  let containerMeta = {};
  if (gTemplate.containerMeta) {
    try {
      containerMeta = typeof gTemplate.containerMeta === 'string'
        ? JSON.parse(gTemplate.containerMeta)
        : gTemplate.containerMeta;
    } catch (_) { /* ignore parse errors */ }
  }

  // Parse meta for examples
  let meta = {};
  if (gTemplate.meta) {
    try {
      meta = typeof gTemplate.meta === 'string'
        ? JSON.parse(gTemplate.meta)
        : gTemplate.meta;
    } catch (_) { /* ignore parse errors */ }
  }

  // Body text: use containerMeta.data first, fallback to gTemplate.data
  const rawData = containerMeta.data || gTemplate.data || '';
  // Gupshup concatenates body + "\n" + footer in the `data` field
  const footerText = containerMeta.footer || '';
  let bodyText = rawData;
  if (footerText && bodyText.endsWith('\n' + footerText)) {
    bodyText = bodyText.slice(0, -(footerText.length + 1));
  }

  result.body = {
    text: bodyText,
    examples: meta.example ? [meta.example] : []
  };

  if (footerText) {
    result.footer = { enabled: true, text: footerText };
  }

  // Header
  if (containerMeta.header) {
    const headerFormat = String(gTemplate.templateType || 'TEXT').toUpperCase();
    result.header = {
      enabled: true,
      format: headerFormat === 'TEXT' ? 'TEXT' : headerFormat,
      text: typeof containerMeta.header === 'string' ? containerMeta.header : '',
      example: containerMeta.exampleHeader || '',
      mediaUrl: containerMeta.headerMediaUrl || ''
    };
  }

  // Buttons (stored as JSON string or array in containerMeta)
  if (containerMeta.buttons) {
    let buttons = containerMeta.buttons;
    if (typeof buttons === 'string') {
      try { buttons = JSON.parse(buttons); } catch (_) { buttons = []; }
    }
    if (Array.isArray(buttons) && buttons.length > 0) {
      result.buttons = {
        enabled: true,
        items: buttons.map(btn => ({
          type: btn.type || 'QUICK_REPLY',
          text: btn.text || '',
          url: btn.url || undefined,
          phoneNumber: btn.phone_number || undefined,
          example: btn.example?.[0] || ''
        }))
      };
    }
  }

  return result;
}

/**
 * Sync templates from Gupshup partner API for a workspace.
 * 1) Triggers Gupshup-side sync (fire-and-forget, non-blocking)
 * 2) Fetches template list from GET /partner/app/{appId}/templates
 * 3) Upserts into local DB
 */
async function syncTemplates(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found',
        code: 'WORKSPACE_NOT_FOUND'
      });
    }

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

    // Relaxed credential check: only require workspace appId
    const appId =
      workspace?.gupshupIdentity?.partnerAppId ||
      workspace?.gupshupAppId;
    const partnerAppId = String(appId || '').trim();

    if (!appId) {
      return res.status(400).json({
        success: false,
        message: 'Template sync is unavailable. Complete WhatsApp onboarding to configure app credentials.',
        code: 'GUPSHUP_CREDENTIALS_MISSING'
      });
    }

    // Step 1: Trigger Gupshup-side sync (fire-and-forget, don't block response)
    bspMessagingService.triggerGupshupSync(workspace).catch(syncErr => {
      const status = syncErr?.response?.status;
      // 429 = rate-limited (1 req/hour), 400/401 = expected in some states
      if (status !== 429 && status !== 400 && status !== 401) {
        console.error(`[Template Sync] Gupshup sync trigger failed: ${syncErr.message}`);
      } else {
        console.log(`[Template Sync] Gupshup sync trigger returned ${status} (expected)`);
      }
    });

    // Step 2: Fetch all templates from Gupshup partner API
    let result;
    try {
      result = await bspMessagingService.fetchTemplates(workspace, { limit: 250 });
    } catch (error) {
      if (error.message === 'GUPSHUP_CREDENTIALS_MISSING') {
        return res.status(400).json({
          success: false,
          message: 'Template sync is unavailable. Missing Gupshup app credentials for this workspace.',
          code: 'GUPSHUP_CREDENTIALS_MISSING'
        });
      }

      const providerStatus = Number(error?.response?.status || error?.statusCode || 0);
      if (providerStatus === 401 || providerStatus === 403 || error?.code === 'TEMPLATES_LIST_FAILED') {
        return res.status(200).json({
          success: true,
          message: 'Template sync skipped because provider template-list auth failed. Existing templates remain available.',
          stats: {
            synced: 0,
            new: 0,
            updated: 0,
            skipped: 0
          },
          totalFromProvider: 0,
          warning: {
            code: 'TEMPLATES_LIST_AUTH_FAILED',
            statusCode: providerStatus || 502,
            details: error?.details || error?.message
          }
        });
      }

      const bspErr = handleBspError(error);
      return res.status(bspErr.statusCode).json(bspErr);
    }

    // Step 3: Upsert Gupshup-format templates into local DB
    let syncStats = {
      synced: 0,
      new: 0,
      updated: 0,
      skipped: 0
    };

    for (const gTemplate of result.templates) {
      // Gupshup uses elementName (not name) and languageCode (not language)
      const templateName = gTemplate.elementName || gTemplate.name || '';
      const templateLang = gTemplate.languageCode || gTemplate.language || 'en';
      const normalizedTemplateName = String(templateName).toLowerCase();

      if (!normalizedTemplateName) {
        syncStats.skipped++;
        continue;
      }

      // Find or create local template
      let localTemplate = await Template.findOne({
        workspace: workspaceId,
        $or: [
          { name: normalizedTemplateName, language: templateLang },
          { metaTemplateName: templateName, language: templateLang }
        ]
      });

      if (!localTemplate) {
        localTemplate = new Template({
          workspace: workspaceId,
          name: normalizedTemplateName,
          language: templateLang,
          partnerAppId,
          createdBy: req.user._id,
          source: 'BSP'
        });
        syncStats.new++;
      } else {
        localTemplate.partnerAppId = localTemplate.partnerAppId || partnerAppId;
        syncStats.updated++;
      }

      // Parse Gupshup structured data
      const parsed = parseGupshupTemplate(gTemplate);

      // Map Gupshup fields to local model
      const previousStatus = localTemplate.status;
      
      // If we manually marked it DELETED locally, do NOT let Gupshup revert it to APPROVED during their cache lag
      if (previousStatus === 'DELETED') {
        syncStats.skipped++;
        continue;
      }
      
      localTemplate.status = gTemplate.status || localTemplate.status;
      localTemplate.metaTemplateId = gTemplate.externalId || gTemplate.id || localTemplate.metaTemplateId;
      localTemplate.metaTemplateName = templateName;

      // Normalize category – Gupshup may return legacy categories like ACCOUNT_UPDATE
      const rawCategory = gTemplate.category || localTemplate.category || 'MARKETING';
      localTemplate.category = Template.getValidMetaCategory(rawCategory);
      localTemplate.header = parsed.header;
      localTemplate.body = parsed.body;
      localTemplate.footer = parsed.footer;
      localTemplate.buttons = parsed.buttons;
      localTemplate.qualityScore = gTemplate.quality || 'UNKNOWN';
      localTemplate.rejectionReason = gTemplate.reason || null;
      localTemplate.lastSyncedAt = new Date();
      localTemplate.submittedVia = 'BSP';

      // Add to approval history if status changed
      if (previousStatus && previousStatus !== gTemplate.status) {
        localTemplate.approvalHistory.push({
          status: gTemplate.status,
          timestamp: new Date(),
          source: 'GUPSHUP_SYNC',
          reason: gTemplate.reason
        });

        if (gTemplate.status === 'APPROVED' && !localTemplate.approvedAt) {
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
      totalFromProvider: result.templates.length
    });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUPLICATE TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Upload sample media for template creation
 */
async function uploadTemplateMedia(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No media file provided' });
    }
    const workspaceId = req.user.workspace;
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }
    
    // Fast fallback strategy as seen in syncTemplates
    let appId = workspace?.gupshupIdentity?.partnerAppId || workspace?.gupshupAppId;
    let appApiKey = workspace?.gupshupIdentity?.appApiKey || workspace?.gupshupApiKey || workspace?.whatsappAccessToken;
    
    if (!appId || !appApiKey) {
      return res.status(400).json({ success: false, message: 'Gupshup app credentials missing.' });
    }
    
    const gupshupService = require('../../services/bsp/gupshupService');
    const result = await gupshupService.uploadTemplateMediaForApp({
      appId, appApiKey, 
      fileBuffer: req.file.buffer, 
      fileName: req.file.originalname, 
      mimeType: req.file.mimetype
    });
    
    // Gupshup response can be:
    //   { status, message: "handle" }           – older/direct API
    //   { status, handleId: "handle" }           – partner API (string)
    //   { status, handleId: { message: "handle" } } – partner API (nested)
    let handleId = result.message
      || (typeof result.handleId === 'string' ? result.handleId : null)
      || result.handleId?.message
      || '';
    
    // Gupshup may return multiple handles separated by newlines; use the first
    if (handleId.includes('\n')) {
      handleId = handleId.split('\n')[0].trim();
    }
    
    if (!handleId) {
      console.error('[uploadTemplateMedia] Could not extract handleId from Gupshup response:', JSON.stringify(result));
      return res.status(502).json({ success: false, message: 'Media uploaded but no handle ID returned from provider' });
    }

    // Try to upload to Cloudinary to get an immediate preview URL
    let cloudUrl = '';
    try {
      if (process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_URL) {
        const { uploadBufferToCloudinary } = require('../../utils/cloudinary');
        let resourceType = 'auto';
        if (req.file.mimetype.startsWith('video/')) resourceType = 'video';
        else if (req.file.mimetype.startsWith('image/')) resourceType = 'image';
        else resourceType = 'raw';
        
        const cloudResult = await uploadBufferToCloudinary(req.file.buffer, resourceType);
        cloudUrl = cloudResult.secure_url;
      }
    } catch (cloudErr) {
      console.warn('[uploadTemplateMedia] Cloudinary upload failed (preview URL not available):', cloudErr.message);
      // We don't fail the request here since Gupshup upload succeeded
    }
    
    return res.status(200).json({ 
      success: true, 
      handleId, 
      url: cloudUrl 
    });
  } catch (error) {
    next(error);
  }
}

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
      { $match: { workspace: workspaceId, status: { $ne: 'DELETED' } } },
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
          mediaUrl: component.example?.header_url?.[0] || '',
          mediaHandle: component.example?.header_handle?.[0] || ''
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
  const providerStatus = Number(error?.response?.status || 0);
  const providerData = error?.response?.data;
  const providerMessage =
    (typeof providerData === 'string' ? providerData : null) ||
    providerData?.message ||
    providerData?.error ||
    providerData?.details ||
    message;

  if (providerStatus === 400 || providerStatus === 422) {
    const normalizedProviderMessage = String(providerMessage || '').toLowerCase();
    if (normalizedProviderMessage.includes('whatsapp business is approved')) {
      return {
        statusCode: 400,
        success: false,
        message: 'WhatsApp Business account is not fully approved yet. Complete BSP/WABA approval before submitting templates.',
        code: 'BSP_WABA_NOT_APPROVED',
        details: providerData || message
      };
    }

    console.error('[Template Submit] Provider rejected payload:', {
      status: providerStatus,
      data: providerData
    });

    return {
      statusCode: 400,
      success: false,
      message: providerMessage || 'Template payload rejected by WhatsApp provider.',
      code: 'BSP_TEMPLATE_BAD_REQUEST',
      details: providerData || message
    };
  }

  if (providerStatus === 401 || providerStatus === 403) {
    return {
      statusCode: 502,
      success: false,
      message: providerMessage || 'Provider authentication/authorization failed while submitting template.',
      code: 'BSP_PROVIDER_AUTH_FAILED',
      details: providerData || message
    };
  }

  if (providerStatus === 404) {
    return {
      statusCode: 400,
      success: false,
      message: providerMessage || 'Gupshup app/template endpoint not found. Verify app credentials and appId.',
      code: 'BSP_PROVIDER_NOT_FOUND',
      details: providerData || message
    };
  }

  if (providerStatus === 409) {
    return {
      statusCode: 400,
      success: false,
      message: providerMessage || 'Template with the same name already exists.',
      code: 'TEMPLATE_EXISTS',
      details: providerData || message
    };
  }

  if (providerStatus === 429) {
    return {
      statusCode: 429,
      success: false,
      message: providerMessage || 'Provider rate limit reached. Retry after some time.',
      code: 'BSP_PROVIDER_RATE_LIMIT',
      details: providerData || message
    };
  }

  if (message.includes('GUPSHUP_CREDENTIALS_MISSING') || message.includes('GUPSHUP_APP_ID_MISSING') || message.includes('GUPSHUP_APP_API_KEY_MISSING')) {
    return {
      statusCode: 400,
      success: false,
      message: 'Gupshup app credentials are missing for this workspace. Complete BSP onboarding or sync credentials first.',
      code: 'GUPSHUP_CREDENTIALS_MISSING',
      details: error?.details || message
    };
  }

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

/**
 * Browse pre-approved Meta library templates via Gupshup partner API.
 * GET /api/v1/templates/library
 * Query params: elementName, industry, languageCode, topic, usecase
 */
async function getLibraryTemplates(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const workspace = await Workspace.findById(workspaceId);

    if (!workspace || !workspace.bspManaged) {
      return res.status(400).json({
        success: false,
        message: 'Workspace is not configured for WhatsApp',
        code: 'BSP_NOT_CONFIGURED'
      });
    }

    const appId =
      workspace?.gupshupIdentity?.partnerAppId ||
      workspace?.gupshupAppId;

    if (!appId) {
      return res.status(400).json({
        success: false,
        message: 'Missing Gupshup app credentials. Complete WhatsApp onboarding first.',
        code: 'GUPSHUP_CREDENTIALS_MISSING'
      });
    }

    const { elementName, industry, languageCode, topic, usecase } = req.query;

    const gupshupService = require('../../services/bsp/gupshupService');
    const result = await gupshupService.getTemplatesFromLibrary({
      appId,
      elementName,
      industry,
      languageCode,
      topic,
      usecase
    });

    res.json({
      success: true,
      templates: result.templates || [],
      filters: { elementName, industry, languageCode, topic, usecase }
    });
  } catch (err) {
    const status = Number(err?.response?.status || 0);
    if (status === 401 || status === 403) {
      return res.status(403).json({
        success: false,
        code: 'BSP_LIBRARY_ACCESS_FORBIDDEN',
        message: 'Gupshup library access is not enabled for this app/token. Verify app-level token and permissions.',
        details: err?.response?.data || null
      });
    }
    // Token resolution failure (not an HTTP error)
    if (err?.message?.includes('GUPSHUP_APP_TOKEN') || err?.message?.includes('GUPSHUP_PARTNER_TOKEN')) {
      return res.status(403).json({
        success: false,
        code: 'BSP_TOKEN_RESOLUTION_FAILED',
        message: err.message
      });
    }
    next(err);
  }
}

/**
 * Create a template from Meta's pre-approved library.
 * POST /api/v1/templates/library
 * Body: { elementName, category, languageCode, libraryTemplateName, buttons }
 */
async function createFromLibrary(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const workspace = await Workspace.findById(workspaceId);

    if (!workspace || !workspace.bspManaged) {
      return res.status(400).json({
        success: false,
        message: 'Workspace is not configured for WhatsApp',
        code: 'BSP_NOT_CONFIGURED'
      });
    }

    const appId =
      workspace?.gupshupIdentity?.partnerAppId ||
      workspace?.gupshupAppId;

    if (!appId) {
      return res.status(400).json({
        success: false,
        message: 'Missing Gupshup app credentials. Complete WhatsApp onboarding first.',
        code: 'GUPSHUP_CREDENTIALS_MISSING'
      });
    }

    const {
      elementName,
      category,
      languageCode,
      libraryTemplateName,
      buttons,
      libraryTemplateBodyInputs
    } = req.body;

    if (!elementName || !languageCode || !libraryTemplateName) {
      return res.status(400).json({
        success: false,
        message: 'elementName, languageCode, and libraryTemplateName are required.',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const gupshupService = require('../../services/bsp/gupshupService');
    const result = await gupshupService.createTemplateFromLibrary({
      appId,
      elementName,
      category: category || 'UTILITY',
      languageCode,
      libraryTemplateName,
      buttons,
      libraryTemplateBodyInputs
    });

    // Save to local DB
    const createdTemplate = result.templates || result.template;
    if (createdTemplate) {
      const normalizedCategory = Template.getValidMetaCategory(createdTemplate.category || category || 'UTILITY');

      const localTemplate = new Template({
        workspace: workspaceId,
        name: createdTemplate.elementName || elementName,
        language: createdTemplate.languageCode || languageCode,
        category: normalizedCategory,
        status: createdTemplate.status || 'PENDING',
        metaTemplateId: createdTemplate.externalId || createdTemplate.id,
        metaTemplateName: createdTemplate.elementName || elementName,
        body: {
          text: createdTemplate.data || '',
          examples: []
        },
        source: 'BSP',
        createdBy: req.user._id,
        submittedVia: 'BSP',
        submittedAt: new Date(),
        approvalHistory: [{
          status: createdTemplate.status || 'PENDING',
          timestamp: new Date(),
          source: 'LIBRARY_CREATE'
        }]
      });

      if (createdTemplate.status === 'APPROVED') {
        localTemplate.approvedAt = new Date();
      }

      await localTemplate.save();

      return res.status(201).json({
        success: true,
        message: `Template "${elementName}" created from library template "${libraryTemplateName}".`,
        template: localTemplate,
        providerResponse: createdTemplate
      });
    }

    res.status(201).json({
      success: true,
      message: `Template "${elementName}" submitted from library.`,
      providerResponse: result
    });
  } catch (err) {
    // Handle known Gupshup errors
    const status = err?.response?.status;
    const providerData = err?.response?.data;
    if (status === 400) {
      return res.status(400).json({
        success: false,
        message: providerData?.message || 'Template creation from library failed.',
        code: 'BSP_LIBRARY_CREATE_FAILED',
        details: providerData
      });
    }
    if (status === 401 || status === 403) {
      return res.status(403).json({
        success: false,
        code: 'BSP_LIBRARY_ACCESS_FORBIDDEN',
        message: providerData?.message || 'Gupshup library access is not enabled for this app/token.',
        details: providerData || null
      });
    }
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

  // Meta template library (Gupshup)
  getLibraryTemplates,
  createFromLibrary,

  // Webhook handler
  handleTemplateStatusWebhook,
  
  // Media upload
  uploadTemplateMedia
};
