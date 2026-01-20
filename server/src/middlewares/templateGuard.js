/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TEMPLATE USAGE GUARD MIDDLEWARE
 * Stage 2 - Task 6: Centralized template validation for all sending contexts
 * 
 * Ensures ONLY APPROVED templates can be used for:
 * - Campaign sending
 * - Auto-reply triggers
 * - Workflow automations
 * - Manual template sends
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const Template = require('../models/Template');

/**
 * Middleware to validate template is approved before use
 * Extracts template ID from:
 * - req.body.templateId
 * - req.body.template (ObjectId)
 * - req.params.templateId
 * 
 * Attaches validated template to req.approvedTemplate
 */
async function requireApprovedTemplate(req, res, next) {
  try {
    const workspaceId = req.user?.workspace;
    
    if (!workspaceId) {
      return res.status(401).json({
        success: false,
        message: 'Workspace not found in request',
        code: 'WORKSPACE_REQUIRED'
      });
    }
    
    // Extract template ID from various sources
    const templateId = req.body.templateId || req.body.template || req.params.templateId;
    
    if (!templateId) {
      return res.status(400).json({
        success: false,
        message: 'Template ID is required',
        code: 'TEMPLATE_ID_REQUIRED'
      });
    }
    
    // Use the model's static method for validation
    const template = await Template.requireApprovedTemplate(templateId, workspaceId);
    
    // Attach to request for downstream use
    req.approvedTemplate = template;
    
    next();
  } catch (error) {
    // Handle specific template errors
    if (error.code === 'TEMPLATE_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }
    
    if (error.code === 'TEMPLATE_NOT_APPROVED') {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
        templateStatus: error.templateStatus,
        templateName: error.templateName,
        helpText: getHelpTextForStatus(error.templateStatus)
      });
    }
    
    // Generic error
    console.error('[TemplateGuard] Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate template',
      code: 'TEMPLATE_VALIDATION_ERROR'
    });
  }
}

/**
 * Non-blocking validation - attaches warning instead of blocking
 * Use for read-only operations where template info is needed but approval isn't required
 */
async function validateTemplateStatus(req, res, next) {
  try {
    const workspaceId = req.user?.workspace;
    const templateId = req.body.templateId || req.body.template || req.params.templateId;
    
    if (!templateId || !workspaceId) {
      return next();
    }
    
    const template = await Template.findOne({
      _id: templateId,
      workspace: workspaceId
    });
    
    if (!template) {
      req.templateWarning = 'Template not found';
      return next();
    }
    
    req.template = template;
    
    if (template.status !== 'APPROVED') {
      req.templateWarning = `Template status is ${template.status}`;
      req.templateStatus = template.status;
    }
    
    next();
  } catch (error) {
    console.error('[TemplateGuard] Validation error:', error.message);
    next();
  }
}

/**
 * Get API endpoint to list only approved templates
 * Use in campaign/auto-reply/workflow template selection dropdowns
 */
async function getApprovedTemplatesForWorkspace(req, res, next) {
  try {
    const workspaceId = req.user?.workspace;
    
    if (!workspaceId) {
      return res.status(401).json({
        success: false,
        message: 'Workspace required',
        code: 'WORKSPACE_REQUIRED'
      });
    }
    
    const { category, language, search } = req.query;
    
    const templates = await Template.getApprovedTemplates(workspaceId, {
      category,
      language,
      search
    });
    
    res.json({
      success: true,
      templates,
      count: templates.length
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get template status counts for dashboard
 */
async function getTemplateStatusCounts(req, res, next) {
  try {
    const workspaceId = req.user?.workspace;
    
    if (!workspaceId) {
      return res.status(401).json({
        success: false,
        message: 'Workspace required'
      });
    }
    
    const counts = await Template.getStatusCounts(workspaceId);
    
    res.json({
      success: true,
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0)
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Helper to generate user-friendly help text
 */
function getHelpTextForStatus(status) {
  const helpTexts = {
    'DRAFT': 'Go to Templates → click on the template → Submit for Approval',
    'PENDING': 'Template is being reviewed by Meta. This usually takes 5-10 minutes but can take up to 24 hours.',
    'REJECTED': 'Review the rejection reason, make necessary changes, and submit again.',
    'PAUSED': 'Template was paused due to quality issues. Review the template content and contact support if needed.',
    'DISABLED': 'Template has been permanently disabled. Create a new template with updated content.',
    'LIMIT_EXCEEDED': 'Your template quality limit was exceeded. Wait 24 hours or contact support.',
    'DELETED': 'Template was deleted. Create a new template.'
  };
  
  return helpTexts[status] || 'Check template status in the Templates section.';
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  requireApprovedTemplate,
  validateTemplateStatus,
  getApprovedTemplatesForWorkspace,
  getTemplateStatusCounts,
  getHelpTextForStatus
};
