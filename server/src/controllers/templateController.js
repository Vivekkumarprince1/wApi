const Template = require('../models/Template');
const Workspace = require('../models/Workspace');
const metaService = require('../services/metaService');

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

// Delete template
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
      
      if (workspaceDoc.whatsappAccessToken && workspaceDoc.wabaId) {
        try {
          await metaService.deleteTemplate(
            workspaceDoc.whatsappAccessToken,
            workspaceDoc.wabaId,
            template.name
          );
        } catch (metaError) {
          console.error('Failed to delete from Meta:', metaError.message);
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

// Submit template to Meta for approval
async function submitTemplate(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const template = await Template.findOne({ _id: req.params.id, workspace });
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    const workspaceDoc = await Workspace.findById(workspace);
    
    if (!workspaceDoc.whatsappAccessToken || !workspaceDoc.wabaId) {
      return res.status(400).json({ 
        message: 'WABA credentials not configured. Please configure in Settings first.',
        requiresSetup: true
      });
    }
    
    // Map category to valid Meta category
    const validCategory = Template.getValidMetaCategory(template.category);
    
    try {
      const result = await metaService.submitTemplate(
        workspaceDoc.whatsappAccessToken,
        workspaceDoc.wabaId,
        {
          name: template.name,
          language: template.language,
          category: validCategory,
          components: template.components
        }
      );
      
      template.status = 'PENDING';
      template.providerId = result.templateId;
      template.submittedAt = new Date();
      await template.save();
      
      // Increment workspace usage
      workspaceDoc.usage.templatesCreated += 1;
      await workspaceDoc.save();
      
      res.json({ 
        success: true,
        message: 'Template submitted to Meta for approval',
        template 
      });
    } catch (metaError) {
      if (metaError.message === 'REQUIRES_BUSINESS_MANAGER') {
        return res.status(403).json({
          success: false,
          message: 'Template submission requires Business Manager. Please submit manually.',
          businessManagerUrl: `https://business.facebook.com/wa/manage/message-templates/`,
          requiresManualSubmission: true
        });
      }
      
      throw metaError;
    }
  } catch (err) {
    next(err);
  }
}

// Sync templates from Meta
async function syncTemplates(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const workspaceDoc = await Workspace.findById(workspace);
    
    if (!workspaceDoc.whatsappAccessToken || !workspaceDoc.wabaId) {
      return res.status(400).json({ 
        message: 'WABA credentials not configured',
        requiresSetup: true
      });
    }
    
    const result = await metaService.fetchTemplates(
      workspaceDoc.whatsappAccessToken,
      workspaceDoc.wabaId
    );
    
    let syncedCount = 0;
    let newCount = 0;
    let updatedCount = 0;
    
    for (const metaTemplate of result.templates) {
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
      
      // Extract variables from body text ({{1}}, {{2}}, etc.)
      const variableMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
      const variables = variableMatches.map(v => v.replace(/[{}]/g, ''));
      
      // Find or create local template
      let localTemplate = await Template.findOne({ 
        workspace, 
        name: metaTemplate.name,
        language: metaTemplate.language
      });
      
      const isNew = !localTemplate;
      
      if (!localTemplate) {
        localTemplate = new Template({
          workspace,
          name: metaTemplate.name,
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
      localTemplate.category = metaTemplate.category;
      localTemplate.components = metaTemplate.components;
      localTemplate.parameterFormat = metaTemplate.parameter_format || 'POSITIONAL';
      localTemplate.rejectionReason = metaTemplate.rejected_reason || null;
      localTemplate.qualityScore = metaTemplate.quality_score?.score || 'UNKNOWN';
      localTemplate.source = 'META';
      localTemplate.lastSyncedAt = new Date();
      
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
      totalFromMeta: result.templates.length
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
