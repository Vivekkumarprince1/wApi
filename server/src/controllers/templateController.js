const Template = require('../models/Template');
const Workspace = require('../models/Workspace');
const metaService = require('../services/metaService');

// Create a new template (local draft)
async function createTemplate(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { name, language, category, components, variables } = req.body;
    
    // Check if template with same name exists
    const existing = await Template.findOne({ workspace, name });
    if (existing) {
      return res.status(400).json({ message: 'Template with this name already exists' });
    }
    
    const template = await Template.create({
      workspace,
      name,
      language: language || 'en',
      category: category || 'MARKETING',
      components: components || [],
      variables: variables || [],
      status: 'DRAFT',
      createdBy: req.user._id
    });
    
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

// Get template library statistics
async function getTemplateLibraryStats(req, res, next) {
  try {
    const workspace = req.user.workspace;
    
    // Get counts by status
    const statusStats = await Template.aggregate([
      { $match: { workspace: workspace } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Get counts by category
    const categoryStats = await Template.aggregate([
      { $match: { workspace: workspace } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    
    // Get counts by source
    const sourceStats = await Template.aggregate([
      { $match: { workspace: workspace } },
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);
    
    // Total count
    const totalCount = await Template.countDocuments({ workspace });
    
    // Last sync time
    const lastSynced = await Template.findOne({ workspace, source: 'META' })
      .sort({ lastSyncedAt: -1 })
      .select('lastSyncedAt');
    
    // Count library templates
    const libraryCount = await Template.countDocuments({ workspace, source: 'META_LIBRARY' });
    
    res.json({
      total: totalCount,
      libraryCount,
      byStatus: statusStats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      byCategory: categoryStats.reduce((acc, c) => ({ ...acc, [c._id]: c.count }), {}),
      bySource: sourceStats.reduce((acc, s) => ({ ...acc, [s._id || 'LOCAL']: s.count }), {}),
      lastSyncedAt: lastSynced?.lastSyncedAt || null
    });
  } catch (err) {
    next(err);
  }
}

// Sync templates from Meta's Template Library (pre-made templates by Meta)
async function syncTemplateLibrary(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { category, language = 'en_US' } = req.query;
    const workspaceDoc = await Workspace.findById(workspace);
    
    if (!workspaceDoc.whatsappAccessToken || !workspaceDoc.wabaId) {
      return res.status(400).json({ 
        message: 'WABA credentials not configured',
        requiresSetup: true
      });
    }
    
    console.log('Fetching Template Library from Meta for WABA:', workspaceDoc.wabaId);
    
    // Fetch from Meta's Template Library
    const result = await metaService.fetchTemplateLibrary(
      workspaceDoc.whatsappAccessToken,
      workspaceDoc.wabaId,
      category,
      language
    );
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to fetch Template Library'
      });
    }
    
    if (result.source === 'NOT_AVAILABLE') {
      return res.json({
        success: true,
        message: 'Template Library API not available. Showing manual template library.',
        templates: [],
        source: 'NOT_AVAILABLE',
        alternativeMessage: 'You can browse Meta Template Library at: https://business.facebook.com/latest/whatsapp_manager/template_library'
      });
    }
    
    let syncedCount = 0;
    let newCount = 0;
    
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
      
      // Check if already exists
      let localTemplate = await Template.findOne({ 
        workspace, 
        name: metaTemplate.name,
        language: metaTemplate.language,
        source: 'META_LIBRARY'
      });
      
      if (!localTemplate) {
        localTemplate = new Template({
          workspace,
          name: metaTemplate.name,
          language: metaTemplate.language || language,
          category: metaTemplate.category,
          components: metaTemplate.components,
          source: 'META_LIBRARY',
          status: 'LIBRARY',
          createdBy: req.user._id,
          headerText,
          bodyText,
          footerText,
          buttonLabels,
          isLibraryTemplate: true,
          lastSyncedAt: new Date()
        });
        
        await localTemplate.save();
        newCount++;
      }
      
      syncedCount++;
    }
    
    res.json({
      success: true,
      message: `Synced ${newCount} new templates from Meta Template Library`,
      syncedCount,
      newCount,
      totalFromMeta: result.templates.length,
      source: result.source,
      libraryUrl: 'https://business.facebook.com/latest/whatsapp_manager/template_library'
    });
  } catch (err) {
    console.error('Error syncing Template Library:', err);
    next(err);
  }
}

// Copy a template from Meta's Template Library to your account
async function copyFromLibrary(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { libraryTemplateName, customName, language = 'en_US', category = 'UTILITY', templateData } = req.body;
    
    if (!libraryTemplateName) {
      return res.status(400).json({ message: 'Library template name is required' });
    }
    
    const workspaceDoc = await Workspace.findById(workspace);
    
    if (!workspaceDoc.whatsappAccessToken || !workspaceDoc.wabaId) {
      return res.status(400).json({ 
        message: 'WABA credentials not configured'
      });
    }
    
    // Generate a unique template name if customName not provided
    let templateName = customName || libraryTemplateName;
    
    // Check if template with this name already exists locally
    const existingLocal = await Template.findOne({ 
      workspace, 
      name: templateName 
    });
    
    if (existingLocal) {
      // Template exists locally, return it
      return res.json({
        success: true,
        message: 'Template already exists in your workspace',
        template: existingLocal,
        alreadyExists: true
      });
    }
    
    // Try to copy from Meta's Template Library (with fallback to direct creation)
    let result;
    try {
      result = await metaService.copyFromTemplateLibrary(
        workspaceDoc.whatsappAccessToken,
        workspaceDoc.wabaId,
        libraryTemplateName,
        templateName,
        language,
        category,
        templateData  // Pass template data for fallback creation
      );
    } catch (metaError) {
      // Check if error is "template already exists in Meta"
      const errorMsg = metaError.message || '';
      if (errorMsg.includes('already') || errorMsg.includes('Content in this language')) {
        // Template exists in Meta but not locally, try to fetch and sync it
        console.log('Template exists in Meta, attempting to sync...');
        
        // Fetch all templates from Meta and find the matching one
        const templates = await metaService.fetchTemplates(
          workspaceDoc.whatsappAccessToken,
          workspaceDoc.wabaId
        );
        
        const matchingTemplate = templates.find(t => t.name === templateName);
        
        if (matchingTemplate) {
          // Create local record from the existing Meta template
          const template = new Template({
            workspace,
            name: matchingTemplate.name,
            language: matchingTemplate.language,
            category: matchingTemplate.category,
            source: 'META',
            status: matchingTemplate.status,
            providerId: matchingTemplate.id,
            components: matchingTemplate.components,
            createdBy: req.user._id,
            lastSyncedAt: new Date()
          });
          await template.save();
          
          return res.json({
            success: true,
            message: 'Template already exists in Meta, synced to your workspace',
            template,
            alreadyExistsInMeta: true
          });
        }
        
        // If not found, try with a unique suffix
        templateName = `${templateName}_${Date.now().toString().slice(-6)}`;
        console.log(`Retrying with unique name: ${templateName}`);
        
        result = await metaService.copyFromTemplateLibrary(
          workspaceDoc.whatsappAccessToken,
          workspaceDoc.wabaId,
          libraryTemplateName,
          templateName,
          language,
          category,
          templateData
        );
      } else {
        throw metaError;
      }
    }
    
    if (result.success) {
      // Create local record with template content
      const templateRecord = {
        workspace,
        name: templateName,  // Use the potentially modified unique name
        language: language,
        category: category,
        source: 'META_LIBRARY_COPY',  // All library copies use this source
        status: result.status || 'PENDING',
        providerId: result.templateId,
        createdBy: req.user._id,
        copiedFrom: libraryTemplateName,
        isLibraryTemplate: false  // It's a copy, not a library template
      };
      
      // Add template content if available
      if (templateData) {
        templateRecord.headerText = templateData.headerText;
        templateRecord.bodyText = templateData.bodyText || templateData.body;
        templateRecord.footerText = templateData.footerText;
        templateRecord.buttonLabels = templateData.buttonLabels;
        templateRecord.variables = templateData.variables;
      }
      
      const template = new Template(templateRecord);
      await template.save();
      
      res.json({
        success: true,
        message: `Template created from ${result.source === 'META_LIBRARY' ? 'Meta Library' : 'built-in templates'} and submitted for approval`,
        template,
        metaResponse: result.data,
        source: result.source
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to copy template from library'
      });
    }
  } catch (err) {
    console.error('Error copying from library:', err);
    next(err);
  }
}

// Get list of predefined template library templates
async function getHardcodedLibraryTemplates(req, res, next) {
  try {
    const { category } = req.query;
    const workspace = req.user.workspace;
    const workspaceDoc = await Workspace.findById(workspace);
    
    // Try to fetch from Meta API first, fallback to built-in templates
    let result;
    if (workspaceDoc?.whatsappAccessToken && workspaceDoc?.wabaId) {
      result = await metaService.fetchTemplateLibrary(
        workspaceDoc.whatsappAccessToken,
        workspaceDoc.wabaId,
        category,
        'en_US'
      );
    } else {
      // Use built-in templates if no credentials
      result = metaService.getBuiltInTemplateLibrary 
        ? metaService.getBuiltInTemplateLibrary(category, 'en_US')
        : { success: true, templates: [], categories: {} };
    }
    
    res.json({
      success: true,
      templates: result.templates || [],
      total: result.total || result.templates?.length || 0,
      categories: result.categories || {
        UTILITY: 0,
        AUTHENTICATION: 0,
        MARKETING: 0
      },
      source: result.source || 'BUILT_IN'
    });
  } catch (err) {
    console.error('Error fetching template library:', err);
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
  syncTemplateLibrary,
  copyFromLibrary,
  getHardcodedLibraryTemplates,
  getTemplateCategories,
  getTemplateLibraryStats
};
