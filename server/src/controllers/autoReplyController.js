const AutoReply = require('../models/AutoReply');
const Template = require('../models/Template');
const Workspace = require('../models/Workspace');
const autoReplyService = require('../services/autoReplyService');

/**
 * Create auto-reply
 */
async function createAutoReply(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { keywords, template: templateId, matchMode = 'contains', enabled = true } = req.body;

    // Validate input
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ error: 'At least one keyword is required' });
    }

    if (keywords.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 keywords per auto-reply' });
    }

    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    // Check template exists and is approved
    const template = await Template.findOne({ _id: templateId, workspace: workspaceId });
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Template must be APPROVED. Current status: ' + template.status });
    }

    // Check plan limits
    const limitCheck = await autoReplyService.checkAutoReplyLimits(workspaceId);
    if (!limitCheck.allowed) {
      return res.status(402).json({ error: limitCheck.reason });
    }

    // Create auto-reply
    const autoReply = await AutoReply.create({
      workspace: workspaceId,
      keywords: keywords.map(k => k.trim().toLowerCase()), // Normalize keywords
      matchMode,
      template: templateId,
      templateName: template.name,
      enabled
    });

    res.status(201).json(autoReply);
  } catch (err) {
    console.error('Error creating auto-reply:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get all auto-replies for workspace
 */
async function listAutoReplies(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { enabled, template, search } = req.query;

    let query = { workspace: workspaceId };

    if (enabled !== undefined) {
      query.enabled = enabled === 'true';
    }

    if (template) {
      query.template = template;
    }

    let autoReplies = await AutoReply.find(query)
      .populate('template', 'name status category')
      .sort({ createdAt: -1 });

    // Client-side search filter
    if (search) {
      const searchLower = search.toLowerCase();
      autoReplies = autoReplies.filter(ar => 
        ar.keywords.some(k => k.includes(searchLower)) ||
        ar.templateName.toLowerCase().includes(searchLower)
      );
    }

    res.json(autoReplies);
  } catch (err) {
    console.error('Error listing auto-replies:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get single auto-reply
 */
async function getAutoReply(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { id } = req.params;

    const autoReply = await AutoReply.findOne({ _id: id, workspace: workspaceId })
      .populate('template');

    if (!autoReply) {
      return res.status(404).json({ error: 'Auto-reply not found' });
    }

    res.json(autoReply);
  } catch (err) {
    console.error('Error getting auto-reply:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Update auto-reply
 */
async function updateAutoReply(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { id } = req.params;
    const { keywords, template: templateId, matchMode, enabled } = req.body;

    // Validate input if provided
    if (keywords) {
      if (!Array.isArray(keywords) || keywords.length === 0 || keywords.length > 10) {
        return res.status(400).json({ error: 'Keywords must be 1-10 items' });
      }
    }

    // Validate template if changing
    if (templateId) {
      const template = await Template.findOne({ _id: templateId, workspace: workspaceId });
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      if (template.status !== 'APPROVED') {
        return res.status(400).json({ error: 'Template must be APPROVED' });
      }
    }

    // Build update object
    const updateData = {};
    if (keywords) {
      updateData.keywords = keywords.map(k => k.trim().toLowerCase());
    }
    if (templateId) {
      updateData.template = templateId;
      const template = await Template.findById(templateId);
      updateData.templateName = template.name;
    }
    if (matchMode) {
      updateData.matchMode = matchMode;
    }
    if (enabled !== undefined) {
      updateData.enabled = enabled;
    }

    updateData.updatedAt = new Date();

    const autoReply = await AutoReply.findOneAndUpdate(
      { _id: id, workspace: workspaceId },
      updateData,
      { new: true }
    ).populate('template');

    if (!autoReply) {
      return res.status(404).json({ error: 'Auto-reply not found' });
    }

    res.json(autoReply);
  } catch (err) {
    console.error('Error updating auto-reply:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Delete auto-reply
 */
async function deleteAutoReply(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { id } = req.params;

    const autoReply = await AutoReply.findOneAndDelete({ _id: id, workspace: workspaceId });

    if (!autoReply) {
      return res.status(404).json({ error: 'Auto-reply not found' });
    }

    res.json({ success: true, message: 'Auto-reply deleted' });
  } catch (err) {
    console.error('Error deleting auto-reply:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Toggle auto-reply enabled/disabled
 */
async function toggleAutoReply(req, res, next) {
  try {
    const workspaceId = req.user.workspace;
    const { id } = req.params;

    const autoReply = await AutoReply.findOne({ _id: id, workspace: workspaceId });
    if (!autoReply) {
      return res.status(404).json({ error: 'Auto-reply not found' });
    }

    autoReply.enabled = !autoReply.enabled;
    autoReply.updatedAt = new Date();
    await autoReply.save();

    res.json(autoReply);
  } catch (err) {
    console.error('Error toggling auto-reply:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  createAutoReply,
  listAutoReplies,
  getAutoReply,
  updateAutoReply,
  deleteAutoReply,
  toggleAutoReply
};
