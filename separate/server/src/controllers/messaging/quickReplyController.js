const { QuickReply } = require('../../models');

/**
 * Get all quick replies for workspace
 * GET /api/quick-replies
 */
exports.getQuickReplies = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const quickReplies = await QuickReply.find({ workspace: workspaceId, isActive: true })
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      data: quickReplies
    });
  } catch (err) {
    console.error('[QuickReply] Get error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch quick replies' });
  }
};

/**
 * Create a quick reply
 * POST /api/quick-replies
 */
exports.createQuickReply = async (req, res) => {
  try {
    const workspaceId = req.user.workspace;
    const { name, content, shortcut, variables, mediaUrl, mediaType } = req.body;

    if (!name || !content) {
      return res.status(400).json({ success: false, message: 'Name and content are required' });
    }

    const quickReply = await QuickReply.create({
      workspace: workspaceId,
      name,
      content,
      shortcut,
      variables,
      mediaUrl,
      mediaType,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      data: quickReply
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Quick reply with this name already exists' });
    }
    console.error('[QuickReply] Create error:', err);
    res.status(500).json({ success: false, message: 'Failed to create quick reply' });
  }
};

/**
 * Update a quick reply
 * PUT /api/quick-replies/:id
 */
exports.updateQuickReply = async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user.workspace;

    const quickReply = await QuickReply.findOneAndUpdate(
      { _id: id, workspace: workspaceId },
      req.body,
      { new: true }
    );

    if (!quickReply) {
      return res.status(404).json({ success: false, message: 'Quick reply not found' });
    }

    res.json({
      success: true,
      data: quickReply
    });
  } catch (err) {
    console.error('[QuickReply] Update error:', err);
    res.status(500).json({ success: false, message: 'Failed to update quick reply' });
  }
};

/**
 * Delete a quick reply
 * DELETE /api/quick-replies/:id
 */
exports.deleteQuickReply = async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user.workspace;

    const quickReply = await QuickReply.findOneAndDelete({ _id: id, workspace: workspaceId });

    if (!quickReply) {
      return res.status(404).json({ success: false, message: 'Quick reply not found' });
    }

    res.json({
      success: true,
      message: 'Quick reply deleted'
    });
  } catch (err) {
    console.error('[QuickReply] Delete error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete quick reply' });
  }
};
