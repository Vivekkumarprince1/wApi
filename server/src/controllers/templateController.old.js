const Template = require('../models/Template');
const Workspace = require('../models/Workspace');
const metaService = require('../services/metaService');
const bspMessagingService = require('../services/bspMessagingService');
const bspConfig = require('../config/bspConfig');

/**
 * ═══════════════════════════════════════════════════════════════════
 * BSP TEMPLATE CONTROLLER
 * 
 * Templates are submitted to the PARENT WABA but ownership is tracked
 * per workspace. Template names are namespaced to ensure uniqueness.
 * ═══════════════════════════════════════════════════════════════════
 */

// Create a new template (local draft)
async function createTemplate(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { name, language, category, components, variables } = req.body;
    
    // Check if template with same name exists
    const existing = await Template.findOne({ workspace: workspaceId, name });
    if (existing) {
      return res.status(400).json({ message: 'Template with this name already exists' });
    }
    
    const template = await Template.create({
      workspace: workspaceId,
      name,
      language: language || 'en',
      category: category || 'MARKETING',
      components: components || [],
      variables: variables || [],
      status: 'DRAFT',
      createdBy: req.user._id
    });
    
    // Increment workspace usage
    const workspace = await Workspace.findById(workspaceId);
    if (workspace) {
      workspace.usage.templates = (workspace.usage.templates || 0) + 1;
      await workspace.save();
    }
    
    res.status(201).json({ template });
  } catch (err) {
    next(err);
  }
}

// Get all templates for workspace
async function listTemplates(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { status, category, search } = req.query;
    
    const query = { workspace };
    if (status) query.status = status.toUpperCase();
    if (category) query.category = category.toUpperCase();
    if (search) query.name = { $regex: search, $options: 'i' };
    
    const templates = await Template.find(query)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email');
    
    res.json({ templates });
  } catch (err) {
    next(err);
  }
}

// Get single template
async function getTemplate(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const template = await Template.findOne({ _id: req.params.id, workspace })
      .populate('createdBy', 'name email');
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    res.json({ template });
  } catch (err) {
    next(err);
  }
}

// Update template
async function updateTemplate(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { name, language, category, components, variables } = req.body;
    
    const template = await Template.findOne({ _id: req.params.id, workspace });
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    // Can only update if not yet approved
    if (template.status === 'APPROVED') {
      return res.status(400).json({ 
        message: 'Cannot update approved template. Create a new version instead.' 
      });
    }
    
    if (name) template.name = name;
    if (language) template.language = language;
    if (category) template.category = category;
    if (components) template.components = components;
    if (variables) template.variables = variables;
    
    await template.save();
    
    res.json({ template });
  } catch (err) {
    next(err);
  }
}

// Delete template (BSP Model)
async function deleteTemplate(req, res, next) {
  try {
    const workspace = req.user.workspace;
    
    const template = await Template.findOne({ _id: req.params.id, workspace });
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    // If template is approved on Meta, attempt to delete from Meta first
    if (template.status === 'APPROVED' && template.providerId) {
      const workspaceDoc = await Workspace.findById(workspace);
      
      // ═══════════════════════════════════════════════════════════════════
      // BSP TEMPLATE DELETION
      // Delete using the namespaced name from parent WABA
      // ═══════════════════════════════════════════════════════════════════
      
      if (workspaceDoc.bspManaged && bspConfig.isEnabled()) {
        try {
          // Use the namespaced name stored during submission
          const metaTemplateName = template.metaTemplateName || 
            `${workspace.toString().slice(-8)}_${template.name}`;
          
          await bspMessagingService.deleteTemplate(metaTemplateName);
          console.log(`[BSP] Deleted template from Meta: ${metaTemplateName}`);
        } catch (metaError) {
          console.error('[BSP] Failed to delete from Meta:', metaError.message);
          // Continue with local deletion even if Meta deletion fails
        }
      }
    }
    
    await Template.deleteOne({ _id: req.params.id });
    
    res.json({ success: true, message: 'Template deleted' });
  } catch (err) {
    next(err);
  }
}

// Submit template to Meta for approval (BSP Model - Parent WABA)
async function submitTemplate(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const template = await Template.findOne({ _id: req.params.id, workspace });
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    const workspaceDoc = await Workspace.findById(workspace);
    
    // ═══════════════════════════════════════════════════════════════════
    // BSP VALIDATION - Check workspace is BSP connected
    // ═══════════════════════════════════════════════════════════════════
    
    if (!workspaceDoc.bspManaged) {
      return res.status(400).json({ 
        message: 'Workspace is not configured for WhatsApp. Please complete onboarding.',
        code: 'BSP_NOT_CONFIGURED',
        requiresOnboarding: true
      });
    }
    
    if (!bspConfig.isEnabled()) {
      return res.status(503).json({ 
        message: 'WhatsApp service is not configured. Please contact support.',
        code: 'BSP_SERVICE_UNAVAILABLE'
      });
    }
    
    // Map category to valid Meta category
    const validCategory = Template.getValidMetaCategory(template.category);
    
    try {
      // ═══════════════════════════════════════════════════════════════════
      // BSP TEMPLATE SUBMISSION
      // Submit via centralized BSP service to parent WABA
      // Template name is namespaced: {workspaceIdSuffix}_{templateName}
      // ═══════════════════════════════════════════════════════════════════
      
      const result = await bspMessagingService.submitTemplate(
        workspace,
        {
          name: template.name,
          language: template.language,
          category: validCategory,
          components: template.components
        }
      );
      
      template.status = 'PENDING';
      template.providerId = result.templateId;
      template.metaTemplateName = result.namespacedName; // Store the namespaced name for webhook routing
      template.submittedAt = new Date();
      template.submittedVia = 'BSP'; // Track submission method
      await template.save();
      
      // Increment workspace usage
      workspaceDoc.usage.templatesCreated = (workspaceDoc.usage.templatesCreated || 0) + 1;
      await workspaceDoc.save();
      
      res.json({ 
        success: true,
        message: 'Template submitted to Meta for approval via BSP',
        template,
        metaTemplateName: result.namespacedName
      });
    } catch (metaError) {
      // Handle specific BSP errors
      if (metaError.message === 'BSP_TOKEN_EXPIRED') {
        return res.status(503).json({
          success: false,
          message: 'WhatsApp service token expired. Please contact support.',
          code: 'BSP_TOKEN_EXPIRED'
        });
      }
      
      if (metaError.message === 'BSP_TEMPLATE_LIMIT_EXCEEDED') {
        return res.status(429).json({
          success: false,
          message: 'Daily template submission limit reached. Please try again tomorrow.',
          code: 'BSP_TEMPLATE_LIMIT_EXCEEDED'
        });
      }
      
      // Handle WABA access issues
      if (metaError.message.includes('does not exist') || 
          metaError.message.includes('cannot be loaded due to missing permissions')) {
        return res.status(503).json({
          success: false,
          message: 'WhatsApp Business Account is not properly configured. The system user token may not have access to the account.',
          code: 'BSP_WABA_ACCESS_ERROR',
          details: 'Check that: 1) WABA ID is correct, 2) System user is assigned to the WABA, 3) Token has proper permissions'
        });
      }
      
      throw metaError;
    }
  } catch (err) {
    next(err);
  }
}

// Sync templates from Meta (BSP Model - Fetch from Parent WABA)
async function syncTemplates(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const workspaceDoc = await Workspace.findById(workspace);
    
    // ═══════════════════════════════════════════════════════════════════
    // BSP VALIDATION
    // ═══════════════════════════════════════════════════════════════════
    
    if (!workspaceDoc.bspManaged) {
      return res.status(400).json({ 
        message: 'Workspace is not configured for WhatsApp',
        code: 'BSP_NOT_CONFIGURED',
        requiresOnboarding: true
      });
    }
    
    if (!bspConfig.isEnabled()) {
      return res.status(503).json({ 
        message: 'WhatsApp service is not configured',
        code: 'BSP_SERVICE_UNAVAILABLE'
      });
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // FETCH TEMPLATES FROM PARENT WABA
    // Filter to only templates belonging to this workspace (by prefix)
    // ═══════════════════════════════════════════════════════════════════
    
    const result = await bspMessagingService.fetchTemplates({ limit: 200 });
    
    // Get workspace ID suffix for filtering
    const workspaceIdSuffix = workspace.toString().slice(-8);
    
    let syncedCount = 0;
    let newCount = 0;
    let updatedCount = 0;
    
    for (const metaTemplate of result.templates) {
      // ═══════════════════════════════════════════════════════════════════
      // BSP TENANT ISOLATION
      // Only sync templates that belong to this workspace (by name prefix)
      // ═══════════════════════════════════════════════════════════════════
      
      // Check if this template belongs to this workspace
      const isOwnTemplate = metaTemplate.name.startsWith(`${workspaceIdSuffix}_`);
      
      // Also check for legacy templates (before BSP namespacing)
      const existingLegacy = await Template.findOne({ 
        workspace, 
        name: metaTemplate.name,
        language: metaTemplate.language
      });
      
      if (!isOwnTemplate && !existingLegacy) {
        // Skip templates that don't belong to this workspace
        continue;
      }
      
      // Extract original template name (remove namespace prefix)
      let originalName = metaTemplate.name;
      if (isOwnTemplate) {
        originalName = metaTemplate.name.replace(`${workspaceIdSuffix}_`, '');
      }
      
      // Extract preview content from components
      const headerComponent = metaTemplate.components?.find(c => c.type === 'HEADER');
      const bodyComponent = metaTemplate.components?.find(c => c.type === 'BODY');
      const footerComponent = metaTemplate.components?.find(c => c.type === 'FOOTER');
      const buttonComponents = metaTemplate.components?.filter(c => c.type === 'BUTTONS');
      
      const headerText = headerComponent?.text || headerComponent?.format || '';
      const bodyText = bodyComponent?.text || '';
      const footerText = footerComponent?.text || '';
      const buttonLabels = buttonComponents?.flatMap(bc => 
        bc.buttons?.map(b => b.text) || []
      ) || [];
      
      // Extract variables from body text
      const variableMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
      const variables = variableMatches.map(v => v.replace(/[{}]/g, ''));
      
      // Find or create local template
      let localTemplate = await Template.findOne({ 
        workspace, 
        $or: [
          { name: originalName, language: metaTemplate.language },
          { metaTemplateName: metaTemplate.name, language: metaTemplate.language }
        ]
      });
      
      const isNew = !localTemplate;
      
      if (!localTemplate) {
        localTemplate = new Template({
          workspace,
          name: originalName,
          language: metaTemplate.language,
          category: metaTemplate.category,
          components: metaTemplate.components,
          source: 'META',
          createdBy: req.user._id
        });
        newCount++;
      } else {
        updatedCount++;
      }
      
      // Update all fields from Meta
      localTemplate.status = metaTemplate.status;
      localTemplate.providerId = metaTemplate.id;
      localTemplate.metaTemplateName = metaTemplate.name; // Store the full namespaced name
      localTemplate.category = metaTemplate.category;
      localTemplate.components = metaTemplate.components;
      localTemplate.parameterFormat = metaTemplate.parameter_format || 'POSITIONAL';
      localTemplate.rejectionReason = metaTemplate.rejected_reason || null;
      localTemplate.qualityScore = metaTemplate.quality_score?.score || 'UNKNOWN';
      localTemplate.source = 'META';
      localTemplate.lastSyncedAt = new Date();
      localTemplate.submittedVia = 'BSP';
      
      // Store preview content
      localTemplate.headerText = headerText;
      localTemplate.bodyText = bodyText;
      localTemplate.footerText = footerText;
      localTemplate.buttonLabels = buttonLabels;
      localTemplate.variables = variables;
      
      if (metaTemplate.status === 'APPROVED' && !localTemplate.approvedAt) {
        localTemplate.approvedAt = new Date();
      }
      
      await localTemplate.save();
      syncedCount++;
    }
    
    res.json({
      success: true,
      message: `Synced ${syncedCount} templates (${newCount} new, ${updatedCount} updated)`,
      syncedCount,
      newCount,
      updatedCount,
      totalFromMeta: result.templates.length,
      bspFiltered: true
    });
  } catch (err) {
    next(err);
  }
}

// Get template categories with counts
async function getTemplateCategories(req, res, next) {
  try {
    const workspace = req.user.workspace;
    
    const categories = await Template.aggregate([
      { $match: { workspace: workspace } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $project: { _id: 0, name: '$_id', count: 1 } }
    ]);
    
    res.json({ categories });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createTemplate,
  listTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  submitTemplate,
  syncTemplates,
  getTemplateCategories
};
